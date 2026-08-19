/**
 * SIP-0094 (Perimeter Phase-1 activation, Part 1 + Part 2) — fork execution test.
 *
 * The activation is aggregated BY OWNERSHIP: every target (both iToken logic
 * beacons, the sovrynProtocol proxy, Zero's BorrowerOperations proxy, the
 * CollSurplusPool proxy and — for the treasury leg — the Adoption Fund and
 * the SOV token) is TimelockOwner-owned, so both proposals go through
 * GovernorOwner; the split exists only because the 11-action bucket exceeds
 * GovernorAlpha's 10-action cap. This test executes BOTH SIPs through real
 * governance on a forked RSK mainnet and asserts:
 *   - ordering is FAIL-CLOSED, not discipline-dependent (F-2): with BOTH
 *     parts Queued (same proposer — GovernorAlpha blocks only a live
 *     Pending/Active proposal), executing Part 2 first reverts wholesale
 *     and leaves the proposal Queued (retryable) with nothing wired; the
 *     in-order Part 1 → Part 2 run then succeeds on the SAME proposals;
 *   - Part 1 (10 actions, at the cap): module/beacon registrations,
 *     charge-hook pointer, the FIRST-EVER CollSurplusPool implementation
 *     upgrade ordered strictly before the BO swap (runbook §8), and the Zero
 *     BO swap+controller-pin pair kept atomic — both orderings pinned via the
 *     in-tx event order — with the lending side still INERT (protocol
 *     controller pointer unset);
 *   - that LoanClosingsLiquidation's registered target is UNCHANGED: it has no
 *     behavior change, so it is deliberately not re-registered;
 *   - Part 2: three actions — the Adoption Fund unlocked-SOV withdrawal, the
 *     forwarding transfer to the Exchequer Multisig (both checked by BALANCE
 *     DELTAS decoded from the proposal's own calldata; the Development Fund
 *     moves by a companion Exchequer multisig transaction and is asserted
 *     UNTOUCHED by governance) and, last, the protocol controller pin (the
 *     final activation pointer);
 *   - live charged flows on both products once the Perimeter Safe (the test's
 *     deployer) enables the ship-disabled controller — including an
 *     ERC20-settled fee leg (iXUSD burn paying its fee in XUSD, 2a-bis,
 *     F-4), the LC-1 closeWithSwap excess-collateral leg (see 2c-bis) and
 *     the charged surplus claim through the upgraded pool (2f);
 *   - no-touch paths (rollover keeper + borrower-self, liquidation, Zero
 *     stability pool, Zero redemption) charge nothing.
 *
 * first run a local forked mainnet node in a separate terminal window:
 *     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
 * now run the test:
 *     __decryptionAlreadyDone__=TRUE npx hardhat test tests-onchain/perimeter/perimeterActivationSips.test.js --network rskForkedMainnet
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
    PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
    PERIMETER_SURFACE_ZERO_WITHDRAW_COLL,
    PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS,
    borrowerOperationsFixture,
    collSurplusPoolFixture,
    colFeeEventsInterface,
    getImpersonatedSigner,
    deployPerimeterStack,
    deployHookedBorrowerOperationsImpl,
    deployCollSurplusPoolImpl,
    stubOutZeroPriceFeed,
    createAndQueueGovernorOwnerSip,
    executeQueuedGovernorOwnerSip,
    setupGovernanceContext,
    countPerimeterEvents,
    getSingleExitFeeApplied,
} = require("./perimeterSipTestHelpers");

const {
    ethers,
    deployments: { createFixture, get },
} = hre;

const FORK_BLOCK = forkBlock(9056400);
// The real PriceFeeds.queryRate(XUSD, WRBTC) at block 9056400. The production
// WRBTC feed (PriceFeedsMoC) reads a MoC medianizer whose values expire, and
// the fallback oracle was deactivated by SIP-0084 — so on a fork, live-feed
// queries break as soon as blocks advance past the pin. The lending borrower
// flows therefore run against a PriceFeedsLocal seeded with this pinned real
// rate. Re-pinning the fork block does NOT require re-measuring unless the
// market moved a lot: the rate only has to stay within the protocol's swap
// price-disagreement tolerance of the live AMM rate at the new block.
const XUSD_WRBTC_RATE_AT_FORK_BLOCK = ethers.BigNumber.from("15435147683493");
const RATE_BPS = 100; // 1% test policy on every surface
const PROPOSAL_STATE_QUEUED = 5; // GovernorAlpha.ProposalState.Queued
const TEN_K = ethers.BigNumber.from(10000);
const LOAN_DURATION = 28 * 24 * 60 * 60;
// Tolerance for Zero's dynamic origination/redemption fee rates (raised well
// above the floor on mainnet); test-only — the debt budgeting below is
// balance-based, so the actual rate charged doesn't matter.
const MAX_ZERO_FEE_PERCENTAGE = ethers.utils.parseEther("0.99");

describe("SIP-0094 Perimeter Phase-1 activation (ownership-aggregated, GovernorOwner)", () => {
    const setupTest = createFixture(async ({ deployments }) => {
        const context = await setupGovernanceContext();

        // Fresh deployments of everything Part 1 registers: the two hooked
        // beacon modules (2000), the four protocol modules (2070) and the
        // borrower-exit charge hook (2061).
        await deployments.fixture(
            ["LoanTokenModules", "ProtocolModules", "BorrowerExitPerimeterOps"],
            { keepExistingDeployments: true }
        );

        // The `<TBD>` SIP inputs: the real 0.8.20 controller+vault (record
        // "ExitFeeController") and the hooked Zero BorrowerOperations built at
        // the audited zero-contracts-perimeter commit (record
        // "BorrowerOperationsPerimeter").
        const stack = await deployPerimeterStack(context.deployerSigner, RATE_BPS);
        const hookedImpl = await deployHookedBorrowerOperationsImpl(context.deployerSigner);
        const poolImpl = await deployCollSurplusPoolImpl(context.deployerSigner);

        return { context, stack, hookedImpl, poolImpl };
    });

    it("executes both SIPs via governance, wires everything, charges live exits and leaves no-touch paths uncharged", async () => {
        if (!hre.network.tags["forked"]) {
            // F-6: throw, don't return — a bare return marks this security test
            // PASSED with zero assertions, so a mis-invoked run would report the
            // activation as verified when nothing executed.
            throw new Error(
                "perimeterActivationSips must run on a forked mainnet (rskForkedMainnet); " +
                    "no fork tag on this network"
            );
        }
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [{ forking: { jsonRpcUrl: FORK_URL, blockNumber: FORK_BLOCK } }],
        });

        const { context: ctx, stack: colFee, hookedImpl, poolImpl } = await setupTest();
        const { deployer, deployerSigner, timelockOwner } = ctx;

        // ── Contract handles ───────────────────────────────────────────────
        const protocol = await ethers.getContractAt(
            "ISovryn",
            (await get("SovrynProtocol")).address,
            deployerSigner
        );
        const erc20Abi = [
            "function balanceOf(address) view returns (uint256)",
            "function approve(address,uint256) returns (bool)",
            "function transfer(address,uint256) returns (bool)",
        ];
        const wrbtc = new ethers.Contract((await get("WRBTC")).address, erc20Abi, deployerSigner);
        const xusd = new ethers.Contract((await get("XUSD")).address, erc20Abi, deployerSigner);
        const iRBTC = await ethers.getContractAt(
            "ILoanTokenModules",
            (await get("LoanToken_iRBTC")).address,
            deployerSigner
        );
        const iXUSD = await ethers.getContractAt(
            "ILoanTokenModules",
            (await get("LoanToken_iXUSD")).address,
            deployerSigner
        );
        const beaconLM = await ethers.getContract("LoanTokenLogicBeaconLM");
        const beaconWrbtc = await ethers.getContract("LoanTokenLogicBeaconWrbtc");
        const boProxy = await ethers.getContract("BorrowerOperations_Proxy", deployerSigner);
        const borrowerOperations = new ethers.Contract(
            boProxy.address,
            borrowerOperationsFixture.abi,
            deployerSigner
        );
        const prePerimeterZeroImpl = await boProxy.getImplementation();
        const collSurplusPoolProxy = await ethers.getContract(
            "CollSurplusPool_Proxy",
            deployerSigner
        );
        const collSurplusPool = new ethers.Contract(
            collSurplusPoolProxy.address,
            collSurplusPoolFixture.abi,
            deployerSigner
        );
        const prePerimeterPoolImpl = await collSurplusPoolProxy.getImplementation();
        // LoanClosingsLiquidation is NOT replaced by the activation: unchanged
        // source, no changed shared function on its call paths, and runtime
        // bytecode (metadata stripped) identical to what is already registered.
        // Pin its live target so the "unchanged" is asserted, not assumed.
        const prePerimeterLiquidationTarget = await protocol.getTarget(
            getProtocolModules().LoanClosingsLiquidation.sampleFunction
        );
        const troveManagerProxy = await ethers.getContract("TroveManager_Proxy");
        const stabilityPoolProxy = await ethers.getContract("StabilityPool_Proxy");
        const troveManagerImplBefore = await troveManagerProxy.getImplementation();
        const stabilityPoolImplBefore = await stabilityPoolProxy.getImplementation();
        const zusd = new ethers.Contract(
            (await get("ZUSDToken")).address,
            erc20Abi,
            deployerSigner
        );

        // Ownership aggregation pre-check: every target of BOTH parts is
        // owned by the same timelock (TimelockOwner) — this is the invariant
        // the by-ownership SIP structure rests on.
        expect(await beaconLM.owner()).to.equal(timelockOwner.address);
        expect(await beaconWrbtc.owner()).to.equal(timelockOwner.address);
        expect(await protocol.owner()).to.equal(timelockOwner.address);
        expect(await boProxy.getOwner()).to.equal(timelockOwner.address);
        // Runbook §8: re-verify the CollSurplusPool proxy's owner is in the
        // TimelockOwner family before its first-ever implementation upgrade.
        expect(await collSurplusPoolProxy.getOwner()).to.equal(timelockOwner.address);

        // ── Queue BOTH parts, then prove the fail-closed ordering (F-2) ───
        // The same proposer creates Part 2 as soon as Part 1 is Queued:
        // GovernorAlpha's one-live-proposal rule blocks only Pending/Active —
        // this is the real Phase C sequencing (create → vote → queue Part 1,
        // then create Part 2).
        const { proposalId: part1Id } = await createAndQueueGovernorOwnerSip(
            ctx,
            "getArgsSip0094Part1"
        );
        const { proposalId: part2Id } = await createAndQueueGovernorOwnerSip(
            ctx,
            "getArgsSip0094Part2"
        );

        // ── The proposals' own action tables ───────────────────────────────
        // Read back from GovernorAlpha storage, so every assertion below binds
        // to what voters would actually execute, not to a test-side constant.
        // Positional destructuring, NOT `.values`: on an ethers Result the
        // `values` key is shadowed by Array.prototype.values.
        const abiCoder = new ethers.utils.AbiCoder();
        const [part1Targets] = await ctx.governorOwner.getActions(part1Id);
        expect(part1Targets.length, "Part 1 action count (GovernorAlpha cap)").to.equal(10);
        const [part2Targets, part2Values, part2Signatures, part2Calldatas] =
            await ctx.governorOwner.getActions(part2Id);
        expect(part2Targets.length, "Part 2 action count").to.equal(3);
        for (const [index, value] of part2Values.entries()) {
            expect(value, `Part 2 action ${index} must carry no RBTC`).to.equal(0);
        }

        // Treasury leg: two fund withdrawals then one forwarding transfer, with
        // the Perimeter pin kept LAST — the final governance action of the whole
        // activation (CF-1).
        const sovToken = new ethers.Contract((await get("SOV")).address, erc20Abi, deployerSigner);
        // Deployment records are not consistently checksummed, while GovernorAlpha
        // returns checksummed addresses — normalise both sides.
        const addr = (value) => ethers.utils.getAddress(value);
        const devFundAddress = addr((await get("DevelopmentFund")).address);
        const adoptionFundAddress = addr((await get("AdoptionFund")).address);
        const exchequerAddress = addr((await get("MultiSigWallet")).address);

        expect(addr(part2Targets[0])).to.equal(adoptionFundAddress);
        expect(part2Signatures[0]).to.equal("withdrawTokensByUnlockedTokenOwner(uint256)");
        expect(addr(part2Targets[1])).to.equal(addr(sovToken.address));
        expect(part2Signatures[1]).to.equal("transfer(address,uint256)");
        expect(addr(part2Targets[2])).to.equal(addr(protocol.address));
        // The Development Fund is deliberately NOT a governance target: its
        // lockedTokenOwner is the Exchequer Multisig, which sweeps it by a
        // companion multisig transaction (SIP-0094 text, 2026-08-11).
        for (const target of part2Targets) {
            expect(addr(target), "no Development Fund action in Part 2").to.not.equal(
                devFundAddress
            );
        }
        expect(part2Signatures[2], "the fee-controller pin must stay the LAST action").to.equal(
            "setExitFeeController(address)"
        );

        const [adoptionSweep] = abiCoder.decode(["uint256"], part2Calldatas[0]);
        const [transferReceiver, transferAmount] = abiCoder.decode(
            ["address", "uint256"],
            part2Calldatas[1]
        );
        // Values, not shapes: the amount is the Adoption Fund's entire live SOV
        // balance, non-zero, and the forwarding transfer moves exactly that
        // amount to the Exchequer — no dust left on the Timelock.
        expect(adoptionSweep.gt(0), "Adoption Fund sweep must move real value").to.be.true;
        expect(adoptionSweep).to.equal(await sovToken.balanceOf(adoptionFundAddress));
        expect(addr(transferReceiver)).to.equal(exchequerAddress);
        expect(transferAmount).to.equal(adoptionSweep);

        const devFundSovBefore = await sovToken.balanceOf(devFundAddress);
        const adoptionFundSovBefore = await sovToken.balanceOf(adoptionFundAddress);
        const exchequerSovBefore = await sovToken.balanceOf(exchequerAddress);
        const timelockSovBefore = await sovToken.balanceOf(timelockOwner.address);

        // Out-of-order attempt: execute Part 2 with Part 1 still Queued.
        // Its single action calls setExitFeeController on the protocol, whose
        // fallback hits `target not active` until Part 1 registers the selector
        // via ExitFeeModule. Timelock.executeTransaction requires success, so
        // GovernorAlpha.execute reverts WHOLESALE (its own `executed` write
        // included).
        await time.increaseTo((await ctx.governorOwner.proposals(part2Id)).eta);
        let outOfOrderError;
        try {
            await (await ctx.governorOwner.execute(part2Id)).wait();
        } catch (e) {
            outOfOrderError = e;
        }
        expect(outOfOrderError, "Part-2-before-Part-1 execute must revert").to.not.be.undefined;
        expect(String(outOfOrderError.message)).to.match(/revert/i);
        // Fail-closed, not fail-partial: the proposal survives as Queued —
        // retryable within the 14-day timelock grace window — and nothing
        // was wired. (The protocol's own exitFeeController() view does not
        // exist yet either, so the probes below use pre-existing surfaces.)
        expect(await ctx.governorOwner.state(part2Id)).to.equal(PROPOSAL_STATE_QUEUED);
        expect((await ctx.governorOwner.proposals(part2Id)).executed).to.be.false;
        expect(await protocol.getTarget("setExitFeeController(address)")).to.equal(
            ethers.constants.AddressZero
        );
        expect(await boProxy.getImplementation()).to.equal(prePerimeterZeroImpl);
        expect(await collSurplusPoolProxy.getImplementation()).to.equal(prePerimeterPoolImpl);
        // …and the treasury actions that sit AHEAD of the failing pin did not
        // settle either: a GovernorAlpha execution is one transaction, so the
        // sweep is all-or-nothing with the Perimeter pin. No SOV moved anywhere.
        expect(await sovToken.balanceOf(devFundAddress)).to.equal(devFundSovBefore);
        expect(await sovToken.balanceOf(adoptionFundAddress)).to.equal(adoptionFundSovBefore);
        expect(await sovToken.balanceOf(exchequerAddress)).to.equal(exchequerSovBefore);
        expect(await sovToken.balanceOf(timelockOwner.address)).to.equal(timelockSovBefore);

        // ── Part 1 ─────────────────────────────────────────────────────────
        const { executionReceipt: part1Receipt } = await executeQueuedGovernorOwnerSip(
            ctx,
            part1Id
        );

        // Protocol modules replaced.
        const modulesList = getProtocolModules();
        for (const key of [
            "LoanClosingsRollover",
            "LoanClosingsWith",
            "LoanMaintenance",
            "ExitFeeModule",
        ]) {
            expect(
                await protocol.getTarget(modulesList[key].sampleFunction),
                `${key} target`
            ).to.equal((await get(modulesList[key].moduleName)).address);
        }

        // …and LoanClosingsLiquidation deliberately NOT replaced: its target
        // still points at the module that was live before the SIP. A module is
        // re-registered only when its observable behavior changes; this one's
        // runtime bytecode is byte-identical to the registered code, so
        // spending an action slot on it would install a duplicate. Pinned here
        // because it is a deliberate property of the proposal, not an accident.
        expect(
            await protocol.getTarget(modulesList.LoanClosingsLiquidation.sampleFunction),
            "LoanClosingsLiquidation target must be unchanged"
        ).to.equal(prePerimeterLiquidationTarget);

        // Charge hook pinned; controller pointer NOT yet (that's Part 2) —
        // the lending fee path is wired but inert, which is exactly the CF-1
        // ordering: hook strictly before controller.
        const opsDeployment = await get("BorrowerExitPerimeterOps");
        expect(await protocol.borrowerExitPerimeterOps()).to.equal(opsDeployment.address);
        expect(await protocol.exitFeeController()).to.equal(ethers.constants.AddressZero);
        expect(countPerimeterEvents(part1Receipt, "BorrowerExitPerimeterOpsSet")).to.equal(1);

        // Beacon registrations: burn selectors and the new exitFeeController()
        // view route to the freshly registered LM modules.
        const newLM = (await get("LoanTokenLogicLM")).address;
        const newWrbtcLM = (await get("LoanTokenLogicWrbtcLM")).address;
        const sel = (sig) => ethers.utils.id(sig).substring(0, 10);
        expect(await beaconLM.getTarget(sel("burn(address,uint256,bool)"))).to.equal(newLM);
        expect(await beaconLM.getTarget(sel("burn(address,uint256)"))).to.equal(newLM);
        expect(await beaconLM.getTarget(sel("exitFeeController()"))).to.equal(newLM);
        expect(await beaconWrbtc.getTarget(sel("burnToBTC(address,uint256,bool)"))).to.equal(
            newWrbtcLM
        );
        expect(await beaconWrbtc.getTarget(sel("exitFeeController()"))).to.equal(newWrbtcLM);
        // iToken read-through reflects the (still unset) protocol singleton.
        expect(await iRBTC.exitFeeController()).to.equal(ethers.constants.AddressZero);

        // Zero: CollSurplusPool (first-ever upgrade, runbook §8) and
        // BorrowerOperations implementations swapped atomically in Part 1, and
        // BO's controller pinned in the SAME tx (actions 9+10) — the hooked
        // implementation is never live with an unset controller.
        expect(await collSurplusPoolProxy.getImplementation()).to.equal(poolImpl.address);
        expect(await collSurplusPoolProxy.getImplementation()).to.not.equal(prePerimeterPoolImpl);
        expect(await boProxy.getImplementation()).to.equal(hookedImpl.address);
        expect(await boProxy.getImplementation()).to.not.equal(prePerimeterZeroImpl);
        expect(await borrowerOperations.exitFeeController()).to.equal(colFee.controller.address);
        // Exactly one ExitFeeControllerSet in Part 1: Zero's. The protocol
        // singleton is Part 2's job (CF-1 — it stays the final pointer).
        expect(countPerimeterEvents(part1Receipt, "ExitFeeControllerSet")).to.equal(1);
        // §8 HARD ordering, pinned in-tx: the pool's ImplementationChanged must
        // precede the BO's within the SAME Part-1 execution receipt.
        const implChangedTopic = ethers.utils.id("ImplementationChanged(address,address)");
        const implChangeIndexes = {};
        part1Receipt.logs.forEach((log, i) => {
            if (log.topics[0] === implChangedTopic) implChangeIndexes[log.address] = i;
        });
        expect(
            implChangeIndexes[collSurplusPoolProxy.address],
            "pool ImplementationChanged present"
        ).to.not.be.undefined;
        expect(implChangeIndexes[boProxy.address], "BO ImplementationChanged present").to.not.be
            .undefined;
        expect(implChangeIndexes[collSurplusPoolProxy.address]).to.be.lessThan(
            implChangeIndexes[boProxy.address]
        );
        // Swap+wire atomicity, pinned in-tx: Zero's ExitFeeControllerSet must
        // follow the BO ImplementationChanged in the SAME receipt — the setter
        // only exists on the implementation the preceding action installs.
        const controllerSetTopic = ethers.utils.id("ExitFeeControllerSet(address,address)");
        const boControllerSetIndex = part1Receipt.logs.findIndex(
            (log) => log.topics[0] === controllerSetTopic && log.address === boProxy.address
        );
        expect(
            boControllerSetIndex,
            "BO ExitFeeControllerSet present in Part 1"
        ).to.be.greaterThan(-1);
        expect(implChangeIndexes[boProxy.address]).to.be.lessThan(boControllerSetIndex);
        // The SIP touches ONLY BorrowerOperations + CollSurplusPool on the
        // Zero side.
        expect(await troveManagerProxy.getImplementation()).to.equal(troveManagerImplBefore);
        expect(await stabilityPoolProxy.getImplementation()).to.equal(stabilityPoolImplBefore);

        // Ship-disabled throughout.
        expect(await colFee.controller.exitFeeEnabled()).to.be.false;

        // Between the parts the LENDING side is provably inert: the protocol
        // controller pointer is still unset, so a live burn pays full gross
        // even though modules+hook are already in place. (Zero is fully wired
        // by now — but the controller ships disabled, so it charges nothing.)
        await (await iRBTC.mintWithBTC(deployer, false, { value: ONE_RBTC.mul(2) })).wait();
        const iRbtcBalance = await iRBTC.balanceOf(deployer);
        const burnQuarter = iRbtcBalance.div(4);
        let vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        let receipt = await (await iRBTC.burnToBTC(deployer, burnQuarter, false)).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);

        // ── Part 2 ─────────────────────────────────────────────────────────
        // The F-2 retry: the SAME proposal that just failed out-of-order now
        // executes cleanly with Part 1 in place.
        const { executionReceipt: part2Receipt } = await executeQueuedGovernorOwnerSip(
            ctx,
            part2Id
        );
        // The treasury leg, asserted by BALANCE DELTAS against the amounts the
        // proposal itself carries: the Adoption Fund is emptied by exactly its
        // own withdrawal, the Exchequer gains exactly that amount, the Timelock
        // — which held the tokens only mid-transaction — ends where it started,
        // and the Development Fund is NOT touched by governance (its sweep is
        // the companion Exchequer multisig transaction).
        expect(
            await sovToken.balanceOf(devFundAddress),
            "Development Fund untouched by Part 2"
        ).to.equal(devFundSovBefore);
        expect(await sovToken.balanceOf(adoptionFundAddress), "Adoption Fund drained").to.equal(
            adoptionFundSovBefore.sub(adoptionSweep)
        );
        expect(await sovToken.balanceOf(exchequerAddress), "Exchequer credited").to.equal(
            exchequerSovBefore.add(adoptionSweep)
        );
        expect(
            await sovToken.balanceOf(timelockOwner.address),
            "the Timelock must not retain any of the swept SOV"
        ).to.equal(timelockSovBefore);

        // The last action: the protocol singleton — the final activation
        // pointer. Zero was already wired in Part 1 and is untouched here.
        expect(await protocol.exitFeeController()).to.equal(colFee.controller.address);
        expect(await borrowerOperations.exitFeeController()).to.equal(colFee.controller.address);
        expect(countPerimeterEvents(part2Receipt, "ExitFeeControllerSet")).to.equal(1);
        // iToken read-through now resolves the singleton — with NO per-iToken
        // configuration anywhere.
        expect(await iRBTC.exitFeeController()).to.equal(colFee.controller.address);
        expect(await iXUSD.exitFeeController()).to.equal(colFee.controller.address);
        // Still ship-disabled after ALL governance actions.
        expect(await colFee.controller.exitFeeEnabled()).to.be.false;

        // ── Lending fixtures for the live flows ────────────────────────────
        // Swap the protocol's price feed for a local one seeded with the real
        // pinned XUSD↔WRBTC rate (see XUSD_WRBTC_RATE_AT_FORK_BLOCK); the
        // protocol owner is TimelockOwner, impersonated. The AMM (used by
        // rollover's interest swap) is unaffected — only margin/deposit math
        // reads this feed.
        const priceFeedsLocalFactory = await ethers.getContractFactory(
            "PriceFeedsLocal",
            deployerSigner
        );
        const localFeeds = await priceFeedsLocalFactory.deploy(
            wrbtc.address,
            (await get("SOV")).address
        );
        await localFeeds.deployed();
        await (
            await localFeeds.setRates(xusd.address, wrbtc.address, XUSD_WRBTC_RATE_AT_FORK_BLOCK)
        ).wait();
        const originalPriceFeeds = (await get("PriceFeeds")).address;
        await (
            await protocol
                .connect(ctx.timelockOwnerSigner)
                .setPriceFeedContract(localFeeds.address)
        ).wait();

        // Borrower position: borrow XUSD against native RBTC collateral (the
        // registered loan params key on the WRBTC address, so the collateral
        // token is passed explicitly and the RBTC goes along as msg.value —
        // the same shape the dApp sends).
        const borrowAmount = ethers.utils.parseEther("300");
        const collateralNeeded = (
            await iXUSD.getDepositAmountForBorrow(borrowAmount, LOAN_DURATION, wrbtc.address)
        )
            .mul(120)
            .div(100);
        const borrowReceipt = await (
            await iXUSD.borrow(
                ethers.constants.HashZero,
                borrowAmount,
                LOAN_DURATION,
                collateralNeeded,
                wrbtc.address,
                deployer,
                deployer,
                "0x",
                { value: collateralNeeded }
            )
        ).wait();
        const borrowEvent = borrowReceipt.logs
            .map((log) => {
                try {
                    return protocol.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            })
            .find((parsed) => parsed && parsed.name === "Borrow");
        expect(borrowEvent, "Borrow event").to.not.be.undefined;
        const loanId = borrowEvent.args.loanId;

        /// Open another XUSD-against-native-RBTC loan on the same terms and
        /// return its loanId. Used by the probes that consume a whole loan, so
        /// the shared `loanId` above stays open for the no-touch section.
        const openAnotherXusdLoan = async () => {
            const receipt = await (
                await iXUSD.borrow(
                    ethers.constants.HashZero,
                    borrowAmount,
                    LOAN_DURATION,
                    collateralNeeded,
                    wrbtc.address,
                    deployer,
                    deployer,
                    "0x",
                    { value: collateralNeeded }
                )
            ).wait();
            const ev = receipt.logs
                .map((log) => {
                    try {
                        return protocol.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .find((parsed) => parsed && parsed.name === "Borrow");
            expect(ev, "Borrow event").to.not.be.undefined;
            return ev.args.loanId;
        };

        // Zero fixtures. The production ZeroPriceFeed enforces oracle
        // freshness, which the governance time-jumps break on a fork — swap
        // in the settable stub seeded with lastGoodPrice (done by the feed
        // proxy's own owner).
        await stubOutZeroPriceFeed(deployerSigner);

        // Two fresh actors with their own troves (the funder doubles as the
        // withdrawColl prober; its borrowed ZUSD later tops up the closer so
        // it can repay its whole debt).
        const funder = await getImpersonatedSigner("0x00000000000000000000000000000000c01fee11");
        const closer = await getImpersonatedSigner("0x00000000000000000000000000000000c01fee12");
        await setBalance(funder.address, ONE_RBTC.mul(10));
        await setBalance(closer.address, ONE_RBTC.mul(10));
        const minNetDebt = await borrowerOperations.MIN_NET_DEBT();
        const zeroBorrowAmount = minNetDebt.mul(2);
        await (
            await borrowerOperations
                .connect(funder)
                .openTrove(
                    MAX_ZERO_FEE_PERCENTAGE,
                    zeroBorrowAmount,
                    funder.address,
                    funder.address,
                    {
                        value: ONE_RBTC.mul(2),
                    }
                )
        ).wait();
        const probe = ethers.utils.parseEther("0.0001");

        // ── 1) DISABLED BY DEFAULT (both products) ─────────────────────────
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        receipt = await (await iRBTC.burnToBTC(deployer, burnQuarter, false)).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);

        const withdrawProbe = ethers.utils.parseEther("0.00001");
        receipt = await (
            await protocol.withdrawCollateral(loanId, deployer, withdrawProbe)
        ).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);

        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        let funderBefore = await ethers.provider.getBalance(funder.address);
        receipt = await (
            await borrowerOperations
                .connect(funder)
                .withdrawColl(probe, funder.address, funder.address)
        ).wait();
        let gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);
        expect(await ethers.provider.getBalance(funder.address)).to.equal(
            funderBefore.add(probe).sub(gasCost)
        );

        // ── 2) ENABLE (Perimeter Safe action — the test's deployer owns the
        //    controller) and re-run the same flows: they now charge. ────────
        await (await colFee.controller.setExitFeeEnabled(true)).wait();

        // 2a) Lender burn (native path): fee lands in the vault as native RBTC.
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        receipt = await (await iRBTC.burnToBTC(deployer, burnQuarter, false)).wait();
        let applied = getSingleExitFeeApplied(receipt);
        expect(applied.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW);
        expect(applied.subProduct).to.equal(iRBTC.address);
        expect(applied.feeAmount).to.equal(applied.grossAmount.mul(RATE_BPS).div(TEN_K));
        expect(applied.grossAmount).to.equal(applied.feeAmount.add(applied.netAmount));
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(
            vaultRbtcBefore.add(applied.feeAmount)
        );

        // 2a-bis) Lender burn, ERC20 path (F-4): an iXUSD burn settles its
        //     fee leg in the loan token itself — the vault takes custody of
        //     an ERC20 (XUSD) instead of native RBTC. Self-funded from the
        //     earlier XUSD borrow: deposit into the pool, burn the whole
        //     iXUSD position straight back.
        const xusdDeposit = ethers.utils.parseEther("100");
        await (await xusd.connect(deployerSigner).approve(iXUSD.address, xusdDeposit)).wait();
        // Overloaded on ILoanTokenModules (an LM variant adds a bool) — the
        // 2-arg forms are the plain-pool selectors the beacon registers.
        await (await iXUSD["mint(address,uint256)"](deployer, xusdDeposit)).wait();
        const iXusdBalance = await iXUSD.balanceOf(deployer);
        expect(iXusdBalance.gt(0), "iXUSD position minted").to.be.true;
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        const vaultXusdBeforeBurn = await xusd.balanceOf(colFee.vault.address);
        const lenderXusdBeforeBurn = await xusd.balanceOf(deployer);
        receipt = await (await iXUSD["burn(address,uint256)"](deployer, iXusdBalance)).wait();
        applied = getSingleExitFeeApplied(receipt);
        expect(applied.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW);
        expect(applied.subProduct).to.equal(iXUSD.address);
        expect(applied.asset).to.equal(xusd.address);
        expect(applied.feeAmount.gt(0), "ERC20 fee leg actually charged").to.be.true;
        expect(applied.feeAmount).to.equal(applied.grossAmount.mul(RATE_BPS).div(TEN_K));
        expect(applied.grossAmount).to.equal(applied.feeAmount.add(applied.netAmount));
        // The fee leg is an ERC20 transfer: the vault's XUSD balance grows by
        // exactly the quoted fee, the lender receives exactly net, and the
        // vault's native balance is untouched.
        expect(await xusd.balanceOf(colFee.vault.address)).to.equal(
            vaultXusdBeforeBurn.add(applied.feeAmount)
        );
        expect(await xusd.balanceOf(deployer)).to.equal(
            lenderXusdBeforeBurn.add(applied.netAmount)
        );
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);

        // 2b) Borrower withdrawCollateral (LoanMaintenance).
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        receipt = await (
            await protocol.withdrawCollateral(loanId, deployer, withdrawProbe.mul(2))
        ).wait();
        applied = getSingleExitFeeApplied(receipt);
        expect(applied.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW);
        expect(applied.subProduct).to.equal(iXUSD.address);
        expect(applied.feeAmount).to.equal(applied.grossAmount.mul(RATE_BPS).div(TEN_K));
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(
            vaultRbtcBefore.add(applied.feeAmount)
        );

        // 2c) Borrower voluntary close (LoanClosingsWith.closeWithDeposit,
        //     partial): collateral comes back minus the fee.
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        await (await xusd.connect(deployerSigner).approve(protocol.address, borrowAmount)).wait();
        receipt = await (
            await protocol.closeWithDeposit(loanId, deployer, borrowAmount.div(2))
        ).wait();
        applied = getSingleExitFeeApplied(receipt);
        expect(applied.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW);
        expect(applied.feeAmount).to.equal(applied.grossAmount.mul(RATE_BPS).div(TEN_K));
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(
            vaultRbtcBefore.add(applied.feeAmount)
        );

        // 2c-bis) LC-1 regression probe: closeWithSwap with
        //     returnTokenIsCollateral=false and swapAmount sized to
        //     principal/price (+10% swap-fee buffer), so the PARTIAL swap
        //     covers the whole principal and `_handleLoanTokenReturn` pays
        //     the excess collateral to the borrower. Pre-fix that leg was an
        //     uncharged plain `_withdrawAsset`; both payout legs must now
        //     charge. Uses its own loan so the shared probe loan stays open
        //     for the no-touch section.
        const borrowReceipt2 = await (
            await iXUSD.borrow(
                ethers.constants.HashZero,
                borrowAmount,
                LOAN_DURATION,
                collateralNeeded,
                wrbtc.address,
                deployer,
                deployer,
                "0x",
                { value: collateralNeeded }
            )
        ).wait();
        const borrowEvent2 = borrowReceipt2.logs
            .map((log) => {
                try {
                    return protocol.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            })
            .find((parsed) => parsed && parsed.name === "Borrow");
        const loanId2 = borrowEvent2.args.loanId;
        const loan2 = await protocol.getLoan(loanId2);
        const [xusdWrbtcRate, xusdWrbtcPrecision] = await localFeeds.queryRate(
            xusd.address,
            wrbtc.address
        );
        const swapAmount2 = loan2.principal
            .mul(xusdWrbtcRate)
            .div(xusdWrbtcPrecision)
            .mul(110)
            .div(100);
        expect(swapAmount2.lt(loan2.collateral), "LC-1 sizing: swapAmount < collateral").to.be
            .true;

        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        const vaultXusdBefore = await xusd.balanceOf(colFee.vault.address);
        receipt = await (
            await protocol.closeWithSwap(loanId2, deployer, swapAmount2, false, "0x")
        ).wait();

        // Fully closed by a partial-collateral swap → the excess-collateral
        // branch ran.
        expect((await protocol.getLoan(loanId2)).principal).to.equal(0);

        const appliedLegs = [];
        for (const log of receipt.logs) {
            try {
                const parsed = colFeeEventsInterface.parseLog(log);
                if (parsed.name === "ExitFeeApplied") appliedLegs.push(parsed.args);
            } catch (e) {
                // not a Perimeter event — ignore
            }
        }
        expect(appliedLegs.length, "both payout legs charged").to.equal(2);

        // The excess-collateral leg: gross is exactly the unswapped
        // collateral, paid native to the borrower; fee lands in the vault as
        // native RBTC.
        const excessLeg = appliedLegs.find(
            (a) => a.asset.toLowerCase() === wrbtc.address.toLowerCase()
        );
        expect(excessLeg, "excess-collateral leg present").to.not.be.undefined;
        expect(excessLeg.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW);
        expect(excessLeg.subProduct).to.equal(iXUSD.address);
        expect(excessLeg.grossAmount).to.equal(loan2.collateral.sub(swapAmount2));
        expect(excessLeg.feeAmount).to.equal(excessLeg.grossAmount.mul(RATE_BPS).div(TEN_K));
        expect(excessLeg.grossAmount).to.equal(excessLeg.feeAmount.add(excessLeg.netAmount));
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(
            vaultRbtcBefore.add(excessLeg.feeAmount)
        );

        // The loan-token residual leg (unchanged behavior): XUSD fee in the
        // vault.
        const residualLeg = appliedLegs.find(
            (a) => a.asset.toLowerCase() === xusd.address.toLowerCase()
        );
        expect(residualLeg, "loan-token residual leg present").to.not.be.undefined;
        expect(residualLeg.feeAmount).to.equal(residualLeg.grossAmount.mul(RATE_BPS).div(TEN_K));
        expect(await xusd.balanceOf(colFee.vault.address)).to.equal(
            vaultXusdBefore.add(residualLeg.feeAmount)
        );

        // 2c-ter) closeWithSwap with returnTokenIsCollateral=TRUE — the other
        //     half of the swap-close surface. 2c-bis covers the
        //     `_handleLoanTokenReturn` shape (loan-token residual + excess
        //     collateral); this covers `_finalizeSwapClose` paying the residual
        //     as COLLATERAL, delivered native. Without it the fork rehearsal
        //     never exercises the collateral-side swap-close payout at all.
        const loanId3 = await openAnotherXusdLoan();
        const loan3 = await protocol.getLoan(loanId3);
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        receipt = await (
            await protocol.closeWithSwap(loanId3, deployer, loan3.collateral, true, "0x")
        ).wait();
        expect((await protocol.getLoan(loanId3)).principal, "loan 3 fully closed").to.equal(0);
        applied = getSingleExitFeeApplied(receipt);
        expect(applied.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW);
        expect(applied.subProduct).to.equal(iXUSD.address);
        expect(applied.asset.toLowerCase(), "residual paid in the COLLATERAL token").to.equal(
            wrbtc.address.toLowerCase()
        );
        expect(applied.feeAmount.gt(0), "collateral-side residual actually charged").to.be.true;
        expect(applied.feeAmount).to.equal(applied.grossAmount.mul(RATE_BPS).div(TEN_K));
        expect(applied.grossAmount).to.equal(applied.feeAmount.add(applied.netAmount));
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(
            vaultRbtcBefore.add(applied.feeAmount)
        );

        // 2d) Zero withdrawColl: fee lands in the vault as native RBTC.
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        funderBefore = await ethers.provider.getBalance(funder.address);
        receipt = await (
            await borrowerOperations
                .connect(funder)
                .withdrawColl(probe, funder.address, funder.address)
        ).wait();
        gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        applied = getSingleExitFeeApplied(receipt);
        expect(applied.surfaceId).to.equal(PERIMETER_SURFACE_ZERO_WITHDRAW_COLL);
        expect(applied.actor).to.equal(funder.address);
        expect(applied.grossAmount).to.equal(probe);
        expect(applied.feeAmount).to.equal(probe.mul(RATE_BPS).div(TEN_K));
        expect(applied.grossAmount).to.equal(applied.feeAmount.add(applied.netAmount));
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(
            vaultRbtcBefore.add(applied.feeAmount)
        );
        expect(await ethers.provider.getBalance(funder.address)).to.equal(
            funderBefore.add(applied.netAmount).sub(gasCost)
        );

        // 2e) Zero closeTrove: fee on the full returned collateral.
        await (
            await borrowerOperations
                .connect(closer)
                .openTrove(
                    MAX_ZERO_FEE_PERCENTAGE,
                    zeroBorrowAmount,
                    closer.address,
                    closer.address,
                    {
                        value: ONE_RBTC.mul(2),
                    }
                )
        ).wait();
        await (
            await zusd
                .connect(funder)
                .transfer(closer.address, await zusd.balanceOf(funder.address))
        ).wait();
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        const closerBefore = await ethers.provider.getBalance(closer.address);
        receipt = await (await borrowerOperations.connect(closer).closeTrove()).wait();
        gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        applied = getSingleExitFeeApplied(receipt);
        expect(applied.surfaceId).to.equal(PERIMETER_SURFACE_ZERO_WITHDRAW_COLL);
        expect(applied.grossAmount).to.equal(ONE_RBTC.mul(2)); // full trove collateral
        expect(applied.feeAmount).to.equal(applied.grossAmount.mul(RATE_BPS).div(TEN_K));
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(
            vaultRbtcBefore.add(applied.feeAmount)
        );
        expect(await ethers.provider.getBalance(closer.address)).to.equal(
            closerBefore.add(applied.netAmount).sub(gasCost)
        );

        // ── 3) NO-TOUCH paths ──────────────────────────────────────────────
        // 3a) Rollover, keeper-reward path.
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        // 31 days: past the initial 28-day term now, and past the MONTH
        // (365/12 ≈ 30.42 days) Torque-rollover extension the next time.
        await time.increase(31 * 24 * 3600);
        const keeper = await getImpersonatedSigner("0x00000000000000000000000000000000c01fee01");
        await setBalance(keeper.address, ONE_RBTC);
        let loanBeforeRollover = await protocol.getLoan(loanId);
        receipt = await (await protocol.connect(keeper).rollover(loanId, "0x")).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(countPerimeterEvents(receipt, "ExitFeeSkipped")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);
        // NOT BLOCKED: the rollover did its job — the term was extended.
        expect(
            (await protocol.getLoan(loanId)).endTimestamp.gt(loanBeforeRollover.endTimestamp),
            "keeper rollover extended the loan term"
        ).to.be.true;

        // 3b) Borrower-initiated rollover (the CloseOrigin gate keys on the
        //     origin, not the caller).
        await time.increase(31 * 24 * 3600);
        loanBeforeRollover = await protocol.getLoan(loanId);
        receipt = await (await protocol.rollover(loanId, "0x")).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(countPerimeterEvents(receipt, "ExitFeeSkipped")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);
        expect(
            (await protocol.getLoan(loanId)).endTimestamp.gt(loanBeforeRollover.endTimestamp),
            "borrower-self rollover extended the loan term"
        ).to.be.true;

        // 3c) Liquidation. Crash the WRBTC→XUSD rate on the local feed
        //     (collateral quoted in loan token collapses → the loan is
        //     undercollateralized), then partially liquidate from a third
        //     party.
        await (
            await localFeeds.setRates(wrbtc.address, xusd.address, ethers.utils.parseEther("1"))
        ).wait();
        const liquidator = await getImpersonatedSigner(
            "0x00000000000000000000000000000000c01fee02"
        );
        await setBalance(liquidator.address, ONE_RBTC);
        const liquidatorRepay = ethers.utils.parseEther("10");
        await (
            await xusd.connect(deployerSigner).transfer(liquidator.address, liquidatorRepay)
        ).wait();
        await (await xusd.connect(liquidator).approve(protocol.address, liquidatorRepay)).wait();
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        const loanBeforeLiquidation = await protocol.getLoan(loanId);
        receipt = await (
            await protocol
                .connect(liquidator)
                .liquidate(loanId, liquidator.address, liquidatorRepay)
        ).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(countPerimeterEvents(receipt, "ExitFeeSkipped")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);
        // NOT BLOCKED: the liquidation actually executed — collateral seized
        // and principal repaid. (A Perimeter regression that bricked liquidation
        // would still satisfy "no fee charged" without this.)
        const loanAfterLiquidation = await protocol.getLoan(loanId);
        expect(
            loanAfterLiquidation.collateral.lt(loanBeforeLiquidation.collateral),
            "liquidation seized collateral"
        ).to.be.true;
        expect(
            loanAfterLiquidation.principal.lt(loanBeforeLiquidation.principal),
            "liquidation repaid principal"
        ).to.be.true;

        // Un-crash the local rate for anything that still quotes it (the real
        // feed stays swapped out until the end: Zero's stability-pool reward
        // issuance also routes through the Sovryn PriceFeeds, and the real
        // one is MoC-stale on a fork).
        await (
            await localFeeds.setRates(
                wrbtc.address,
                xusd.address,
                ethers.constants.WeiPerEther.mul(ethers.constants.WeiPerEther).div(
                    XUSD_WRBTC_RATE_AT_FORK_BLOCK
                )
            )
        ).wait();

        // 3d) Zero stability pool: deposits/withdrawals move funds with no fee
        //     (they don't route through BorrowerOperations). Its SOV-gain
        //     issuance prices through ZeroCommunityIssuance's OWN Sovryn
        //     PriceFeeds pointer — swap that to the local feed too (the real
        //     one is MoC-stale on a fork), via its own impersonated owner.
        const communityIssuance = await ethers.getContract("ZeroCommunityIssuance");
        const communityIssuanceOwner = await getImpersonatedSigner(
            await communityIssuance.getOwner()
        );
        await setBalance(communityIssuanceOwner.address, ONE_RBTC);
        const originalCommunityIssuanceFeed = await communityIssuance.priceFeed();
        await (
            await communityIssuance
                .connect(communityIssuanceOwner)
                .setPriceFeed(localFeeds.address)
        ).wait();

        const stabilityPool = await ethers.getContract("StabilityPool");
        const spAmount = ethers.utils.parseEther("50");
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        receipt = await (
            await stabilityPool.connect(closer).provideToSP(spAmount, ethers.constants.AddressZero)
        ).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        receipt = await (await stabilityPool.connect(closer).withdrawFromSP(spAmount)).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);

        // 3e) Zero redemption: pays collateral for ZUSD with no exit fee.
        const troveManager = await ethers.getContract("TroveManager");
        const hintHelpers = await ethers.getContract("HintHelpers");
        const priceFeed = await ethers.getContract("PriceFeed");
        const sortedTroves = await ethers.getContract("SortedTroves");
        const price = await priceFeed.callStatic.fetchPrice();
        const { firstRedemptionHint, partialRedemptionHintNICR, truncatedZUSDamount } =
            await hintHelpers.getRedemptionHints(ethers.utils.parseEther("10"), price, 0);
        const redeemAmount = truncatedZUSDamount.gt(0)
            ? truncatedZUSDamount
            : ethers.utils.parseEther("10");
        const [upperHint, lowerHint] = await sortedTroves.findInsertPosition(
            partialRedemptionHintNICR,
            firstRedemptionHint,
            firstRedemptionHint
        );
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        receipt = await (
            await troveManager
                .connect(closer)
                .redeemCollateral(
                    redeemAmount,
                    firstRedemptionHint,
                    upperHint,
                    lowerHint,
                    partialRedemptionHintNICR,
                    0,
                    MAX_ZERO_FEE_PERCENTAGE
                )
        ).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);

        // ── 2f) Zero surplus claim (PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS) — a CHARGED
        //     probe, placed after 3e because it reuses the redemption
        //     plumbing. A FULL redemption of a deterministic probe trove
        //     leaves its owner a collateral surplus in the (part-1-upgraded)
        //     CollSurplusPool; claimCollateral() then routes the pool's new
        //     claimCollWithFee two-leg split and is charged (runbook §8).
        const surplusVictim = await getImpersonatedSigner(
            "0x00000000000000000000000000000000c01fee13"
        );
        await setBalance(surplusVictim.address, ONE_RBTC.mul(10));
        const gasComp = await borrowerOperations.ZUSD_GAS_COMPENSATION();
        // Open the probe trove as the system's riskiest REDEEMABLE trove
        // (fee-aware: the redemption in 3e raised the baseRate, so the
        // origination fee is predicted, not floored). The full redemption in
        // 3f must consume exactly this trove, so its open ICR is derived from
        // the live queue floor at the fork pin instead of hardcoded: halfway
        // between the MCR and the current first-redeemable ICR, capped at
        // 113% when the floor is roomy. The price is stubbed (frozen) and
        // Zero troves accrue no interest, so the derived ordering holds.
        const victimBorrowFee = await troveManager.getBorrowingFeeWithDecay(zeroBorrowAmount);
        const victimExpectedDebt = zeroBorrowAmount.add(victimBorrowFee).add(gasComp);
        const mcr = await troveManager.MCR();
        let probeIcr = ethers.utils.parseEther("1.13");
        const floorHints = await hintHelpers.getRedemptionHints(
            ethers.utils.parseEther("1"),
            price,
            0
        );
        if (floorHints.firstRedemptionHint !== ethers.constants.AddressZero) {
            const floorIcr = await troveManager.getCurrentICR(
                floorHints.firstRedemptionHint,
                price
            );
            if (floorIcr.lte(probeIcr)) {
                const gap = floorIcr.sub(mcr);
                expect(
                    gap.gte(ethers.utils.parseEther("0.0004")),
                    "live queue floor ICR grazes the MCR — no room to open the probe " +
                        "below it; re-pin COLFEE_FORK_BLOCK or fully redeem the floor trove first"
                ).to.be.true;
                probeIcr = mcr.add(gap.div(2));
            }
        }
        const victimColl = victimExpectedDebt.mul(probeIcr).div(price).add(1);
        await (
            await borrowerOperations
                .connect(surplusVictim)
                .openTrove(
                    MAX_ZERO_FEE_PERCENTAGE,
                    zeroBorrowAmount,
                    surplusVictim.address,
                    surplusVictim.address,
                    { value: victimColl }
                )
        ).wait();
        // Full-redemption budget = the victim's entire debt minus the gas
        // compensation; the victim's fresh ZUSD + the closer's leftovers fund
        // the redeemer (closer).
        const victimEntire = await troveManager.getEntireDebtAndColl(surplusVictim.address);
        const victimRedeemable = victimEntire.debt.sub(gasComp);
        await (
            await zusd
                .connect(surplusVictim)
                .transfer(closer.address, await zusd.balanceOf(surplusVictim.address))
        ).wait();
        expect(
            (await zusd.balanceOf(closer.address)).gte(victimRedeemable),
            "closer must hold enough ZUSD to fully redeem the probe trove"
        ).to.be.true;
        const surplusHints = await hintHelpers.getRedemptionHints(victimRedeemable, price, 0);
        expect(
            surplusHints.firstRedemptionHint,
            "the probe trove must be the system's first redeemable trove — " +
                "lower its open ICR if a mainnet trove sits below it"
        ).to.equal(surplusVictim.address);
        const [surplusUpper, surplusLower] = await sortedTroves.findInsertPosition(
            surplusHints.partialRedemptionHintNICR,
            surplusHints.firstRedemptionHint,
            surplusHints.firstRedemptionHint
        );
        await (
            await troveManager
                .connect(closer)
                .redeemCollateral(
                    victimRedeemable,
                    surplusHints.firstRedemptionHint,
                    surplusUpper,
                    surplusLower,
                    surplusHints.partialRedemptionHintNICR,
                    0,
                    MAX_ZERO_FEE_PERCENTAGE
                )
        ).wait();
        // 4 == closedByRedemption; the trove's leftover collateral is now a
        // claimable surplus.
        expect(await troveManager.getTroveStatus(surplusVictim.address)).to.equal(4);
        const surplusGross = await collSurplusPool.getCollateral(surplusVictim.address);
        expect(surplusGross.gt(0), "full redemption must leave a surplus").to.be.true;
        const poolEthBefore = await collSurplusPool.getETH();
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        const victimBefore = await ethers.provider.getBalance(surplusVictim.address);
        receipt = await (await borrowerOperations.connect(surplusVictim).claimCollateral()).wait();
        gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        applied = getSingleExitFeeApplied(receipt);
        expect(applied.surfaceId).to.equal(PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS);
        expect(applied.actor).to.equal(surplusVictim.address);
        expect(applied.grossAmount).to.equal(surplusGross);
        expect(applied.feeAmount).to.equal(surplusGross.mul(RATE_BPS).div(TEN_K));
        expect(applied.grossAmount).to.equal(applied.feeAmount.add(applied.netAmount));
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(
            vaultRbtcBefore.add(applied.feeAmount)
        );
        expect(await ethers.provider.getBalance(surplusVictim.address)).to.equal(
            victimBefore.add(applied.netAmount).sub(gasCost)
        );
        // The pool drains by EXACTLY gross — the two-leg split leaves no
        // residue, and the victim's claim is zeroed.
        expect(await collSurplusPool.getETH()).to.equal(poolEthBefore.sub(surplusGross));
        expect(await collSurplusPool.getCollateral(surplusVictim.address)).to.equal(0);

        // ── 4) KILL SWITCH: a single Safe disable stops all charging ───────
        // Re-run one probe per PRODUCT that was charging above — lender exit,
        // borrower exit and Zero — so "stops charging" is proven where the
        // charging was proven, not only on the lending lender surface.
        await (await colFee.controller.setExitFeeEnabled(false)).wait();

        // 4a) Lending, lender exit (iToken burn).
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        receipt = await (await iRBTC.burnToBTC(deployer, burnQuarter, false)).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);

        // 4b) Lending, borrower exit (withdrawCollateral on a fresh loan, so
        //     the probe is independent of the liquidated shared loan's margin).
        const killSwitchLoanId = await openAnotherXusdLoan();
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        receipt = await (
            await protocol.withdrawCollateral(killSwitchLoanId, deployer, withdrawProbe)
        ).wait();
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);

        // 4c) Zero, borrower exit (withdrawColl) — and the user now receives
        //     the FULL gross, not a net: the clearest disabled-state proof.
        vaultRbtcBefore = await ethers.provider.getBalance(colFee.vault.address);
        funderBefore = await ethers.provider.getBalance(funder.address);
        receipt = await (
            await borrowerOperations
                .connect(funder)
                .withdrawColl(probe, funder.address, funder.address)
        ).wait();
        gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        expect(countPerimeterEvents(receipt, "ExitFeeApplied")).to.equal(0);
        expect(await ethers.provider.getBalance(colFee.vault.address)).to.equal(vaultRbtcBefore);
        expect(
            await ethers.provider.getBalance(funder.address),
            "Zero withdrawColl pays FULL gross once disabled"
        ).to.equal(funderBefore.add(probe).sub(gasCost));

        // Hygiene: hand the real price feeds back.
        await (
            await communityIssuance
                .connect(communityIssuanceOwner)
                .setPriceFeed(originalCommunityIssuanceFeed)
        ).wait();
        await (
            await protocol
                .connect(ctx.timelockOwnerSigner)
                .setPriceFeedContract(originalPriceFeeds)
        ).wait();
    });
});
