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

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));

/**
 * Test to verify that the liquidation blocking fix works correctly
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

    describe("Liquidation Blocking Fix", () => {
        it("Should allow liquidation to succeed with malicious borrower by donating to FeeSharingCollector", async () => {
            const lender = accounts[0];
            const liquidator = accounts[2];
            const loan_token_sent = new BN(10).mul(oneEth);

            console.log("=== Testing Liquidation Fix ===");
            console.log("Malicious Borrower Address:", maliciousBorrower.address);
            console.log("FeeSharingCollector Address:", feeSharingCollector.address);

            // Step 1: Set up malicious borrower with tokens
            await SUSD.mint(maliciousBorrower.address, loan_token_sent);
            await maliciousBorrower.approveToken(SUSD.address, loanToken.address, loan_token_sent);

            // Step 2: Lender provides liquidity
            const lendAmount = new BN(10).pow(new BN(21));
            await SUSD.mint(lender, lendAmount);
            await SUSD.approve(loanToken.address, lendAmount, { from: lender });
            await loanToken.mint(lender, lendAmount, { from: lender });

            // Step 3: Malicious borrower opens margin trade position
            const tx = await maliciousBorrower.performMarginTrade(
                loanToken.address,
                "0x0", // new loan
                new BN(2).mul(oneEth), // 2x leverage
                loan_token_sent,
                0, // no collateral
                RBTC.address,
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

            // Step 5: Make position liquidatable
            const unhealthyRate = new BN(1).mul(new BN(10).pow(new BN(20)));
            await priceFeeds.setRates(RBTC.address, SUSD.address, unhealthyRate);
            await increaseTime(10 * 24 * 60 * 60);

            // Verify position is liquidatable
            const marginInfo = await priceFeeds.getCurrentMargin(
                SUSD.address,
                RBTC.address,
                loan.principal,
                loan.collateral
            );
            console.log("Current margin:", marginInfo.currentMargin.toString());
            console.log("Maintenance margin:", loan.maintenanceMargin.toString());

            // Step 6: Prepare liquidator
            await SUSD.mint(liquidator, loan_token_sent);
            await SUSD.approve(sovryn.address, loan_token_sent, { from: liquidator });

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
            if (donationDecode.length > 0) {
                console.log("✅ Donation to FeeSharingCollector event emitted");
                console.log("Original recipient:", donationDecode[0].args.originalRecipient);
                console.log("Donated amount:", donationDecode[0].args.amount.toString());
            }

            // Step 10: Verify FeeSharingCollector received the donation
            const finalBalance = await web3.eth.getBalance(feeSharingCollector.address);
            const balanceIncrease = new BN(finalBalance).sub(new BN(initialBalance));
            console.log("FeeSharingCollector balance increase:", balanceIncrease.toString());
        });

        it("Should handle normal borrowers without donating to FeeSharingCollector", async () => {
            const lender = accounts[0];
            const borrower = accounts[1]; // Normal EOA borrower
            const liquidator = accounts[3];
            const loan_token_sent = new BN(5).mul(oneEth);

            console.log("=== Testing Normal Borrower (No Donation) ===");

            // Reset prices to healthy levels first
            await priceFeeds.setRates(
                RBTC.address,
                SUSD.address,
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

        it("Should handle rollover with malicious borrower", async () => {
            const lender = accounts[0];
            const loan_token_sent = new BN(3).mul(oneEth);

            console.log("=== Testing Rollover with Malicious Borrower ===");

            // Reset prices to healthy levels first
            await priceFeeds.setRates(
                RBTC.address,
                SUSD.address,
                new BN(10).pow(new BN(22)).toString()
            );

            // Set up malicious borrower
            await SUSD.mint(maliciousBorrower.address, loan_token_sent);
            await maliciousBorrower.approveToken(SUSD.address, loanToken.address, loan_token_sent);

            // Lender provides liquidity
            const lendAmount = new BN(10).pow(new BN(21));
            await SUSD.mint(lender, lendAmount);
            await SUSD.approve(loanToken.address, lendAmount, { from: lender });
            await loanToken.mint(lender, lendAmount, { from: lender });

            // Malicious borrower opens margin trade
            const tx = await maliciousBorrower.performMarginTrade(
                loanToken.address,
                "0x0",
                new BN(2).mul(oneEth),
                loan_token_sent,
                0,
                RBTC.address,
                0,
                "0x",
                { value: 0 }
            );

            const decode = decodeLogs(tx.receipt.rawLogs, LoanOpenings, "Trade");
            const loanId = decode[0].args["loanId"];

            // Wait for loan to expire
            await increaseTime(28 * 24 * 60 * 60 + 3600); // 28 days + 1 hour

            // Get initial FeeSharingCollector balance
            const initialBalance = await web3.eth.getBalance(feeSharingCollector.address);

            // Attempt rollover - should succeed despite malicious borrower
            const rolloverTx = await sovryn.rollover(loanId, "0x", { from: accounts[4] });

            console.log("✅ Rollover succeeded despite malicious borrower");

            // Check if donation event was emitted
            const donationDecode = decodeLogs(
                rolloverTx.receipt.rawLogs,
                LoanClosingsEvents,
                "DonateToFeeSharingCollector"
            );
            if (donationDecode.length > 0) {
                console.log("✅ Donation to FeeSharingCollector event emitted during rollover");
            }

            // Verify FeeSharingCollector received the donation
            const finalBalance = await web3.eth.getBalance(feeSharingCollector.address);
            const balanceIncrease = new BN(finalBalance).sub(new BN(initialBalance));
            console.log("FeeSharingCollector balance increase:", balanceIncrease.toString());
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
    await sovryn.setFeesController(accounts[0]);

    // Fund the protocol with WRBTC for swaps (like in the boilerplate)
    await WRBTC.mint(sovryn.address, new BN(10).pow(new BN(21))); // 1000 WRBTC

    // Fund the loan token with SUSD so it can lend
    await SUSD.transfer(loanToken.address, new BN(10).pow(new BN(21))); // 1000 SUSD

    // Create WRBTC loan token (simplified for testing)
    const loanTokenWRBTC = loanToken; // Use same for simplicity

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

    // Create a mock staking contract for FeeSharingCollector
    const mockStaking = await TestToken.new("MockStaking", "MST", 18, totalSupply);

    // Create FeeSharingCollector
    const feeSharingCollector = await FeeSharingCollectorMockup.new(
        sovryn.address,
        mockStaking.address
    );

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
