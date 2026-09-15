/**
 * The SIP-0094 proposals as the fork rehearsals see them: found by the actions
 * they carry, never by a proposal id, and required to be executed before the
 * delay release is rehearsed on top of them.
 *
 * `findProposalByActions` and `hasAction` are generic over any GovernorAlpha
 * proposal and are what the delay proposals are discovered with too.
 */
const { ethers, deployments, network } = require("hardhat");
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
/** The same names the governor's own enum carries, for anything that has to
 *  write down which one a proposal was found in. */
const STATE_NAMES = Object.keys(STATE);
const BO_PROXY = "0x5B9dB4B8bdeF3e57323187a9AC2639C5DEe5FD39";
const LOOKBACK = 20;

const abiCoder = new ethers.utils.AbiCoder();

const rpc = () => new ethers.providers.JsonRpcProvider(network.config.url);

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

/** True when ONE action carries `signature` against `target`, and — when
 *  `dataMatches` is given — carries calldata that predicate accepts. Every
 *  clause is judged on the same action index on purpose: a proposal that
 *  touches the address for another reason, runs the signature against a
 *  different address, or puts the interesting argument on a different action
 *  does not count. */
const hasAction = (actions, signature, target, dataMatches = null) =>
    actions.signatures.some(
        (candidate, i) =>
            candidate === signature &&
            actions.targets[i].toLowerCase() === target.toLowerCase() &&
            (dataMatches === null || dataMatches(actions.datas[i]))
    );

/** SIP-0094 Part 1's shape: the two beacon module registrations, the
 *  BorrowerOperations implementation swap, and that proxy's own controller
 *  pin. The registrations alone are ordinary maintenance and the delay
 *  release emits them too; the controller pin against the same proxy is what
 *  only this part carries. */
const rewiresLendingAndZero = (actions, beacons) =>
    beacons.every((beacon) => hasAction(actions, "registerLoanTokenModule(address)", beacon)) &&
    hasAction(actions, "setImplementation(address)", BO_PROXY) &&
    hasAction(actions, "setExitFeeController(address)", BO_PROXY);

/** SIP-0094 Part 3's shape: one action that sets the rate to zero on the
 *  CommunityIssuance. Signature, target and the zero argument have to be the
 *  same action — a part that zeroes something else, or sets a nonzero rate
 *  here, is not this one. */
const retiresTheSubsidy = (actions, communityIssuance) =>
    hasAction(actions, "setAPR(uint256)", communityIssuance, (data) =>
        abiCoder.decode(["uint256"], data)[0].isZero()
    );

/** Point the CommunityIssuance at a settable local price feed, using its own
 *  owner — the authority that would rotate a feed in production. setAPR
 *  settles the accrued subsidy first, pricing ZUSD in SOV through that feed,
 *  and governance clock jumps push the production MoC-backed feed past
 *  expiry. Anything that triggers issuance later on the same fork needs a feed
 *  that does not expire either. */
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

/** Locate the three SIP-0094 proposals by shape. Each entry is null when the
 *  fork carries no proposal of that shape. */
const findPhase1Proposals = async (ctx) => {
    const beacons = [
        (await deployments.get("LoanTokenLogicBeaconLM")).address,
        (await deployments.get("LoanTokenLogicBeaconWrbtc")).address,
    ];
    const protocolAddress = (await deployments.get("SovrynProtocol")).address;
    const communityIssuanceAddress = (await deployments.get("ZeroCommunityIssuance")).address;
    return {
        part1: {
            governor: "governorOwner",
            proposalId: await findProposalByActions(
                ctx.governorOwner,
                [
                    "registerLoanTokenModule(address)",
                    "setImplementation(address)",
                    "setExitFeeController(address)",
                ],
                [BO_PROXY, ...beacons],
                (actions) => rewiresLendingAndZero(actions, beacons)
            ),
        },
        // Part 1 runs the same signature against a different proxy and touches
        // the protocol for other reasons, so the pair is what tells them apart.
        part2: {
            governor: "governorOwner",
            proposalId: await findProposalByActions(
                ctx.governorOwner,
                ["setExitFeeController(address)"],
                [protocolAddress],
                (actions) => hasAction(actions, "setExitFeeController(address)", protocolAddress)
            ),
        },
        part3: {
            governor: "governorAdmin",
            proposalId: await findProposalByActions(
                ctx.governorAdmin,
                ["setAPR(uint256)"],
                [communityIssuanceAddress],
                (actions) => retiresTheSubsidy(actions, communityIssuanceAddress)
            ),
        },
    };
};

/** The delay release is rehearsed on top of an executed SIP-0094 and nothing
 *  else: the delay proposals emit some of the same actions and their builders
 *  refuse targets that do not already carry the fee release. A fork on which
 *  any part is missing or not yet executed is the wrong fork, so this stops
 *  there rather than finishing governance on the release's behalf.
 *
 *  Returns one record per part in the shape the QA state file carries. */
const requirePhase1Executed = async (ctx) => {
    const found = await findPhase1Proposals(ctx);
    const result = {};
    for (const part of ["part1", "part2", "part3"]) {
        const { governor, proposalId } = found[part];
        if (proposalId === null) {
            throw new Error(
                `SIP-0094 ${part} is not on this fork — fork a block after the release executed`
            );
        }
        const state = Number(await ctx[governor].state(proposalId));
        if (state !== STATE.Executed) {
            throw new Error(
                `SIP-0094 ${part} (proposal ${proposalId} on ${governor}) reads ` +
                    `${STATE_NAMES[state] || state}, not Executed — fork a block after the ` +
                    "release executed"
            );
        }
        result[part] = { proposalId, governor, action: "skipped", stateAtFork: "Executed" };
    }
    return result;
};

module.exports = {
    findProposalByActions,
    hasAction,
    rewiresLendingAndZero,
    retiresTheSubsidy,
    useSettableCommunityIssuanceFeed,
    findPhase1Proposals,
    requirePhase1Executed,
    STATE,
    STATE_NAMES,
};
