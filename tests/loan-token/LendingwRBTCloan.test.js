/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 6.1s
 * After optimization: 5.1s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use WRBTC as collateral token, instead of custom testWRBTC token.
 *   Updated to use SUSD as underlying token, instead of custom underlyingToken.
 *   Moved some initialization code from tests to fixture.
 *   Added tests to increase the test coverage index:
 *     + "test avgBorrowInterestRate() function"
 *     + "test totalSupplyInterestRate() function"
 *     + ...
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, constants, BN } = require("@openzeppelin/test-helpers");
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

const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicWrbtc = artifacts.require("LoanTokenLogicWrbtc");

const { verify_start_conditions, verify_lending_result_and_itoken_price_change, cash_out_from_the_pool } = require("./helpers");

const wei = web3.utils.toWei;

contract("LoanTokenLending", (accounts) => {
	let lender;
	let SUSD, WRBTC;
	let sovryn, loanToken;
	let baseRate;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		await sovryn.setSovrynProtocolAddress(sovryn.address);

		await priceFeeds.setRates(SUSD.address, WRBTC.address, wei("0.01", "ether"));
		await sovryn.setSupportedTokens([SUSD.address, WRBTC.address], [true, true]);
		await sovryn.setFeesController(lender);

		// Custom tokens
		await getSOV(sovryn, priceFeeds, SUSD, accounts);

		loanTokenLogicWrbtc = await LoanTokenLogicWrbtc.new();
		loanToken = await LoanToken.new(lender, loanTokenLogicWrbtc.address, sovryn.address, WRBTC.address);
		await loanToken.initialize(WRBTC.address, "iWRBTC", "iWRBTC"); // iToken
		loanToken = await LoanTokenLogicWrbtc.at(loanToken.address);

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			lender, // address owner; // owner of this object
			WRBTC.address, // address loanToken; // the token being loaned
			SUSD.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		await loanToken.setupLoanParams([params], false);
		await loanToken.setupLoanParams([params], true);

		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (lender == (await sovryn.owner())) await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

		await WRBTC.mint(sovryn.address, wei("500", "ether"));

		baseRate = wei("1", "ether");
		const rateMultiplier = wei("20.25", "ether");
		const targetLevel = wei("80", "ether");
		const kinkLevel = wei("90", "ether");
		const maxScaleRate = wei("100", "ether");

		await loanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);
	}

	before(async () => {
		[lender, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("test lending using wRBTC as loanToken", () => {
		it("test avgBorrowInterestRate() function", async () => {
			expect(await await loanToken.avgBorrowInterestRate()).to.be.a.bignumber.equal(new BN(0));
		});

		it("test supplyInterestRate() function", async () => {
			expect(await loanToken.supplyInterestRate()).to.be.a.bignumber.equal(new BN(0));
		});

		it("test nextSupplyInterestRate() function", async () => {
			const deposit_amount = new BN(1);
			expect(await loanToken.nextSupplyInterestRate(deposit_amount)).to.be.a.bignumber.equal(new BN(0));
		});

		it("test totalSupplyInterestRate() function", async () => {
			const deposit_amount = new BN(1);
			expect(await loanToken.totalSupplyInterestRate(deposit_amount)).to.be.a.bignumber.equal(new BN(0));
		});

		it("test lend to the pool", async () => {
			borrow_interest_rate = await loanToken.borrowInterestRate();
			expect(borrow_interest_rate.gt(baseRate)).to.be.true;

			const deposit_amount = new BN(wei("4", "ether"));
			const loan_token_sent = new BN(wei("1", "ether"));
			let initial_balance = new BN(0);
			const actual_initial_balance = new BN(await web3.eth.getBalance(lender));

			await verify_start_conditions(WRBTC, loanToken, lender, initial_balance, deposit_amount);
			await loanToken.mintWithBTC(lender, false, { value: deposit_amount });

			initial_balance = new BN(wei("5", "ether"));
			await verify_lending_result_and_itoken_price_change(
				WRBTC,
				SUSD,
				loanToken,
				lender,
				loan_token_sent,
				deposit_amount,
				sovryn,
				true
			);

			const new_balance = new BN(await web3.eth.getBalance(lender));
			expect(new_balance.lt(actual_initial_balance)).to.be.true;
		});

		it("test cash out from the pool", async () => {
			await cash_out_from_the_pool(loanToken, lender, WRBTC, true);
		});

		it("test cash out from the pool more of lender balance should not fail", async () => {
			const total_deposit_amount = new BN(wei("200", "ether"));
			await loanToken.mintWithBTC(lender, false, { value: total_deposit_amount.toString() });
			await expectRevert(loanToken.burnToBTC(lender, total_deposit_amount.mul(new BN(2)).toString(), false), "32");
			await loanToken.burnToBTC(lender, constants.MAX_UINT256, false);
			expect(await loanToken.balanceOf(lender)).to.be.a.bignumber.equal(new BN(0));
		});
	});
});
