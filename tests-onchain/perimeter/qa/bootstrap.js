/**
 * Brings a freshly booted mainnet fork to the state the withdrawal-delay
 * release leaves behind, in one pass, so both dapps can be driven against it by
 * hand from MetaMask.
 *
 * Governance is not waited for. Each release's proposals are found on chain by
 * the actions they carry and replayed straight from the timelock that would
 * have run them — no votes, no queue, no eta. That is the whole point: walking
 * real governance costs days of chain time, and this environment cannot afford
 * to spend any. NOTHING here moves the chain clock. A held withdrawal counts
 * down against block.timestamp while the dapp counts down against the
 * operator's wall clock, so a fork pushed forward shows timers that never
 * expire, and one pushed back shows holds that are already over.
 *
 * Every write goes to a LOCAL fork and nowhere else: each entry point re-checks
 * chain id 30 and the network's "qa" tag before anything is sent.
 *
 * The state file this writes carries a private key in clear. That is
 * deliberate — it is one of hardhat's published mnemonic accounts, it is there
 * to be imported into MetaMask, and it must never hold value on a real network.
 */
const fs = require("fs");
const path = require("path");

const {
    forkOps,
    deployPerimeterStack,
    deployPhase2Release,
    upgradeControllerToDelayBuild,
    servesDelayBuild,
    borrowerOperationsFixture,
} = require("../perimeterSipTestHelpers");
const {
    findProposalByActions,
    hasAction,
    rewiresLendingAndZero,
    retiresTheSubsidy,
    useSettableCommunityIssuanceFeed,
    STATE,
} = require("../phase1Preflight");
const {
    setupPhase2Stack,
    useAttachedStack,
    EXCHEQUER,
    MIN_DELAY_SECONDS,
} = require("../phase2Stack");
const {
    getArgsSipPerimeterDelayPart1,
    getArgsSipPerimeterDelayPart2,
} = require("../../../hardhat/tasks/sips/args/sipArgs");

const controllerFixture = require("../fixtures/ExitFeeController.json");
const queueFixture = require("../fixtures/ExitDelayQueue.json");

const CHAIN_ID = 30;
const STATE_FILE = path.join(__dirname, "..", "..", "..", "qa", "perimeter-qa.json");

const DEFAULT_DELAY_SECONDS = 120;
const RBTC_PER_ACCOUNT = "100";
const XUSD_PER_ACCOUNT = "50000";
/** Gas float for the accounts this impersonates. They pay for deploys and for
 *  every replayed proposal action, so the figure is generous on purpose. */
const IMPERSONATED_FUNDING = "10000";

/** Hardhat's published mnemonic accounts 0-3. These are test keys with no
 *  secrecy at all — account 0 is the one the operator imports into MetaMask,
 *  and the other three stand in for the accounts an incident response would be
 *  practised against. Never fund any of them on a real network. */
const TEST_KEY = {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
};
const SUSPECTS = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
];

/** What the release ledger says when a node is attached to without a state file
 *  that describes it: the release is on chain, and how it got there is not this
 *  run's to claim. */
const PRE_EXISTING = {
    phase1: {
        part1: { how: "pre-existing" },
        part2: { how: "pre-existing" },
        part3: { how: "pre-existing" },
    },
    phase2: { part1: { how: "pre-existing" }, part2: { how: "pre-existing" } },
};

/** The protocol's own deployment record predates these views, so its recorded
 *  ABI does not carry them. */
const PROTOCOL_POINTERS_ABI = [
    "function exitDelayQueue() view returns (address)",
    "function exitFeeController() view returns (address)",
    "function borrowerExitPerimeterOps() view returns (address)",
    "function feesController() view returns (address)",
];
const PROXY_ABI = [
    "function getImplementation() view returns (address)",
    "function getOwner() view returns (address)",
];
const XUSD_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function owner() view returns (address)",
    "function mint(address,uint256) returns (bool)",
];
const COMMUNITY_ISSUANCE_ABI = ["function APR() view returns (uint256)"];

/** Refuse to send anything anywhere but a local QA fork. Chain id alone is not
 *  enough — real RSK reports 30 too — so the network's own "qa" tag has to
 *  agree, and only `rskForkedMainnetQa` carries it. */
const assertLocalQaFork = async (hre) => {
    const { chainId } = await hre.ethers.provider.getNetwork();
    if (chainId !== CHAIN_ID || !hre.network.tags.qa) {
        throw new Error(
            `perimeter QA: refusing to run against chain id ${chainId} on network ` +
                `"${hre.network.name}". This writes to a local fork only and expects chain id ` +
                `${CHAIN_ID} on a network tagged "qa" — boot scripts/perimeter/qa-node.sh and ` +
                "pass --network rskForkedMainnetQa."
        );
    }
    // The tag says what the config INTENDS; the node itself says what is really
    // answering. Only a local hardhat or anvil process accepts the impersonation
    // and balance writes below, and a hosted fork would take them as a shared,
    // durable environment rather than a throwaway one.
    const kind = await forkOps.detectForkKind(hre.ethers.provider);
    if (kind !== "hardhat" && kind !== "anvil") {
        throw new Error(
            `perimeter QA: the node at ${hre.network.config.url} reports as "${kind}", not a ` +
                "local hardhat or anvil fork. This bootstrap impersonates accounts and rewrites " +
                "balances, which belongs on a throwaway node only."
        );
    }
};

/** Unlock an account and leave it able to pay for gas, without taking anything
 *  away from it. `forkOps.impersonate` writes a fixed float, which on a live
 *  account — the multisig and the timelocks all hold RBTC — would replace the
 *  balance the dapps display. The floor is applied after it, so the balance only
 *  ever goes up. No transaction runs in between. */
const impersonateSolvent = async (hre, provider, address, minimumEther) => {
    const { ethers } = hre;
    const held = await ethers.provider.getBalance(address);
    const floor = ethers.utils.parseEther(minimumEther);
    const signer = await forkOps.impersonate(provider, address);
    await forkOps.setBalance(
        provider,
        address,
        ethers.utils.hexValue(held.gt(floor) ? held : floor)
    );
    return signer;
};

const missingProposal = (label) =>
    new Error(
        `perimeter QA: ${label} is not on this fork. This bootstrap replays the proposals ` +
            "that exist on chain, it never creates them — re-fork at a block where they do."
    );

/** One action list, whether it came off a governor or out of a proposal
 *  builder. `getActions` answers positionally and the builders answer with a
 *  named `data` field; everything downstream wants one shape. */
const toActions = (raw) =>
    Array.isArray(raw)
        ? { targets: raw[0], values: raw[1], signatures: raw[2], datas: raw[3] }
        : {
              targets: raw.targets,
              values: raw.values,
              signatures: raw.signatures,
              datas: raw.data,
          };

/**
 * Replay an action list from the timelock that would have executed it.
 *
 * A timelock runs `target.call{value}(data)` when the action carries no
 * signature, and `target.call{value}(selector(signature) ++ data)` when it
 * does. Sending each action from the impersonated timelock reproduces exactly
 * that call, from exactly that caller, which is all the target's own access
 * control ever sees.
 */
const executeActionsFromTimelock = async (hre, timelockSigner, actions, label) => {
    const { ethers } = hre;
    for (let i = 0; i < actions.targets.length; i++) {
        const signature = actions.signatures[i];
        const data =
            signature === ""
                ? actions.datas[i]
                : ethers.utils.hexConcat([
                      ethers.utils.id(signature).slice(0, 10),
                      actions.datas[i],
                  ]);
        try {
            await (
                await timelockSigner.sendTransaction({
                    to: actions.targets[i],
                    value: actions.values[i],
                    data,
                })
            ).wait();
        } catch (error) {
            // A release that stops half way leaves the fork in a state no
            // re-run can pick up from — the actions already sent would be sent
            // again. Say so here rather than letting the next attempt fail
            // somewhere less obvious.
            throw new Error(
                `perimeter QA: ${label} action ${i + 1} of ${actions.targets.length} — ` +
                    `${signature || "raw calldata"} on ${actions.targets[i]} — failed: ` +
                    `${error.message}\n` +
                    "The fork is now part way through a release. Restart the node " +
                    "(scripts/perimeter/qa-node.sh --stop, then boot it again) before retrying."
            );
        }
    }
    return actions.targets.length;
};

/** Take one already-created proposal to executed, or report that the chain got
 *  there first. A proposal the voters rejected is refused rather than replayed:
 *  this environment reproduces a release that is going live, not one that is
 *  not. */
const replayProposal = async (hre, governor, timelockSigner, proposalId, label, log) => {
    if (proposalId === null) throw missingProposal(label);
    const state = Number(await governor.state(proposalId));
    if (state === STATE.Executed) {
        return { proposalId, how: "executed-on-chain" };
    }
    if (state === STATE.Canceled || state === STATE.Defeated || state === STATE.Expired) {
        throw new Error(
            `perimeter QA: ${label} (proposal ${proposalId}) is in state ${state} — canceled, ` +
                "defeated or expired. Refusing to install a release that governance did not " +
                "carry to an executable proposal."
        );
    }
    if (state === STATE.Pending || state === STATE.Active) {
        // Replaying a proposal still open for votes installs a release the
        // voters have not approved. That is what this environment is for, and
        // it is exactly the thing nobody should discover later from a state
        // file, so it is said out loud here.
        log(
            `  WARNING: ${label} (proposal ${proposalId}) is still open for votes — replaying it ` +
                "anyway; this fork carries a release governance has not approved"
        );
    }
    const actions = toActions(await governor.getActions(proposalId));
    const count = await executeActionsFromTimelock(hre, timelockSigner, actions, label);
    return { proposalId, how: "impersonated", actions: count };
};

/** Find and settle the three parts of the release that precedes the delay,
 *  each by the shape of the actions it carries rather than by its id. */
const settlePrecedingRelease = async (hre, provider, deployerSigner, log) => {
    const {
        ethers,
        deployments: { get },
    } = hre;

    const governorOwner = await ethers.getContractAt(
        "GovernorAlpha",
        (await get("GovernorOwner")).address
    );
    const governorAdmin = await ethers.getContractAt(
        "GovernorAlpha",
        (await get("GovernorAdmin")).address
    );
    const timelockOwnerSigner = await impersonateSolvent(
        hre,
        provider,
        (await get("TimelockOwner")).address,
        IMPERSONATED_FUNDING
    );
    const timelockAdminSigner = await impersonateSolvent(
        hre,
        provider,
        (await get("TimelockAdmin")).address,
        IMPERSONATED_FUNDING
    );

    const beacons = [
        (await get("LoanTokenLogicBeaconLM")).address,
        (await get("LoanTokenLogicBeaconWrbtc")).address,
    ];
    const boProxyAddress = (await get("BorrowerOperations_Proxy")).address;
    const protocolAddress = (await get("SovrynProtocol")).address;
    const communityIssuanceAddress = (await get("ZeroCommunityIssuance")).address;

    const part1Id = await findProposalByActions(
        governorOwner,
        [
            "registerLoanTokenModule(address)",
            "setImplementation(address)",
            "setExitFeeController(address)",
        ],
        [boProxyAddress, ...beacons],
        (actions) => rewiresLendingAndZero(actions, beacons)
    );
    const part2Id = await findProposalByActions(
        governorOwner,
        ["setExitFeeController(address)"],
        [protocolAddress],
        (actions) => hasAction(actions, "setExitFeeController(address)", protocolAddress)
    );
    const part3Id = await findProposalByActions(
        governorAdmin,
        ["setAPR(uint256)"],
        [communityIssuanceAddress],
        (actions) => retiresTheSubsidy(actions, communityIssuanceAddress)
    );

    // Part 2 must follow Part 1: the protocol selector it calls is registered by
    // the admin module Part 1 installs. Part 3 is on the other governor pair and
    // touches nothing the other two do.
    const part1 = await replayProposal(
        hre,
        governorOwner,
        timelockOwnerSigner,
        part1Id,
        "part 1",
        log
    );
    log(`  preceding release part 1: proposal ${part1.proposalId} ${part1.how}`);
    const part2 = await replayProposal(
        hre,
        governorOwner,
        timelockOwnerSigner,
        part2Id,
        "part 2",
        log
    );
    log(`  preceding release part 2: proposal ${part2.proposalId} ${part2.how}`);
    // Nothing is rotated for a part that is not there to run: the feed swap
    // below is a side effect, and it must not be left behind by a run that was
    // always going to refuse.
    if (part3Id === null) throw missingProposal("part 3");
    // Part 3 settles the subsidy accrued so far before it zeroes the rate, and
    // that settlement prices ZUSD in SOV through a feed this fork cannot keep
    // fresh — the upstream oracle stopped publishing at the fork block. The
    // CommunityIssuance's own owner rotates it onto a settable local feed, which
    // is the authority that would rotate a feed in production. The swap stays:
    // anything that triggers issuance later needs a feed that does not expire
    // either.
    if (Number(await governorAdmin.state(part3Id)) !== STATE.Executed) {
        await useSettableCommunityIssuanceFeed({ deployerSigner });
    }
    const part3 = await replayProposal(
        hre,
        governorAdmin,
        timelockAdminSigner,
        part3Id,
        "part 3",
        log
    );
    log(`  preceding release part 3: proposal ${part3.proposalId} ${part3.how}`);

    // What the parts were for, asserted on the chain rather than on the
    // proposals: both products carry the controller pointer, and the subsidy is
    // retired. The delay proposals refuse to build without the first of these.
    const controllerOnProtocol = await new ethers.Contract(
        protocolAddress,
        PROTOCOL_POINTERS_ABI,
        ethers.provider
    ).exitFeeController();
    const controllerOnZero = await new ethers.Contract(
        boProxyAddress,
        ["function exitFeeController() view returns (address)"],
        ethers.provider
    ).exitFeeController();
    if (
        controllerOnProtocol === ethers.constants.AddressZero ||
        controllerOnProtocol.toLowerCase() !== controllerOnZero.toLowerCase()
    ) {
        throw new Error(
            `perimeter QA: after the preceding release the protocol points at controller ` +
                `${controllerOnProtocol} and Zero at ${controllerOnZero} — both products must ` +
                "sit on one live controller before the delay is installed"
        );
    }
    const apr = await new ethers.Contract(
        communityIssuanceAddress,
        COMMUNITY_ISSUANCE_ABI,
        ethers.provider
    ).APR();
    if (!apr.isZero()) {
        throw new Error(
            `perimeter QA: the stability pool subsidy is still running at ${apr.toString()} — ` +
                "the preceding release did not retire it"
        );
    }

    return {
        parts: { part1, part2, part3 },
        timelockOwnerSigner,
        controllerOnProtocol,
    };
};

/**
 * Prove the release actually landed, before anything writes it down.
 *
 * A timelock swallows nothing here — every action was sent as its own
 * transaction and a revert would already have thrown — but `replaceContract` is
 * a raw delegatecall and the pointer setters live on modules this same release
 * installs, so "the transactions succeeded" is not by itself "the pointers
 * moved". Both products have to name the queue that was just deployed, and the
 * protocol has to name the settlement companion that was just deployed;
 * anything else is a fork that looks released and holds nothing.
 */
const assertReleaseLanded = async (hre, release) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const queue = ethers.utils.getAddress(release.queue.address);
    const ops = ethers.utils.getAddress(release.lending.BorrowerExitPerimeterOps.address);

    const protocol = new ethers.Contract(
        (await get("SovrynProtocol")).address,
        PROTOCOL_POINTERS_ABI,
        ethers.provider
    );
    const borrowerOperations = new ethers.Contract(
        (await get("BorrowerOperations_Proxy")).address,
        ["function exitDelayQueue() view returns (address)"],
        ethers.provider
    );

    const found = {
        "the protocol's queue pointer": await protocol.exitDelayQueue(),
        "Zero's queue pointer": await borrowerOperations.exitDelayQueue(),
    };
    for (const [what, address] of Object.entries(found)) {
        if (ethers.utils.getAddress(address) !== queue) {
            throw new Error(
                `perimeter QA: ${what} is ${address}, not the queue this run deployed (${queue}) ` +
                    "— the release did not land"
            );
        }
    }
    const pinnedOps = await protocol.borrowerExitPerimeterOps();
    if (ethers.utils.getAddress(pinnedOps) !== ops) {
        throw new Error(
            `perimeter QA: the protocol's borrower settlement companion is ${pinnedOps}, not the ` +
                `one this run deployed (${ops}) — the release did not land`
        );
    }
    return queue;
};

/** Deploy the delay release and execute its two proposals from the owner
 *  timelock, in the order the release itself requires. */
const installDelayRelease = async (hre, provider, deployerSigner, timelockOwnerSigner, log) => {
    const { ethers } = hre;

    const release = await deployPhase2Release(deployerSigner, {
        minDelay: MIN_DELAY_SECONDS,
        owner: EXCHEQUER,
        admin: EXCHEQUER,
    });
    log(`  queue ${release.queue.address}`);

    const stack = await deployPerimeterStack(deployerSigner);
    const controllerOwner = await stack.controller.owner();
    if (controllerOwner.toLowerCase() !== EXCHEQUER.toLowerCase()) {
        throw new Error(
            `perimeter QA: the controller at ${stack.controller.address} is owned by ` +
                `${controllerOwner}, not by the multisig that arms the perimeter — this fork is ` +
                "not carrying the live stack"
        );
    }

    // The delay proposals both refuse to build against a controller that cannot
    // answer the delay views, and this upgrade is the only thing that lifts the
    // refusal. It is the owner's own transaction, never a governance action.
    const exchequerSigner = await impersonateSolvent(
        hre,
        provider,
        EXCHEQUER,
        IMPERSONATED_FUNDING
    );
    const upgrade = await upgradeControllerToDelayBuild(stack.controller.address, exchequerSigner);
    log(`  controller ${stack.controller.address} now serves ${upgrade.implementation}`);

    // Pin what the proposals are allowed to resolve to: the proxy the products
    // call, which is the address the proposals carry.
    process.env.PERIMETER_EXIT_FEE_CONTROLLER_CODEHASH = ethers.utils.keccak256(
        await ethers.provider.getCode(stack.controller.address)
    );

    // Deploying the release rotates Zero's price feed, and that rotation is the
    // feed proxy owner's own transaction — the same timelock that is about to
    // send every action below, whose float the rotation resets to what one call
    // needs. Restore it here rather than meeting it as an out-of-gas failure
    // part way through a release.
    await impersonateSolvent(hre, provider, timelockOwnerSigner.address, IMPERSONATED_FUNDING);

    // Never a hardcoded count — the Zero part drops its pool upgrade when the
    // pool's bytes do not change, and the state file records what was built.
    const built1 = await getArgsSipPerimeterDelayPart1(hre);
    const count1 = await executeActionsFromTimelock(
        hre,
        timelockOwnerSigner,
        toActions(built1.args),
        "delay part 1"
    );
    log(`  delay part 1: ${count1} actions executed`);
    const built2 = await getArgsSipPerimeterDelayPart2(hre);
    const count2 = await executeActionsFromTimelock(
        hre,
        timelockOwnerSigner,
        toActions(built2.args),
        "delay part 2"
    );
    log(`  delay part 2: ${count2} actions executed`);

    await assertReleaseLanded(hre, release);

    return {
        release,
        stack,
        upgrade,
        phase2: {
            part1: { actions: count1, how: "impersonated" },
            part2: { actions: count2, how: "impersonated" },
        },
    };
};

/**
 * Arm the perimeter: the hold, the switch that makes it bite, and the charge.
 *
 * All three are the controller owner's and admin's act, and on this chain one
 * account holds both roles. The charge is armed too, and by default: a fork
 * that holds a withdrawal but quotes no fee shows the operator half of what a
 * released chain does. `fee: false` leaves the switch alone for the case where
 * a hold is what is being looked at.
 *
 * Every leg is conditional, so this is safe to run against a fork that is
 * already armed — which is what makes the installed and attached paths converge
 * on the same state.
 */
const armDelay = async (controller, exchequerSigner, { delaySeconds, fee }) => {
    const armed = controller.connect(exchequerSigner);
    if (Number(await controller.globalDelaySeconds()) !== delaySeconds) {
        await (await armed.setGlobalDelaySeconds(delaySeconds)).wait();
    }
    if (!(await controller.securityPerimeterEnabled())) {
        await (await armed.setSecurityPerimeterEnabled(true)).wait();
    }
    if (fee && !(await controller.exitFeeEnabled())) {
        await (await armed.setExitFeeEnabled(true)).wait();
    }
};

/**
 * Give the test key a seat on the multisig, and drop the threshold so one key
 * can pull the operator levers on its own.
 *
 * `addOwner` and `changeRequirement` are onlyWallet — the wallet has to be its
 * own caller — so the multisig ADDRESS is what gets impersonated here, not any
 * of its signers.
 */
const ensureOperator = async (hre, provider, multisig, keepThreshold) => {
    const walletSigner = await impersonateSolvent(
        hre,
        provider,
        multisig.address,
        IMPERSONATED_FUNDING
    );

    // The real owners keep their seats: an operator drill is only worth
    // anything against the wallet the release actually ships with.
    if (!(await multisig.isOwner(TEST_KEY.address))) {
        await (await multisig.connect(walletSigner).addOwner(TEST_KEY.address)).wait();
    }
    if (!keepThreshold && Number(await multisig.required()) !== 1) {
        await (await multisig.connect(walletSigner).changeRequirement(1)).wait();
    }
    return {
        owners: await multisig.getOwners(),
        required: Number(await multisig.required()),
    };
};

/**
 * RBTC and XUSD for the accounts the operator drives from MetaMask.
 *
 * RBTC is written straight into the balances. XUSD is MINTED by the token's own
 * minter rather than moved off a live holder: the float handed out here is a
 * third of the largest XUSD balance any deployment record names — the iXUSD
 * pool's — and a pool drained to stock test accounts would show the wrong
 * liquidity in the very screens this environment exists to test. That the pool
 * is untouched is asserted rather than assumed.
 *
 * Both legs only ever top an account UP, so re-running against a fork that is
 * already in use restores a spent float without resetting one that is not.
 */
const fundQaAccounts = async (hre, provider, accounts) => {
    const {
        ethers,
        deployments: { get },
    } = hre;

    const rbtc = ethers.utils.parseEther(RBTC_PER_ACCOUNT);
    for (const account of accounts) {
        if ((await ethers.provider.getBalance(account)).lt(rbtc)) {
            await forkOps.setBalance(provider, account, ethers.utils.hexValue(rbtc));
        }
    }

    const xusdAddress = (await get("XUSD")).address;
    const poolAddress = (await get("LoanToken_iXUSD")).address;
    const xusd = new ethers.Contract(xusdAddress, XUSD_ABI, ethers.provider);
    const poolBefore = await xusd.balanceOf(poolAddress);

    const minter = await xusd.owner();
    const minterSigner = await impersonateSolvent(hre, provider, minter, IMPERSONATED_FUNDING);
    const target = ethers.utils.parseEther(XUSD_PER_ACCOUNT);
    for (const account of accounts) {
        const held = await xusd.balanceOf(account);
        if (held.gte(target)) continue;
        await (await xusd.connect(minterSigner).mint(account, target.sub(held))).wait();
    }

    const poolAfter = await xusd.balanceOf(poolAddress);
    if (!poolAfter.eq(poolBefore)) {
        throw new Error(
            `perimeter QA: funding moved XUSD out of the iXUSD pool at ${poolAddress} ` +
                `(${poolBefore.toString()} became ${poolAfter.toString()}) — the pool's ` +
                "liquidity is what the lending screens display and must be left alone"
        );
    }
    return { token: xusdAddress, minter, perAccount: XUSD_PER_ACCOUNT };
};

/** The block the node forked at, for the record. A node that does not answer
 *  hardhat_metadata still gives a usable environment, so this is not fatal. */
const readForkBlock = async (hre) => {
    try {
        const metadata = await hre.ethers.provider.send("hardhat_metadata", []);
        return Number(metadata.forkedNetwork.forkBlockNumber);
    } catch (error) {
        return 0;
    }
};

const readState = () => {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
};

const writeState = (state) => {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 4)}\n`);
    return STATE_FILE;
};

/** Everything the state file records that can be read back off the chain. */
const readChainFacts = async (hre, controllerAddress) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const protocolAddress = (await get("SovrynProtocol")).address;
    const boProxyAddress = (await get("BorrowerOperations_Proxy")).address;
    const controller = new ethers.Contract(
        controllerAddress,
        controllerFixture.abi,
        ethers.provider
    );
    const protocol = new ethers.Contract(protocolAddress, PROTOCOL_POINTERS_ABI, ethers.provider);
    return {
        rpc: hre.network.config.url,
        chainId: CHAIN_ID,
        forkBlock: await readForkBlock(hre),
        // Taken off the protocol, not off the deploy that produced it: the
        // address the products actually route to is the only one worth handing
        // to anything downstream.
        queue: ethers.utils.getAddress(await protocol.exitDelayQueue()),
        controller: ethers.utils.getAddress(controllerAddress),
        // Where the CHARGE lands — the perimeter's own vault.
        feeReceiver: ethers.utils.getAddress(await controller.feeReceiver()),
        // Where the protocol's ordinary fee stream lands, which this release
        // does not touch. Recorded so that "untouched" can be checked.
        feesController: ethers.utils.getAddress((await get("FeeSharingCollector_Proxy")).address),
        multisig: ethers.utils.getAddress((await get("MultiSigWallet")).address),
        protocol: ethers.utils.getAddress(protocolAddress),
        borrowerOperations: ethers.utils.getAddress(boProxyAddress),
        // Read off the proxy, so the record is what the chain serves rather
        // than what this run happened to deploy.
        borrowerOperationsImpl: ethers.utils.getAddress(
            await new ethers.Contract(
                boProxyAddress,
                PROXY_ABI,
                ethers.provider
            ).getImplementation()
        ),
        wrbtc: ethers.utils.getAddress((await get("WRBTC")).address),
        loanTokens: {
            iRBTC: ethers.utils.getAddress((await get("LoanToken_iRBTC")).address),
            iXUSD: ethers.utils.getAddress((await get("LoanToken_iXUSD")).address),
        },
        // Read back off the controller, never taken from the request: an
        // attached node keeps whatever it was armed with, and a state file that
        // claimed otherwise would mis-time every countdown the dapp draws.
        delaySeconds: Number(await controller.globalDelaySeconds()),
        feeEnabled: await controller.exitFeeEnabled(),
    };
};

/** The delay release is already installed on this node when the protocol
 *  carries a queue pointer and the controller it points at serves the delay
 *  build. Read off the chain, never off the state file: the file is an output
 *  of this bootstrap, and a node that was restarted under it would make it lie. */
const findInstalledRelease = async (hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const protocol = new ethers.Contract(
        (await get("SovrynProtocol")).address,
        PROTOCOL_POINTERS_ABI,
        ethers.provider
    );
    let queue;
    let controller;
    try {
        queue = await protocol.exitDelayQueue();
        controller = await protocol.exitFeeController();
    } catch (error) {
        return null;
    }
    if (queue === ethers.constants.AddressZero || controller === ethers.constants.AddressZero) {
        return null;
    }
    // A pointer is not a queue. A node restarted under a state file, or one
    // forked before the queue was deployed, answers with an address that has
    // nothing behind it — attaching to that would look installed and hold
    // nothing.
    if ((await ethers.provider.getCode(queue)) === "0x") return null;
    if (!(await servesDelayBuild(controller))) return null;
    return { queue, controller };
};

/**
 * Bring the fork to the released, armed, operator-ready state and record it.
 *
 * `opts.governance` picks how the release gets installed:
 *   "impersonate" (default) replays every proposal from its timelock and leaves
 *       the chain clock where it found it — the mode the dapps need;
 *   "real"        walks the whole thing through governance instead, which is a
 *       far more faithful drill but jumps the clock days ahead, so the dapps'
 *       countdowns are then meaningless.
 *
 * `opts.fee` (default true) also closes the charge switch. `opts.delaySeconds`
 * left undefined keeps whatever an attached fork is already armed with.
 *
 * Idempotent: a node that already carries the release is attached to, its
 * addresses re-read, and its state file rewritten. Nothing is redeployed, and
 * arming runs on every path so the result does not depend on which one ran.
 */
const bootstrapQa = async (hre, opts = {}) => {
    /* eslint-disable no-console */
    const log = opts.log === undefined ? console.log : opts.log;
    /* eslint-enable no-console */
    const keepThreshold = Boolean(opts.keepThreshold);
    const fee = opts.fee === undefined ? true : Boolean(opts.fee);
    const governance = opts.governance || "impersonate";
    if (governance !== "impersonate" && governance !== "real") {
        throw new Error(
            `perimeter QA: unknown governance mode "${governance}" — use "impersonate" or "real"`
        );
    }
    // Left null when nobody asked, so that a bare re-run against a fork already
    // in use keeps the hold it was armed with instead of silently retiming
    // every countdown a tester is watching.
    const asked = opts.delaySeconds ?? process.env.PERIMETER_QA_DELAY_SECONDS;
    const requestedDelay = asked === undefined || asked === null ? null : Number(asked);
    if (requestedDelay !== null && (!Number.isInteger(requestedDelay) || requestedDelay <= 0)) {
        throw new Error("perimeter QA: --delay must be a positive whole number of seconds");
    }

    await assertLocalQaFork(hre);
    // Set before anything reads the overrides: the perimeter stack is attached
    // to, never redeployed, and the resolution happens once per process.
    useAttachedStack();

    const { ethers } = hre;
    const provider = new ethers.providers.JsonRpcProvider(hre.network.config.url);
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        (await hre.deployments.get("MultiSigWallet")).address
    );
    if (multisig.address.toLowerCase() !== EXCHEQUER.toLowerCase()) {
        throw new Error(
            `perimeter QA: this fork's MultiSigWallet is ${multisig.address}, not the ${EXCHEQUER} ` +
                "that owns the perimeter — the deployment records and the chain disagree"
        );
    }

    const previous = readState();
    const installed = await findInstalledRelease(hre);
    // A state file only describes THIS node while it names the queue this node
    // actually serves. One left behind by an earlier fork is history, not a
    // record of what is running, so nothing is carried over from it.
    const history =
        previous && installed && previous.queue.toLowerCase() === installed.queue.toLowerCase()
            ? previous
            : null;
    let how = "attached";
    let recordedGovernance = history ? history.governance : governance;
    let phase1 = history ? history.phase1 : PRE_EXISTING.phase1;
    let phase2 = history ? history.phase2 : PRE_EXISTING.phase2;
    let controllerAddress = installed && installed.controller;

    if (installed) {
        log("perimeter QA: the delay release is already installed — attaching");
    } else if (governance === "real") {
        log("perimeter QA: installing the delay release through real governance");
        const stack = await setupPhase2Stack();
        controllerAddress = stack.stack.controller.address;
        phase1 = {
            part1: { proposalId: stack.phase1.part1.proposalId, how: stack.phase1.part1.action },
            part2: { proposalId: stack.phase1.part2.proposalId, how: stack.phase1.part2.action },
            part3: { proposalId: stack.phase1.part3.proposalId, how: stack.phase1.part3.action },
        };
        phase2 = {
            part1: {
                proposalId: Number(stack.proposals.part1),
                actions: (await stack.ctx.governorOwner.getActions(stack.proposals.part1))[0]
                    .length,
                how: "governance",
            },
            part2: {
                proposalId: Number(stack.proposals.part2),
                actions: (await stack.ctx.governorOwner.getActions(stack.proposals.part2))[0]
                    .length,
                how: "governance",
            },
        };
        how = "governance";
        recordedGovernance = "real";
    } else {
        log("perimeter QA: installing the delay release by impersonation");
        const deployerSigner = (await ethers.getSigners())[0];
        await forkOps.setBalance(
            provider,
            deployerSigner.address,
            ethers.utils.hexValue(ethers.utils.parseEther(IMPERSONATED_FUNDING))
        );

        const preceding = await settlePrecedingRelease(hre, provider, deployerSigner, log);
        const installedNow = await installDelayRelease(
            hre,
            provider,
            deployerSigner,
            preceding.timelockOwnerSigner,
            log
        );

        controllerAddress = installedNow.stack.controller.address;
        phase1 = preceding.parts;
        phase2 = installedNow.phase2;
        how = "installed";
        recordedGovernance = "impersonate";
    }

    // Arming is the same act on every path, so it happens in one place: an
    // installed fork and an attached one then agree, and so do the two
    // governance modes — the one that walks real proposals arms its own
    // defaults, and this brings it back to what was asked for.
    const controller = new ethers.Contract(
        controllerAddress,
        controllerFixture.abi,
        ethers.provider
    );
    const foundArmed = await controller.securityPerimeterEnabled();
    const foundDelay = Number(await controller.globalDelaySeconds());
    if (how === "attached" && (!foundArmed || foundDelay === 0)) {
        log(
            `  WARNING: this node was found disarmed (perimeter ${foundArmed}, hold ${foundDelay}s)` +
                " — arming it now; a fork left disarmed holds nothing and would test nothing"
        );
    }
    const delaySeconds =
        requestedDelay !== null
            ? requestedDelay
            : how === "attached" && foundDelay > 0
              ? foundDelay
              : DEFAULT_DELAY_SECONDS;
    const exchequerSigner = await impersonateSolvent(
        hre,
        provider,
        EXCHEQUER,
        IMPERSONATED_FUNDING
    );
    await armDelay(controller, exchequerSigner, { delaySeconds, fee });

    const accounts = [TEST_KEY.address, ...SUSPECTS];
    const operator = await ensureOperator(hre, provider, multisig, keepThreshold);
    const funding = await fundQaAccounts(hre, provider, accounts);
    log(
        `  operator: ${operator.owners.length} multisig owners, threshold ${operator.required}; ` +
            `${accounts.length} accounts at ${RBTC_PER_ACCOUNT} RBTC / ` +
            `${funding.perAccount} XUSD`
    );

    const facts = await readChainFacts(hre, controllerAddress);
    const state = {
        ...facts,
        governance: recordedGovernance,
        testKey: TEST_KEY,
        suspects: SUSPECTS,
        phase1,
        phase2,
        how,
    };
    if (recordedGovernance === "real") {
        state.warning =
            "installed through real governance: the chain clock was jumped days ahead of " +
            "wall-clock time, so the dapps' countdowns do not match this fork, and the delay " +
            "is the one that mode arms rather than the one --delay asked for";
    }
    writeState(state);
    log(`perimeter QA: ${how}; state written to ${STATE_FILE}`);
    return state;
};

/**
 * Attach to a node this bootstrap has already brought up.
 *
 * Returns read-only contracts on the network's own provider — connect a signer
 * to send. The state file is the address book; the chain is checked to still
 * agree with it, so a node that was restarted under the file says so here
 * rather than three calls later.
 */
const attachQa = async (hre) => {
    const { ethers } = hre;
    await assertLocalQaFork(hre);

    const state = readState();
    if (!state) {
        throw new Error(
            `perimeter QA: no state file at ${STATE_FILE} — run ` +
                "`npx hardhat perimeter:qa up --network rskForkedMainnetQa` first"
        );
    }
    for (const name of ["queue", "controller", "protocol", "multisig", "borrowerOperations"]) {
        if ((await ethers.provider.getCode(state[name])) === "0x") {
            throw new Error(
                `perimeter QA: ${state[name]} (${name}) has no code on this node — the state ` +
                    "file describes a fork that is no longer running. Re-run perimeter:qa up."
            );
        }
    }

    return {
        queue: new ethers.Contract(state.queue, queueFixture.abi, ethers.provider),
        controller: new ethers.Contract(state.controller, controllerFixture.abi, ethers.provider),
        protocol: await ethers.getContractAt("ISovryn", state.protocol),
        iRBTC: await ethers.getContractAt("ILoanTokenModules", state.loanTokens.iRBTC),
        iXUSD: await ethers.getContractAt("ILoanTokenModules", state.loanTokens.iXUSD),
        wrbtc: await ethers.getContractAt("IWrbtcERC20", state.wrbtc),
        borrowerOperations: new ethers.Contract(
            state.borrowerOperations,
            borrowerOperationsFixture.abi,
            ethers.provider
        ),
        multisig: await ethers.getContractAt("MultiSigWallet", state.multisig),
        state,
    };
};

module.exports = {
    bootstrapQa,
    attachQa,
    assertLocalQaFork,
    STATE_FILE,
    TEST_KEY,
    SUSPECTS,
    DEFAULT_DELAY_SECONDS,
    RBTC_PER_ACCOUNT,
    XUSD_PER_ACCOUNT,
};
