/**
 * Aggregate perimeter release — fork execution rehearsal.
 *
 * SUPERSEDED as the delay rehearsal: what this file exercises is the
 * single-release shape, and it ends at one held withdrawal released once. The
 * sequenced path — the live release first, the delay layered on top of it, and
 * every operator lever driven through the multisig — lives in
 * `perimeterDelayE2E.test.js`. Keep this one for the aggregate shape itself.
 *
 * The aggregate shape ships the fee and the delay in ONE release: three
 * proposals instead of the five that sequencing Phase 1 then Phase 2 would
 * take. This runs all three through real governance on a forked RSK mainnet
 * and asserts the properties that make the shape safe:
 *
 *   Part 1 (GovernorOwner, 10 actions) leaves the protocol INERT. Beacons and
 *   all six modules are registered, the settlement hook and the delay queue are
 *   pinned, but the controller pointer is still unset — so nothing quotes a fee
 *   or a delay yet. This is the property that lets Part 1 sit on-chain
 *   unexecuted-upon without changing user behaviour.
 *
 *   Part 2 (GovernorOwner, 8 actions) does the Zero side and the treasury leg,
 *   and pins the controller LAST. The pool upgrade must precede the
 *   BorrowerOperations swap — not tidiness: the new BorrowerOperations settles
 *   every surplus claim through `claimCollWithFeeTo`, which the live pool does
 *   not have.
 *
 *   Part 3 (GovernorAdmin, 1 action) retires the Zero stability-pool subsidy.
 *
 *   Then the Exchequer arms the perimeter and a REAL lending withdrawal is
 *   held: the funds land in the queue, the user is not paid, and executeExit
 *   pays them after the hold. That last part is what makes the rehearsal worth
 *   the fixtures — everything before it is wiring, and wiring that quotes no
 *   delay would still pass.
 *
 * first run a local forked mainnet node in a separate terminal window:
 *     npx hardhat node --fork https://mainnet.sovryn.app/rpc --no-deploy
 * now run the test:
 *     __decryptionAlreadyDone__=TRUE npx hardhat test \
 *       tests-onchain/perimeter/perimeterAggregateSips.test.js --network rskForkedMainnet
 */
const { expect } = require("chai");
const { mine, time, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const { getProtocolModules } = require("../../deployment/helpers/helpers");
const {
    ONE_RBTC,
    FORK_URL,
    forkBlock,
    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
    getImpersonatedSigner,
    deployPerimeterStack,
    deployHookedBorrowerOperationsImpl,
    deployCollSurplusPoolImpl,
    deployExitDelayQueue,
    deployBorrowerOperationsPerimeterOps,
    deployLendingReleaseContracts,
    stubOutZeroPriceFeed,
    createAndQueueSip,
    executeQueuedSip,
    createAndQueueGovernorOwnerSip,
    executeQueuedGovernorOwnerSip,
    setupGovernanceContext,
} = require("./perimeterSipTestHelpers");

const {
    ethers,
    deployments: { createFixture, get },
} = hre;

const FORK_BLOCK = forkBlock(9056400);
const RATE_BPS = 10;
const DELAY_SECONDS = 3600;
const MIN_DELAY_SECONDS = 60;
const ZERO_ADDRESS = ethers.constants.AddressZero;

describe("Aggregate perimeter release — three proposals through governance", () => {
    const setupTest = createFixture(async ({ deployments }) => {
        const context = await setupGovernanceContext();

        await deployLendingReleaseContracts(context.deployerSigner);

        const stack = await deployPerimeterStack(context.deployerSigner, RATE_BPS);
        const hookedImpl = await deployHookedBorrowerOperationsImpl(context.deployerSigner);
        const poolImpl = await deployCollSurplusPoolImpl(context.deployerSigner);
        const zeroOps = await deployBorrowerOperationsPerimeterOps(context.deployerSigner);

        // Governance voting and the timelock push block.timestamp far past any
        // oracle update, and the real Zero feed enforces freshness — Part 3's
        // setAPR prices ZUSD in SOV through it and would revert on staleness.
        await stubOutZeroPriceFeed(context.deployerSigner);

        // Every contract that RECORDS an exit has to be an allowed source, and
        // that is not one address per product. Borrower exits record from the
        // protocol singleton, but each iToken pool records its own LENDER
        // exits, and Zero records from BorrowerOperations. A source left out is
        // fail-closed: the exit reverts with UnregisteredSource, which halts
        // withdrawals on that pool until governance adds it.
        const sources = [(await get("SovrynProtocol")).address];
        for (const name of [
            "LoanToken_iRBTC",
            "LoanToken_iXUSD",
            "LoanToken_iDOC",
            "LoanToken_iDLLR",
            "LoanToken_iUSDT",
            "LoanToken_iBPRO",
        ]) {
            sources.push((await get(name)).address);
        }
        sources.push((await get("BorrowerOperations_Proxy")).address);

        const queue = await deployExitDelayQueue(
            context.deployerSigner,
            (await get("WRBTC")).address,
            MIN_DELAY_SECONDS,
            sources
        );

        return { context, stack, hookedImpl, poolImpl, zeroOps, queue };
    });

    it("executes all three parts, leaves Part 1 inert, and holds a live withdrawal", async () => {
        if (!hre.network.tags["forked"]) {
            // Throw, never return: a bare return marks a security rehearsal
            // PASSED with zero assertions.
            throw new Error(
                "perimeterAggregateSips must run on a forked mainnet (rskForkedMainnet); " +
                    "no fork tag on this network"
            );
        }
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [{ forking: { jsonRpcUrl: FORK_URL, blockNumber: FORK_BLOCK } }],
        });

        const { context: ctx, stack, hookedImpl, poolImpl, zeroOps, queue } = await setupTest();
        const { deployerSigner } = ctx;

        const protocol = await ethers.getContractAt(
            "ISovryn",
            (await get("SovrynProtocol")).address,
            deployerSigner
        );
        const zeroBo = new ethers.Contract(
            (await get("BorrowerOperations_Proxy")).address,
            [
                "function exitFeeController() view returns (address)",
                "function exitDelayQueue() view returns (address)",
                "function perimeterOps() view returns (address)",
            ],
            deployerSigner
        );
        const poolProxy = await ethers.getContract("CollSurplusPool_Proxy", deployerSigner);
        const boProxy = await ethers.getContract("BorrowerOperations_Proxy", deployerSigner);

        // ── Before anything: the pointers do not even exist ────────────────
        // ExitFeeModule is what registers these selectors, and it is not on the
        // live protocol yet — so ask the registry rather than calling them,
        // which would revert with "target not active".
        for (const sig of [
            "setExitFeeController(address)",
            "setExitDelayQueue(address)",
            "setBorrowerExitPerimeterOps(address)",
        ]) {
            expect(await protocol.getTarget(sig), `${sig} already registered`).to.equal(
                ZERO_ADDRESS
            );
        }

        // ── Part 1 ─────────────────────────────────────────────────────────
        const part1 = await createAndQueueGovernorOwnerSip(ctx, "getArgsSipPerimeterPart1");
        expect((await ctx.governorOwner.getActions(part1.proposalId)).targets.length).to.equal(10);
        await executeQueuedGovernorOwnerSip(ctx, part1.proposalId);

        const modules = getProtocolModules();
        for (const key of [
            "LoanClosingsRollover",
            "LoanClosingsWith",
            "LoanClosingsWithSwap",
            "LoanMaintenance",
            "LoanMaintenanceViews",
            "ExitFeeModule",
        ]) {
            const registered = await protocol.getTarget(modules[key].sampleFunction);
            expect(registered.toLowerCase(), `${key} not registered`).to.equal(
                (await get(modules[key].moduleName)).address.toLowerCase()
            );
        }
        expect((await protocol.borrowerExitPerimeterOps()).toLowerCase()).to.equal(
            (await get("BorrowerExitPerimeterOps")).address.toLowerCase()
        );
        expect((await protocol.exitDelayQueue()).toLowerCase()).to.equal(
            queue.address.toLowerCase()
        );
        // The point of the split: after Part 1 the protocol still quotes nothing.
        expect(
            await protocol.exitFeeController(),
            "Part 1 must leave the protocol inert"
        ).to.equal(ZERO_ADDRESS);

        // ── Part 2 ─────────────────────────────────────────────────────────
        const part2 = await createAndQueueGovernorOwnerSip(ctx, "getArgsSipPerimeterPart2");
        const actions2 = await ctx.governorOwner.getActions(part2.proposalId);
        expect(actions2.targets.length).to.equal(8);
        // The controller pin is the last action of the whole release.
        expect(actions2.signatures[7]).to.equal("setExitFeeController(address)");
        expect(actions2.targets[7].toLowerCase()).to.equal(protocol.address.toLowerCase());
        // The pool upgrade precedes the BorrowerOperations swap.
        expect(actions2.targets[0].toLowerCase()).to.equal(poolProxy.address.toLowerCase());
        expect(actions2.targets[1].toLowerCase()).to.equal(boProxy.address.toLowerCase());

        await executeQueuedGovernorOwnerSip(ctx, part2.proposalId);

        expect((await poolProxy.getImplementation()).toLowerCase()).to.equal(
            poolImpl.address.toLowerCase()
        );
        expect((await boProxy.getImplementation()).toLowerCase()).to.equal(
            hookedImpl.address.toLowerCase()
        );
        expect((await zeroBo.perimeterOps()).toLowerCase()).to.equal(
            zeroOps.address.toLowerCase()
        );
        expect((await zeroBo.exitFeeController()).toLowerCase()).to.equal(
            stack.controller.address.toLowerCase()
        );
        expect((await zeroBo.exitDelayQueue()).toLowerCase()).to.equal(
            queue.address.toLowerCase()
        );
        expect((await protocol.exitFeeController()).toLowerCase()).to.equal(
            stack.controller.address.toLowerCase()
        );

        // ── Part 3 ─────────────────────────────────────────────────────────
        const communityIssuance = await ethers.getContract(
            "ZeroCommunityIssuance",
            deployerSigner
        );
        expect((await communityIssuance.APR()).toString()).to.not.equal("0");

        // setAPR settles the accrued subsidy first, pricing ZUSD in SOV through
        // the CommunityIssuance's own Sovryn PriceFeeds pointer. That feed is
        // MoC-backed and the governance clock jumps put it past expiry, so swap
        // it for a settable local one using its real owner — the same authority
        // that would rotate a feed in production.
        const localFeeds = await (
            await ethers.getContractFactory("PriceFeedsLocal", deployerSigner)
        ).deploy((await get("WRBTC")).address, (await get("SOV")).address);
        await localFeeds.deployed();
        const ciOwner = await getImpersonatedSigner(await communityIssuance.getOwner());
        await setBalance(ciOwner.address, ONE_RBTC);
        await (await communityIssuance.connect(ciOwner).setPriceFeed(localFeeds.address)).wait();
        const part3 = await createAndQueueSip(ctx, "getArgsSipPerimeterPart3", "governorAdmin");
        await executeQueuedSip(ctx, part3.proposalId, "governorAdmin");
        expect((await communityIssuance.APR()).toString()).to.equal("0");

        // ── Arm, then hold a real withdrawal ───────────────────────────────
        // Everything above is wiring. Wiring that quotes no delay would pass it,
        // so the rehearsal only means something once a live exit is held.
        await (await stack.controller.setGlobalDelaySeconds(DELAY_SECONDS)).wait();
        await (await stack.controller.setSecurityPerimeterEnabled(true)).wait();
        await (await stack.controller.setExitFeeEnabled(true)).wait();

        // The native lender path: mint iRBTC with RBTC and burn straight back.
        // No token whale needed, and it exercises the branch where the queue
        // escrows WRBTC and unwraps it to native at delivery.
        const iRBTC = await ethers.getContractAt(
            "ILoanTokenModules",
            (await get("LoanToken_iRBTC")).address,
            deployerSigner
        );
        const wrbtcAddress = (await get("WRBTC")).address;
        await setBalance(deployerSigner.address, ONE_RBTC.mul(100));

        const lendAmount = ethers.utils.parseEther("1");
        await (
            await iRBTC.mintWithBTC(deployerSigner.address, false, { value: lendAmount })
        ).wait();
        const iBalance = await iRBTC.balanceOf(deployerSigner.address);
        expect(iBalance.gt(0), "iRBTC position minted").to.be.true;

        const queuedBefore = await queue.lastRequestId();
        const userBefore = await ethers.provider.getBalance(deployerSigner.address);
        await (await iRBTC.burnToBTC(deployerSigner.address, iBalance, false)).wait();

        const queuedAfter = await queue.lastRequestId();
        expect(queuedAfter.gt(queuedBefore), "the withdrawal was not held").to.be.true;
        // Gas makes an exact equality wrong here; what matters is that the
        // payout did NOT arrive, so the balance cannot have gone UP.
        expect(
            (await ethers.provider.getBalance(deployerSigner.address)).lte(userBefore),
            "the lender was paid despite an active hold"
        ).to.be.true;

        const request = await queue.getRequest(queuedAfter);
        expect(request.receiver).to.equal(deployerSigner.address);
        expect(request.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW);
        expect(request.token.toLowerCase()).to.equal(wrbtcAddress.toLowerCase());
        expect(request.unwrapOnDelivery, "native exits unwrap at delivery").to.be.true;
        expect((await queue.totalEscrowed(wrbtcAddress)).gt(0)).to.be.true;

        // ── And the hold ends ──────────────────────────────────────────────
        await time.increase(DELAY_SECONDS + 1);
        await mine();
        const beforeRelease = await ethers.provider.getBalance(deployerSigner.address);
        await (await queue.executeExit(queuedAfter)).wait();
        expect(
            (await ethers.provider.getBalance(deployerSigner.address)).gt(beforeRelease),
            "the lender was not paid after the hold ended"
        ).to.be.true;
        expect((await queue.totalEscrowed(wrbtcAddress)).toString()).to.equal("0");
    });
});
