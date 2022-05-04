/** Speed optimized on branch hardhatTestRefactor, 2021-09-16
 * Greatest bottlenecks found at:
 * 	- 3 recurrent deployments on beforeEach
 *  - repeated snippets of deployment code along the tests (not needed, removed for optimization)
 * Total time elapsed: 9s
 * After optimization: 6s
 *
 * Other minor optimizations:
 *  - removed unused modules and lines of code
 *  - reformatted code comments
 *
 * Notes: Used waffle fixture to snapshot deployment scenarios.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use SUSD as underlying token, instead of custom SUSD.
 *   Updated to use WRBTC as collateral token, instead of custom testWrbtc.
 */

const { BN, constants, expectEvent } = require("@openzeppelin/test-helpers");
const { expect, waffle } = require("hardhat");
const { deployMockContract, loadFixture } = waffle;
const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const LoanToken = artifacts.require("LoanToken");
const LockedSOV = artifacts.require("LockedSOV");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingProxy = artifacts.require("FeeSharingProxyMockup");
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry3");
const TestWrbtc = artifacts.require("TestWrbtc");

const TestToken = artifacts.require("TestToken");

const PriceFeeds = artifacts.require("PriceFeeds");
const PriceFeedRSKOracle = artifacts.require("PriceFeedRSKOracle");
const PriceFeedRSKOracleMockup = artifacts.require("PriceFeedRSKOracleMockup");
const PriceFeedV1PoolOracle = artifacts.require("PriceFeedV1PoolOracle");
const LiquidityPoolV1ConverterMockup = artifacts.require("LiquidityPoolV1ConverterMockup");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwap");
const Affiliates = artifacts.require("Affiliates");
const IV1PoolOracle = artifacts.require("IV1PoolOracle");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanTokenLogic,
    getLoanToken,
    getLoanTokenLogicWrbtc,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    getPriceFeeds,
    getSovryn,
    decodeLogs,
    getSOV,
} = require("../Utils/initializer.js");

let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.

contract("Affiliates", (accounts) => {
    let loanTokenLogic;
    let WRBTC;
    let doc;
    let SUSD;
    let lockedSOV;
    let sovryn;
    let loanTokenV2;
    let feeds;
    let wei = web3.utils.toWei;
    let senderMock;
    let swapsSovryn;

    let loanTokenSent;
    let leverageAmount;
    let referrerFee;

    async function deploymentAndInitFixture(_wallets, _provider) {
        const provider = waffle.provider;
        [senderMock] = provider.getWallets();

        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        // loanTokenLogic = await LoanTokenLogicLM.new();
        const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
        loanTokenLogic = initLoanTokenLogic[0];
        loanTokenLogicBeacon = initLoanTokenLogic[1];
        doc = await TestToken.new("dollar on chain", "DOC", 18, wei("20000", "ether"));
        loanToken = await LoanToken.new(
            owner,
            loanTokenLogic.address,
            sovryn.address,
            WRBTC.address
        );
        await loanToken.initialize(doc.address, "SUSD", "SUSD");

        /** Initialize the loan token logic proxy */
        loanTokenV2 = await ILoanTokenLogicProxy.at(loanToken.address);
        await loanTokenV2.setBeaconAddress(loanTokenLogicBeacon.address);

        /** Use interface of LoanTokenModules */
        loanTokenV2 = await ILoanTokenModules.at(loanToken.address);

        const loanTokenAddress = await loanToken.loanTokenAddress();
        if (owner == (await sovryn.owner())) {
            await sovryn.setLoanPool([loanTokenV2.address], [loanTokenAddress]);
        }

        // Creating the Staking Instance.
        stakingLogic = await StakingLogic.new(SUSD.address);
        staking = await StakingProxy.new(SUSD.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);

        // Creating the FeeSharing Instance.
        feeSharingProxy = await FeeSharingProxy.new(constants.ZERO_ADDRESS, staking.address);

        // Creating the Vesting Instance.
        vestingLogic = await VestingLogic.new();
        vestingFactory = await VestingFactory.new(vestingLogic.address);
        vestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            SUSD.address,
            staking.address,
            feeSharingProxy.address,
            owner // This should be Governance Timelock Contract.
        );
        vestingFactory.transferOwnership(vestingRegistry.address);

        // Creating the instance of newLockedSOV Contract.
        await sovryn.setLockedSOVAddress(
            (
                await LockedSOV.new(SUSD.address, vestingRegistry.address, cliff, duration, [
                    owner,
                ])
            ).address
        );
        lockedSOV = await LockedSOV.at(await sovryn.lockedSOVAddress());

        // initialize
        /// @dev Optimization: Init same feeds for all tests

        // feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
        // await feeds.setRates(doc.address, WRBTC.address, wei("0.01", "ether"));

        feeds = await PriceFeeds.new(WRBTC.address, SUSD.address, doc.address);
        testToken1Precision = 18;
        testToken2Precision = 18;
        btcPrecision = 18;
        testToken1 = await TestToken.new(
            "test token 1",
            "TEST1",
            testToken1Precision,
            wei("20000", "ether")
        );
        testToken2 = await TestToken.new(
            "test token 2",
            "TEST2",
            testToken2Precision,
            wei("20000", "ether")
        );
        testToken1Price = wei("2", "ether");
        testToken2Price = wei("2", "ether");
        wrBTCPrice = wei("8", "ether");
        docPrice = wei("7", "ether");

        // Set tetToken1 feed - price 1Z BTC
        // Set v1 convert mockup
        liquidityV1ConverterMockupTestToken1 = await LiquidityPoolV1ConverterMockup.new(
            testToken1.address,
            WRBTC.address
        );

        priceFeedsV1PoolOracleMockupTestToken1 = await deployMockContract(
            senderMock,
            IV1PoolOracle.abi
        );
        await priceFeedsV1PoolOracleMockupTestToken1.mock.latestAnswer.returns(testToken1Price);
        await priceFeedsV1PoolOracleMockupTestToken1.mock.latestPrice.returns(testToken1Price);
        await priceFeedsV1PoolOracleMockupTestToken1.mock.liquidityPool.returns(
            liquidityV1ConverterMockupTestToken1.address
        );

        priceFeedsV1PoolOracleTestToken1 = await PriceFeedV1PoolOracle.new(
            priceFeedsV1PoolOracleMockupTestToken1.address,
            WRBTC.address,
            doc.address,
            testToken1.address
        );

        liquidityV1ConverterMockupTestToken2 = await LiquidityPoolV1ConverterMockup.new(
            testToken2.address,
            WRBTC.address
        );
        priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(
            senderMock,
            IV1PoolOracle.abi
        );
        await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(testToken2Price);
        await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(testToken2Price);
        await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(
            liquidityV1ConverterMockupTestToken2.address
        );

        priceFeedsV1PoolOracleTestToken2 = await PriceFeedV1PoolOracle.new(
            priceFeedsV1PoolOracleMockupTestToken2.address,
            WRBTC.address,
            doc.address,
            testToken2.address
        );

        // Set rBTC feed - using rsk oracle
        priceFeedsV1PoolOracleMockupBTC = await PriceFeedRSKOracleMockup.new();
        await priceFeedsV1PoolOracleMockupBTC.setValue(wrBTCPrice);
        priceFeedsV1PoolOracleBTC = await PriceFeedRSKOracle.new(
            priceFeedsV1PoolOracleMockupBTC.address
        );

        // Set DOC feed -- price 1 BTC
        liquidityV1ConverterMockupDOC = await LiquidityPoolV1ConverterMockup.new(
            doc.address,
            WRBTC.address
        );

        priceFeedsV1PoolOracleMockupDOC = await deployMockContract(senderMock, IV1PoolOracle.abi);
        await priceFeedsV1PoolOracleMockupDOC.mock.latestAnswer.returns(docPrice);
        await priceFeedsV1PoolOracleMockupDOC.mock.latestPrice.returns(docPrice);
        await priceFeedsV1PoolOracleMockupDOC.mock.liquidityPool.returns(
            liquidityV1ConverterMockupDOC.address
        );

        priceFeedsV1PoolOracleDOC = await PriceFeedV1PoolOracle.new(
            priceFeedsV1PoolOracleMockupDOC.address,
            WRBTC.address,
            doc.address,
            doc.address
        );

        // await feeds.setPriceFeed([WRBTC.address, doc.address], [priceFeedsV1PoolOracle.address, priceFeedsV1PoolOracle.address])
        await feeds.setPriceFeed(
            [testToken1.address, testToken2.address, doc.address, WRBTC.address],
            [
                priceFeedsV1PoolOracleTestToken1.address,
                priceFeedsV1PoolOracleTestToken2.address,
                priceFeedsV1PoolOracleDOC.address,
                priceFeedsV1PoolOracleBTC.address,
            ]
        );

        test1 = await feeds.queryRate(testToken1.address, doc.address);
        expect(test1[0].toString()).to.be.equal(
            new BN(testToken1Price)
                .mul(new BN(wrBTCPrice))
                .mul(new BN(10 ** (testToken1Precision - btcPrecision)))
                .div(new BN(wei("1", "ether")))
                .toString()
        );

        test = await feeds.queryReturn(testToken1.address, doc.address, wei("2", "ether"));
        expect(test.toString()).to.be.equal(
            new BN(2)
                .mul(
                    new BN(testToken1Price)
                        .mul(new BN(wrBTCPrice))
                        .mul(new BN(10 ** (testToken1Precision - btcPrecision)))
                        .div(new BN(wei("1", "ether")))
                )
                .toString()
        );

        test1 = await feeds.queryRate(testToken1.address, testToken2.address);

        expect(test1[0].toString()).to.be.equal(
            new BN(testToken1Price)
                .div(new BN(testToken2Price))
                .mul(new BN(wei("1", "ether")))
                .toString()
        );
        test = await feeds.queryReturn(testToken1.address, testToken2.address, wei("2", "ether"));
        expect(test.toString()).to.be.equal(
            new BN(2)
                .mul(
                    new BN(testToken1Price)
                        .div(new BN(testToken2Price))
                        .mul(new BN(wei("1", "ether")))
                )
                .toString()
        );

        /// @dev Optimization: Init same swap pool for all tests

        swapsSovryn = await SwapsImplSovrynSwap.new();
        const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
        await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
        await sovryn.setSupportedTokens([doc.address, WRBTC.address], [true, true]);
        await sovryn.setPriceFeedContract(
            feeds.address // priceFeeds
        );
        await sovryn.setSwapsImplContract(
            swapsSovryn.address // swapsImpl
        );
        await sovryn.setFeesController(owner);
        await sovryn.setWrbtcToken(WRBTC.address);
        await sovryn.setSOVTokenAddress(SUSD.address);

        {
            /**
			struct LoanParams {
				bytes32 id; // id of loan params object
				bool active; // if false, this object has been disabled by the owner and can't be used for future loans
				address owner; // owner of this object
				address loanToken; // the token being loaned
				address collateralToken; // the required collateral token
				uint256 minInitialMargin; // the minimum allowed initial margin
				uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
				uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
			}
		*/
        }
        params = [
            "0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
            false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
            owner, // address owner; // owner of this object
            doc.address, // address loanToken; // the token being loaned
            WRBTC.address, // address collateralToken; // the required collateral token
            wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
            wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
            2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
        ];

        // await loanTokenV2.setupLoanParams([params], true);
        await loanTokenV2.setupLoanParams([params], false);

        // setting up interest rates
        const baseRate = wei("1", "ether");
        const rateMultiplier = wei("20.25", "ether");
        const targetLevel = wei("80", "ether");
        const kinkLevel = wei("90", "ether");
        const maxScaleRate = wei("100", "ether");
        await loanTokenV2.setDemandCurve(
            baseRate,
            rateMultiplier,
            baseRate,
            rateMultiplier,
            targetLevel,
            kinkLevel,
            maxScaleRate
        );

        // GIVING SOME DOC tokens to loanToken so that we can borrow from loanToken
        await doc.transfer(loanTokenV2.address, wei("500", "ether"));
        await doc.transfer(trader, wei("100", "ether"));
        // trader approves to LoanToken loan amount for trading
        await doc.approve(loanToken.address, web3.utils.toWei("100", "ether"), { from: trader });
        // Giving some testRbtc to sovrynAddress (by minting some testRbtc),so that it can open position in wRBTC.
        await WRBTC.mint(sovryn.address, wei("500", "ether"));

        // Giving some SOV Token to sovrynAddress (For affiliates rewards purposes)
        await SUSD.mint(sovryn.address, wei("500", "ether"));

        /// @dev Optimization: Init default affiliate for all tests

        // Change the min referrals to payout to 3 for testing purposes
        await sovryn.setMinReferralsToPayoutAffiliates(3);
        loanTokenLogic = await LoanTokenLogicLM.new();

        loanTokenSent = wei("21", "ether");
        leverageAmount = web3.utils.toWei("2", "ether");
        // underlyingToken.approve(loanTokenV2.address, loanTokenSent*2)

        let previousAffiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
        let tx = await loanTokenV2.marginTradeAffiliate(
            constants.ZERO_BYTES32, // loanId (0 for new loans)
            leverageAmount, // Leverage
            loanTokenSent, // loanTokenSent
            0, //
            WRBTC.address, // collateralTokenAddress
            trader, // trader
            0, // max slippage
            referrer, // referrer address
            "0x", // loanDataBytes (only required with ether)
            { from: trader }
        );

        await expectEvent.inTransaction(
            tx.receipt.rawLogs[0].transactionHash,
            Affiliates,
            "SetAffiliatesReferrer",
            {
                user: trader,
                referrer: referrer,
            }
        );

        let referrerOnChain = await sovryn.affiliatesUserReferrer(trader);
        expect(referrerOnChain, "Incorrect User Affiliate").to.be.equal(referrer);

        notFirstTradeFlagOnChain = await sovryn.getUserNotFirstTradeFlag(trader);
        expect(notFirstTradeFlagOnChain, "First trade flag is not updated").to.be.true;

        let decode = decodeLogs(tx.receipt.rawLogs, Affiliates, "PayTradingFeeToAffiliate");
        referrerFee = await sovryn.affiliatesReferrerBalances(referrer, doc.address);
        if (!decode.length) {
            throw "Event PayTradingFeeToAffiliate is not fired properly";
        }

        let isHeld = decode[0].args["isHeld"];
        let affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
        let submittedAffiliatesReward = decode[0].args["sovBonusAmount"];
        let submittedTokenBonusAmount = decode[0].args["tokenBonusAmount"];
        let submittedReferrer = decode[0].args["referrer"];
        let submittedTrader = decode[0].args["trader"];
        expect(isHeld, "First trade affiliates reward must be in held").to.be.true;
        expect(referrerFee.toString(), "Token bonus rewards is not matched").to.be.equal(
            submittedTokenBonusAmount.toString()
        );

        let checkedValueShouldBe = affiliateRewardsHeld - previousAffiliateRewardsHeld;
        expect(
            checkedValueShouldBe.toString(),
            "Affiliates bonus rewards is not matched"
        ).to.be.equal(submittedAffiliatesReward.toString());

        // Check lockedSOV Balance of the referrer
        let referrerBalanceInLockedSOV = await lockedSOV.getLockedBalance(referrer);
        expect(
            referrerBalanceInLockedSOV.toString(),
            "Referrer balance in lockedSOV is not matched"
        ).to.be.equal(new BN(0).toString());

        expect(submittedReferrer).to.eql(referrer);
        expect(submittedTrader).to.eql(trader);
    }

    before(async () => {
        [owner, trader, referrer, account1, account2, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    it("Test affiliates integration with underlying token", async () => {
        /*
		/// @dev Optimization: Removed default affiliate init for specific test, relayed to beforeEach hook

		// Change the min referrals to payout to 3 for testing purposes
		await sovryn.setMinReferralsToPayoutAffiliates(3);
		loanTokenLogic = await LoanTokenLogicLM.new();

		const loanTokenSent = wei("21", "ether");
		const leverageAmount = web3.utils.toWei("2", "ether");
		// underlyingToken.approve(loanTokenV2.address, loanTokenSent*2)

		let previousAffiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
		let tx = await loanTokenV2.marginTradeAffiliate(
			constants.ZERO_BYTES32, // loanId (0 for new loans)
			leverageAmount, // Leverage
			loanTokenSent, // loanTokenSent
			0, //
			WRBTC.address, // collateralTokenAddress
			trader, // trader
			0, // max slippage
			referrer, // referrer address
			"0x", // loanDataBytes (only required with ether)
			{ from: trader }
		);

		await expectEvent.inTransaction(tx.receipt.rawLogs[0].transactionHash, Affiliates, "SetAffiliatesReferrer", {
			user: trader,
			referrer: referrer,
		});

		let referrerOnChain = await sovryn.affiliatesUserReferrer(trader);
		expect(referrerOnChain, "Incorrect User Affiliate").to.be.equal(referrer);

		notFirstTradeFlagOnChain = await sovryn.getUserNotFirstTradeFlag(trader);
		expect(notFirstTradeFlagOnChain, "First trade flag is not updated").to.be.true;

		let event_name = "PayTradingFeeToAffiliate";
		let decode = decodeLogs(tx.receipt.rawLogs, Affiliates, event_name);
		let referrerFee = await sovryn.affiliatesReferrerBalances(referrer, doc.address);
		if (!decode.length) {
			throw "Event PayTradingFeeToAffiliate is not fired properly";
		}

		let isHeld = decode[0].args["isHeld"];
		let affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
		let submittedAffiliatesReward = decode[0].args["sovBonusAmount"];
		let submittedTokenBonusAmount = decode[0].args["tokenBonusAmount"];
		let submittedReferrer = decode[0].args["referrer"];
		let submittedTrader = decode[0].args["trader"];
		expect(isHeld, "First trade affiliates reward must be in held").to.be.true;
		expect(referrerFee.toString(), "Token bonus rewards is not matched").to.be.equal(submittedTokenBonusAmount.toString());

		let checkedValueShouldBe = affiliateRewardsHeld - previousAffiliateRewardsHeld;
		expect(checkedValueShouldBe.toString(), "Affiliates bonus rewards is not matched").to.be.equal(
			submittedAffiliatesReward.toString()
		);

		// Check lockedSOV Balance of the referrer
		let referrerBalanceInLockedSOV = await lockedSOV.getLockedBalance(referrer);
		expect(referrerBalanceInLockedSOV.toString(), "Referrer balance in lockedSOV is not matched").to.be.equal(new BN(0).toString());

		expect(submittedReferrer).to.eql(referrer);
		expect(submittedTrader).to.eql(trader);
*/

        // Change the min referrals to payout to 1
        await sovryn.setMinReferralsToPayoutAffiliates(1);

        previousAffiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
        tx = await loanTokenV2.marginTradeAffiliate(
            constants.ZERO_BYTES32, // loanId (0 for new loans)
            leverageAmount, // Leverage
            loanTokenSent, // loanTokenSent
            0, //
            WRBTC.address, // collateralTokenAddress
            trader, // trader
            0, // max slippage
            referrer, // referrer address
            "0x", // loanDataBytes (only required with ether)
            { from: trader }
        );

        decode = decodeLogs(tx.receipt.rawLogs, Affiliates, "PayTradingFeeToAffiliate");
        if (!decode.length) {
            throw "Event PayTradingFeeToAffiliate is not fired properly";
        }

        isHeld = decode[0].args["isHeld"];
        expect(isHeld, "First trade affiliates reward must not be in held").to.be.false;

        affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
        submittedAffiliatesReward = decode[0].args["sovBonusAmount"];
        submittedTokenBonusAmount = decode[0].args["tokenBonusAmount"];
        sovBonusAmountPaid = decode[0].args["sovBonusAmountPaid"];
        submittedReferrer = decode[0].args["referrer"];
        submittedTrader = decode[0].args["trader"];

        expect(
            affiliateRewardsHeld.toString(),
            "affiliateRewardHeld should be zero at this point"
        ).to.be.equal(new BN(0).toString());
        expect(referrerFee.toString(), "Token bonus rewards is not matched").to.be.equal(
            submittedTokenBonusAmount.toString()
        );

        checkSovBonusAmountPaid = new BN(submittedAffiliatesReward).add(
            new BN(previousAffiliateRewardsHeld)
        );
        expect(
            checkSovBonusAmountPaid.toString(),
            "Affiliates bonus rewards paid is not matched"
        ).to.be.equal(sovBonusAmountPaid.toString());

        checkedValueShouldBe = new BN(affiliateRewardsHeld).add(
            new BN(previousAffiliateRewardsHeld)
        );
        expect(
            checkedValueShouldBe.toString(),
            "Affiliates bonus rewards is not matched"
        ).to.be.equal(submittedAffiliatesReward.toString());

        // Check lockedSOV Balance of the referrer
        referrerBalanceInLockedSOV = await lockedSOV.getLockedBalance(referrer);
        expect(
            referrerBalanceInLockedSOV.toString(),
            "Referrer balance in lockedSOV is not matched"
        ).to.be.equal(checkSovBonusAmountPaid.toString());

        expect(submittedReferrer).to.eql(referrer);
        expect(submittedTrader).to.eql(trader);

        // Do withdrawal
        let referrerTokenBalance = await doc.balanceOf(referrer);
        let referrerFee2 = new BN(referrerFee).add(new BN(submittedTokenBonusAmount));
        tx = await sovryn.withdrawAllAffiliatesReferrerTokenFees(referrer, { from: referrer });
        const referrerFeeAfterWithdrawal = await sovryn.affiliatesReferrerBalances(
            referrer,
            doc.address
        );
        let referrerTokenBalanceAfterWithdrawal = await doc.balanceOf(referrer);
        expect(
            referrerFeeAfterWithdrawal,
            "Incorrect all balance after all DoC withdraw"
        ).to.be.bignumber.equal(new BN(0));
        expect(
            referrerTokenBalanceAfterWithdrawal.sub(referrerTokenBalance).toString()
        ).to.be.equal(referrerFee2.toString());

        await expectEvent.inTransaction(
            tx.receipt.rawLogs[0].transactionHash,
            Affiliates,
            "WithdrawAffiliatesReferrerTokenFees",
            {
                referrer: referrer,
                receiver: referrer,
                tokenAddress: doc.address,
                amount: referrerFee2.toString(),
            }
        );
    });

    it("Test affiliates integration with underlying token with oracle v1Pool", async () => {
        /*
		/// @dev Optimization: Removed feeds init for specific test, relayed to beforeEach hook

		feeds = await PriceFeeds.new(WRBTC.address, SUSD.address, doc.address);
		testToken1Precision = 18;
		testToken2Precision = 18;
		btcPrecision = 18;
		testToken1 = await TestToken.new("test token 1", "TEST1", testToken1Precision, wei("20000", "ether"));
		testToken2 = await TestToken.new("test token 2", "TEST2", testToken2Precision, wei("20000", "ether"));
		testToken1Price = wei("2", "ether");
		testToken2Price = wei("2", "ether");
		wrBTCPrice = wei("8", "ether");
		docPrice = wei("7", "ether");

		// Set tetToken1 feed - price 1Z BTC
		// Set v1 convert mockup
		liquidityV1ConverterMockupTestToken1 = await LiquidityPoolV1ConverterMockup.new(testToken1.address, WRBTC.address);

		priceFeedsV1PoolOracleMockupTestToken1 = await deployMockContract(senderMock, IV1PoolOracle.abi);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.latestAnswer.returns(testToken1Price);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.latestPrice.returns(testToken1Price);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.liquidityPool.returns(liquidityV1ConverterMockupTestToken1.address);

		priceFeedsV1PoolOracleTestToken1 = await PriceFeedV1PoolOracle.new(
			priceFeedsV1PoolOracleMockupTestToken1.address,
			WRBTC.address,
			doc.address,
			testToken1.address
		);

		liquidityV1ConverterMockupTestToken2 = await LiquidityPoolV1ConverterMockup.new(testToken2.address, WRBTC.address);
		priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(senderMock, IV1PoolOracle.abi);
		await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(testToken2Price);
		await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(testToken2Price);
		await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(liquidityV1ConverterMockupTestToken2.address);

		priceFeedsV1PoolOracleTestToken2 = await PriceFeedV1PoolOracle.new(
			priceFeedsV1PoolOracleMockupTestToken2.address,
			WRBTC.address,
			doc.address,
			testToken2.address
		);

		// Set rBTC feed - using rsk oracle
		priceFeedsV1PoolOracleMockupBTC = await PriceFeedRSKOracleMockup.new();
		await priceFeedsV1PoolOracleMockupBTC.setValue(wrBTCPrice);
		priceFeedsV1PoolOracleBTC = await PriceFeedRSKOracle.new(priceFeedsV1PoolOracleMockupBTC.address);

		// Set DOC feed -- price 1 BTC
		liquidityV1ConverterMockupDOC = await LiquidityPoolV1ConverterMockup.new(doc.address, WRBTC.address);

		priceFeedsV1PoolOracleMockupDOC = await deployMockContract(senderMock, IV1PoolOracle.abi);
		await priceFeedsV1PoolOracleMockupDOC.mock.latestAnswer.returns(docPrice);
		await priceFeedsV1PoolOracleMockupDOC.mock.latestPrice.returns(docPrice);
		await priceFeedsV1PoolOracleMockupDOC.mock.liquidityPool.returns(liquidityV1ConverterMockupDOC.address);

		priceFeedsV1PoolOracleDOC = await PriceFeedV1PoolOracle.new(
			priceFeedsV1PoolOracleMockupDOC.address,
			WRBTC.address,
			doc.address,
			doc.address
		);

		// await feeds.setPriceFeed([WRBTC.address, doc.address], [priceFeedsV1PoolOracle.address, priceFeedsV1PoolOracle.address])
		await feeds.setPriceFeed(
			[testToken1.address, testToken2.address, doc.address, WRBTC.address],
			[
				priceFeedsV1PoolOracleTestToken1.address,
				priceFeedsV1PoolOracleTestToken2.address,
				priceFeedsV1PoolOracleDOC.address,
				priceFeedsV1PoolOracleBTC.address,
			]
		);

		test1 = await feeds.queryRate(testToken1.address, doc.address);
		expect(test1[0].toString()).to.be.equal(
			new BN(testToken1Price)
				.mul(new BN(wrBTCPrice))
				.mul(new BN(10 ** (testToken1Precision - btcPrecision)))
				.div(new BN(wei("1", "ether")))
				.toString()
		);

		test = await feeds.queryReturn(testToken1.address, doc.address, wei("2", "ether"));
		expect(test.toString()).to.be.equal(
			new BN(2)
				.mul(
					new BN(testToken1Price)
						.mul(new BN(wrBTCPrice))
						.mul(new BN(10 ** (testToken1Precision - btcPrecision)))
						.div(new BN(wei("1", "ether")))
				)
				.toString()
		);

		test1 = await feeds.queryRate(testToken1.address, testToken2.address);

		expect(test1[0].toString()).to.be.equal(
			new BN(testToken1Price)
				.div(new BN(testToken2Price))
				.mul(new BN(wei("1", "ether")))
				.toString()
		);
		test = await feeds.queryReturn(testToken1.address, testToken2.address, wei("2", "ether"));
		expect(test.toString()).to.be.equal(
			new BN(2).mul(new BN(testToken1Price).div(new BN(testToken2Price)).mul(new BN(wei("1", "ether")))).toString()
		);
*/

        /*
		/// @dev Optimization: Removed swap pool init for specific test, relayed to beforeEach hook

		swapsSovryn = await SwapsImplSovrynSwap.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([doc.address, WRBTC.address], [true, true]);
		await sovryn.setPriceFeedContract(
			feeds.address // priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swapsSovryn.address // swapsImpl
		);
		await sovryn.setFeesController(owner);
		await sovryn.setWrbtcToken(WRBTC.address);
		await sovryn.setSOVTokenAddress(SUSD.address);
*/

        /*
		/// @dev Optimization: Removed default affiliate init for specific test, relayed to beforeEach hook

		// Change the min referrals to payout to 3 for testing purposes
		await sovryn.setMinReferralsToPayoutAffiliates(3);
		loanTokenLogic = await LoanTokenLogicLM.new();

		const loanTokenSent = wei("21", "ether");
		const leverageAmount = web3.utils.toWei("2", "ether");
		// underlyingToken.approve(loanTokenV2.address, loanTokenSent*2)

		let previousAffiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
		let tx = await loanTokenV2.marginTradeAffiliate(
			constants.ZERO_BYTES32, // loanId (0 for new loans)
			leverageAmount, // Leverage
			loanTokenSent, // loanTokenSent
			0, //
			WRBTC.address, // collateralTokenAddress
			trader, // trader
			0, // max slippage
			referrer, // referrer address
			"0x", // loanDataBytes (only required with ether)
			{ from: trader }
		);

		await expectEvent.inTransaction(tx.receipt.rawLogs[0].transactionHash, Affiliates, "SetAffiliatesReferrer", {
			user: trader,
			referrer: referrer,
		});

		let referrerOnChain = await sovryn.affiliatesUserReferrer(trader);
		expect(referrerOnChain, "Incorrect User Affiliate").to.be.equal(referrer);

		notFirstTradeFlagOnChain = await sovryn.getUserNotFirstTradeFlag(trader);
		expect(notFirstTradeFlagOnChain, "First trade flag is not updated").to.be.true;

		let event_name = "PayTradingFeeToAffiliate";
		let decode = decodeLogs(tx.receipt.rawLogs, Affiliates, event_name);
		let referrerFee = await sovryn.affiliatesReferrerBalances(referrer, doc.address);
		if (!decode.length) {
			throw "Event PayTradingFeeToAffiliate is not fired properly";
		}

		let isHeld = decode[0].args["isHeld"];
		let affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
		let submittedAffiliatesReward = decode[0].args["sovBonusAmount"];
		let submittedTokenBonusAmount = decode[0].args["tokenBonusAmount"];
		expect(isHeld, "First trade affiliates reward must be in held").to.be.true;
		expect(referrerFee.toString(), "Token bonus rewards is not matched").to.be.equal(submittedTokenBonusAmount.toString());

		let checkedValueShouldBe = affiliateRewardsHeld - previousAffiliateRewardsHeld;
		expect(checkedValueShouldBe.toString(), "Affiliates bonus rewards is not matched").to.be.equal(
			submittedAffiliatesReward.toString()
		);

		// Check lockedSOV Balance of the referrer
		let referrerBalanceInLockedSOV = await lockedSOV.getLockedBalance(referrer);
		expect(referrerBalanceInLockedSOV.toString(), "Referrer balance in lockedSOV is not matched").to.be.equal(new BN(0).toString());
*/

        // Change the min referrals to payout to 1
        await sovryn.setMinReferralsToPayoutAffiliates(1);

        previousAffiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
        tx = await loanTokenV2.marginTradeAffiliate(
            constants.ZERO_BYTES32, // loanId (0 for new loans)
            leverageAmount, // Leverage
            loanTokenSent, // loanTokenSent
            0, //
            WRBTC.address, // collateralTokenAddress
            trader, // trader
            0, // max slippage
            referrer, // referrer address,
            "0x", // loanDataBytes (only required with ether)
            { from: trader }
        );

        decode = decodeLogs(tx.receipt.rawLogs, Affiliates, "PayTradingFeeToAffiliate");
        if (!decode.length) {
            throw "Event PayTradingFeeToAffiliate is not fired properly";
        }

        isHeld = decode[0].args["isHeld"];
        expect(isHeld, "First trade affiliates reward must not be in held").to.be.false;

        affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
        submittedAffiliatesReward = decode[0].args["sovBonusAmount"];
        submittedTokenBonusAmount = decode[0].args["tokenBonusAmount"];
        sovBonusAmountPaid = decode[0].args["sovBonusAmountPaid"];

        expect(
            affiliateRewardsHeld.toString(),
            "affiliateRewardHeld should be zero at this point"
        ).to.be.equal(new BN(0).toString());
        expect(referrerFee.toString(), "Token bonus rewards is not matched").to.be.equal(
            submittedTokenBonusAmount.toString()
        );

        checkSovBonusAmountPaid = new BN(submittedAffiliatesReward).add(
            new BN(previousAffiliateRewardsHeld)
        );
        expect(
            checkSovBonusAmountPaid.toString(),
            "Affiliates bonus rewards paid is not matched"
        ).to.be.equal(sovBonusAmountPaid.toString());

        checkedValueShouldBe = new BN(affiliateRewardsHeld).add(
            new BN(previousAffiliateRewardsHeld)
        );
        expect(
            checkedValueShouldBe.toString(),
            "Affiliates bonus rewards is not matched"
        ).to.be.equal(submittedAffiliatesReward.toString());

        // Check lockedSOV Balance of the referrer
        referrerBalanceInLockedSOV = await lockedSOV.getLockedBalance(referrer);
        expect(
            referrerBalanceInLockedSOV.toString(),
            "Referrer balance in lockedSOV is not matched"
        ).to.be.equal(checkSovBonusAmountPaid.toString());

        // Do withdrawal
        let referrerTokenBalance = await doc.balanceOf(referrer);
        let referrerFee2 = new BN(referrerFee).add(new BN(submittedTokenBonusAmount));
        tx = await sovryn.withdrawAllAffiliatesReferrerTokenFees(referrer, { from: referrer });
        const referrerFeeAfterWithdrawal = await sovryn.affiliatesReferrerBalances(
            referrer,
            doc.address
        );
        let referrerTokenBalanceAfterWithdrawal = await doc.balanceOf(referrer);
        expect(
            referrerFeeAfterWithdrawal,
            "Incorrect all balance after all DoC withdraw"
        ).to.be.bignumber.equal(new BN(0));
        expect(
            referrerTokenBalanceAfterWithdrawal.sub(referrerTokenBalance).toString()
        ).to.be.equal(referrerFee2.toString());

        await expectEvent.inTransaction(
            tx.receipt.rawLogs[0].transactionHash,
            Affiliates,
            "WithdrawAffiliatesReferrerTokenFees",
            {
                referrer: referrer,
                receiver: referrer,
                tokenAddress: doc.address,
                amount: referrerFee2.toString(),
            }
        );
    });

    it("Check get estimation token value in rBTC", async () => {
        /*
		/// @dev Optimization: Removed feeds init for specific test, relayed to beforeEach hook

		feeds = await PriceFeeds.new(WRBTC.address, SUSD.address, doc.address);
		testToken1Precision = 18;
		testToken2Precision = 18;
		btcPrecision = 18;
		testToken1 = await TestToken.new("test token 1", "TEST1", testToken1Precision, wei("20000", "ether"));
		testToken2 = await TestToken.new("test token 2", "TEST2", testToken2Precision, wei("20000", "ether"));
		testToken1Price = wei("2", "ether");
		testToken2Price = wei("2", "ether");
		wrBTCPrice = wei("8", "ether");
		docPrice = wei("7", "ether");

		// Set tetToken1 feed - price 1Z BTC
		// Set v1 convert mockup
		liquidityV1ConverterMockupTestToken1 = await LiquidityPoolV1ConverterMockup.new(testToken1.address, WRBTC.address);

		priceFeedsV1PoolOracleMockupTestToken1 = await deployMockContract(senderMock, IV1PoolOracle.abi);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.latestAnswer.returns(testToken1Price);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.latestPrice.returns(testToken1Price);
		await priceFeedsV1PoolOracleMockupTestToken1.mock.liquidityPool.returns(liquidityV1ConverterMockupTestToken1.address);

		priceFeedsV1PoolOracleTestToken1 = await PriceFeedV1PoolOracle.new(
			priceFeedsV1PoolOracleMockupTestToken1.address,
			WRBTC.address,
			doc.address,
			testToken1.address
		);

		liquidityV1ConverterMockupTestToken2 = await LiquidityPoolV1ConverterMockup.new(testToken2.address, WRBTC.address);
		priceFeedsV1PoolOracleMockupTestToken2 = await deployMockContract(senderMock, IV1PoolOracle.abi);
		await priceFeedsV1PoolOracleMockupTestToken2.mock.latestAnswer.returns(testToken2Price);
		await priceFeedsV1PoolOracleMockupTestToken2.mock.latestPrice.returns(testToken2Price);
		await priceFeedsV1PoolOracleMockupTestToken2.mock.liquidityPool.returns(liquidityV1ConverterMockupTestToken2.address);

		priceFeedsV1PoolOracleTestToken2 = await PriceFeedV1PoolOracle.new(
			priceFeedsV1PoolOracleMockupTestToken2.address,
			WRBTC.address,
			doc.address,
			testToken2.address
		);

		// Set rBTC feed - using rsk oracle
		priceFeedsV1PoolOracleMockupBTC = await PriceFeedRSKOracleMockup.new();
		await priceFeedsV1PoolOracleMockupBTC.setValue(wrBTCPrice);
		priceFeedsV1PoolOracleBTC = await PriceFeedRSKOracle.new(priceFeedsV1PoolOracleMockupBTC.address);

		// Set DOC feed -- price 1 BTC
		liquidityV1ConverterMockupDOC = await LiquidityPoolV1ConverterMockup.new(doc.address, WRBTC.address);

		priceFeedsV1PoolOracleMockupDOC = await deployMockContract(senderMock, IV1PoolOracle.abi);
		await priceFeedsV1PoolOracleMockupDOC.mock.latestAnswer.returns(docPrice);
		await priceFeedsV1PoolOracleMockupDOC.mock.latestPrice.returns(docPrice);
		await priceFeedsV1PoolOracleMockupDOC.mock.liquidityPool.returns(liquidityV1ConverterMockupDOC.address);

		priceFeedsV1PoolOracleDOC = await PriceFeedV1PoolOracle.new(
			priceFeedsV1PoolOracleMockupDOC.address,
			WRBTC.address,
			doc.address,
			doc.address
		);

		// await feeds.setPriceFeed([WRBTC.address, doc.address], [priceFeedsV1PoolOracle.address, priceFeedsV1PoolOracle.address])
		await feeds.setPriceFeed(
			[testToken1.address, testToken2.address, doc.address, WRBTC.address],
			[
				priceFeedsV1PoolOracleTestToken1.address,
				priceFeedsV1PoolOracleTestToken2.address,
				priceFeedsV1PoolOracleDOC.address,
				priceFeedsV1PoolOracleBTC.address,
			]
		);

		test1 = await feeds.queryRate(testToken1.address, doc.address);
		expect(test1[0].toString()).to.be.equal(
			new BN(testToken1Price)
				.mul(new BN(wrBTCPrice))
				.mul(new BN(10 ** (testToken1Precision - btcPrecision)))
				.div(new BN(wei("1", "ether")))
				.toString()
		);

		test = await feeds.queryReturn(testToken1.address, doc.address, wei("2", "ether"));
		expect(test.toString()).to.be.equal(
			new BN(2)
				.mul(
					new BN(testToken1Price)
						.mul(new BN(wrBTCPrice))
						.mul(new BN(10 ** (testToken1Precision - btcPrecision)))
						.div(new BN(wei("1", "ether")))
				)
				.toString()
		);

		test1 = await feeds.queryRate(testToken1.address, testToken2.address);

		expect(test1[0].toString()).to.be.equal(
			new BN(testToken1Price)
				.div(new BN(testToken2Price))
				.mul(new BN(wei("1", "ether")))
				.toString()
		);
		test = await feeds.queryReturn(testToken1.address, testToken2.address, wei("2", "ether"));
		expect(test.toString()).to.be.equal(
			new BN(2).mul(new BN(testToken1Price).div(new BN(testToken2Price)).mul(new BN(wei("1", "ether")))).toString()
		);
*/

        /*
		/// @dev Optimization: Removed swap pool init for specific test, relayed to beforeEach hook

		swapsSovryn = await SwapsImplSovrynSwap.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([doc.address, WRBTC.address], [true, true]);
		await sovryn.setPriceFeedContract(
			feeds.address // priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swapsSovryn.address // swapsImpl
		);
		await sovryn.setFeesController(owner);
		await sovryn.setWrbtcToken(WRBTC.address);
		await sovryn.setSOVTokenAddress(SUSD.address);
*/

        /*
		/// @dev Optimization: Removed default affiliate init for specific test, relayed to beforeEach hook

		// Change the min referrals to payout to 3 for testing purposes
		await sovryn.setMinReferralsToPayoutAffiliates(3);
		loanTokenLogic = await LoanTokenLogicLM.new();

		const loanTokenSent = wei("21", "ether");
		const leverageAmount = web3.utils.toWei("2", "ether");
		// underlyingToken.approve(loanTokenV2.address, loanTokenSent*2)

		let previousAffiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
		let tx = await loanTokenV2.marginTradeAffiliate(
			constants.ZERO_BYTES32, // loanId (0 for new loans)
			leverageAmount, // Leverage
			loanTokenSent, // loanTokenSent
			0, //
			WRBTC.address, // collateralTokenAddress
			trader, // trader
			0, // max slippage
			referrer, // referrer address
			"0x", // loanDataBytes (only required with ether)
			{ from: trader }
		);

		await expectEvent.inTransaction(tx.receipt.rawLogs[0].transactionHash, Affiliates, "SetAffiliatesReferrer", {
			user: trader,
			referrer: referrer,
		});

		let referrerOnChain = await sovryn.affiliatesUserReferrer(trader);
		expect(referrerOnChain, "Incorrect User Affiliate").to.be.equal(referrer);

		notFirstTradeFlagOnChain = await sovryn.getUserNotFirstTradeFlag(trader);
		expect(notFirstTradeFlagOnChain, "First trade flag is not updated").to.be.true;

		let event_name = "PayTradingFeeToAffiliate";
		let decode = decodeLogs(tx.receipt.rawLogs, Affiliates, event_name);
		let referrerFee = await sovryn.affiliatesReferrerBalances(referrer, doc.address);
		if (!decode.length) {
			throw "Event PayTradingFeeToAffiliate is not fired properly";
		}

		let isHeld = decode[0].args["isHeld"];
		let affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer);
		let submittedAffiliatesReward = decode[0].args["sovBonusAmount"];
		let submittedTokenBonusAmount = decode[0].args["tokenBonusAmount"];
		expect(isHeld, "First trade affiliates reward must be in held").to.be.true;
		expect(referrerFee.toString(), "Token bonus rewards is not matched").to.be.equal(submittedTokenBonusAmount.toString());

		let checkedValueShouldBe = affiliateRewardsHeld - previousAffiliateRewardsHeld;
		expect(checkedValueShouldBe.toString(), "Affiliates bonus rewards is not matched").to.be.equal(
			submittedAffiliatesReward.toString()
		);

		// Check lockedSOV Balance of the referrer
		let referrerBalanceInLockedSOV = await lockedSOV.getLockedBalance(referrer);
		expect(referrerBalanceInLockedSOV.toString(), "Referrer balance in lockedSOV is not matched").to.be.equal(new BN(0).toString());
*/

        // Check est token rewards balance in rbtc
        const tokenRewards = await sovryn.getAffiliatesReferrerTokenBalance(referrer, doc.address);

        const tokenRewardsInRBTC = await sovryn.getAffiliatesTokenRewardsValueInRbtc(referrer);

        expect(tokenRewardsInRBTC.toString()).to.be.equal(
            tokenRewards
                .mul(new BN(wei("1", "ether")))
                .div(new BN(wrBTCPrice))
                .toString()
        );
    });
});
