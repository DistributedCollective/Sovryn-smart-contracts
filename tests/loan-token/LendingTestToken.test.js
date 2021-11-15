/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 8.6s
 * After optimization: 5.8s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use the initializer.js function getSOV for protocol token SOV deployment.
 *   Updated to use WRBTC as collateral token, instead of custom testWrbtc.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { constants, expectRevert, BN } = require("@openzeppelin/test-helpers");
const { increaseTime } = require("../Utils/Ethereum");

const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwap");

const { lend_to_the_pool, cash_out_from_the_pool, cash_out_from_the_pool_uint256_max_should_withdraw_total_balance } = require("./helpers");
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
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const wei = web3.utils.toWei;

contract("LoanTokenLending", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let lender, account2;
	let SUSD, WRBTC;
	let sovryn, loanToken;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		await sovryn.setSovrynProtocolAddress(sovryn.address);

		await sovryn.setWrbtcToken(WRBTC.address);

		feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
		await feeds.setRates(SUSD.address, WRBTC.address, wei("0.01", "ether"));
		const swaps = await SwapsImplSovrynSwap.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([SUSD.address, WRBTC.address], [true, true]);
		await sovryn.setPriceFeedContract(
			feeds.address // priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swaps.address // swapsImpl
		);
		await sovryn.setFeesController(lender);

		sov = await getSOV(sovryn, priceFeeds, SUSD, accounts);

		loanTokenLogicStandard = await LoanTokenLogicLM.new();
		loanToken = await LoanToken.new(lender, loanTokenLogicStandard.address, sovryn.address, WRBTC.address);
		await loanToken.initialize(SUSD.address, name, symbol); // iToken
		loanToken = await LoanTokenLogicLM.at(loanToken.address);

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			lender, // address owner; // owner of this object
			SUSD.address, // address loanToken; // the token being loaned
			WRBTC.address, // address collateralToken; // the required collateral token
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

		await WRBTC.mint(sovryn.address, wei("500", "ether"));
	}

	before(async () => {
		[lender, account2, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("Test lending using TestToken", () => {
		it("Test disableLoanParams", async () => {
			await loanToken.disableLoanParams([WRBTC.address], [false]);
		});

		it("Should revert when calling disableLoanParams by other than Admin", async () => {
			await expectRevert(loanToken.disableLoanParams([WRBTC.address], [false], { from: account2 }), "unauthorized");
		});

		it("Should revert when calling disableLoanParams w/ mismatching parameters", async () => {
			await expectRevert(loanToken.disableLoanParams([WRBTC.address, ZERO_ADDRESS], [false]), "count mismatch");
		});

		it("test lend to the pool", async () => {
			await lend_to_the_pool(loanToken, lender, SUSD, WRBTC, sovryn);
		});

		it("test cash out from the pool", async () => {
			await cash_out_from_the_pool(loanToken, lender, SUSD, false);
		});

		it("test cash out from the pool more of lender balance should not fail", async () => {
			// await cash_out_from_the_pool_more_of_lender_balance_should_not_fail(loanToken, lender, SUSD);
			await cash_out_from_the_pool_uint256_max_should_withdraw_total_balance(loanToken, lender, SUSD);
		});

		it("should fail when minting on address(0) behalf", async () => {
			let amount = new BN(1);
			await SUSD.approve(loanToken.address, amount);
			await expectRevert(loanToken.mint(constants.ZERO_ADDRESS, amount), "15");
		});

		/// @dev For test coverage
		it("should revert _prepareMinting when depositAmount is 0", async () => {
			await lend_to_the_pool(loanToken, lender, SUSD, WRBTC, sovryn);

			await expectRevert(loanToken.mint(account2, 0), "17");
		});

		it("test profit", async () => {
			await lend_to_the_pool(loanToken, lender, SUSD, WRBTC, sovryn);

			// above function also opens a trading position, so I need to add some more funds to be able to withdraw everything
			const balanceOf0 = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(loanToken.address, balanceOf0.toString());
			await loanToken.mint(account2, balanceOf0.toString());
			const profitBefore = await loanToken.profitOf(lender);
			const iTokenBalance = await loanToken.balanceOf(lender);

			// burn everything -> profit should be 0
			await loanToken.burn(lender, iTokenBalance.toString());
			const profitInt = await loanToken.profitOf(lender);

			// lend again and wait some time -> profit should rise again, but less than before, because there are more funds in the pool.
			await SUSD.approve(loanToken.address, balanceOf0.add(new BN(wei("100", "ether"))).toString());
			await loanToken.mint(lender, balanceOf0.toString());
			await SUSD.approve(loanToken.address, balanceOf0.add(new BN(wei("100", "ether"))).toString());

			await increaseTime(10000);

			const profitAfter = await loanToken.profitOf(lender);

			expect(profitInt).to.be.a.bignumber.equal(new BN(0));
			expect(profitAfter.gt(new BN(0))).to.be.true;
			expect(profitAfter.lt(profitBefore)).to.be.true;
		});

		/// @dev For test coverage
		it("should revert _burnToken when depositAmount is 0", async () => {
			await lend_to_the_pool(loanToken, lender, SUSD, WRBTC, sovryn);

			// above function also opens a trading position, so I need to add some more funds to be able to withdraw everything
			const balanceOf0 = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(loanToken.address, balanceOf0.toString());
			await loanToken.mint(account2, balanceOf0.toString());

			// Try to burn 0
			await expectRevert(loanToken.burn(lender, 0), "19");
		});

		it("Check swapExternal with minReturn > 0 should revert if minReturn is not valid (higher)", async () => {
			const balanceOf0 = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, balanceOf0.add(new BN(wei("10", "ether"))).toString());
			await expectRevert(
				sovryn.swapExternal(SUSD.address, WRBTC.address, accounts[0], accounts[0], wei("1", "ether"), 0, wei("10", "ether"), "0x"),
				"destTokenAmountReceived too low"
			);
		});

		it("Check swapExternal with minReturn > 0 should revert if minReturn is valid", async () => {
			const balanceOf0 = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, balanceOf0.add(new BN(wei("10", "ether"))).toString());
			// feeds price is set 0.01, so test minReturn with 0.01 as well for the 1 ether swap
			await sovryn.swapExternal(
				SUSD.address,
				WRBTC.address,
				accounts[0],
				accounts[0],
				wei("1", "ether"),
				0,
				wei("0.01", "ether"),
				"0x"
			);
		});

		it("Should revert _swapsCall through swapExternal w/ non-empty loanDataBytes", async () => {
			const balanceOf0 = await loanToken.assetBalanceOf(lender);
			await SUSD.approve(sovryn.address, balanceOf0.add(new BN(wei("10", "ether"))).toString());

			await expectRevert(
				sovryn.swapExternal(
					SUSD.address,
					WRBTC.address,
					accounts[0],
					accounts[0],
					wei("1", "ether"),
					0,
					wei("0.01", "ether"),
					"0x1"
				),
				"invalid state"
			);
		});
	});
});
