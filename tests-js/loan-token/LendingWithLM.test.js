const { expect, assert } = require("chai");
const { expectRevert, BN } = require("@openzeppelin/test-helpers");
const { increaseTime } = require("../Utils/Ethereum");

const TestToken = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");

const sovrynProtocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const ISovryn = artifacts.require("ISovryn");

const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const LoanClosingsBase = artifacts.require("LoanClosingsBase");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");
const SwapsExternal = artifacts.require("SwapsExternal");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplLocal = artifacts.require("SwapsImplLocal");

const LiquidityMiningLogic = artifacts.require("LiquidityMiningMockup");
const LiquidityMiningProxy = artifacts.require("LiquidityMiningProxy");

const TOTAL_SUPPLY = web3.utils.toWei("1000", "ether");

//const { lend_to_the_pool, cash_out_from_the_pool, cash_out_from_the_pool_more_of_lender_balance_should_not_fail } = require("./helpers");
const { lend_to_the_pool, cash_out_from_the_pool, cash_out_from_the_pool_uint256_max_should_withdraw_total_balance } = require("./helpers");

const wei = web3.utils.toWei;

contract("LoanTokenLogicLM", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let lender, account1, account2, account3, account4;
	let underlyingToken, testWrbtc;
	let sovryn, loanToken;
	let liquidityMining;

	before(async () => {
		[lender, account1, account2, account3, account4, ...accounts] = accounts;

		//Token
		underlyingToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
		testWrbtc = await TestWrbtc.new();

		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);

		await sovryn.replaceContract((await LoanClosingsBase.new()).address);
		await sovryn.replaceContract((await LoanClosingsWith.new()).address);
		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.replaceContract((await LoanSettings.new()).address);
		await sovryn.replaceContract((await LoanMaintenance.new()).address);
		await sovryn.replaceContract((await SwapsExternal.new()).address);
		await sovryn.replaceContract((await LoanOpenings.new()).address);

		await sovryn.setWrbtcToken(testWrbtc.address);

		feeds = await PriceFeedsLocal.new(testWrbtc.address, sovryn.address);
		await feeds.setRates(underlyingToken.address, testWrbtc.address, wei("0.01", "ether"));
		const swaps = await SwapsImplLocal.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([underlyingToken.address, testWrbtc.address], [true, true]);
		await sovryn.setPriceFeedContract(
			feeds.address //priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swaps.address // swapsImpl
		);
		await sovryn.setFeesController(lender);

		loanTokenLogicLM = await LoanTokenLogicLM.new();
		loanToken = await LoanToken.new(lender, loanTokenLogicLM.address, sovryn.address, testWrbtc.address);
		await loanToken.initialize(underlyingToken.address, name, symbol); //iToken
		loanToken = await LoanTokenLogicLM.at(loanToken.address);

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			lender, // address owner; // owner of this object
			underlyingToken.address, // address loanToken; // the token being loaned
			testWrbtc.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		await loanToken.setupLoanParams([params], false);

		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (lender == (await sovryn.owner())) await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);
		// const baseRate = wei("1", "ether");
		// const rateMultiplier = wei("20.25", "ether");
		// const targetLevel = wei("80", "ether");
		// const kinkLevel = wei("90", "ether");
		// const maxScaleRate = wei("100", "ether");
		// await loanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);

		await testWrbtc.mint(sovryn.address, wei("500", "ether"));
		console.log("after before each in JS");

		await deployLiquidityMining();

		await loanToken.setLiquidityMiningAddress(liquidityMining.address);

		await liquidityMining.add(loanToken.address, 10, false);
		
	});

	describe("Test lending with liquidity mining", () => {
		it("Should lend to the pool and deposit the pool tokens at the liquidity mining contract", async () => {
			//await lend_to_the_pool(loanToken, lender, underlyingToken, testWrbtc, sovryn);
            const depositAmount = new BN(wei("400", "ether"));
            await underlyingToken.approve(loanToken.address, depositAmount);
            await loanToken.mint(lender, depositAmount, true);
			const userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
			//expected: user pool token balance is 0, but balance of LM contract increased
			expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal(depositAmount);
		});

		it("Should lend to the pool without depositing the pool tokens at the liquidity mining contract", async () => {
			const depositAmount = new BN(wei("400", "ether"));
            await underlyingToken.approve(loanToken.address, depositAmount);
            await loanToken.mint(lender, depositAmount, false);
			const userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
			//expected: user pool token balance increased by the deposited amount, LM balance stays unchanged
			expect(await loanToken.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal(depositAmount);
		});
		/**
        it("Should remove the pool tokens from the liquidity mining pool and burn them", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await loanToken.burn(lender, depositAmount, true);
		});

        it("Should burn pool tokens without removing them from the LM pool", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await loanToken.burn(lender, depositAmount, false);
		});

		
		 * missing:
		 * test lm connection with wrbtc
		 * test the setter
		 * fix test for tx limits lending (because removed)
		 */
		
	});

	async function deployLiquidityMining() {
		let liquidityMiningLogic = await LiquidityMiningLogic.new();
		let liquidityMiningProxy = await LiquidityMiningProxy.new();
		await liquidityMiningProxy.setImplementation(liquidityMiningLogic.address);
		liquidityMining = await LiquidityMiningLogic.at(liquidityMiningProxy.address);

		//dummy settings
		await liquidityMining.initialize(
			loanToken.address, 10, 1, 1, account1, account1, 0
		);
	}
});
