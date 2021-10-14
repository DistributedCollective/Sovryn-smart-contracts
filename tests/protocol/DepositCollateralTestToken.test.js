/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 6.5s
 * After optimization: 5.3s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Moved some initialization code from tests to fixture.
 *
 *   Added tests to increase the test coverage index:
 *     + "Test deposit collateral sending Ether as collateral"
 *     + "should fail LoanMaintenance fallback"
 *     + Tests on the "Reducing Margin" slot.
 */

const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const LoanMaintenanceEvents = artifacts.require("LoanMaintenanceEvents");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");

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
	lend_to_pool,
	getPriceFeeds,
	getSovryn,
	getSOV,
	decodeLogs,
	open_margin_trade_position,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;
const zeroAddress = constants.ZERO_ADDRESS;

const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

// This decodes longs for a single event type, and returns a decoded object in
// the same form truffle-contract uses on its receipts

contract("ProtocolAddingMargin", (accounts) => {
	let owner;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		sov = await getSOV(sovryn, priceFeeds, SUSD, accounts);

		const loanTokenLogicStandard = await getLoanTokenLogic();
		const loanTokenLogicWrbtc = await getLoanTokenLogicWrbtc();
		loanToken = await getLoanToken(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(loanTokenLogicWrbtc, owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

		/// @dev Moved from some tests that require this initialization
		/// and is not interfering w/ any others.
		await set_demand_curve(loanToken);
		await lend_to_pool(loanToken, SUSD, owner);
	}

	before(async () => {
		[owner, account1, ...accounts] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("Adding Margin", () => {
		it("Test deposit collateral", async () => {
			// prepare the test
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
			const loadData = await sovryn.getLoan(loan_id);
			const startCollateral = new BN(loadData["collateral"]);
			const deposit_amount = startCollateral.div(new BN(2));

			// deposit collateral to add margin to the loan created above
			await RBTC.approve(sovryn.address, deposit_amount);
			const { receipt } = await sovryn.depositCollateral(loan_id, deposit_amount);
			const { collateralToLoanRate } = await priceFeeds.getCurrentMargin(
				loadData["loanToken"],
				loadData["collateralToken"],
				loadData["principal"],
				loadData["collateral"]
			);
			const decode = decodeLogs(receipt.rawLogs, LoanMaintenanceEvents, "DepositCollateral");
			const args = decode[0].args;

			// verify the deposit collateral event

			expect(args["loanId"] == loan_id).to.be.true;
			expect(args["depositAmount"]).to.eq(deposit_amount.toString());
			expect(args["rate"]).to.eq(collateralToLoanRate.toString());

			// make sure, collateral was increased
			const endCollateral = (await sovryn.getLoan(loan_id))["collateral"];
			expect(new BN(endCollateral).sub(startCollateral).eq(deposit_amount)).to.be.true;
		});

		it("Test deposit collateral to non existent loan", async () => {
			// try to deposit collateral to a loan with id 0
			await RBTC.approve(sovryn.address, new BN(10).pow(new BN(15)));
			expectRevert(sovryn.depositCollateral("0x0", new BN(10).pow(new BN(15))), "loan is closed");
		});

		it("Test deposit collateral 0 value", async () => {
			// prepare the test
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
			expectRevert(sovryn.depositCollateral(loan_id, new BN(0)), "depositAmount is 0");
		});

		it("Test deposit collateral sending Ether instead of RBTC", async () => {
			// prepare the test
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);
			expectRevert(sovryn.depositCollateral(loan_id, new BN(10).pow(new BN(15)), { value: new BN(1) }), "wrong asset sent");
		});

		it("Test deposit collateral sending Ether as collateral", async () => {
			/// @dev open_margin_trade_position cannot be used to perform this check
			let trader = owner;
			let loan_token_sent = hunEth.toString();
			let leverage_amount = new BN(2).mul(oneEth).toString();
			let collateralToken = zeroAddress;
			await SUSD.mint(trader, loan_token_sent);
			await SUSD.approve(loanToken.address, loan_token_sent, { from: trader });
			const { receipt } = await loanToken.marginTrade(
				"0x0", // loanId  (0 for new loans)
				leverage_amount, // leverageAmount
				loan_token_sent, // loanTokenSent
				0, // no collateral token sent
				collateralToken, // collateralTokenAddress
				trader, // trader,
				0, // slippage
				[], // loanDataBytes (only required with ether)
				{ from: trader }
			);
			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
			let loan_id = decode[0].args["loanId"];

			let depositAmount = new BN(10).pow(new BN(15));
			expectRevert(sovryn.depositCollateral(loan_id, depositAmount, { value: new BN(1) }), "ether deposit mismatch");
			await sovryn.depositCollateral(loan_id, depositAmount, { value: depositAmount });
		});

		it("should fail LoanMaintenance fallback", async () => {
			let newLoanMaintenanceAddr = await LoanMaintenance.new();
			await expectRevert(
				newLoanMaintenanceAddr.send(wei("0.0000000000000001", "ether")),
				"fallback function is not payable and was called with value 100"
			);
			await expectRevert(newLoanMaintenanceAddr.sendTransaction({}), "fallback not allowed");
		});
	});

	describe("Reducing Margin", () => {
		it("should revert when withdrawAmount is 0", async () => {
			// prepare the test
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);

			let withdrawAmount = new BN(0);
			await expectRevert(sovryn.withdrawCollateral(loan_id, owner, withdrawAmount), "withdrawAmount is 0");
		});

		it("should revert when sender is nor borrower neither delegated", async () => {
			// prepare the test
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);

			let withdrawAmount = new BN(10).pow(new BN(15));
			await expectRevert(sovryn.withdrawCollateral(loan_id, owner, withdrawAmount, { from: account1 }), "unauthorized");
		});

		it("should revert when loan is closed", async () => {
			// prepare the test
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);

			// close the loan
			const loadData = await sovryn.getLoan(loan_id);
			const collateral = new BN(loadData["collateral"]);
			await sovryn.closeWithSwap(loan_id, owner, collateral, false, "0x", { from: owner });

			let withdrawAmount = new BN(10).pow(new BN(15));
			await expectRevert(sovryn.withdrawCollateral(loan_id, owner, withdrawAmount), "loan is closed");
		});

		it("should reduce the margin when calling withdrawCollateral", async () => {
			// prepare the test
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner);

			// owner initial balance should be 10^50
			expect(await RBTC.balanceOf(owner)).bignumber.equal(new BN(10).pow(new BN(50)));

			let withdrawAmount = new BN(10).pow(new BN(15));
			await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

			// owner final balance should be 10^50 + withdrawAmount(10^15)
			expect(await RBTC.balanceOf(owner)).bignumber.equal(new BN(10).pow(new BN(50)).add(withdrawAmount));

			// maxDrawdown = 5647468293983077 (aprox. 5.6*10^15)
			// trying a withdrawal a bit higher (5.7*10^15) than available
			let withdrawAmount2 = new BN(57).mul(new BN(10).pow(new BN(14)));
			await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount2);

			// owner final balance cannot be 10^50 + withdrawAmount(10^15) + withdrawAmount2(5.7*10^15), but a bit lower
			expect(await RBTC.balanceOf(owner)).bignumber.lessThan(new BN(10).pow(new BN(50)).add(withdrawAmount).add(withdrawAmount2));
		});

		it("should work when collateral is WRBTC", async () => {
			// prepare the test
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, owner, "WRBTC");

			// send Ether collateral
			let depositAmount = new BN(10).pow(new BN(15));
			await sovryn.depositCollateral(loan_id, depositAmount, { value: depositAmount });

			// get collateral
			let withdrawAmount = new BN(10).pow(new BN(15));
			await sovryn.withdrawCollateral(loan_id, owner, withdrawAmount);

			// should revert if collateral requested is higher than available
			// Try to get collateral again
			await expectRevert.unspecified(sovryn.withdrawCollateral(loan_id, owner, withdrawAmount));
		});
	});
});
