/**
 * The perimeter as it stands once the withdrawal delay is activated on top of
 * the release that is already live: the deployed controller upgraded to the
 * delay build by its owner, a queue owned and administered by the multisig, both
 * products wired through real governance, and the delay armed.
 *
 * Built once and shared by every scenario. It is NOT re-entrant on one node —
 * the delay proposals refuse to install over targets that already carry them —
 * so each test file that needs it runs against a fresh fork.
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
    createAndQueueGovernorOwnerSip,
    executeQueuedGovernorOwnerSip,
    borrowerOperationsFixture,
    forkOps,
} = require("./perimeterSipTestHelpers");
const { ensurePhase1Executed } = require("./phase1Preflight");
const { assertControllerIsDelayBuild } = require("../../hardhat/tasks/sips/args/sipArgs");

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

const setupPhase2Stack = async () => {
    useAttachedStack();
    assertDelayVintageControllerFixture();

    const ctx = await setupGovernanceContext();
    const provider = new ethers.providers.JsonRpcProvider(hre.network.config.url);

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
    const owners = await multisig.getOwners();
    const required = Number(await multisig.required());
    const ownerSigners = [];
    for (let i = 0; i < required; i++) {
        ownerSigners.push(await forkOps.impersonate(provider, owners[i]));
    }

    /** Drive one operator action the way the multisig does: the submitter's own
     *  confirmation is the first of the threshold, and the wallet executes on
     *  the last one.
     *
     *  The gas limit is stated, never estimated. The wallet SWALLOWS a failing
     *  inner call — it emits ExecutionFailure, clears the executed flag, and
     *  the confirming transaction itself still succeeds. An estimator therefore
     *  settles on the cheapest limit at which the OUTER transaction succeeds,
     *  which is a limit where the inner call runs out of gas: EIP-150 hands the
     *  inner call only 63/64 of what is left, so the wallet's own frame keeps
     *  enough to finish while the action it was meant to take does not happen.
     *  The lever then reports success and changes nothing. A stated limit, at
     *  the network's block gas limit, is what the signers actually send. */
    const viaMultisig = async (target, data) => {
        const gasLimit = OPERATOR_CALL_GAS;
        const submitReceipt = await (
            await multisig
                .connect(ownerSigners[0])
                .submitTransaction(target, 0, data, { gasLimit })
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

    const protocol = await ethers.getContractAt(
        "ISovryn",
        (await get("SovrynProtocol")).address,
        ctx.deployerSigner
    );
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
        (await get("BorrowerOperations_Proxy")).address,
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
        upgrade,
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
