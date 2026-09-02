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

/** Attach to the live perimeter stack instead of deploying one, and to nothing
 *  else. The lending modules and the Zero implementations MUST be deployed
 *  fresh here: the ones already on chain are the previous release's, which is
 *  exactly what this release replaces. Set before anything reads the overrides,
 *  which are resolved once per process. */
process.env.PERIMETER_DEPLOYED_ADDRESSES = path.join(
    __dirname,
    "deployed.perimeterStack.rskSovrynMainnet.json"
);

const {
    setupGovernanceContext,
    deployLendingReleaseContracts,
    deployPerimeterStack,
    deployHookedBorrowerOperationsImpl,
    deployCollSurplusPoolImpl,
    deployBorrowerOperationsPerimeterOps,
    stubOutZeroPriceFeed,
    deployExitDelayQueue,
    upgradeControllerToDelayBuild,
    assertDelayVintageControllerFixture,
    createAndQueueGovernorOwnerSip,
    executeQueuedGovernorOwnerSip,
    borrowerOperationsFixture,
    collSurplusPoolFixture,
    forkOps,
} = require("./perimeterSipTestHelpers");
const { ensurePhase1Executed } = require("./phase1Preflight");

const RATE_BPS = 50;
const DELAY_SECONDS = 3600;
const MIN_DELAY_SECONDS = 60;
const EXCHEQUER = "0x924f5ad34698Fd20c90Fe5D5A8A0abd3b42dc711";
const SUBMISSION_TOPIC = ethers.utils.id("Submission(uint256)");

const LOAN_TOKENS = [
    "LoanToken_iRBTC",
    "LoanToken_iXUSD",
    "LoanToken_iDOC",
    "LoanToken_iDLLR",
    "LoanToken_iUSDT",
    "LoanToken_iBPRO",
];

const setupPhase2Stack = async () => {
    assertDelayVintageControllerFixture();

    const ctx = await setupGovernanceContext();
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

    // The preceding release must be finished before any of this one is
    // proposed: its proposals are discovered by shape, and this one emits some
    // of the same actions.
    const phase1 = await ensurePhase1Executed(ctx);

    await deployLendingReleaseContracts(ctx.deployerSigner);
    const boImpl = await deployHookedBorrowerOperationsImpl(ctx.deployerSigner);
    const poolImpl = await deployCollSurplusPoolImpl(ctx.deployerSigner);
    await deployBorrowerOperationsPerimeterOps(ctx.deployerSigner);

    // The Zero implementations resolve under their own record names in this
    // release, so that a shell still holding the previous release's addresses
    // cannot quietly supply them here.
    await deployments.save("BorrowerOperationsPerimeter", {
        address: boImpl.address,
        abi: borrowerOperationsFixture.abi,
    });
    await deployments.save("CollSurplusPoolPerimeter", {
        address: poolImpl.address,
        abi: collSurplusPoolFixture.abi,
    });

    // Governance jumps the clock far past any oracle update, and the production
    // feed enforces freshness on every Zero operation.
    await stubOutZeroPriceFeed(ctx.deployerSigner);

    // Every contract that RECORDS an exit has to be an allowed source, and that
    // is not one address per product: borrower exits record from the protocol
    // singleton, each iToken pool records its own lender exits, and Zero records
    // from BorrowerOperations. A source left out is fail-closed.
    const sources = [(await get("SovrynProtocol")).address];
    for (const name of LOAN_TOKENS) sources.push((await get(name)).address);
    sources.push((await get("BorrowerOperations_Proxy")).address);

    const queue = await deployExitDelayQueue(
        ctx.deployerSigner,
        (await get("WRBTC")).address,
        MIN_DELAY_SECONDS,
        sources,
        EXCHEQUER,
        EXCHEQUER
    );

    const stack = await deployPerimeterStack(ctx.deployerSigner, RATE_BPS);
    if ((await stack.controller.owner()).toLowerCase() !== EXCHEQUER.toLowerCase()) {
        throw new Error(
            `the controller at ${stack.controller.address} is not owned by the multisig that ` +
                "arms the perimeter — this fixture rehearses the live stack, never a local one"
        );
    }

    const exchequerSigner = await forkOps.impersonate(provider, EXCHEQUER);
    const upgrade = await upgradeControllerToDelayBuild(stack.controller.address, exchequerSigner);

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
     *  the last one. */
    const viaMultisig = async (target, data) => {
        const submitReceipt = await (
            await multisig.connect(ownerSigners[0]).submitTransaction(target, 0, data)
        ).wait();
        const log = submitReceipt.logs.find((l) => l.topics[0] === SUBMISSION_TOPIC);
        if (!log) throw new Error("the multisig did not record a submission");
        const txId = ethers.BigNumber.from(log.topics[1]).toNumber();
        let receipt = submitReceipt;
        for (let i = 1; i < required; i++) {
            receipt = await (
                await multisig.connect(ownerSigners[i]).confirmTransaction(txId)
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
        proposals: { part1: part1.proposalId, part2: part2.proposalId },
    };
};

module.exports = { setupPhase2Stack, DELAY_SECONDS, MIN_DELAY_SECONDS, EXCHEQUER };
