/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 9.1s
 * After optimization: 6.6s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const FeesEvents = artifacts.require("FeesEvents");
const LoanClosingsEvents = artifacts.require("LoanClosingsEvents");

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
	getSOV,
	decodeLogs,
} = require("../Utils/initializer.js");

const { liquidate, liquidate_healthy_position_should_fail, prepare_liquidation } = require("./liquidationFunctions");

const { increaseTime } = require("../Utils/Ethereum");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));

/*
Should test the liquidation handling
1. Liquidate a position
2. Should fail to liquidate a healthy position
*/

contract("ProtocolLiquidationTestToken", (accounts) => {
	let owner;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, SOV;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		const loanTokenLogicStandard = await getLoanTokenLogic();
		const loanTokenLogicWrbtc = await getLoanTokenLogicWrbtc();
		loanToken = await getLoanToken(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(loanTokenLogicWrbtc, owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

		/// @dev SOV test token deployment w/ initializer.js
		SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
	}

	before(async () => {
		[owner] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("Tests liquidation handling ", () => {
		/*
			Test with different rates so the currentMargin is <= liquidationIncentivePercent
			or > liquidationIncentivePercent
			liquidationIncentivePercent = 5e18 by default
		*/
		it("Test liquidate with rate 1e21", async () => {
			const rate = new BN(10).pow(new BN(21));
			await liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WRBTC, FeesEvents, SOV);
		});

		it("Test liquidate with rate 1e21 (special rebates)", async () => {
			const rate = new BN(10).pow(new BN(21));
			await liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WRBTC, FeesEvents, SOV, true);
		});

		it("Test liquidate with rate 6.7e21", async () => {
			const rate = new BN(67).mul(new BN(10).pow(new BN(20)));
			await liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WRBTC, FeesEvents, SOV);
		});

		it("Test liquidate with rate 6.7e21 (special rebates)", async () => {
			const rate = new BN(67).mul(new BN(10).pow(new BN(20)));
			await liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WRBTC, FeesEvents, SOV, true);
		});

		it("Test coverage: Trigger maxLiquidatable: ad hoc rate to be unhealthy and currentMargin > incentivePercent", async () => {
			/// @dev Healthy when rate aprox. > 8*10^21
			/// @dev We need unhealthy to liquidate
			/// @dev Not enough margin when rate aprox. < 7*10^21

			/// @dev This rate triggers the maxLiquidatable computation in the contract
			///   but the uncovered conditions:
			///     if (maxLiquidatable > principal) {
			///   and
			///     if (maxSeizable > collateral) {
			///   cannot ever be met inside the range (8*10^21 > rate > 7*10^21)

			const rate = new BN(10).pow(new BN(20)).mul(new BN(72));

			/// @dev It should liquidate but not entirely:
			///   principal            = 20267418874797325811
			///   maxLiquidatable      = 18355350998378606486
			///   Do not check RepayAmount => last parameter set to false
			await liquidate(
				accounts,
				loanToken,
				SUSD,
				set_demand_curve,
				RBTC,
				sovryn,
				priceFeeds,
				rate,
				WRBTC,
				FeesEvents,
				SOV,
				false,
				false
			);
		});

		/*
			Test if fails when the position is healthy currentMargin > maintenanceRate
		*/
		it("Should fail liquidating a healthy position", async () => {
			await liquidate_healthy_position_should_fail(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, WRBTC);
		});

		it("Should fail liquidating a closed loan", async () => {
			// Close the loan
			await set_demand_curve(loanToken);
			const lender = accounts[0];
			const borrower = accounts[1];
			const receiver = borrower;
			const liquidator = accounts[2];
			const loan_token_sent = new BN(10).mul(oneEth);
			const loan_id = await prepare_liquidation(
				lender,
				borrower,
				liquidator,
				loan_token_sent,
				loanToken,
				SUSD, // underlyingToken
				RBTC, // collateralToken
				sovryn,
				WRBTC
			);
			/// @dev Only way to close the loan into an inactive state is
			///   by depositing the exact amount of the principal.
			let deposit_amount = new BN("20267418874797325811"); // loanLocal.principal
			await SUSD.mint(borrower, deposit_amount);
			await SUSD.approve(sovryn.address, deposit_amount, { from: borrower });
			await sovryn.closeWithDeposit(loan_id, receiver, deposit_amount, { from: borrower });

			// Try to liquidate an inactive loan
			let value = 0;
			await expectRevert(
				sovryn.liquidate(loan_id, liquidator, loan_token_sent, { from: liquidator, value: value }),
				"loan is closed"
			);
		});

		it("Should work liquidating an unhealthy loan", async () => {
			// Close the loan
			await set_demand_curve(loanToken);
			const lender = accounts[0];
			const borrower = accounts[1];
			const receiver = borrower;
			const liquidator = accounts[2];
			const loan_token_sent = new BN(10).mul(oneEth);
			const loan_id = await prepare_liquidation(
				lender,
				borrower,
				liquidator,
				loan_token_sent,
				loanToken,
				SUSD, // underlyingToken
				RBTC, // collateralToken
				sovryn,
				WRBTC
			);

			// Ad hoc rate for unhealthy loan
			const rate = new BN(10).pow(new BN(20)).mul(new BN(72));
			await priceFeeds.setRates(RBTC.address, SUSD.address, rate);

			// Liquidate an unhealthy loan
			let value = 0;
			await sovryn.liquidate(loan_id, liquidator, loan_token_sent, { from: liquidator, value: value });
		});

		it("Should revert liquidating w/ wrong asset", async () => {
			// Close the loan
			await set_demand_curve(loanToken);
			const lender = accounts[0];
			const borrower = accounts[1];
			const receiver = borrower;
			const liquidator = accounts[2];
			const loan_token_sent = new BN(10).mul(oneEth);
			const loan_id = await prepare_liquidation(
				lender,
				borrower,
				liquidator,
				loan_token_sent,
				loanToken,
				SUSD, // underlyingToken
				RBTC, // collateralToken
				sovryn,
				WRBTC
			);

			// Ad hoc rate for unhealthy loan
			const rate = new BN(10).pow(new BN(20)).mul(new BN(72));
			await priceFeeds.setRates(RBTC.address, SUSD.address, rate);

			// Try to liquidate by sending Ether
			let value = 10;
			await expectRevert(
				sovryn.liquidate(loan_id, liquidator, loan_token_sent, { from: liquidator, value: value }),
				"wrong asset sent"
			);
		});

		it("Should fail rolling over a closed loan", async () => {
			// Close the loan
			await set_demand_curve(loanToken);
			const lender = accounts[0];
			const borrower = accounts[1];
			const receiver = borrower;
			const liquidator = accounts[2];
			const loan_token_sent = new BN(10).mul(oneEth);
			const loan_id = await prepare_liquidation(
				lender,
				borrower,
				liquidator,
				loan_token_sent,
				loanToken,
				SUSD, // underlyingToken
				RBTC, // collateralToken
				sovryn,
				WRBTC
			);
			/// @dev Only way to close the loan into an inactive state is
			///   by depositing the exact amount of the principal.
			let deposit_amount = new BN("20267418874797325811"); // loanLocal.principal
			await SUSD.mint(borrower, deposit_amount);
			await SUSD.approve(sovryn.address, deposit_amount, { from: borrower });
			await sovryn.closeWithDeposit(loan_id, receiver, deposit_amount, { from: borrower });

			// Try to liquidate an inactive loan
			let value = 0;
			await expectRevert(sovryn.rollover(loan_id, "0x", { from: liquidator, value: value }), "loan is closed");
		});

		it("Should fail rolling over a healthy position", async () => {
			// Close the loan
			await set_demand_curve(loanToken);
			const lender = accounts[0];
			const borrower = accounts[1];
			const receiver = borrower;
			const liquidator = accounts[2];
			const loan_token_sent = new BN(10).mul(oneEth);
			const loan_id = await prepare_liquidation(
				lender,
				borrower,
				liquidator,
				loan_token_sent,
				loanToken,
				SUSD, // underlyingToken
				RBTC, // collateralToken
				sovryn,
				WRBTC
			);

			// Try to roll over a healthy loan
			let value = 0;
			await expectRevert(sovryn.rollover(loan_id, "0x", { from: liquidator, value: value }), "healthy position");
		});

		it("Should work rolling over an unhealthy position", async () => {
			// Close the loan
			await set_demand_curve(loanToken);
			const lender = accounts[0];
			const borrower = accounts[1];
			const receiver = borrower;
			const liquidator = accounts[2];
			const loan_token_sent = new BN(10).mul(oneEth);
			const loan_id = await prepare_liquidation(
				lender,
				borrower,
				liquidator,
				loan_token_sent,
				loanToken,
				SUSD, // underlyingToken
				RBTC, // collateralToken
				sovryn,
				WRBTC
			);

			// time travel 100 days turns position into an unhealthy state
			await increaseTime(8640000);

			// Try to liquidate an inactive loan
			let value = 0;
			await sovryn.rollover(loan_id, "0x", { from: liquidator, value: value });
		});

		/// @dev the revert "loanParams not exists" is not achievable
		///   because the previous check of loanLocal.active
		///   is going to block it.
		it("Should fail liquidating an inexistent loan", async () => {
			// Try to liquidate an inexistent loan
			const liquidator = accounts[2];
			const loan_token_sent = new BN(10).mul(oneEth);
			let fakeLoan_id = "0x7af58ba7b104005f8e95f09abbbed011dab7e97dcfc9a353ce37948c7c320b45";
			let value = 0;
			await expectRevert(
				sovryn.liquidate(fakeLoan_id, liquidator, loan_token_sent, { from: liquidator, value: value }),
				"loan is closed"
			);
		});
	});
});
