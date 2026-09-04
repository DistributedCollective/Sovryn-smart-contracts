/**
 * Phase 1 preflight — replay the real vote.
 *
 * `ensurePhase1Executed` normally buys a stuck proposal's way to Succeeded with
 * impersonated whale stakers (`voteWithStakers` in ./phase1Preflight.js). This
 * test proves the same three proposals can instead be carried by the actual
 * Bitocracy vote: every real `VoteCast` is read from the live chain and
 * replayed on the fork through the same voters, and only once that alone has
 * carried each proposal past its voting window is `ensurePhase1Executed`
 * called — at which point its whale-staker branch has nothing left to do and
 * is never entered.
 *
 * PERIMETER_FORK_BLOCK has to name a block after all three proposals exist
 * and are already Active, but before anyone cast a real vote on any of them —
 * otherwise a replayed vote reverts as a double vote. To find it: read
 * `ProposalCreated` for GovernorOwner and GovernorAdmin on the live RPC
 * (PERIMETER_LIVE_RPC, default https://mainnet-dev.sovryn.app/rpc) for the
 * three Phase 1 proposals, take the highest of their `startBlock` fields and
 * add one — that is the first block at which all three read Active — then
 * confirm it is still before the earliest `VoteCast` for any of the three
 * (same RPC, `VoteCast` over each proposal's own startBlock..endBlock).
 *
 * Boot a QA fork at that block and run this file against it:
 *     PERIMETER_QA_PORT=8547 PERIMETER_FORK_BLOCK=<that block> \
 *         scripts/perimeter/qa-node.sh --detach
 *     __decryptionAlreadyDone__=TRUE PERIMETER_FORK_BLOCK=<that block> \
 *         PERIMETER_QA_RPC=http://127.0.0.1:8547 npx hardhat test \
 *         tests-onchain/perimeter/phase1Preflight.voters.test.js \
 *         --network rskForkedMainnetQa
 *     scripts/perimeter/qa-node.sh --stop
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments, network } = hre;
const { setupGovernanceContext, forkOps } = require("./perimeterSipTestHelpers");
const {
    ensurePhase1Executed,
    findProposalByActions,
    hasAction,
    rewiresLendingAndZero,
    retiresTheSubsidy,
    STATE,
} = require("./phase1Preflight");
const { assertLocalQaFork } = require("./qa/bootstrap");

// The Zero BorrowerOperations proxy Part 1 pins its controller against —
// mirrors the constant ./phase1Preflight.js keeps private to itself.
const BO_PROXY = "0x5B9dB4B8bdeF3e57323187a9AC2639C5DEe5FD39";

const LIVE_RPC = process.env.PERIMETER_LIVE_RPC || "https://mainnet-dev.sovryn.app/rpc";
// The upstream archive node refuses an eth_getLogs range wider than this.
const LOG_RANGE = 9000;
// Mining the whole gap to endBlock in one call can outlast the RPC timeout.
const MINE_CHUNK = 5000;

const liveProvider = () => new ethers.providers.JsonRpcProvider(LIVE_RPC);
const forkProvider = () => new ethers.providers.JsonRpcProvider(network.config.url);

/** Find the three live Phase 1 proposals exactly the way ensurePhase1Executed
 *  does internally, without touching governance — only to know which ids to
 *  read the real vote history for. */
const discoverParts = async (ctx) => {
    const beacons = [
        (await deployments.get("LoanTokenLogicBeaconLM")).address,
        (await deployments.get("LoanTokenLogicBeaconWrbtc")).address,
    ];
    const part1Id = await findProposalByActions(
        ctx.governorOwner,
        [
            "registerLoanTokenModule(address)",
            "setImplementation(address)",
            "setExitFeeController(address)",
        ],
        [BO_PROXY, ...beacons],
        (actions) => rewiresLendingAndZero(actions, beacons)
    );

    const protocolAddress = (await deployments.get("SovrynProtocol")).address;
    const part2Id = await findProposalByActions(
        ctx.governorOwner,
        ["setExitFeeController(address)"],
        [protocolAddress],
        (actions) => hasAction(actions, "setExitFeeController(address)", protocolAddress)
    );

    const communityIssuanceAddress = (await deployments.get("ZeroCommunityIssuance")).address;
    const part3Id = await findProposalByActions(
        ctx.governorAdmin,
        ["setAPR(uint256)"],
        [communityIssuanceAddress],
        (actions) => retiresTheSubsidy(actions, communityIssuanceAddress)
    );

    return [
        { label: "part1", governorKey: "governorOwner", proposalId: part1Id },
        { label: "part2", governorKey: "governorOwner", proposalId: part2Id },
        { label: "part3", governorKey: "governorAdmin", proposalId: part3Id },
    ];
};

/** Every VoteCast the live chain recorded for `proposalId` on `governorAddress`,
 *  between `fromBlock` and `toBlock` inclusive. VoteCast carries no indexed
 *  fields, so the log filter can only narrow by contract and event signature —
 *  the proposal id itself is matched after decoding. */
const fetchLiveVotes = async (iface, governorAddress, proposalId, fromBlock, toBlock) => {
    const provider = liveProvider();
    const topic = iface.getEventTopic("VoteCast");
    const votes = [];
    for (let start = fromBlock; start <= toBlock; start += LOG_RANGE) {
        const end = Math.min(start + LOG_RANGE - 1, toBlock);
        const logs = await provider.getLogs({
            address: governorAddress,
            topics: [topic],
            fromBlock: start,
            toBlock: end,
        });
        for (const log of logs) {
            const parsed = iface.parseLog(log);
            if (!parsed.args.proposalId.eq(proposalId)) continue;
            votes.push({
                voter: parsed.args.voter,
                support: parsed.args.support,
                votes: parsed.args.votes,
            });
        }
    }
    return votes;
};

/** Mine `blocks` blocks, in chunks the node can answer within its timeout. */
const mineBlocks = async (provider, blocks) => {
    let left = blocks;
    while (left > 0) {
        const step = Math.min(left, MINE_CHUNK);
        await forkOps.mine(provider, step);
        left -= step;
    }
};

const sumVotes = (votes, support) =>
    votes
        .filter((vote) => vote.support === support)
        .reduce((total, vote) => total.add(vote.votes), ethers.BigNumber.from(0));

describe("Phase 1 preflight — real voters", () => {
    it("carries all three proposals on the replayed live vote alone", async () => {
        if (!process.env.PERIMETER_FORK_BLOCK) {
            throw new Error(
                "PERIMETER_FORK_BLOCK is not set — this test only means something forked at a " +
                    "specific block; see the header comment for how to find it"
            );
        }
        // The QA guard: refuses to send anything anywhere but a local fork
        // tagged "qa" reporting chain id 30. Checked before any impersonation
        // or transaction below.
        await assertLocalQaFork(hre);

        const ctx = await setupGovernanceContext();
        const parts = await discoverParts(ctx);
        for (const part of parts) {
            expect(
                part.proposalId,
                `${part.label} must be discoverable on this fork`
            ).to.not.equal(null);
        }

        const governorAlphaArtifact = await hre.artifacts.readArtifact("GovernorAlpha");
        const liveInterface = new ethers.utils.Interface(governorAlphaArtifact.abi);
        const provider = forkProvider();

        let maxEndBlock = 0;
        const summary = [];
        for (const part of parts) {
            const governor = ctx[part.governorKey];
            expect(
                Number(await governor.state(part.proposalId)),
                `${part.label} must be Active at the fork block`
            ).to.equal(STATE.Active);

            const proposal = await governor.proposals(part.proposalId);
            const liveGovernor = new ethers.Contract(
                governor.address,
                governorAlphaArtifact.abi,
                liveProvider()
            );
            const liveProposal = await liveGovernor.proposals(part.proposalId);
            const liveVotes = await fetchLiveVotes(
                liveInterface,
                governor.address,
                part.proposalId,
                Number(proposal.startBlock),
                Number(proposal.endBlock)
            );
            expect(liveVotes.length, `${part.label} must have a real vote to replay`).to.be.above(
                0
            );

            for (const { voter, support } of liveVotes) {
                const signer = await forkOps.impersonate(provider, voter);
                await (await governor.connect(signer).castVote(part.proposalId, support)).wait();
            }

            const afterVoting = await governor.proposals(part.proposalId);
            const forSum = sumVotes(liveVotes, true);
            const againstSum = sumVotes(liveVotes, false);
            expect(
                afterVoting.forVotes.toString(),
                `${part.label} forVotes must equal the replayed votes' own total`
            ).to.equal(forSum.toString());
            expect(
                afterVoting.againstVotes.toString(),
                `${part.label} againstVotes must equal the replayed votes' own total`
            ).to.equal(againstSum.toString());
            expect(
                afterVoting.forVotes.toString(),
                `${part.label} forVotes must equal the live chain's tally`
            ).to.equal(liveProposal.forVotes.toString());
            expect(
                afterVoting.againstVotes.toString(),
                `${part.label} againstVotes must equal the live chain's tally`
            ).to.equal(liveProposal.againstVotes.toString());

            maxEndBlock = Math.max(maxEndBlock, Number(proposal.endBlock));
            summary.push({
                label: part.label,
                voters: liveVotes.length,
                forVotes: afterVoting.forVotes.toString(),
                againstVotes: afterVoting.againstVotes.toString(),
            });
        }

        const beforeAdvance = await ethers.provider.getBlockNumber();
        await mineBlocks(provider, Math.max(0, maxEndBlock + 1 - beforeAdvance));

        const tallyAfterVoting = {};
        for (const part of parts) {
            const governor = ctx[part.governorKey];
            expect(
                Number(await governor.state(part.proposalId)),
                `${part.label} must have Succeeded on the replayed votes alone, with no ` +
                    "further voting"
            ).to.equal(STATE.Succeeded);
            const proposal = await governor.proposals(part.proposalId);
            tallyAfterVoting[part.label] = {
                forVotes: proposal.forVotes.toString(),
                againstVotes: proposal.againstVotes.toString(),
            };
        }

        expect(
            ctx.whaleStaked,
            "no synthetic whale stake exists before ensurePhase1Executed runs"
        ).to.not.equal(true);

        const result = await ensurePhase1Executed(ctx);

        expect(
            ctx.whaleStaked,
            "ensurePhase1Executed must not mint whale stake once the live vote already " +
                "carried every proposal"
        ).to.not.equal(true);

        for (const part of parts) {
            expect(
                result[part.label].action,
                `${part.label} must skip the whale-staker voting branch entirely`
            ).to.equal("executed");

            const governor = ctx[part.governorKey];
            expect(
                Number(await governor.state(part.proposalId)),
                `${part.label} must be Executed`
            ).to.equal(STATE.Executed);

            const proposal = await governor.proposals(part.proposalId);
            expect(
                proposal.forVotes.toString(),
                `${part.label} forVotes must not have moved since the replayed vote`
            ).to.equal(tallyAfterVoting[part.label].forVotes);
            expect(
                proposal.againstVotes.toString(),
                `${part.label} againstVotes must not have moved since the replayed vote`
            ).to.equal(tallyAfterVoting[part.label].againstVotes);
        }

        console.log(
            "        preflight (real voters):",
            summary
                .map(
                    (s) =>
                        `${s.label} ${s.voters} voters, ${s.forVotes} for / ${s.againstVotes} against`
                )
                .join(", ")
        );
    });
});
