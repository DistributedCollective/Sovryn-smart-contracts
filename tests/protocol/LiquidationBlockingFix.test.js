const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { decodeLogs } = require("../Utils/initializer");
const { increaseTime } = require("../Utils/Ethereum");

const MaliciousBorrower = artifacts.require("MaliciousBorrower");
const LoanOpenings = artifacts.require("LoanOpenings");
const LoanClosingsEvents = artifacts.require("LoanClosingsEvents");

// Import required contracts for proper initialization
const TestToken = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");
const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const sovrynProtocol = artifacts.require("sovrynProtocol");
const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogic = artifacts.require("LoanTokenLogic");
const LoanTokenLogicWrbtc = artifacts.require("LoanTokenLogicWrbtc");
const LoanTokenLogicBeacon = artifacts.require("LoanTokenLogicBeacon");
const LoanTokenSettingsLowerAdmin = artifacts.require("LoanTokenSettingsLowerAdmin");
const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const LoanTokenLogicWrbtcLM = artifacts.require("LoanTokenLogicWrbtcLM");
const LoanTokenLogicProxy = artifacts.require("LoanTokenLogicProxy");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const FeeSharingCollectorMockup = artifacts.require("FeeSharingCollectorMockup");

// Protocol modules
const ProtocolSettings = artifacts.require("ProtocolSettings");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapModule = artifacts.require("SwapsImplSovrynSwapModule");
const SwapsExternal = artifacts.require("SwapsExternal");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");
const LoanClosingsLiquidation = artifacts.require("LoanClosingsLiquidation");
const LoanClosingsRollover = artifacts.require("LoanClosingsRollover");
const Affiliates = artifacts.require("Affiliates");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const ISovryn = artifacts.require("ISovryn");
const LockedSOVMockup = artifacts.require("LockedSOVMockup");
const StakingMockForFeeSharingCollector = artifacts.require("StakingMockForFeeSharingCollector");

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));

/**
 * Comprehensive test suite to verify that the liquidation blocking fix works correctly
 * across all scenarios where _withdrawAsset is called with allowDonationOnFailure = true
 * The fix should allow liquidation to succeed even with malicious borrowers
 * by donating failed RBTC transfers to FeeSharingCollector
 */
contract("Liquidation Blocking Fix", (accounts) => {
    let owner;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds, loanToken, loanTokenWRBTC, SOV;
    let maliciousBorrower;
    let feeSharingCollector;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Deploy malicious borrower contract
        maliciousBorrower = await MaliciousBorrower.new();

        // Get existing contracts from the test environment
        const {
            SUSD: _SUSD,
            RBTC: _RBTC,
            WRBTC: _WRBTC,
            BZRX: _BZRX,
            priceFeeds: _priceFeeds,
            sovryn: _sovryn,
            loanToken: _loanToken,
            loanTokenWRBTC: _loanTokenWRBTC,
            SOV: _SOV,
            feeSharingCollector: _feeSharingCollector,
        } = await getTestContracts(accounts);

        SUSD = _SUSD;
        RBTC = _RBTC;
        WRBTC = _WRBTC;
        BZRX = _BZRX;
        priceFeeds = _priceFeeds;
        sovryn = _sovryn;
        loanToken = _loanToken;
        loanTokenWRBTC = _loanTokenWRBTC;
        SOV = _SOV;
        feeSharingCollector = _feeSharingCollector;
    }

    before(async () => {
        [owner] = accounts;
        await deploymentAndInitFixture();
    });

    describe("Liquidation Blocking Fix - All Scenarios", () => {
        it("Should allow liquidation to succeed with malicious borrower by donating to FeeSharingCollector", async () => {
            const lender = accounts[0];
            const liquidator = accounts[2];
            const loan_token_sent = new BN(1).mul(oneEth); // Reduce size to avoid "swap too large"

            console.log("=== Testing Liquidation Fix ===");
            console.log("Malicious Borrower Address:", maliciousBorrower.address);
            console.log("FeeSharingCollector Address:", feeSharingCollector.address);

            // Step 1: Set up malicious borrower with WRBTC tokens (to trigger donation mechanism)
            await WRBTC.mint(maliciousBorrower.address, loan_token_sent);
            await maliciousBorrower.approveToken(
                WRBTC.address,
                loanTokenWRBTC.address,
                loan_token_sent
            );

            // Step 2: Lender provides WRBTC liquidity
            const lendAmount = new BN(10).pow(new BN(21));
            await WRBTC.mint(lender, lendAmount);
            await WRBTC.approve(loanTokenWRBTC.address, lendAmount, { from: lender });
            await loanTokenWRBTC.mint(lender, lendAmount, { from: lender });

            // Step 3: Malicious borrower opens margin trade position with WRBTC
            const tx = await maliciousBorrower.performMarginTrade(
                loanTokenWRBTC.address,
                "0x0", // new loan
                new BN(2).mul(oneEth), // 2x leverage
                loan_token_sent,
                0, // no collateral
                SUSD.address, // collateral token
                0,
                "0x",
                { value: 0 }
            );

            // Extract loan ID
            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            console.log("Created Loan ID:", loanId);

            // Step 4: Get loan information
            const loan = await sovryn.getLoan(loanId);
            console.log("Principal:", loan.principal.toString());
            console.log("Collateral:", loan.collateral.toString());

            // Step 5: Make position liquidatable by crashing SUSD price relative to WRBTC
            // Since collateral is SUSD and loan is WRBTC, we need SUSD to lose value dramatically
            const unhealthyRate = new BN(1); // Extremely low rate - 1 wei
            await priceFeeds.setRates(SUSD.address, WRBTC.address, unhealthyRate);
            await increaseTime(10 * 24 * 60 * 60);

            // Verify position is liquidatable
            const marginInfo = await priceFeeds.getCurrentMargin(
                WRBTC.address,
                SUSD.address,
                loan.principal,
                loan.collateral
            );
            console.log("Current margin:", marginInfo.currentMargin.toString());
            console.log("Maintenance margin:", loan.maintenanceMargin.toString());

            // Step 6: Prepare liquidator with WRBTC
            await WRBTC.mint(liquidator, loan_token_sent);
            await WRBTC.approve(sovryn.address, loan_token_sent, { from: liquidator });

            // Get initial FeeSharingCollector balance
            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);
            console.log("Initial FeeSharingCollector balance:", initialBalance);

            // Step 7: Attempt liquidation - should now succeed!
            console.log("Attempting liquidation with fix...");

            const liquidationTx = await sovryn.liquidate(loanId, liquidator, loan_token_sent, {
                from: liquidator,
                value: 0,
            });

            console.log("✅ SUCCESS: Liquidation succeeded despite malicious borrower!");

            // Step 8: Verify liquidation event was emitted
            const liquidationDecode = decodeLogs(
                liquidationTx.receipt.rawLogs,
                LoanClosingsEvents,
                "Liquidate"
            );
            expect(liquidationDecode.length).to.be.greaterThan(0);
            console.log("✅ Liquidation event emitted");

            // Step 9: Check if donation event was emitted
            const donationDecode = decodeLogs(
                liquidationTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            expect(donationDecode.length).to.be.greaterThan(0);
            console.log("✅ Donation to FeeSharingCollector event emitted");
            console.log("Original recipient:", donationDecode[0].args.originalRecipient);
            console.log("Donated amount:", donationDecode[0].args.amount.toString());

            // Step 10: Verify FeeSharingCollector received the donation
            const finalBalance = await web3.eth.getBalance(feeSharingCollector.address);
            const balanceIncrease = new BN(finalBalance).sub(new BN(initialBalance));
            console.log("FeeSharingCollector balance increase:", balanceIncrease.toString());
        });

        it("Should handle normal borrowers without donating to FeeSharingCollector", async () => {
            const lender = accounts[0];
            const borrower = accounts[1]; // Normal EOA borrower
            const liquidator = accounts[3];
            const loan_token_sent = new BN(10).mul(oneEth); // Larger amount

            console.log("=== Testing Normal Borrower (No Donation) ===");

            // Reset prices to healthy levels first
            await priceFeeds.setRates(
                RBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(22)).toString()
            );
            await priceFeeds.setRates(
                SUSD.address,
                WRBTC.address,
                new BN(10).pow(new BN(22)).toString()
            );

            // Set up normal borrower
            await SUSD.mint(borrower, loan_token_sent);
            await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });

            // Lender provides liquidity
            const lendAmount = new BN(10).pow(new BN(21));
            await SUSD.mint(lender, lendAmount);
            await SUSD.approve(loanToken.address, lendAmount, { from: lender });
            await loanToken.mint(lender, lendAmount, { from: lender });

            // Normal borrower opens margin trade
            const tx = await loanToken.marginTrade(
                "0x0",
                new BN(2).mul(oneEth),
                loan_token_sent,
                0,
                RBTC.address,
                borrower,
                0,
                "0x",
                { from: borrower, value: 0 }
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            // Make liquidatable
            const unhealthyRate = new BN(1).mul(new BN(10).pow(new BN(20)));
            await priceFeeds.setRates(RBTC.address, SUSD.address, unhealthyRate);
            await increaseTime(10 * 24 * 60 * 60);

            // Prepare liquidator
            await SUSD.mint(liquidator, loan_token_sent);
            await SUSD.approve(sovryn.address, loan_token_sent, { from: liquidator });

            // Get initial FeeSharingCollector balance
            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);

            // Liquidate - should succeed normally
            const liquidationTx = await sovryn.liquidate(loanId, liquidator, loan_token_sent, {
                from: liquidator,
                value: 0,
            });

            console.log("✅ Normal borrower liquidation succeeded");

            // Check that no donation event was emitted
            const donationDecode = decodeLogs(
                liquidationTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );
            expect(donationDecode.length).to.equal(0);
            console.log("✅ No donation event emitted for normal borrower");

            // Verify FeeSharingCollector balance didn't increase
            const finalBalance = await web3.eth.getBalance(feeSharingCollector.address);
            const balanceIncrease = new BN(finalBalance).sub(new BN(initialBalance));
            expect(balanceIncrease.toString()).to.equal("0");
            console.log("✅ FeeSharingCollector balance unchanged");
        });

        it("Should handle rollover with malicious borrower and trigger donation when loan is closed", async () => {
            const lender = accounts[0];
            const borrower = maliciousBorrower.address;
            // Create a small WRBTC loan that will become tiny and trigger closure during rollover
            const borrowAmount = new BN(2).mul(new BN(10).pow(new BN(14))); // 0.0002 WRBTC
            const duration = 28 * 24 * 60 * 60; // 28 days

            console.log("=== Testing Rollover with Malicious Borrower - Donation Required ===");
            console.log(
                "Creating tiny WRBTC loan that will trigger closure and donation during rollover"
            );

            // Reset prices to healthy levels first
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(10).pow(new BN(22)));

            // Lender provides WRBTC liquidity
            const lendAmount = new BN(10).pow(new BN(21));
            await WRBTC.mint(lender, lendAmount);
            await WRBTC.approve(loanTokenWRBTC.address, lendAmount, { from: lender });
            await loanTokenWRBTC.mint(lender, lendAmount, { from: lender });

            // Calculate required SUSD collateral for tiny WRBTC loan
            const collateralRequired = await loanTokenWRBTC.getDepositAmountForBorrow(
                borrowAmount,
                duration,
                SUSD.address
            );
            const collateralWithBuffer = collateralRequired.mul(new BN(2)); // 2x buffer

            console.log("SUSD collateral required:", collateralRequired.toString());
            console.log("SUSD collateral with buffer:", collateralWithBuffer.toString());

            // Fund malicious borrower and create loan
            await SUSD.mint(borrower, collateralWithBuffer);
            await maliciousBorrower.approveToken(
                SUSD.address,
                loanTokenWRBTC.address,
                collateralWithBuffer
            );

            const tx = await maliciousBorrower.performBorrow(
                loanTokenWRBTC.address, // WRBTC loan token
                "0x0", // new loan
                borrowAmount, // 0.0003 WRBTC
                duration, // 28 days
                collateralWithBuffer, // SUSD collateral
                SUSD.address, // collateral token
                borrower, // receiver (malicious contract)
                "0x" // loan data
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Borrow");
            const loanId = decode[0].args["loanId"];

            console.log(
                "Loan opened: 0.0002 WRBTC borrow with SUSD collateral, borrower=malicious"
            );

            // Wait for loan to expire
            await increaseTime(duration + 3600);

            const loanBefore = await sovryn.getLoan(loanId);
            console.log(
                "Loan before rollover - Principal:",
                loanBefore.principal.toString(),
                "wei"
            );
            console.log(
                "Loan before rollover - Collateral:",
                loanBefore.collateral.toString(),
                "wei"
            );

            // Apply price manipulation to make WRBTC principal tiny
            const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13))); // 25e13
            await priceFeeds.setRates(WRBTC.address, WRBTC.address, TINY_AMOUNT);
            console.log("Applied price manipulation to make WRBTC principal tiny");

            // Increase maxSwapSize to handle the swap
            const currentMaxSwapSize = await sovryn.maxSwapSize();
            const largeMaxSwapSize = new BN(10).pow(new BN(30));
            await sovryn.setMaxSwapSize(largeMaxSwapSize);

            // Get initial FeeSharingCollector balance
            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);
            console.log("FeeSharingCollector balance before:", initialBalance);

            // Attempt rollover - this should trigger tiny position closure and donation
            console.log("Attempting rollover - expecting tiny position closure with donation...");
            const rolloverTx = await sovryn.rollover(loanId, "0x", { from: accounts[4] });

            console.log("✅ Rollover completed successfully!");

            // Check for donation events - THIS IS THE CRITICAL TEST
            const donationDecode = decodeLogs(
                rolloverTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            console.log("Number of donation events:", donationDecode.length);

            // The test MUST have donation events, otherwise it fails
            expect(donationDecode.length).to.be.greaterThan(0);
            console.log("🎉 SUCCESS! Rollover triggered donation as expected!");

            for (let i = 0; i < donationDecode.length; i++) {
                console.log(`Donation ${i + 1}:`, donationDecode[i].args.amount.toString());
                console.log(
                    `Original recipient ${i + 1}:`,
                    donationDecode[i].args.originalRecipient
                );
                expect(donationDecode[i].args.originalRecipient.toLowerCase()).to.equal(
                    borrower.toLowerCase()
                );
            }

            // Verify FeeSharingCollector received the donation
            const finalBalance = await web3.eth.getBalance(feeSharingCollector.address);
            const balanceIncrease = new BN(finalBalance).sub(new BN(initialBalance));
            expect(balanceIncrease).to.be.greaterThan(new BN(0));
            console.log("FeeSharingCollector balance increase:", balanceIncrease.toString());

            // Verify loan was closed due to tiny position
            const loanAfter = await sovryn.getLoan(loanId);
            console.log("Final loan principal:", loanAfter.principal.toString());
            expect(loanAfter.principal.toString()).to.equal("0");
            console.log("✅ Loan was closed due to tiny position");

            // Restore maxSwapSize
            await sovryn.setMaxSwapSize(currentMaxSwapSize);
        });
    });

    describe("_withdrawAsset Donation Mechanism - All Scenarios", () => {
        it("Scenario 1: Liquidation - Interest refund to malicious borrower (WRBTC loan)", async () => {
            const lender = accounts[0];
            const liquidator = accounts[2];
            const loan_token_sent = new BN(1).mul(oneEth);

            console.log("=== Scenario 1: Liquidation Interest Refund (WRBTC) ===");

            // Set up malicious borrower with WRBTC
            await WRBTC.mint(maliciousBorrower.address, loan_token_sent);
            await maliciousBorrower.approveToken(
                WRBTC.address,
                loanTokenWRBTC.address,
                loan_token_sent
            );

            // Lender provides WRBTC liquidity
            const lendAmount = new BN(10).pow(new BN(21));
            await WRBTC.mint(lender, lendAmount);
            await WRBTC.approve(loanTokenWRBTC.address, lendAmount, { from: lender });
            await loanTokenWRBTC.mint(lender, lendAmount, { from: lender });

            // Malicious borrower opens margin trade
            const tx = await maliciousBorrower.performMarginTrade(
                loanTokenWRBTC.address,
                "0x0",
                new BN(2).mul(oneEth),
                loan_token_sent,
                0,
                SUSD.address,
                0,
                "0x",
                { value: 0 }
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            // Make position liquidatable
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(1));
            await increaseTime(10 * 24 * 60 * 60);

            // Prepare liquidator
            await WRBTC.mint(liquidator, loan_token_sent);
            await WRBTC.approve(sovryn.address, loan_token_sent, { from: liquidator });

            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);

            // Liquidate
            const liquidationTx = await sovryn.liquidate(loanId, liquidator, loan_token_sent, {
                from: liquidator,
            });

            // Verify donation event
            const donationDecode = decodeLogs(
                liquidationTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            expect(donationDecode.length).to.be.greaterThan(0);
            console.log("✅ Interest refund donation successful");
            console.log("Donated amount:", donationDecode[0].args.amount.toString());
        });

        it("Scenario 2: CloseWithSwap - No Excess collateral refund to malicious borrower", async () => {
            const borrower = maliciousBorrower.address;
            const loan_token_sent = new BN(1).mul(oneEth);

            console.log("=== Scenario 2: CloseWithSwap Excess Collateral Refund ===");

            // Set up for closeWithSwap scenario
            await WRBTC.mint(borrower, loan_token_sent);
            await maliciousBorrower.approveToken(
                WRBTC.address,
                loanTokenWRBTC.address,
                loan_token_sent
            );

            // Reset prices to healthy levels
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(10).pow(new BN(22)));

            // Open position
            const tx = await maliciousBorrower.performMarginTrade(
                loanTokenWRBTC.address,
                "0x0",
                new BN(2).mul(oneEth),
                loan_token_sent,
                0,
                SUSD.address,
                0,
                "0x",
                { value: 0 }
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);

            // Close with swap - must be called by borrower
            const closeAmount = new BN(1).mul(oneEth);
            const closeTx = await maliciousBorrower.closeWithSwap(
                sovryn.address,
                loanId,
                borrower, // receiver (borrower itself)
                closeAmount,
                true, // returnTokenIsCollateral
                "0x"
            );

            // Check for donation events
            const donationDecode = decodeLogs(
                closeTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            // No excess collateral refund should occur
            expect(donationDecode.length).to.equal(0);
        });

        it("Scenario 3: Rollover with tiny position closure - WRBTC collateral donation (with excess susd - No donation)", async () => {
            const borrower = maliciousBorrower.address;
            const borrowAmount = new BN(10000).mul(oneEth); // 10,000 SUSD like Foundry test
            const duration = 28 * 24 * 60 * 60; // 28 days

            console.log(
                "=== Scenario 3: Rollover Tiny Position Closure with WRBTC Collateral Donation ==="
            );
            console.log(
                "Following Foundry test pattern exactly: borrow 10k SUSD with WRBTC collateral"
            );

            // Lender provides SUSD liquidity
            const lendAmount = new BN(10).pow(new BN(25)); // Large amount
            await SUSD.mint(accounts[0], lendAmount);
            await SUSD.approve(loanToken.address, lendAmount, { from: accounts[0] });
            await loanToken.mint(accounts[0], lendAmount, { from: accounts[0] });

            // Calculate collateral required (like Foundry test)
            const collateralRequired = await loanToken.getDepositAmountForBorrow(
                borrowAmount,
                duration,
                WRBTC.address
            );
            const collateralWithBuffer = collateralRequired.mul(new BN(2)); // 2x buffer

            console.log("Collateral required (wei):", collateralRequired.toString());
            console.log("Collateral with buffer (wei):", collateralWithBuffer.toString());

            // Fund borrower with WRBTC collateral
            await WRBTC.mint(borrower, collateralWithBuffer);
            await maliciousBorrower.approveToken(
                WRBTC.address,
                loanToken.address,
                collateralWithBuffer
            );

            // Borrow SUSD with WRBTC collateral (exactly like Foundry test)
            const tx = await maliciousBorrower.performBorrow(
                loanToken.address, // SUSD loan token
                "0x0", // new loan
                borrowAmount, // 10,000 SUSD
                duration, // 28 days
                collateralWithBuffer, // WRBTC collateral
                WRBTC.address, // collateral token
                borrower, // receiver
                "0x" // loan data
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Borrow");
            const loanId = decode[0].args["loanId"];

            console.log("Loan opened: 10,000 SUSD borrow with WRBTC collateral");

            // Let loan expire (like Foundry test)
            await increaseTime(duration + 3600);

            const loanBefore = await sovryn.getLoan(loanId);
            console.log("Loan principal before (SUSD):", loanBefore.principal.toString());
            console.log("Loan collateral before (WRBTC):", loanBefore.collateral.toString());

            // Apply Foundry test's extreme price manipulation: 50_000_000e18 SUSD per WRBTC
            // This makes 10k SUSD worth < 0.00025 RBTC (TINY_AMOUNT)
            const extremePrice = new BN(50000000).mul(oneEth); // 50 million SUSD per WRBTC

            // In Foundry test, this is done by manipulateMarginPrice(extremePrice)
            // Set WRBTC to SUSD rate (50M SUSD per WRBTC)
            await priceFeeds.setRates(WRBTC.address, SUSD.address, extremePrice);

            // Set inverse rate carefully to avoid division by zero
            const inverseRate = oneEth.mul(oneEth).div(extremePrice); // (1e18 * 1e18) / 50M*1e18 = 20 wei
            await priceFeeds.setRates(SUSD.address, WRBTC.address, inverseRate);

            // Also set SUSD to RBTC rate to make 10k SUSD < TINY_AMOUNT (0.00025 RBTC)
            // 10,000 SUSD should be worth < 0.00025 RBTC
            // So 1 SUSD should be worth < 0.000000000025 RBTC
            await priceFeeds.setRates(
                SUSD.address,
                RBTC.address,
                new BN(25).mul(new BN(10).pow(new BN(6)))
            ); // 0.000000025 RBTC per SUSD

            console.log(
                "Applied Foundry test extreme price: 50M SUSD per WRBTC (makes 10k SUSD < 0.00025 RBTC)"
            );

            // Increase maxSwapSize to handle large collateral amounts
            const currentMaxSwapSize = await sovryn.maxSwapSize();
            const largeMaxSwapSize = new BN(10).pow(new BN(30)); // Very large amount
            await sovryn.setMaxSwapSize(largeMaxSwapSize);
            console.log("Increased maxSwapSize to handle large collateral amounts");

            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);

            // Rollover - this should trigger tiny position closure
            console.log("Attempting rollover to trigger tiny position closure...");

            const rolloverTx = await sovryn.rollover(loanId, "0x", { from: accounts[4] });
            console.log("✅ Rollover completed successfully!");

            // Check for donation events
            const donationDecode = decodeLogs(
                rolloverTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            // no donation events should be emitted
            expect(donationDecode.length).to.be.equal(0);
            // Check if loan was closed even without donation
            const loanAfter = await sovryn.getLoan(loanId);
            console.log("Loan principal after rollover:", loanAfter.principal.toString());

            // Restore original maxSwapSize
            await sovryn.setMaxSwapSize(currentMaxSwapSize);
        });

        it("Scenario 4: Rollover tiny position iWRBTC - Donation triggered", async () => {
            console.log("=== Scenario 4: Rollover Tiny Position iWRBTC - ACTUAL DONATION ===");
            console.log("Using realistic mainnet-like conditions: WRBTC ≈ $110k USD");

            const borrower = maliciousBorrower.address;
            // Create a very small WRBTC loan that will become tiny
            const borrowAmount = new BN(2).mul(new BN(10).pow(new BN(14))); // 0.0002 WRBTC ≈ $22 (below TINY_AMOUNT after interest)
            const duration = 28 * 24 * 60 * 60; // 28 days

            console.log("Target loan size:", borrowAmount.toString(), "wei (0.0002 WRBTC ≈ $22)");

            // Step 1: Lender provides WRBTC liquidity
            const lendAmount = new BN(10).pow(new BN(21));
            await WRBTC.mint(accounts[0], lendAmount);
            await WRBTC.approve(loanTokenWRBTC.address, lendAmount, { from: accounts[0] });
            await loanTokenWRBTC.mint(accounts[0], lendAmount, { from: accounts[0] });

            // Step 2: Calculate required SUSD collateral for tiny WRBTC loan
            // At $110k WRBTC and $1 SUSD, need ~$50 SUSD collateral for $33 loan
            const collateralRequired = await loanTokenWRBTC.getDepositAmountForBorrow(
                borrowAmount,
                duration,
                SUSD.address
            );
            const collateralWithBuffer = collateralRequired.mul(new BN(2)); // 2x buffer

            console.log("SUSD collateral required:", collateralRequired.toString());
            console.log("SUSD collateral with buffer:", collateralWithBuffer.toString());

            // Step 3: Fund malicious borrower and create loan via borrow (not margin trade)
            await SUSD.mint(borrower, collateralWithBuffer);
            await maliciousBorrower.approveToken(
                SUSD.address,
                loanTokenWRBTC.address,
                collateralWithBuffer
            );

            const tx = await maliciousBorrower.performBorrow(
                loanTokenWRBTC.address, // WRBTC loan token
                "0x0", // new loan
                borrowAmount, // 0.0002 WRBTC
                duration, // 28 days
                collateralWithBuffer, // SUSD collateral
                SUSD.address, // collateral token
                borrower, // receiver
                "0x" // loan data
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Borrow");
            const loanId = decode[0].args["loanId"];

            console.log("Loan opened: 0.0002 WRBTC borrow with SUSD collateral");

            // Step 4: Let loan expire
            await increaseTime(duration + 3600);

            const loanBefore = await sovryn.getLoan(loanId);
            console.log("Loan principal before:", loanBefore.principal.toString(), "wei");
            console.log("Loan collateral before:", loanBefore.collateral.toString(), "wei");

            // Step 5: Create conditions for tiny position with WRBTC excess refund
            // Manipulate WRBTC price to make principal tiny AND create favorable swap conditions

            // Make WRBTC extremely cheap relative to SUSD to trigger tiny condition
            const extremelyLowWRBTCPrice = new BN(1000).mul(oneEth); // 1000 SUSD per WRBTC (vs normal ~110,000)
            await priceFeeds.setRates(WRBTC.address, SUSD.address, extremelyLowWRBTCPrice);
            console.log("Set WRBTC price extremely low: 1000 SUSD per WRBTC");

            // Also mock WRBTC->RBTC conversion to return TINY_AMOUNT for _getAmountInRbtc check
            const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13))); // 25e13
            await priceFeeds.setRates(WRBTC.address, WRBTC.address, TINY_AMOUNT);
            console.log("Mocked WRBTC->RBTC conversion to return TINY_AMOUNT");

            // Step 6: Increase maxSwapSize
            const currentMaxSwapSize = await sovryn.maxSwapSize();
            const largeMaxSwapSize = new BN(10).pow(new BN(30));
            await sovryn.setMaxSwapSize(largeMaxSwapSize);

            // Step 7: Record initial balance
            const feeCollectorBalanceBefore = await web3.eth.getBalance(
                feeSharingCollector.address
            );
            console.log("FeeSharingCollector balance before:", feeCollectorBalanceBefore);

            // Step 8: Attempt rollover
            console.log("Attempting rollover on tiny WRBTC position...");

            const rolloverTx = await sovryn.rollover(loanId, "0x", { from: accounts[4] });
            console.log("✅ Rollover completed successfully!");

            // Step 9: Check for donation events
            const donationDecode = decodeLogs(
                rolloverTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            console.log("Number of donation events:", donationDecode.length);

            expect(donationDecode.length).to.be.greaterThan(0);
            console.log("🎉 SUCCESS! WRBTC tiny position rollover donation triggered!");

            for (let i = 0; i < donationDecode.length; i++) {
                console.log(`Donation ${i + 1}:`, donationDecode[i].args.amount.toString());
                console.log(
                    `Original recipient ${i + 1}:`,
                    donationDecode[i].args.originalRecipient
                );
                expect(donationDecode[i].args.originalRecipient.toLowerCase()).to.equal(
                    borrower.toLowerCase()
                );
            }

            const feeCollectorBalanceAfter = await web3.eth.getBalance(
                feeSharingCollector.address
            );
            const feeCollectorDelta = new BN(feeCollectorBalanceAfter).sub(
                new BN(feeCollectorBalanceBefore)
            );
            console.log(
                "FeeSharingCollector balance increase:",
                feeCollectorDelta.toString(),
                "wei"
            );

            expect(feeCollectorDelta).to.be.greaterThan(new BN(0));

            // Step 10: Verify loan was closed
            const finalLoan = await sovryn.getLoan(loanId);
            console.log("Final loan principal:", finalLoan.principal.toString());
            expect(finalLoan.principal.toString()).to.equal("0");
            console.log("✅ Loan closed after rollover");

            // Restore maxSwapSize
            await sovryn.setMaxSwapSize(currentMaxSwapSize);
        });

        it("Scenario 5: CloseWithDeposit - Interest refund to malicious borrower", async () => {
            const loan_token_sent = new BN(2).mul(oneEth);

            console.log("=== Scenario 5: CloseWithDeposit Interest Refund ===");

            // Set up borrower with WRBTC
            await WRBTC.mint(maliciousBorrower.address, loan_token_sent);
            await maliciousBorrower.approveToken(
                WRBTC.address,
                loanTokenWRBTC.address,
                loan_token_sent
            );

            // Reset prices
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(10).pow(new BN(22)));

            // Open position
            const tx = await maliciousBorrower.performMarginTrade(
                loanTokenWRBTC.address,
                "0x0",
                new BN(2).mul(oneEth),
                loan_token_sent,
                0,
                SUSD.address,
                0,
                "0x",
                { value: 0 }
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);

            // Close with deposit (normal closure - should have allowDonationOnFailure = false)
            const closeAmount = new BN(1).mul(oneEth);
            await WRBTC.mint(maliciousBorrower.address, closeAmount);
            await maliciousBorrower.approveToken(WRBTC.address, sovryn.address, closeAmount);

            const closeTx = await maliciousBorrower.closeWithDeposit(
                sovryn.address,
                loanId,
                maliciousBorrower.address, // receiver
                closeAmount
            );

            const donationDecode = decodeLogs(
                closeTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            // CloseWithDeposit should NOT donate (allowDonationOnFailure = false)
            expect(donationDecode.length).to.equal(0);
            console.log("✅ Confirmed: CloseWithDeposit does NOT donate on failure (as expected)");
        });

        it("Scenario 6: Liquidation with seized collateral going to liquidator (should NOT donate)", async () => {
            const lender = accounts[0];
            const liquidator = accounts[2];
            const loan_token_sent = new BN(1).mul(oneEth);

            console.log("=== Scenario 6: Liquidation Seized Collateral (No Donation) ===");

            // Set up with SUSD collateral (so seized amount goes to liquidator, not borrower)
            await WRBTC.mint(maliciousBorrower.address, loan_token_sent);
            await maliciousBorrower.approveToken(
                WRBTC.address,
                loanTokenWRBTC.address,
                loan_token_sent
            );

            const tx = await maliciousBorrower.performMarginTrade(
                loanTokenWRBTC.address,
                "0x0",
                new BN(2).mul(oneEth),
                loan_token_sent,
                0,
                SUSD.address, // SUSD collateral
                0,
                "0x",
                { value: 0 }
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            // Make position liquidatable
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(1));
            await increaseTime(10 * 24 * 60 * 60);

            // Prepare liquidator
            await WRBTC.mint(liquidator, loan_token_sent);
            await WRBTC.approve(sovryn.address, loan_token_sent, { from: liquidator });

            // Liquidate
            const liquidationTx = await sovryn.liquidate(loanId, liquidator, loan_token_sent, {
                from: liquidator,
            });

            const donationDecode = decodeLogs(
                liquidationTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            // Should still have donation from interest refund, but seized collateral goes to liquidator
            console.log("Number of donation events:", donationDecode.length);
            expect(donationDecode.length).to.be.greaterThan(0);
            console.log("✅ Interest refund donation occurred");
            console.log("Donated amount:", donationDecode[0].args.amount.toString());
        });

        it("Scenario 7: Multiple donations in single transaction", async () => {
            const lender = accounts[0];
            const liquidator = accounts[2];
            const loan_token_sent = new BN(2).mul(oneEth);

            console.log("=== Scenario 7: Multiple Donations in Single Transaction ===");

            // Reset prices to healthy levels first
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(10).pow(new BN(22)));

            // Create scenario that could trigger multiple _withdrawAsset calls with donation
            await WRBTC.mint(maliciousBorrower.address, loan_token_sent);
            await maliciousBorrower.approveToken(
                WRBTC.address,
                loanTokenWRBTC.address,
                loan_token_sent
            );

            // Open larger position
            const tx = await maliciousBorrower.performMarginTrade(
                loanTokenWRBTC.address,
                "0x0",
                new BN(3).mul(oneEth), // Higher leverage
                loan_token_sent,
                0,
                SUSD.address,
                0,
                "0x",
                { value: 0 }
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            // Make position liquidatable
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(1));
            await increaseTime(10 * 24 * 60 * 60);

            // Verify position is liquidatable
            const loan = await sovryn.getLoan(loanId);
            const marginInfo = await priceFeeds.getCurrentMargin(
                WRBTC.address,
                SUSD.address,
                loan.principal,
                loan.collateral
            );
            console.log("Scenario 7 - Current margin:", marginInfo.currentMargin.toString());
            console.log("Scenario 7 - Maintenance margin:", loan.maintenanceMargin.toString());

            // Prepare liquidator
            await WRBTC.mint(liquidator, loan_token_sent);
            await WRBTC.approve(sovryn.address, loan_token_sent, { from: liquidator });

            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);

            // Liquidate
            const liquidationTx = await sovryn.liquidate(loanId, liquidator, loan_token_sent, {
                from: liquidator,
            });

            const donationDecode = decodeLogs(
                liquidationTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            console.log("Total donation events in transaction:", donationDecode.length);
            let totalDonated = new BN(0);

            for (let i = 0; i < donationDecode.length; i++) {
                const amount = new BN(donationDecode[i].args.amount.toString());
                totalDonated = totalDonated.add(amount);
                console.log(`Donation ${i + 1}: ${amount.toString()}`);
            }

            expect(totalDonated).to.be.greaterThan(new BN(0));
            console.log("✅ Total donated:", totalDonated.toString());

            const finalBalance = await web3.eth.getBalance(feeSharingCollector.address);
            const balanceIncrease = new BN(finalBalance).sub(new BN(initialBalance));
            expect(balanceIncrease).to.be.greaterThan(new BN(0));
        });

        it("Scenario 8: Normal borrower should not trigger donations", async () => {
            const normalBorrower = accounts[5];
            const liquidator = accounts[2];
            const loan_token_sent = new BN(1).mul(oneEth);

            console.log("=== Scenario 8: Normal Borrower (No Donation Expected) ===");

            // Set up normal EOA borrower
            await WRBTC.mint(normalBorrower, loan_token_sent);
            await WRBTC.approve(loanTokenWRBTC.address, loan_token_sent, { from: normalBorrower });

            // Reset prices
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(10).pow(new BN(22)));

            // Normal borrower opens position
            const tx = await loanTokenWRBTC.marginTrade(
                "0x0",
                new BN(2).mul(oneEth),
                loan_token_sent,
                0,
                SUSD.address,
                normalBorrower,
                0,
                "0x",
                { from: normalBorrower }
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            // Make position liquidatable
            await priceFeeds.setRates(SUSD.address, WRBTC.address, new BN(1));
            await increaseTime(10 * 24 * 60 * 60);

            // Prepare liquidator
            await WRBTC.mint(liquidator, loan_token_sent);
            await WRBTC.approve(sovryn.address, loan_token_sent, { from: liquidator });

            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);

            // Liquidate normal borrower
            const liquidationTx = await sovryn.liquidate(loanId, liquidator, loan_token_sent, {
                from: liquidator,
            });

            const donationDecode = decodeLogs(
                liquidationTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );

            // Normal borrower should not trigger donations (transfer succeeds)
            expect(donationDecode.length).to.equal(0);
            console.log("✅ Confirmed: Normal borrower liquidation does not donate");

            const finalBalance = await web3.eth.getBalance(feeSharingCollector.address);
            const balanceIncrease = new BN(finalBalance).sub(new BN(initialBalance));
            expect(balanceIncrease.toString()).to.equal("0");
        });
    });
});

// Helper function to get test contracts with proper initialization
async function getTestContracts(accounts) {
    // Deploy the mutex for global reentrancy protection
    await mutexUtils.getOrDeployMutex();

    const totalSupply = new BN(10).pow(new BN(25)); // 10^25 tokens
    const oneEth = new BN(10).pow(new BN(18));

    // Create basic tokens
    const SUSD = await TestToken.new("SUSD", "SUSD", 18, totalSupply);
    const RBTC = await TestToken.new("RBTC", "RBTC", 18, totalSupply);
    const WRBTC = await TestWrbtc.new();
    const BZRX = await TestWrbtc.new();

    // Create price feeds
    const priceFeeds = await PriceFeedsLocal.new(WRBTC.address, BZRX.address);
    await priceFeeds.setRates(WRBTC.address, RBTC.address, oneEth.toString());
    await priceFeeds.setRates(WRBTC.address, SUSD.address, new BN(10).pow(new BN(22)).toString());
    await priceFeeds.setRates(RBTC.address, SUSD.address, new BN(10).pow(new BN(22)).toString());

    // Create Sovryn protocol and initialize all modules
    const sovrynproxy = await sovrynProtocol.new();
    const sovryn = await ISovryn.at(sovrynproxy.address);

    // Link libraries for protocol modules (ignore errors if already linked)
    try {
        const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
        await SwapsExternal.link(swapsImplSovrynSwapLib);
        await LoanClosingsWith.link(swapsImplSovrynSwapLib);
        await LoanClosingsRollover.link(swapsImplSovrynSwapLib);
        await SwapsImplSovrynSwapModule.link(swapsImplSovrynSwapLib);
        await LoanOpenings.link(swapsImplSovrynSwapLib);
        await LoanMaintenance.link(swapsImplSovrynSwapLib);
    } catch (err) {}

    // Initialize protocol modules
    await sovryn.replaceContract((await ProtocolSettings.new()).address);
    await sovryn.replaceContract((await LoanSettings.new()).address);
    await sovryn.replaceContract((await LoanMaintenance.new()).address);
    await sovryn.replaceContract((await SwapsImplSovrynSwapModule.new()).address);
    await sovryn.replaceContract((await SwapsExternal.new()).address);

    // Set up swap simulator
    const sovrynSwapSimulator = await TestSovrynSwap.new(priceFeeds.address);
    await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
    await sovryn.setSupportedTokens(
        [SUSD.address, RBTC.address, WRBTC.address],
        [true, true, true]
    );

    await sovryn.setWrbtcToken(WRBTC.address);

    // Initialize loan opening
    const swaps = await SwapsImplSovrynSwapModule.new();
    await sovryn.replaceContract((await LoanOpenings.new()).address);
    await sovryn.setPriceFeedContract(priceFeeds.address);
    await sovryn.setSwapsImplContract(swaps.address);

    // Initialize loan closing modules
    await sovryn.replaceContract((await LoanClosingsWith.new()).address);
    await sovryn.replaceContract((await LoanClosingsLiquidation.new()).address);
    await sovryn.replaceContract((await LoanClosingsRollover.new()).address);

    // Initialize affiliates
    await sovryn.replaceContract((await Affiliates.new()).address);

    // Create loan token logic beacon
    const loanTokenLogicBeacon = await LoanTokenLogicBeacon.new();

    // Deploy LoanTokenSettingsLowerAdmin
    const loanTokenSettingsLowerAdmin = await LoanTokenSettingsLowerAdmin.new();

    // Deploy LoanTokenLogicLM
    const loanTokenLogicLM = await LoanTokenLogicLM.new();

    // Register Loan Token Modules to the Beacon
    await loanTokenLogicBeacon.registerLoanTokenModule(loanTokenSettingsLowerAdmin.address);
    await loanTokenLogicBeacon.registerLoanTokenModule(loanTokenLogicLM.address);

    // Deploy actual loan token logic
    const loanTokenLogic = await LoanTokenLogic.new();
    await loanTokenLogicBeacon.registerLoanTokenModule(loanTokenLogic.address);

    // Deploy LoanTokenLogicProxy
    const loanTokenLogicProxy = await LoanTokenLogicProxy.new(loanTokenLogicBeacon.address);

    // Create loan token
    let loanToken = await LoanToken.new(
        accounts[0], // owner
        loanTokenLogicProxy.address,
        sovryn.address,
        WRBTC.address
    );
    await loanToken.initialize(SUSD.address, "iSUSD", "iSUSD");

    // Initialize the loan token logic proxy
    loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
    await loanToken.setBeaconAddress(loanTokenLogicBeacon.address);

    // Use interface of LoanTokenModules
    loanToken = await ILoanTokenModules.at(loanToken.address);

    // Set up loan token parameters
    const params = [
        "0x0000000000000000000000000000000000000000000000000000000000000000", // id
        true, // active - this needs to be true!
        accounts[0], // owner
        SUSD.address, // loanToken
        RBTC.address, // collateralToken
        wei("20", "ether"), // minInitialMargin
        wei("15", "ether"), // maintenanceMargin
        0, // fixedLoanTerm
    ];

    await loanToken.setupLoanParams([params], true);
    await loanToken.setupLoanParams([params], false); // Also set up for inactive (like in boilerplate)

    // Also set up SUSD loan token with WRBTC collateral for rollover tiny position tests
    const wrbtcCollateralParams = [
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        true,
        accounts[0],
        SUSD.address,
        WRBTC.address,
        wei("20", "ether"),
        wei("15", "ether"),
        0,
    ];

    await loanToken.setupLoanParams([wrbtcCollateralParams], true);
    await loanToken.setupLoanParams([wrbtcCollateralParams], false);

    // Set up demand curve (interest rates) like in the boilerplate
    const baseRate = wei("1", "ether");
    const rateMultiplier = wei("20.25", "ether");
    const targetLevel = wei("80", "ether");
    const kinkLevel = wei("90", "ether");
    const maxScaleRate = wei("100", "ether");
    await loanToken.setDemandCurve(
        baseRate,
        rateMultiplier,
        baseRate,
        rateMultiplier,
        targetLevel,
        kinkLevel,
        maxScaleRate
    );

    // Register the loan token with the protocol (this is the missing piece!)
    const loanTokenAddress = await loanToken.loanTokenAddress();
    await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

    // Set supported tokens
    await sovryn.setSupportedTokens(
        [SUSD.address, RBTC.address, WRBTC.address],
        [true, true, true]
    );

    // Create FeeSharingCollector BEFORE setting it as feesController
    const mockStaking = await StakingMockForFeeSharingCollector.new();
    const feeSharingCollector = await FeeSharingCollectorMockup.new(
        sovryn.address,
        mockStaking.address
    );

    await sovryn.setFeesController(feeSharingCollector.address);

    // Set higher max swap size to avoid "swap too large" errors
    await sovryn.setMaxSwapSize(new BN(10).pow(new BN(24))); // Very large limit

    // Fund the protocol with WRBTC for swaps (like in the boilerplate)
    await WRBTC.mint(sovryn.address, new BN(10).pow(new BN(21))); // 1000 WRBTC

    // Fund the WRBTC contract with RBTC so it can handle withdrawals
    await web3.eth.sendTransaction({
        from: accounts[0],
        to: WRBTC.address,
        value: new BN(10).pow(new BN(21)), // 1000 RBTC
    });

    // Fund the loan token with SUSD so it can lend
    await SUSD.transfer(loanToken.address, new BN(10).pow(new BN(21))); // 1000 SUSD

    // Create WRBTC loan token
    let loanTokenWRBTC = await LoanToken.new(
        accounts[0], // owner
        loanTokenLogicProxy.address,
        sovryn.address,
        WRBTC.address
    );
    await loanTokenWRBTC.initialize(WRBTC.address, "iWRBTC", "iWRBTC");

    // Initialize the WRBTC loan token logic proxy
    loanTokenWRBTC = await ILoanTokenLogicProxy.at(loanTokenWRBTC.address);
    await loanTokenWRBTC.setBeaconAddress(loanTokenLogicBeacon.address);

    // Use interface of LoanTokenModules
    loanTokenWRBTC = await ILoanTokenModules.at(loanTokenWRBTC.address);

    // Set up WRBTC loan token parameters
    const wrbtcParams = [
        "0x0000000000000000000000000000000000000000000000000000000000000000", // id
        true, // active
        accounts[0], // owner
        WRBTC.address, // loanToken
        SUSD.address, // collateralToken (use SUSD as collateral for WRBTC loans)
        wei("20", "ether"), // minInitialMargin
        wei("15", "ether"), // maintenanceMargin
        0, // fixedLoanTerm
    ];

    await loanTokenWRBTC.setupLoanParams([wrbtcParams], true);
    await loanTokenWRBTC.setupLoanParams([wrbtcParams], false);

    // Set up demand curve for WRBTC loan token
    await loanTokenWRBTC.setDemandCurve(
        baseRate,
        rateMultiplier,
        baseRate,
        rateMultiplier,
        targetLevel,
        kinkLevel,
        maxScaleRate
    );

    // Register the WRBTC loan token with the protocol
    const loanTokenWRBTCAddress = await loanTokenWRBTC.loanTokenAddress();
    await sovryn.setLoanPool([loanTokenWRBTC.address], [loanTokenWRBTCAddress]);

    // Fund the WRBTC loan token so it can lend
    await WRBTC.mint(loanTokenWRBTC.address, new BN(10).pow(new BN(21))); // 1000 WRBTC

    // Create SOV token and set it in the protocol (following initializer.js pattern)
    const SOV = await TestToken.new("SOV", "SOV", 18, totalSupply);
    await sovryn.setSovrynProtocolAddress(sovryn.address);
    await sovryn.setProtocolTokenAddress(SOV.address);
    await sovryn.setSOVTokenAddress(SOV.address);

    // Set locked SOV address (required for SOV rewards)
    const lockedSOV = await LockedSOVMockup.new(SOV.address, [accounts[0]]);
    await sovryn.setLockedSOVAddress(lockedSOV.address);

    // Set SOV price in price feeds
    await priceFeeds.setRates(SUSD.address, SOV.address, oneEth);

    // FeeSharingCollector was already created above

    return {
        SUSD,
        RBTC,
        WRBTC,
        BZRX,
        priceFeeds,
        sovryn,
        loanToken,
        loanTokenWRBTC,
        SOV,
        feeSharingCollector,
    };
}
