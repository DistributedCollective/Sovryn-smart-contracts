const { assert } = require("chai");
// const LoanTokenLogicStandard = artifacts.require("LoanTokenLogicStandard"); //replaced by MockLoanTokenLogic
const sovrynProtocol = artifacts.require("sovrynProtocol");
const LoanToken = artifacts.require("LoanToken");
const MockLoanTokenLogic = artifacts.require("MockLoanTokenLogic"); //added functionality for isolated unit testing
const LockedSovMockup = artifacts.require("LockedSovMockup");
// const LockedSOVMockup = artifacts.require("LockedSOVMockup");

const TestWrbtc = artifacts.require("TestWrbtc");
const TestToken = artifacts.require("TestToken");
const SOV = artifacts.require("SOV");
const ISovryn = artifacts.require("ISovryn");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const SwapsExternal = artifacts.require("SwapsExternal");
const LoanClosingsBase = artifacts.require("LoanClosingsBase");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwap");
const Affiliates = artifacts.require("Affiliates");

const { BN, constants, send, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("hardhat");

const TOTAL_SUPPLY = "10000000000000000000000000";

const {
	decodeLogs
} = require("./Utils/initializer.js");

contract("Affiliates", (accounts) => {
	let loanTokenLogic;
	let testWrbtc;
	let doc;
	let tokenSOV;
	let sovryn;
	let loanTokenV2;
	let feeds;
	let wei = web3.utils.toWei;
	before(async () => {
		[owner, trader, referrer, account1, account2, ...accounts] = accounts;
	});
	beforeEach(async () => {
		// Deploying sovrynProtocol
		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);

		await sovryn.replaceContract((await LoanClosingsBase.new()).address);
		await sovryn.replaceContract((await LoanClosingsWith.new()).address);
		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.replaceContract((await LoanSettings.new()).address);
		await sovryn.replaceContract((await LoanMaintenance.new()).address);
		await sovryn.replaceContract((await SwapsExternal.new()).address);
		await sovryn.replaceContract((await LoanOpenings.new()).address);
		await sovryn.replaceContract((await Affiliates.new()).address);
		await sovryn.replaceContract((await LockedSovMockup.new()).address);

		await sovryn.setSovrynProtocolAddress(sovrynproxy.address);

		//loanTokenLogic = await LoanTokenLogicStandard.new();
		loanTokenLogic = await MockLoanTokenLogic.new();
		testWrbtc = await TestWrbtc.new();
		doc = await TestToken.new("dollar on chain", "DOC", 18, wei("20000", "ether"));
		tokenSOV = await SOV.new(TOTAL_SUPPLY);
		loanToken = await LoanToken.new(owner, loanTokenLogic.address, sovryn.address, testWrbtc.address);
		await loanToken.initialize(doc.address, "SUSD", "SUSD");

		// loanTokenV2 = await LoanTokenLogicStandard.at(loanToken.address);
		loanTokenV2 = await MockLoanTokenLogic.at(loanToken.address); //mocked for ad-hoc logic for isolated testing
		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (owner == (await sovryn.owner())) {
			await sovryn.setLoanPool([loanTokenV2.address], [loanTokenAddress]);
		}

		// await sovryn.replaceContract((await LockedSOVMockup.new(tokenSOV.address, [owner])).address);
	});
	let swapsSovryn;
	beforeEach(async () => {
		//initialize
		feeds = await PriceFeedsLocal.new(testWrbtc.address, sovryn.address);
		await feeds.setRates(doc.address, testWrbtc.address, wei("0.01", "ether"));
		swapsSovryn = await SwapsImplSovrynSwap.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([doc.address, testWrbtc.address], [true, true]);
		await sovryn.setPriceFeedContract(
			feeds.address //priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swapsSovryn.address // swapsImpl
		);
		await sovryn.setFeesController(owner);
		await sovryn.setWrbtcToken(testWrbtc.address);
		await sovryn.setSOVTokenAddress(tokenSOV.address);

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
			testWrbtc.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		//await loanTokenV2.setupLoanParams([params], true);
		await loanTokenV2.setupLoanParams([params], false);

		// setting up interest rates
		const baseRate = wei("1", "ether");
		const rateMultiplier = wei("20.25", "ether");
		const targetLevel = wei("80", "ether");
		const kinkLevel = wei("90", "ether");
		const maxScaleRate = wei("100", "ether");
		await loanTokenV2.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);

		// GIVING SOME DOC tokens to loanToken so that we can borrow from loanToken
		await doc.transfer(loanTokenV2.address, wei("500", "ether"));
		await doc.transfer(trader, wei("100", "ether"));
		//trader approves to LoanToken loan amount for trading
		await doc.approve(loanToken.address, web3.utils.toWei("100", "ether"), { from: trader });
		//Giving some testRbtc to sovrynAddress (by minting some testRbtc),so that it can open position in wRBTC.
		await testWrbtc.mint(sovryn.address, wei("500", "ether"));
	});

	it("Should not be able to set the minReferralsPayout to 0", async() => {
		await expectRevert(sovryn.setMinReferralsToPayoutAffiliates(0, { from: referrer }), "unauthorized")
		await expectRevert(sovryn.setMinReferralsToPayoutAffiliates(0), "Minimum referrals must be greater than 0");
	});

	it("Should not be able to set the affiliateFeePercent more than 100%", async() => {
		const valueExperiment = wei("101", "ether")
		await expectRevert(sovryn.setAffiliateFeePercent(0, { from: referrer }), "unauthorized")
		await expectRevert(sovryn.setAffiliateFeePercent(valueExperiment), "value too high");
	});

	it("User Margin Trade with Affiliate runs correctly", async () => {
		//expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5)
		const leverageAmount = web3.utils.toWei("3", "ether");
		//loan tokens sent to iToken contract to start Margin Trading
		const loanTokenSent = web3.utils.toWei("20", "ether");
		// AUDIT: should the call be allowed from arbitrary address to set an affiliate in
		// LoanTokenLogicStandard.marginTradeAffiliate?
		const tx = await loanTokenV2.marginTradeAffiliate(
			constants.ZERO_BYTES32, // loanId  (0 for new loans)
			leverageAmount, // leverageAmount
			loanTokenSent, // loanTokenSent
			0, // no collateral token sent
			testWrbtc.address, // collateralTokenAddress
			trader,
			referrer, // affiliates referrer
			"0x", // loanDataBytes (only required with ether)
			{ from: trader }
		);

		expect(await sovryn.getUserNotFirstTradeFlag(trader), "userNotFirstTradeFlag has not been set to true").to.be.true;
		expect(await sovryn.affiliatesUserReferrer(trader), "Incorrect User Affiliate Referrer set").to.be.equal(referrer);

		let event_name = "PayTradingFeeToAffiliate";
		let decode = decodeLogs(tx.receipt.rawLogs, Affiliates, event_name);
		if (!decode.length) {
			throw "Event PayTradingFeeToAffiliate is not fired properly"
		}

		tradingFeeAmount = decode[0].args["tradingFeeTokenAmount"]
		submittedToken = decode[0].args["token"]
		submittedReferrer = decode[0].args["referrer"]
		isHeld = decode[0].args['isHeld']
		affiliatesFeePercentage = await sovryn.affiliateFeePercent()
		sovBonusAmountShouldBePaid = await feeds.queryReturn(doc.address, tokenSOV.address, (affiliatesFeePercentage*tradingFeeAmount/Math.pow(10,20)).toString())
		submittedSovBonusAmount = decode[0].args["sovBonusAmount"]
		affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer)
		expect(sovBonusAmountShouldBePaid.toString(), "Incorrect sov bonus amount calculation").to.be.equal(submittedSovBonusAmount)
		expect(submittedToken).to.eql(doc.address)
		expect(submittedReferrer).to.eql(referrer)
		// Since the minimum referrals to payout is set to 3, make sure the affiliateRewardsHeld is correct
		expect(affiliateRewardsHeld.toString(), "SOV Bonus amount that stored in the affiliateRewardsHeld is incorrect").to.be.equal(sovBonusAmountShouldBePaid.toString())
		expect(isHeld, "Token should not be sent since the minimum referrals to payout has not been fullfilled").to.eql(true)





		/*----------------------------------- Do a trade once again, and set the min referrals to payout to 1 -----------------------------------*/
		previousAffiliateRewardsHeld = affiliateRewardsHeld
		await sovryn.setMinReferralsToPayoutAffiliates(1);
		const tx2 = await loanTokenV2.marginTradeAffiliate(
			constants.ZERO_BYTES32, // loanId  (0 for new loans)
			leverageAmount, // leverageAmount
			loanTokenSent, // loanTokenSent
			0, // no collateral token sent
			testWrbtc.address, // collateralTokenAddress
			trader,
			referrer, // affiliates referrer
			"0x", // loanDataBytes (only required with ether)
			{ from: trader }
		);

		decode = decodeLogs(tx2.receipt.rawLogs, Affiliates, event_name);
		if (!decode.length) {
			throw "Event PayTradingFeeToAffiliate is not fired properly"
		}

		// At this point, the remaining affiliate rewards in protocol + current rewards will be sent to the locked sov
		tradingFeeAmount = decode[0].args["tradingFeeTokenAmount"]
		submittedToken = decode[0].args["token"]
		submittedReferrer = decode[0].args["referrer"]
		isHeld = decode[0].args['isHeld']
		sovBonusAmountShouldBePaid = await feeds.queryReturn(doc.address, tokenSOV.address, (affiliatesFeePercentage*tradingFeeAmount/Math.pow(10,20)).toString())
		submittedSovBonusAmount = decode[0].args["sovBonusAmount"]
		affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer)
		expect(sovBonusAmountShouldBePaid.toString(), "Incorrect sov bonus amount calculation").to.be.equal((submittedSovBonusAmount - previousAffiliateRewardsHeld).toString())
		expect(submittedToken).to.eql(doc.address)
		expect(submittedReferrer).to.eql(referrer)

		expect(( new BN(parseInt(previousAffiliateRewardsHeld)).add(new BN(parseInt(sovBonusAmountShouldBePaid))) ).toString(), "Incorrect sov bonus amount calculation").to.be.equal(submittedSovBonusAmount.toString())
		expect(affiliateRewardsHeld.toString(), "Affiliates rewards should be 0 after rewards is sent").to.eql((new BN(0)).toString())
		expect(isHeld, "Token should be sent since the minimum referrals to payout has not been fullfilled").to.eql(false)
	});

	it("User Margin Trade with Affiliate runs correctly when  minimum referrals set to 1", async () => {
		await sovryn.setMinReferralsToPayoutAffiliates(1);
		//expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5)
		const leverageAmount = web3.utils.toWei("3", "ether");
		//loan tokens sent to iToken contract to start Margin Trading
		const loanTokenSent = web3.utils.toWei("20", "ether");
		// AUDIT: should the call be allowed from arbitrary address to set an affiliate in
		// LoanTokenLogicStandard.marginTradeAffiliate?
		const tx = await loanTokenV2.marginTradeAffiliate(
			constants.ZERO_BYTES32, // loanId  (0 for new loans)
			leverageAmount, // leverageAmount
			loanTokenSent, // loanTokenSent
			0, // no collateral token sent
			testWrbtc.address, // collateralTokenAddress
			trader,
			referrer, // affiliates referrer
			"0x", // loanDataBytes (only required with ether)
			{ from: trader }
		);

		expect(await sovryn.getUserNotFirstTradeFlag(trader), "userNotFirstTradeFlag has not been set to true").to.be.true;
		expect(await sovryn.affiliatesUserReferrer(trader), "Incorrect User Affiliate Referrer set").to.be.equal(referrer);

		const event_name = "PayTradingFeeToAffiliate";
		const decode = decodeLogs(tx.receipt.rawLogs, Affiliates, event_name);
		if (!decode.length) {
			throw "Event PayTradingFeeToAffiliate is not fired properly"
		}

		tradingFeeAmount = decode[0].args["tradingFeeTokenAmount"]
		submittedToken = decode[0].args["token"]
		submittedReferrer = decode[0].args["referrer"]
		isHeld = decode[0].args['isHeld']
		affiliatesFeePercentage = await sovryn.affiliateFeePercent()
		sovBonusAmountShouldBePaid = await feeds.queryReturn(doc.address, tokenSOV.address, (affiliatesFeePercentage*tradingFeeAmount/Math.pow(10,20)).toString())
		submittedSovBonusAmount = decode[0].args["sovBonusAmount"]
		affiliateRewardsHeld = await sovryn.affiliateRewardsHeld(referrer)
		expect(sovBonusAmountShouldBePaid.toString(), "Incorrect sov bonus amount calculation").to.be.equal(submittedSovBonusAmount)
		expect(submittedToken).to.eql(doc.address)
		expect(submittedReferrer).to.eql(referrer)
		// Since the minimum referrals to payout is set to 1, make sure the affiliateRewardsHeld is correct
		expect(affiliateRewardsHeld.toString(), "SOV Bonus amount that stored in the affiliateRewardsHeld is incorrect").to.be.equal((new BN(0)).toString())
		expect(isHeld, "Token should be sent since the minimum referrals to payout has not been fullfilled").to.eql(false)
	});

	it("Only the first trade users can be assigned Affiliates Referrer", async () => {
		let tx = await loanTokenV2.setUserNotFirstTradeFlag(trader); // can be called only from loan tokens pool addresses
		await expectEvent.inTransaction(tx.receipt.rawLogs[0].transactionHash, Affiliates, "SetUserNotFirstTradeFlag", {
			user: trader,
		});
		tx = await loanTokenV2.setAffiliatesReferrer(trader, referrer); // can be called only from loan tokens pool addresses
		expect(await sovryn.affiliatesUserReferrer(trader), "Referrer cannot be set for non first trade users").to.be.equal(
			constants.ZERO_ADDRESS
		);

		await expectEvent.inTransaction(tx.receipt.rawLogs[0].transactionHash, Affiliates, "SetAffiliatesReferrerFail", {
			user: trader,
			referrer: referrer,
		});
	});

	it("Affiliates Referrer cannot be changed once set", async () => {
		const tx = await loanTokenV2.setAffiliatesReferrer(trader, referrer); // can be called only from loan tokens pool addresses
		await expectEvent.inTransaction(tx.receipt.rawLogs[0].transactionHash, Affiliates, "SetAffiliatesReferrer", {
			user: trader,
			referrer: referrer,
		});
		await loanTokenV2.setAffiliatesReferrer(trader, account1); // try to replace referrer
		expect(await sovryn.affiliatesUserReferrer(trader), "Affiliates Referrer is set once and cannot be changed").to.be.equal(referrer);
	});

	it("Users cannot be self-referrers", async () => {
		// try to replace referrer
		await loanTokenV2.setAffiliatesReferrer(trader, trader); // can be called only from loan tokens pool addresses
		expect(await sovryn.affiliatesUserReferrer(trader), "Affiliates Referrer is set once and cannot be changed").to.be.equal(
			constants.ZERO_ADDRESS
		);
	});

	it("First users Margin trading without affiliate referrer sets userNotFirstTradingFlag = true", async () => {
		const leverageAmount = web3.utils.toWei("3", "ether");
		const loanTokenSent = web3.utils.toWei("20", "ether");
		await loanTokenV2.marginTrade(
			constants.ZERO_BYTES32, // loanId  (0 for new loans)
			leverageAmount, // leverageAmount
			loanTokenSent, // loanTokenSent
			0, // no collateral token sent
			testWrbtc.address, // collateralTokenAddress
			trader, // trader,
			//referrer, // affiliates referrer
			"0x", // loanDataBytes (only required with ether)
			{ from: trader }
		);
		expect(await sovryn.getUserNotFirstTradeFlag(trader), "sovryn.getUserNotFirstTradeFlag(trader) should be true").to.be.true;
	});

	it("Doesn't allow fallback function calls", async () => {
		const affiliates = await Affiliates.new();
		await expectRevert(
			affiliates.send(wei("0.0000000000000001", "ether")),
			"fallback function is not payable and was called with value 100"
		);
		await expectRevert(affiliates.sendTransaction({}), "Affiliates - fallback not allowed");
	});
});
