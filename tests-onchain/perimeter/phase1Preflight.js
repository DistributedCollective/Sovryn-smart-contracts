/**
 * Brings a fork to "Phase 1 executed" doing only what the chain still lacks.
 *
 * This module is the seam between the live Phase 1 release and the Phase 2
 * rehearsal. Once Phase 1 is executed on mainnet every branch below resolves
 * to "skipped", at which point the module and its call sites are deleted.
 *
 * Each part is found by the actions it carries, never by a proposal id, and is
 * then walked through real governance — real stakers, real votes, real queue
 * and execute. Nothing is written to vote storage.
 */
const { ethers, deployments, network } = require("hardhat");
const { createAndQueueSip, executeQueuedSip } = require("./perimeterSipTestHelpers");
const forkOps = require("./forkOps");

const STATE = {
    Pending: 0,
    Active: 1,
    Canceled: 2,
    Defeated: 3,
    Succeeded: 4,
    Queued: 5,
    Expired: 6,
    Executed: 7,
};
const BO_PROXY = "0x5B9dB4B8bdeF3e57323187a9AC2639C5DEe5FD39";
const LOOKBACK = 20;
const MAX_WHALES = 60;
/** The staker search walks back one window at a time and stops as soon as the
 *  addresses it has found could carry the vote, so a fork that only needs a
 *  couple of whales pays for a couple of windows. */
const STAKER_WINDOW = 200000;
const STAKER_MAX_LOOKBACK = 1000000;
/** The upstream archive node refuses an eth_getLogs range wider than this. */
const LOG_RANGE = 10000;
/** Mining the whole voting period in one call can outlast the RPC timeout. */
const MINE_CHUNK = 5000;

const abiCoder = new ethers.utils.AbiCoder();

const stakingEvents = new ethers.utils.Interface([
    "event TokensStaked(address indexed staker, uint256 amount, uint256 lockedUntil, uint256 totalStaked)",
    "event DelegateChanged(address indexed delegator, uint256 lockedUntil, address indexed fromDelegate, address indexed toDelegate)",
]);
const TOKENS_STAKED_TOPIC = stakingEvents.getEventTopic("TokensStaked");
const DELEGATE_CHANGED_TOPIC = stakingEvents.getEventTopic("DelegateChanged");

const rpc = () => new ethers.providers.JsonRpcProvider(network.config.url);

const addressFromTopic = (topic) => ethers.utils.getAddress("0x" + topic.slice(26));

/** Mine `blocks` blocks, in chunks the node can answer within its timeout. */
const mineBlocks = async (blocks) => {
    const provider = rpc();
    let left = blocks;
    while (left > 0) {
        const step = Math.min(left, MINE_CHUNK);
        await forkOps.mine(provider, step);
        left -= step;
    }
};

/** Newest proposal whose action list contains every signature in `signatures`
 *  (and, when given, every `targets` address) and satisfies `matches`. Null
 *  when none of the last LOOKBACK proposals qualifies. */
const findProposalByActions = async (governor, signatures, targets = [], matches = null) => {
    const count = Number(await governor.proposalCount());
    for (let id = count; id > Math.max(0, count - LOOKBACK); id--) {
        const [tgts, values, sigs, datas] = await governor.getActions(id);
        const lowerTargets = tgts.map((t) => t.toLowerCase());
        const hasSigs = signatures.every((s) => sigs.includes(s));
        const hasTargets = targets.every((t) => lowerTargets.includes(t.toLowerCase()));
        if (!hasSigs || !hasTargets) continue;
        if (matches && !matches({ targets: tgts, values, signatures: sigs, datas })) continue;
        return id;
    }
    return null;
};

/** True when the action list carries `signature` on `target` — the pair, not
 *  the two independently. A proposal that touches the same address for another
 *  reason, or runs the same signature against a different address, does not
 *  count. */
const hasAction = (actions, signature, target) =>
    actions.signatures.some(
        (candidate, i) =>
            candidate === signature && actions.targets[i].toLowerCase() === target.toLowerCase()
    );

/** The Succeeded predicate of GovernorAlpha.state, evaluated off chain: the
 *  proposal carries its own quorum snapshot, while the majority share is a
 *  governor-wide setting. */
const winsTheVote = (forVotes, againstVotes, quorum, majorityPercentage) => {
    const totalVotes = forVotes.add(againstVotes);
    const majority = totalVotes.div(100).mul(majorityPercentage);
    return forVotes.gt(majority) && totalVotes.gte(quorum);
};

/** Addresses that staked or were delegated to in the recent past — the pool
 *  from which voting power at a past block can still be found. */
const collectStakerCandidates = async (stakingAddress, fromBlock, toBlock) => {
    const candidates = new Set();
    for (let from = fromBlock; from <= toBlock; from += LOG_RANGE) {
        const to = Math.min(from + LOG_RANGE - 1, toBlock);
        let logs;
        for (let attempt = 0; ; attempt++) {
            try {
                logs = await ethers.provider.getLogs({
                    address: stakingAddress,
                    topics: [[TOKENS_STAKED_TOPIC, DELEGATE_CHANGED_TOPIC]],
                    fromBlock: from,
                    toBlock: to,
                });
                break;
            } catch (error) {
                if (attempt >= 2) throw error;
            }
        }
        for (const log of logs) {
            if (log.topics[0] === TOKENS_STAKED_TOPIC) {
                candidates.add(addressFromTopic(log.topics[1]));
            } else {
                candidates.add(addressFromTopic(log.topics[3]));
            }
        }
    }
    return [...candidates];
};

/** Cast FOR votes from real stakers (impersonated) until the proposal would
 *  succeed. Returns how many stakers had to vote — zero when the votes already
 *  on the proposal carry it, which is the case for a proposal that has been
 *  open on mainnet for a while. */
const voteWithStakers = async (ctx, governor, proposalId) => {
    const proposal = await governor.proposals(proposalId);
    const majorityPercentage = await governor.majorityPercentageVotes();
    const wins = (forVotes) =>
        winsTheVote(forVotes, proposal.againstVotes, proposal.quorum, majorityPercentage);
    if (wins(proposal.forVotes)) return 0;

    const provider = rpc();
    const { staking } = ctx;
    const latest = await ethers.provider.getBlockNumber();
    const floor = Math.max(0, latest - STAKER_MAX_LOOKBACK);
    const seen = new Set();
    const ranked = [];
    for (let top = latest; top >= floor; ) {
        const from = Math.max(floor, top - STAKER_WINDOW + 1);
        for (const address of await collectStakerCandidates(staking.address, from, top)) {
            if (seen.has(address)) continue;
            seen.add(address);
            if ((await governor.getReceipt(proposalId, address)).hasVoted) continue;
            const votes = await staking.getPriorVotes(
                address,
                proposal.startBlock,
                proposal.startTime
            );
            if (votes.gt(0)) ranked.push({ address, votes });
        }
        ranked.sort((a, b) => (b.votes.gt(a.votes) ? 1 : -1));
        const reachable = ranked
            .slice(0, MAX_WHALES)
            .reduce((sum, candidate) => sum.add(candidate.votes), proposal.forVotes);
        if (wins(reachable)) break;
        if (from === floor) break;
        top = from - 1;
    }

    let forVotes = proposal.forVotes;
    let used = 0;
    for (const { address, votes } of ranked) {
        if (used >= MAX_WHALES) break;
        const signer = await forkOps.impersonate(provider, address);
        await (await governor.connect(signer).castVote(proposalId, true)).wait();
        forVotes = forVotes.add(votes);
        used++;
        if (wins(forVotes)) return used;
    }
    throw new Error(
        `preflight: ${used} of ${ranked.length} stakers found in ${latest - floor} blocks took ` +
            `proposal ${proposalId} to ${forVotes.toString()} for / ` +
            `${proposal.againstVotes.toString()} against, short of a quorum of ` +
            `${proposal.quorum.toString()} at a ${majorityPercentage.toString()}% majority; ` +
            "fork block too early?"
    );
};

/** Walk one already-created proposal to Executed and name what that took. */
const finishProposal = async (ctx, governorKey, proposalId) => {
    const governor = ctx[governorKey];
    const state = Number(await governor.state(proposalId));
    if (state === STATE.Executed) return "skipped";
    if ([STATE.Canceled, STATE.Defeated, STATE.Expired].includes(state)) {
        throw new Error(
            `preflight: proposal ${proposalId} on ${governorKey} is in terminal state ${state}`
        );
    }
    let action = "executed";
    if (state === STATE.Pending || state === STATE.Active) {
        const proposal = await governor.proposals(proposalId);
        const beforeVoting = await ethers.provider.getBlockNumber();
        await mineBlocks(Math.max(0, Number(proposal.startBlock) + 1 - beforeVoting));
        await voteWithStakers(ctx, governor, proposalId);
        const afterVoting = await ethers.provider.getBlockNumber();
        await mineBlocks(Math.max(0, Number(proposal.endBlock) + 1 - afterVoting));
        action = "voted-queued-executed";
    }
    if (Number(await governor.state(proposalId)) === STATE.Succeeded) {
        await (await governor.queue(proposalId)).wait();
    }
    await executeQueuedSip(ctx, proposalId, governorKey);
    return action;
};

/** Point the CommunityIssuance at a settable local price feed, using its own
 *  owner — the authority that would rotate a feed in production. setAPR
 *  settles the accrued subsidy first, pricing ZUSD in SOV through that feed,
 *  and the governance clock jumps push the production MoC-backed feed past
 *  expiry. The swap stays in place: anything that triggers issuance later on
 *  the same fork needs a feed that does not expire either. */
const useSettableCommunityIssuanceFeed = async (ctx) => {
    const { deployerSigner } = ctx;
    const communityIssuance = await ethers.getContract("ZeroCommunityIssuance", deployerSigner);
    const localFeeds = await (
        await ethers.getContractFactory("PriceFeedsLocal", deployerSigner)
    ).deploy((await deployments.get("WRBTC")).address, (await deployments.get("SOV")).address);
    await localFeeds.deployed();
    const feedOwner = await forkOps.impersonate(rpc(), await communityIssuance.getOwner());
    await (await communityIssuance.connect(feedOwner).setPriceFeed(localFeeds.address)).wait();
};

/** Finish an existing proposal, or create and execute it when the chain has
 *  none matching. */
const settlePart = async (ctx, governorKey, proposalId, argsFunc) => {
    if (proposalId === null) {
        const created = await createAndQueueSip(ctx, argsFunc, governorKey);
        const id = Number(created.proposalId);
        await executeQueuedSip(ctx, id, governorKey);
        return { proposalId: id, governor: governorKey, action: "created-and-executed" };
    }
    return {
        proposalId,
        governor: governorKey,
        action: await finishProposal(ctx, governorKey, proposalId),
    };
};

const ensurePhase1Executed = async (ctx) => {
    const result = {};

    // Part 1: owner-side wiring. Neither half identifies it alone — the part
    // swaps implementations on two different proxies, and re-registering a
    // beacon module is ordinary maintenance — so it is the beacon
    // registrations AND the BorrowerOperations swap together, each pinned to
    // the address it must run against.
    const beacons = [
        (await deployments.get("LoanTokenLogicBeaconLM")).address,
        (await deployments.get("LoanTokenLogicBeaconWrbtc")).address,
    ];
    const rewiresBothBeaconsAndTheProxy = (actions) =>
        hasAction(actions, "setImplementation(address)", BO_PROXY) &&
        beacons.every((beacon) => hasAction(actions, "registerLoanTokenModule(address)", beacon));
    const part1Id = await findProposalByActions(
        ctx.governorOwner,
        ["setImplementation(address)", "registerLoanTokenModule(address)"],
        [BO_PROXY, ...beacons],
        rewiresBothBeaconsAndTheProxy
    );
    result.part1 = await settlePart(ctx, "governorOwner", part1Id, "getArgsSip0094Part1");

    // Part 2: the activation pointer on the protocol. Must follow Part 1 —
    // the selector it routes through is registered by Part 1's execution.
    // Part 1 runs the same signature against a different proxy and touches the
    // protocol for other reasons, so the pair is what tells them apart.
    const protocolAddress = (await deployments.get("SovrynProtocol")).address;
    const part2Id = await findProposalByActions(
        ctx.governorOwner,
        ["setExitFeeController(address)"],
        [protocolAddress],
        (actions) => hasAction(actions, "setExitFeeController(address)", protocolAddress)
    );
    result.part2 = await settlePart(ctx, "governorOwner", part2Id, "getArgsSip0094Part2");

    // Part 3: admin-side subsidy rate to zero on the CommunityIssuance.
    const communityIssuanceAddress = (await deployments.get("ZeroCommunityIssuance")).address;
    const zeroesTheRate = (actions) =>
        hasAction(actions, "setAPR(uint256)", communityIssuanceAddress) &&
        actions.signatures.some(
            (signature, i) =>
                signature === "setAPR(uint256)" &&
                abiCoder.decode(["uint256"], actions.datas[i])[0].isZero()
        );
    const part3Id = await findProposalByActions(
        ctx.governorAdmin,
        ["setAPR(uint256)"],
        [communityIssuanceAddress],
        zeroesTheRate
    );
    const part3Done =
        part3Id !== null && Number(await ctx.governorAdmin.state(part3Id)) === STATE.Executed;
    if (!part3Done) await useSettableCommunityIssuanceFeed(ctx);
    result.part3 = await settlePart(ctx, "governorAdmin", part3Id, "getArgsSip0094Part3");

    return result;
};

module.exports = {
    ensurePhase1Executed,
    findProposalByActions,
    hasAction,
    finishProposal,
    collectStakerCandidates,
    winsTheVote,
    STATE,
};
