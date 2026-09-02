/**
 * The perimeter as it stands once the withdrawal delay is activated on top of
 * the release that is already live: the deployed controller upgraded to the
 * delay build by its owner, a queue owned and administered by the multisig, both
 * products wired through real governance, and the delay armed.
 *
 * Built once and shared by every scenario, and re-entrant on one node: the
 * delay proposals refuse to install over targets that already carry them, so a
 * second call attaches to what the first one installed instead of repeating it
 * (see `findInstalledPhase2Release` and `attachToInstalledPhase2Stack` below).
 */
const hre = require("hardhat");
const path = require("path");
const { ethers, deployments } = hre;
const { get } = deployments;

const {
    setupGovernanceContext,
    deployPerimeterStack,
    deployPhase2Release,
    upgradeControllerToDelayBuild,
    assertDelayVintageControllerFixture,
    servesDelayBuild,
    createAndQueueGovernorOwnerSip,
    executeQueuedGovernorOwnerSip,
    borrowerOperationsFixture,
    ERC1967_IMPL_SLOT,
    forkOps,
} = require("./perimeterSipTestHelpers");
const { ensurePhase1Executed, findProposalByActions, hasAction } = require("./phase1Preflight");
const { assertControllerIsDelayBuild } = require("../../hardhat/tasks/sips/args/sipArgs");

const queueFixture = require("./fixtures/ExitDelayQueue.json");

const DELAY_SECONDS = 3600;
const MIN_DELAY_SECONDS = 60;
const EXCHEQUER = "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711";
const SUBMISSION_TOPIC = ethers.utils.id("Submission(uint256)");
/** The block gas limit the network config carries — what a signer's wallet can
 *  put behind one multisig confirmation, and what every operator action here is
 *  sent with. See `viaMultisig` for why this is stated rather than estimated. */
const OPERATOR_CALL_GAS = 6800000;

/** Attach to the live perimeter stack instead of deploying one, and to nothing
 *  else. The lending modules and the Zero implementations MUST be deployed
 *  fresh: the ones already on chain are the previous release's, which is
 *  exactly what this release replaces.
 *
 *  The overrides are resolved once per process, so this has to be set before
 *  anything reads them — but inside the build, never at import: requiring this
 *  file must not reconfigure sibling tests that share the process. An operator
 *  who has already chosen a file keeps it, unless it disagrees, which is a
 *  contradiction worth stopping for rather than silently resolving. */
const ATTACHED_STACK = path.join(__dirname, "deployed.perimeterStack.rskSovrynMainnet.json");

const useAttachedStack = () => {
    const chosen = process.env.PERIMETER_DEPLOYED_ADDRESSES;
    if (!chosen) {
        process.env.PERIMETER_DEPLOYED_ADDRESSES = ATTACHED_STACK;
        return;
    }
    if (path.resolve(chosen) !== ATTACHED_STACK) {
        throw new Error(
            `PERIMETER_DEPLOYED_ADDRESSES is already set to ${chosen}, but this fixture attaches ` +
                `to the live perimeter stack named in ${ATTACHED_STACK}. Unset it, or point it ` +
                "there, so it is clear which contracts the rehearsal exercises."
        );
    }
};

/** Minimal read surface used only to decide whether the release is already
 *  installed — never the fixture ABI, so this answers about the bytes the
 *  protocol actually points at rather than what a build happens to expect. */
const PROTOCOL_POINTERS_ABI = [
    "function exitDelayQueue() view returns (address)",
    "function exitFeeController() view returns (address)",
];

/** The delay release is already installed on this node when the protocol
 *  carries a queue pointer and the controller it points at serves the delay
 *  build. Read off the chain, never assumed: the same reads the QA bootstrap's
 *  own attach predicate uses (`findInstalledRelease` in qa/bootstrap.js), kept
 *  independent here so this fixture never depends on the QA module. */
const findInstalledPhase2Release = async (protocolAddress) => {
    const protocol = new ethers.Contract(protocolAddress, PROTOCOL_POINTERS_ABI, ethers.provider);
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
    if ((await ethers.provider.getCode(queue)) === "0x") return null;
    if (!(await servesDelayBuild(controller))) return null;
    return { queue, controller };
};

/** The two delay proposals, found by the actions they carry rather than by id
 *  — `setBorrowerExitPerimeterOps`+`setExitDelayQueue` on the protocol for
 *  Part 1, `setPerimeterOps`+`setExitDelayQueue` on BorrowerOperations for
 *  Part 2 (see getArgsSipPerimeterDelayPart1/2 in sipArgs.js for the full
 *  shapes). Null when either is missing: an attached release installed by
 *  impersonation (the QA bootstrap's replay path) never created them. */
const findPhase2Proposals = async (governorOwner, protocolAddress, boProxyAddress) => {
    const part1 = await findProposalByActions(
        governorOwner,
        ["setBorrowerExitPerimeterOps(address)", "setExitDelayQueue(address)"],
        [protocolAddress],
        (actions) => hasAction(actions, "setExitDelayQueue(address)", protocolAddress)
    );
    const part2 = await findProposalByActions(
        governorOwner,
        ["setPerimeterOps(address)", "setExitDelayQueue(address)"],
        [boProxyAddress],
        (actions) => hasAction(actions, "setExitDelayQueue(address)", boProxyAddress)
    );
    if (part1 === null || part2 === null) return null;
    return { part1, part2 };
};

/** Drive one operator action the way the multisig does — shared by the build
 *  and the attach path so the two never diverge in how they exercise it. See
 *  the call site in the build path for why the gas limit is stated rather than
 *  estimated. */
const buildViaMultisig = (multisig, ownerSigners, required) => async (target, data) => {
    const gasLimit = OPERATOR_CALL_GAS;
    const submitReceipt = await (
        await multisig.connect(ownerSigners[0]).submitTransaction(target, 0, data, { gasLimit })
    ).wait();
    const log = submitReceipt.logs.find((l) => l.topics[0] === SUBMISSION_TOPIC);
    if (!log) throw new Error("the multisig did not record a submission");
    const txId = ethers.BigNumber.from(log.topics[1]).toNumber();
    let receipt = submitReceipt;
    for (let i = 1; i < required; i++) {
        receipt = await (
            await multisig.connect(ownerSigners[i]).confirmTransaction(txId, { gasLimit })
        ).wait();
    }
    const executed = (await multisig.transactions(txId)).executed;
    return { txId, executed, receipt };
};

/** Impersonate every multisig owner needed to reach its confirmation
 *  threshold. Shared by the build and the attach path — both need the same
 *  signers to drive `viaMultisig`. */
const impersonateMultisigOwners = async (provider, multisig) => {
    const owners = await multisig.getOwners();
    const required = Number(await multisig.required());
    const ownerSigners = [];
    for (let i = 0; i < required; i++) {
        ownerSigners.push(await forkOps.impersonate(provider, owners[i]));
    }
    return { owners, required, ownerSigners };
};

/** Read the release already on chain instead of building one.
 *
 *  Returns the same top-level shape as a fresh build. The parts that only a
 *  build produces are filled in from what can be read back: `upgrade.performed`
 *  is false because nothing was upgraded this call — `implementation` is the
 *  proxy's current active implementation and `previousImplementation` is null,
 *  since an attach never observed what came before it. `proposals` names the
 *  Phase 2 governance proposals when they can still be found by shape, or null
 *  when the release was installed by impersonation and no proposal exists.
 *  `controllerPrecondition` is not meaningful here — there is no upgrade
 *  transition to probe either side of — so it is left out rather than faked. */
const attachToInstalledPhase2Stack = async (
    ctx,
    provider,
    installed,
    protocolAddress,
    boProxyAddress
) => {
    const stack = await deployPerimeterStack(ctx.deployerSigner);
    if (stack.controller.address.toLowerCase() !== installed.controller.toLowerCase()) {
        throw new Error(
            `the protocol's controller pointer is ${installed.controller}, but the attached ` +
                `perimeter stack names ${stack.controller.address} — the fixture and the chain ` +
                "disagree about which controller is live"
        );
    }

    const queue = new ethers.Contract(installed.queue, queueFixture.abi, ctx.deployerSigner);

    const exchequerSigner = await forkOps.impersonate(provider, EXCHEQUER);
    const multisig = await ethers.getContractAt("MultiSigWallet", EXCHEQUER);
    const { owners, required, ownerSigners } = await impersonateMultisigOwners(provider, multisig);
    const viaMultisig = buildViaMultisig(multisig, ownerSigners, required);

    const protocol = await ethers.getContractAt("ISovryn", protocolAddress, ctx.deployerSigner);
    const iRBTC = await ethers.getContractAt(
        "ILoanTokenModules",
        (await get("LoanToken_iRBTC")).address,
        ctx.deployerSigner
    );
    const iXUSD = await ethers.getContractAt(
        "ILoanTokenModules",
        (await get("LoanToken_iXUSD")).address,
        ctx.deployerSigner
    );
    const wrbtc = new ethers.Contract(
        (await get("WRBTC")).address,
        ["function balanceOf(address) view returns (uint256)"],
        ctx.deployerSigner
    );
    const borrowerOperations = new ethers.Contract(
        boProxyAddress,
        borrowerOperationsFixture.abi,
        ctx.deployerSigner
    );

    // Cheap on a fork where it already ran: every part reads as Executed and
    // resolves in a handful of RPC calls, no staker walk needed.
    const phase1 = await ensurePhase1Executed(ctx);

    const active = ethers.utils.getAddress(
        "0x" +
            (
                await ethers.provider.getStorageAt(stack.controller.address, ERC1967_IMPL_SLOT)
            ).slice(26)
    );
    const preserved = {
        owner: await stack.controller.owner(),
        admin: await stack.controller.admin(),
        feeReceiver: await stack.controller.feeReceiver(),
        exitFeeEnabled: await stack.controller.exitFeeEnabled(),
    };

    const proposals = await findPhase2Proposals(
        ctx.governorOwner,
        protocolAddress,
        boProxyAddress
    );

    return {
        ctx,
        stack,
        queue,
        protocol,
        iRBTC,
        iXUSD,
        wrbtc,
        borrowerOperations,
        provider,
        exchequer: { address: EXCHEQUER, signer: exchequerSigner, owners, required },
        viaMultisig,
        DELAY_SECONDS,
        MIN_DELAY_SECONDS,
        phase1,
        upgrade: {
            performed: false,
            implementation: active,
            previousImplementation: null,
            preserved,
        },
        proposals,
    };
};

const setupPhase2Stack = async () => {
    useAttachedStack();
    assertDelayVintageControllerFixture();

    const ctx = await setupGovernanceContext();
    const provider = new ethers.providers.JsonRpcProvider(hre.network.config.url);

    const protocolAddress = (await get("SovrynProtocol")).address;
    const boProxyAddress = (await get("BorrowerOperations_Proxy")).address;
    const installed = await findInstalledPhase2Release(protocolAddress);
    if (installed) {
        return await attachToInstalledPhase2Stack(
            ctx,
            provider,
            installed,
            protocolAddress,
            boProxyAddress
        );
    }

    // The preceding release must be finished before any of this one is
    // proposed: its proposals are discovered by shape, and this one emits some
    // of the same actions.
    const phase1 = await ensurePhase1Executed(ctx);

    const { queue } = await deployPhase2Release(ctx.deployerSigner, {
        minDelay: MIN_DELAY_SECONDS,
        owner: EXCHEQUER,
        admin: EXCHEQUER,
    });

    const stack = await deployPerimeterStack(ctx.deployerSigner);
    if ((await stack.controller.owner()).toLowerCase() !== EXCHEQUER.toLowerCase()) {
        throw new Error(
            `the controller at ${stack.controller.address} is not owned by the multisig that ` +
                "arms the perimeter — this fixture rehearses the live stack, never a local one"
        );
    }

    const exchequerSigner = await forkOps.impersonate(provider, EXCHEQUER);

    /** Both delay proposals refuse to build against a controller that is not
     *  yet the delay build, and the upgrade below is the only thing that lifts
     *  that refusal. The reading is taken on either side of it — the controller
     *  is live and the release before this one is finished by now — so a test
     *  can hold the release to the ordering it depends on rather than trusting
     *  the order these lines happen to be written in. */
    const controllerPrecondition = { beforeUpgrade: null, afterUpgrade: null };
    const readPrecondition = async () => {
        try {
            await assertControllerIsDelayBuild(hre, stack.controller.address);
            return { refused: false, message: null };
        } catch (error) {
            return { refused: true, message: error.message };
        }
    };
    controllerPrecondition.beforeUpgrade = await readPrecondition();

    const upgrade = await upgradeControllerToDelayBuild(stack.controller.address, exchequerSigner);

    controllerPrecondition.afterUpgrade = await readPrecondition();

    // Pin what the proposals are allowed to resolve to. The hash covers the
    // proxy the products call, which is the address the proposals carry; the
    // implementation behind it is asserted by the upgrade itself.
    process.env.PERIMETER_EXIT_FEE_CONTROLLER_CODEHASH = ethers.utils.keccak256(
        await ethers.provider.getCode(stack.controller.address)
    );

    const part1 = await createAndQueueGovernorOwnerSip(ctx, "getArgsSipPerimeterDelayPart1");
    await executeQueuedGovernorOwnerSip(ctx, part1.proposalId);
    const part2 = await createAndQueueGovernorOwnerSip(ctx, "getArgsSipPerimeterDelayPart2");
    await executeQueuedGovernorOwnerSip(ctx, part2.proposalId);

    // This release has no subsidy action: the rate it would retire is already
    // retired. If it is not, the chain is not where this fixture believes.
    const communityIssuance = await ethers.getContract(
        "ZeroCommunityIssuance",
        ctx.deployerSigner
    );
    if (!(await communityIssuance.APR()).isZero()) {
        throw new Error(
            "the Zero stability pool subsidy is still running — the preceding release did not " +
                "retire it, so this fixture is building on the wrong chain state"
        );
    }

    // Arming is the owner's and the admin's act, and one account holds both.
    const controller = stack.controller.connect(exchequerSigner);
    await (await controller.setGlobalDelaySeconds(DELAY_SECONDS)).wait();
    await (await controller.setSecurityPerimeterEnabled(true)).wait();
    if (!(await controller.exitFeeEnabled())) {
        await (await controller.setExitFeeEnabled(true)).wait();
    }

    const multisig = await ethers.getContractAt("MultiSigWallet", EXCHEQUER);
    const { owners, required, ownerSigners } = await impersonateMultisigOwners(provider, multisig);
    const viaMultisig = buildViaMultisig(multisig, ownerSigners, required);

    const protocol = await ethers.getContractAt("ISovryn", protocolAddress, ctx.deployerSigner);
    const iRBTC = await ethers.getContractAt(
        "ILoanTokenModules",
        (await get("LoanToken_iRBTC")).address,
        ctx.deployerSigner
    );
    const iXUSD = await ethers.getContractAt(
        "ILoanTokenModules",
        (await get("LoanToken_iXUSD")).address,
        ctx.deployerSigner
    );
    const wrbtc = new ethers.Contract(
        (await get("WRBTC")).address,
        ["function balanceOf(address) view returns (uint256)"],
        ctx.deployerSigner
    );
    const borrowerOperations = new ethers.Contract(
        boProxyAddress,
        borrowerOperationsFixture.abi,
        ctx.deployerSigner
    );

    return {
        ctx,
        stack,
        queue,
        protocol,
        iRBTC,
        iXUSD,
        wrbtc,
        borrowerOperations,
        provider,
        exchequer: { address: EXCHEQUER, signer: exchequerSigner, owners, required },
        viaMultisig,
        DELAY_SECONDS,
        MIN_DELAY_SECONDS,
        phase1,
        upgrade: { ...upgrade, performed: true },
        controllerPrecondition,
        proposals: { part1: part1.proposalId, part2: part2.proposalId },
    };
};

module.exports = {
    setupPhase2Stack,
    useAttachedStack,
    ATTACHED_STACK,
    DELAY_SECONDS,
    MIN_DELAY_SECONDS,
    EXCHEQUER,
};
