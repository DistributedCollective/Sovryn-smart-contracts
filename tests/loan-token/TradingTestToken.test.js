/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, loan ... on every test.
 *
 * Total time elapsed: 26.5s
 * After optimization: 11.4s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Added tests to increase the test coverage index:
 *     + "Check marginTrade w/ collateralToken as address(0)"
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, BN } = require("@openzeppelin/test-helpers");

const {
	margin_trading_sending_loan_tokens,
	margin_trading_sov_reward_payment,
	margin_trading_sov_reward_payment_with_special_rebates,
	margin_trading_sending_collateral_tokens,
	margin_trading_sending_collateral_tokens_sov_reward_payment,
	margin_trading_sending_collateral_tokens_sov_reward_payment_with_special_rebates,
	close_complete_margin_trade,
	close_complete_margin_trade_sov_reward_payment,
	close_complete_margin_trade_sov_reward_payment_with_special_rebates,
	close_partial_margin_trade,
	close_partial_margin_trade_sov_reward_payment,
	close_partial_margin_trade_sov_reward_payment_with_special_rebates,
} = require("./tradingFunctions");

const FeesEvents = artifacts.require("FeesEvents");
const LoanOpenings = artifacts.require("LoanOpenings");

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getSOV,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenWRBTC,
	loan_pool_setup,
	set_demand_curve,
	lend_to_pool,
	getPriceFeeds,
	getSovryn,
	open_margin_trade_position,
	decodeLogs,
} = require("../Utils/initializer.js");
const { ZERO_ADDRESS, ZERO_BYTES32 } = require("@openzeppelin/test-helpers/src/constants");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));
const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13))); // 25 * 10**13

contract("LoanTokenTrading", (accounts) => {
	let owner;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, SOV, priceFeeds;

	async function deploymentAndInitFixture(_wallets, _provider) {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD, true);
		loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD, true);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

		SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
	}

	before(async () => {
		[owner] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("Test the loan token trading logic with 2 TestTokens.", () => {
		// verifies that the loan token address is set on the contract
		it("Test loanAddress", async () => {
			const loanTokenAddress = await loanToken.loanTokenAddress();
			expect(loanTokenAddress).to.equal(SUSD.address);
		});

		/*
		  tests margin trading sending loan tokens.
		  process is handled by the shared function margin_trading_sending_loan_tokens
		  1. approve the transfer
		  2. send the margin trade tx
		  3. verify the trade event and balances are correct
		  4. retrieve the loan from the smart contract and make sure all values are set as expected
		*/
		it("Test margin trading sending loan tokens", async () => {
			await expectRevert(
				loanToken.marginTrade(
					ZERO_BYTES32, // loanId  (0 for new loans)
					oneEth.toString(), // leverageAmount
					oneEth.toString(), // loanTokenSent
					"0", // no collateral token sent
					WRBTC.address, // collateralTokenAddress
					owner, // trader,
					0, // slippage
					"0x" // loanDataBytes (only required with ether)
				),
				"principal too small"
			);

			await priceFeeds.setRates(WRBTC.address, SUSD.address, new BN(10).pow(new BN(20)).toString());
			await priceFeeds.setRates(RBTC.address, SUSD.address, new BN(10).pow(new BN(20)).toString());

			await margin_trading_sending_loan_tokens(accounts, sovryn, loanToken, SUSD, RBTC, priceFeeds, false);
			await margin_trading_sov_reward_payment(accounts, loanToken, SUSD, RBTC, SOV, FeesEvents, sovryn);
			await margin_trading_sov_reward_payment_with_special_rebates(accounts, loanToken, SUSD, RBTC, SOV, FeesEvents, sovryn);
		});

		it("Test margin trading sending loan tokens tiny amount", async () => {
			// Send the transaction
			await expectRevert(
				loanToken.marginTrade(
					"0x0", // loanId  (0 for new loans)
					new BN(2).mul(oneEth), // leverageAmount
					TINY_AMOUNT, // loanTokenSent
					new BN(0), // no collateral token sent
					RBTC.address, // collateralTokenAddress
					accounts[0], // trader,
					0, // slippage
					"0x", // loanDataBytes (only required with ether)
					{ from: accounts[2] }
				),
				"principal too small"
			);
		});

		/*
		  tests margin trading sending collateral tokens as collateral.
		  process:
		  1. send the margin trade tx with the passed parameter (NOTE: the token transfer needs to be approved already)
		  2. TODO verify the trade event and balances are correct
		*/
		it("Test margin trading sending collateral tokens", async () => {
			const loanSize = new BN(10000).mul(oneEth);
			await SUSD.mint(loanToken.address, loanSize.mul(new BN(12)));

			//   address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			const collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address, //loanToken
				RBTC.address, //collateralToken
				loanSize.mul(new BN(2)), //newPrincipal loanSize*2 ethers
				new BN(50).mul(oneEth), //leverage amount (5x leverage)
				false //false means we are trading (true if borrowing) - the loan is stored and processed in the loanToken contract
			);

			await RBTC.mint(accounts[0], collateralTokenSent);
			await RBTC.mint(accounts[2], collateralTokenSent);
			// important! WRBTC is being held by the loanToken contract itself, all other tokens are transfered directly from
			// the sender and need approval
			await RBTC.approve(loanToken.address, collateralTokenSent);
			await RBTC.approve(loanToken.address, collateralTokenSent, { from: accounts[2] });

			const leverageAmount = new BN(5).mul(oneEth); // 5x leverage
			const value = 0;
			await margin_trading_sending_collateral_tokens(
				accounts,
				loanToken,
				SUSD,
				RBTC,
				loanSize,
				collateralTokenSent,
				leverageAmount,
				value,
				priceFeeds
			);
			await margin_trading_sending_collateral_tokens_sov_reward_payment(
				accounts[2],
				loanToken,
				SUSD,
				RBTC,
				collateralTokenSent,
				leverageAmount,
				value,
				FeesEvents,
				SOV,
				sovryn
			);
		});

		/*
		  tests margin trading sending collateral tokens as collateral.
		  process:
		  1. send the margin trade tx with the passed parameter (NOTE: the token transfer needs to be approved already)
		  2. TODO verify the trade event and balances are correct
		*/
		it("Test margin trading sending collateral tokens with special rebates", async () => {
			const loanSize = new BN(10000).mul(oneEth);
			await SUSD.mint(loanToken.address, loanSize.mul(new BN(12)));

			//   address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			const collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address, //loanToken
				RBTC.address, //collateralToken
				loanSize.mul(new BN(2)), //newPrincipal loanSize*2 ethers
				new BN(50).mul(oneEth), //leverage amount (5x leverage)
				false //false means we are trading (true if borrowing) - the loan is stored and processed in the loanToken contract
			);

			await RBTC.mint(accounts[0], collateralTokenSent);
			await RBTC.mint(accounts[2], collateralTokenSent);
			// important! WRBTC is being held by the loanToken contract itself, all other tokens are transfered directly from
			// the sender and need approval
			await RBTC.approve(loanToken.address, collateralTokenSent);
			await RBTC.approve(loanToken.address, collateralTokenSent, { from: accounts[2] });

			const leverageAmount = new BN(5).mul(oneEth); // 5x leverage
			const value = 0;
			await margin_trading_sending_collateral_tokens(
				accounts,
				loanToken,
				SUSD,
				RBTC,
				loanSize,
				collateralTokenSent,
				leverageAmount,
				value,
				priceFeeds
			);

			await margin_trading_sending_collateral_tokens_sov_reward_payment_with_special_rebates(
				accounts[2],
				loanToken,
				SUSD,
				RBTC,
				collateralTokenSent,
				leverageAmount,
				value,
				FeesEvents,
				SOV,
				sovryn
			);
		});
		/*
		  should completely close a position.
		  first with returning loan tokens, then with returning collateral tokens to the sender.
		  process is handled by the shared function close_complete_margin_trade
		  1. prepares the test by setting up the interest rates, lending to the pool and opening a position
		  2. travels in time, so interest needs to be paid
		  3. makes sure closing with an unauthorized caller fails (only the trader may close his position)
		  4. sends the closing tx from the trader
		  5. verifies the result
		*/
		it("Test close complete margin trade", async () => {
			await close_complete_margin_trade(
				sovryn,
				loanToken,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				priceFeeds,
				true,
				RBTC,
				WRBTC,
				SUSD,
				accounts
			);
			await close_complete_margin_trade(
				sovryn,
				loanToken,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				priceFeeds,
				false,
				RBTC,
				WRBTC,
				SUSD,
				accounts
			);
		});

		it("Test close complete margin trade sov reward payment", async () => {
			await close_complete_margin_trade_sov_reward_payment(
				sovryn,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				true,
				FeesEvents,
				loanToken,
				RBTC,
				WRBTC,
				SUSD,
				SOV,
				accounts
			);
		});

		it("Test close complete margin trade sov reward payment with special rebates", async () => {
			await close_complete_margin_trade_sov_reward_payment_with_special_rebates(
				sovryn,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				true,
				FeesEvents,
				loanToken,
				RBTC,
				WRBTC,
				SUSD,
				SOV,
				accounts
			);
		});

		it("Test close complete margin trade sov reward payment false", async () => {
			await close_complete_margin_trade_sov_reward_payment(
				sovryn,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				false,
				FeesEvents,
				loanToken,
				RBTC,
				WRBTC,
				SUSD,
				SOV,
				accounts
			);
		});

		it("Test close complete margin trade sov reward payment false with special rebates", async () => {
			await close_complete_margin_trade_sov_reward_payment_with_special_rebates(
				sovryn,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				false,
				FeesEvents,
				loanToken,
				RBTC,
				WRBTC,
				SUSD,
				SOV,
				accounts
			);
		});

		it("Test close partial margin trade", async () => {
			await close_partial_margin_trade(
				sovryn,
				loanToken,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				priceFeeds,
				true,
				RBTC,
				WRBTC,
				SUSD,
				accounts
			);
			await close_partial_margin_trade(
				sovryn,
				loanToken,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				priceFeeds,
				false,
				RBTC,
				WRBTC,
				SUSD,
				accounts
			);
		});

		it("Test close partial margin trade sov reward payment", async () => {
			await close_partial_margin_trade_sov_reward_payment(
				sovryn,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				true,
				FeesEvents,
				loanToken,
				RBTC,
				WRBTC,
				SUSD,
				SOV,
				accounts
			);
		});

		it("Test close partial margin trade sov reward payment with special rebates", async () => {
			await close_partial_margin_trade_sov_reward_payment_with_special_rebates(
				sovryn,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				true,
				FeesEvents,
				loanToken,
				RBTC,
				WRBTC,
				SUSD,
				SOV,
				accounts
			);
		});

		it("Test close partial margin trade sov reward payment false", async () => {
			await close_partial_margin_trade_sov_reward_payment(
				sovryn,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				false,
				FeesEvents,
				loanToken,
				RBTC,
				WRBTC,
				SUSD,
				SOV,
				accounts
			);
		});

		it("Test close partial margin trade sov reward payment false with special rebates", async () => {
			await close_partial_margin_trade_sov_reward_payment_with_special_rebates(
				sovryn,
				set_demand_curve,
				lend_to_pool,
				open_margin_trade_position,
				false,
				FeesEvents,
				loanToken,
				RBTC,
				WRBTC,
				SUSD,
				SOV,
				accounts
			);
		});

		// verifies that the loan size is computed correctly
		it("Test getMarginBorrowAmountAndRate", async () => {
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, accounts[0]);
			const deposit = hunEth;
			const borrowAmount = await loanToken.getMarginBorrowAmountAndRate(oneEth.mul(new BN(4)), deposit);
			const monthly_interest = borrowAmount[1].mul(new BN(28)).div(new BN(365));
			// divide by 1000 because of rounding
			const actualAmount = borrowAmount[0].div(new BN(1000));
			const expectedAmount = deposit.mul(new BN(4)).mul(hunEth).div(hunEth.sub(monthly_interest)).div(new BN(1000));
			expect(actualAmount.eq(expectedAmount)).to.be.true;
		});

		// test the correct max escrow amount is returned (considering that the function is actually returning a bit less than the max)
		it("Test getMaxEscrowAmount", async () => {
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, accounts[0]);

			const maxEscrowAmount1x = await loanToken.getMaxEscrowAmount(oneEth);
			const maxEscrowAmount4x = await loanToken.getMaxEscrowAmount(oneEth.mul(new BN(4)));
			expect(maxEscrowAmount1x.eq(maxEscrowAmount4x.mul(new BN(4)))).to.be.true;
		});

		it("Test increasing position of other trader should fail", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, accounts[0]);
			// trader=accounts[1] on this call
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, accounts[1]);

			// deposit collateral to add margin to the loan created above
			await RBTC.approve(sovryn.address, oneEth);
			await sovryn.depositCollateral(loan_id, oneEth);
			await RBTC.transfer(accounts[2], oneEth);
			await RBTC.approve(loanToken.address, oneEth, { from: accounts[2] });

			await expectRevert(
				loanToken.marginTrade(
					loan_id, // loanId  (0 for new loans)
					new BN(2).mul(oneEth), // leverageAmount
					0, // loanTokenSent
					1000, // no collateral token sent
					RBTC.address, // collateralTokenAddress
					accounts[1], // trader,
					0, // slippage
					"0x", // loanDataBytes (only required with ether)
					{ from: accounts[2] }
				),
				"401 use of existing loan"
			);
		});

		/// @dev For test coverage
		it("Should revert when collateralTokenAddress != loanTokenAddress", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, accounts[0]);
			// trader=accounts[1] on this call
			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, accounts[1]);

			// deposit collateral to add margin to the loan created above
			await RBTC.approve(sovryn.address, oneEth);
			await sovryn.depositCollateral(loan_id, oneEth);
			await RBTC.transfer(accounts[2], oneEth);
			await RBTC.approve(loanToken.address, oneEth, { from: accounts[2] });

			await expectRevert(
				loanToken.marginTrade(
					loan_id, // loanId  (0 for new loans)
					new BN(2).mul(oneEth), // leverageAmount
					0, // loanTokenSent
					1000, // no collateral token sent
					SUSD.address, // collateralTokenAddress != loanTokenAddress
					accounts[1], // trader,
					0,
					"0x", // loanDataBytes (only required with ether)
					{ from: accounts[2] }
				),
				"11"
			);
		});

		it("Test increasing position of margin trade using collateral", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, accounts[0]);

			const collateralTokenSent = new BN(wei("1", "ether"));
			const leverage = 2;

			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, accounts[0]);

			// deposit collateral to add margin to the loan created above
			await RBTC.approve(sovryn.address, oneEth);
			await sovryn.depositCollateral(loan_id, oneEth);
			await RBTC.approve(loanToken.address, oneEth);

			let sovryn_before_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			let previous_trader_collateral_token_balance = await RBTC.balanceOf(accounts[0]);

			let { receipt } = await loanToken.marginTrade(
				loan_id, // loanId  (0 for new loans)
				new BN(leverage).mul(oneEth), // leverageAmount
				0, // loanTokenSent
				collateralTokenSent, // collateral token sent
				RBTC.address, // collateralTokenAddress
				accounts[0], // trader,
				0,
				"0x", // loanDataBytes (only required with ether)
				{ from: accounts[0] }
			);

			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");

			// Verify event
			let sovryn_after_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			let latest_trader_collateral_token_balance = await RBTC.balanceOf(accounts[0]);

			const sovryn_collateral_token_balance_diff = sovryn_after_collateral_token_balance
				.sub(sovryn_before_collateral_token_balance)
				.toString();
			const trader_collateral_token_balance_diff = previous_trader_collateral_token_balance
				.sub(latest_trader_collateral_token_balance)
				.toString();
			const args = decode[0].args;

			expect(collateralTokenSent.toString()).to.equal(trader_collateral_token_balance_diff);
			expect(args["user"]).to.equal(accounts[0]);
			expect(args["lender"]).to.equal(loanToken.address);
			expect(args["loanId"]).to.equal(loan_id);
			expect(args["collateralToken"]).to.equal(RBTC.address);
			expect(args["loanToken"]).to.equal(SUSD.address);

			// For margin trade using collateral, the positionSize can be checked by getting the additional collateral token that is transferred into the protocol (difference between latest & previous balance)
			expect(args["positionSize"]).to.equal(sovryn_collateral_token_balance_diff);
		});

		it("Test increasing position of margin trade using underlying token", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, accounts[0]);

			const loanTokenSent = new BN(wei("2", "ether"));
			const leverage = 2;

			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, accounts[0]);

			// deposit collateral to add margin to the loan created above
			await SUSD.approve(sovryn.address, loanTokenSent);
			// await sovryn.depositCollateral(loan_id, oneEth);
			await SUSD.approve(loanToken.address, loanTokenSent);

			const sovryn_before_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			const trader_before_underlying_token_balance = await SUSD.balanceOf(accounts[0]);

			let { receipt } = await loanToken.marginTrade(
				loan_id, // loanId  (0 for new loans)
				new BN(leverage).mul(oneEth), // leverageAmount
				loanTokenSent, // loanTokenSent (Note 1 RBTC was set to 10000 SUSD)
				0, // no collateral token sent
				RBTC.address, // collateralTokenAddress
				accounts[0], // trader,
				0,
				"0x", // loanDataBytes (only required with ether)
				{ from: accounts[0] }
			);

			const sovryn_after_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			const trader_after_underlying_token_balance = await SUSD.balanceOf(accounts[0]);

			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
			const args = decode[0].args;
			const sovryn_collateral_token_balance_diff = sovryn_after_collateral_token_balance
				.sub(sovryn_before_collateral_token_balance)
				.toString();
			const trader_underlying_token_balance_diff = trader_before_underlying_token_balance
				.sub(trader_after_underlying_token_balance)
				.toString();

			expect(loanTokenSent.toString()).to.equal(trader_underlying_token_balance_diff);
			expect(args["user"]).to.equal(accounts[0]);
			expect(args["lender"]).to.equal(loanToken.address);
			expect(args["loanId"]).to.equal(loan_id);
			expect(args["collateralToken"]).to.equal(RBTC.address);
			expect(args["loanToken"]).to.equal(SUSD.address);

			// For margin trade using underlying token, the positionSize can be checked by getting the additional underlying token that is transferred into the protocol (difference between latest & previous balance)
			expect(args["positionSize"]).to.equal(sovryn_collateral_token_balance_diff);
		});

		it("checkPriceDivergence should succeed if entry price is less than or equal to a minimum", async () => {
			await set_demand_curve(loanToken);
			await SUSD.transfer(loanToken.address, wei("500", "ether"));

			await loanToken.checkPriceDivergence(wei("1", "ether"), RBTC.address, wei("0.0001", "ether"));
		});

		/// @dev For test coverage, it's required to perform a margin trade using WRBTC as collateral
		it("Check marginTrade w/ collateralToken as address(0)", async () => {
			await set_demand_curve(loanToken);
			await SUSD.transfer(loanToken.address, wei("1000000", "ether"));
			await WRBTC.mint(accounts[2], oneEth);
			await WRBTC.approve(loanToken.address, oneEth, { from: accounts[2] });

			await loanToken.marginTrade(
				"0x0", // loanId  (0 for new loans)
				wei("2", "ether"), // leverageAmount
				0, // loanTokenSent (SUSD)
				wei("1", "ether"), // collateral token sent
				ZERO_ADDRESS, // collateralTokenAddress (address 0 means collateral is WRBTC)
				accounts[1], // trader,
				2000,
				"0x", // loanDataBytes (only required with ether)
				{ from: accounts[2] }
			);
		});

		it("Check marginTrade with minPositionSize > 0 ", async () => {
			// await set_demand_curve(loanToken);
			await SUSD.transfer(loanToken.address, wei("1000000", "ether"));
			await RBTC.transfer(accounts[2], oneEth);
			await RBTC.approve(loanToken.address, oneEth, { from: accounts[2] });

			await expectRevert(
				loanToken.marginTrade(
					"0x0", // loanId  (0 for new loans)
					wei("2", "ether"), // leverageAmount
					0, // loanTokenSent (SUSD)
					10000, // collateral token sent
					RBTC.address, // collateralTokenAddress (RBTC)
					accounts[1], // trader,
					20000, // minEntryPrice
					"0x", // loanDataBytes (only required with ether)
					{ from: accounts[2] }
				),
				"principal too small"
			);

			await priceFeeds.setRates(WRBTC.address, SUSD.address, new BN(10).pow(new BN(20)).toString());
			await priceFeeds.setRates(RBTC.address, SUSD.address, new BN(10).pow(new BN(20)).toString());

			await loanToken.marginTrade(
				"0x0", // loanId  (0 for new loans)
				wei("2", "ether"), // leverageAmount
				0, // loanTokenSent (SUSD)
				oneEth.toString(), // collateral token sent
				RBTC.address, // collateralTokenAddress (RBTC)
				accounts[1], // trader,
				200000, // minEntryPrice
				"0x", // loanDataBytes (only required with ether)
				{ from: accounts[2] }
			);
		});

		it("checkPriceDivergence should revert if entry price lies above a minimum", async () => {
			await set_demand_curve(loanToken);

			await expectRevert(
				loanToken.checkPriceDivergence(wei("2", "ether"), RBTC.address, wei("1", "ether")),
				"entry price above the minimum"
			);
		});

		it("Check marginTrade with minPositionSize > 0 (with defaultConversionPath set)", async () => {
			// await set_demand_curve(loanToken);
			await SUSD.transfer(loanToken.address, wei("1000000", "ether"));
			await RBTC.transfer(accounts[2], oneEth);
			await RBTC.approve(loanToken.address, oneEth, { from: accounts[2] });

			await expectRevert(
				loanToken.marginTrade(
					"0x0", // loanId  (0 for new loans)
					wei("2", "ether"), // leverageAmount
					0, // loanTokenSent (SUSD)
					10000, // collateral token sent
					RBTC.address, // collateralTokenAddress (RBTC)
					accounts[1], // trader,
					20000, // minEntryPrice
					"0x", // loanDataBytes (only required with ether)
					{ from: accounts[2] }
				),
				"principal too small"
			);

			await priceFeeds.setRates(WRBTC.address, SUSD.address, new BN(10).pow(new BN(20)).toString());
			await priceFeeds.setRates(RBTC.address, SUSD.address, new BN(10).pow(new BN(20)).toString());

			const defaultPathConversion = [SUSD.address, RBTC.address, RBTC.address];
			await sovryn.setDefaultPathConversion(SUSD.address, RBTC.address, defaultPathConversion);
			expect(await sovryn.getDefaultPathConversion(SUSD.address, RBTC.address)).to.deep.equal(defaultPathConversion);

			await loanToken.marginTrade(
				"0x0", // loanId  (0 for new loans)
				wei("2", "ether"), // leverageAmount
				0, // loanTokenSent (SUSD)
				oneEth.toString(), // collateral token sent
				RBTC.address, // collateralTokenAddress (RBTC)
				accounts[1], // trader,
				200000, // minEntryPrice
				"0x", // loanDataBytes (only required with ether)
				{ from: accounts[2] }
			);
		});

		it("Test increasing position of margin trade using collateral (with default path set)", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, accounts[0]);

			const defaultPathConversion = [SUSD.address, RBTC.address, RBTC.address];
			await sovryn.setDefaultPathConversion(SUSD.address, RBTC.address, defaultPathConversion);
			expect(await sovryn.getDefaultPathConversion(SUSD.address, RBTC.address)).to.deep.equal(defaultPathConversion);

			const collateralTokenSent = new BN(wei("1", "ether"));
			const leverage = 2;

			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, accounts[0]);

			// deposit collateral to add margin to the loan created above
			await RBTC.approve(sovryn.address, oneEth);
			await sovryn.depositCollateral(loan_id, oneEth);
			await RBTC.approve(loanToken.address, oneEth);

			let sovryn_before_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			let previous_trader_collateral_token_balance = await RBTC.balanceOf(accounts[0]);

			let { receipt } = await loanToken.marginTrade(
				loan_id, // loanId  (0 for new loans)
				new BN(leverage).mul(oneEth), // leverageAmount
				0, // loanTokenSent
				collateralTokenSent, // collateral token sent
				RBTC.address, // collateralTokenAddress
				accounts[0], // trader,
				0,
				"0x", // loanDataBytes (only required with ether)
				{ from: accounts[0] }
			);

			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");

			// Verify event
			let sovryn_after_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			let latest_trader_collateral_token_balance = await RBTC.balanceOf(accounts[0]);

			const sovryn_collateral_token_balance_diff = sovryn_after_collateral_token_balance
				.sub(sovryn_before_collateral_token_balance)
				.toString();
			const trader_collateral_token_balance_diff = previous_trader_collateral_token_balance
				.sub(latest_trader_collateral_token_balance)
				.toString();
			const args = decode[0].args;

			expect(collateralTokenSent.toString()).to.equal(trader_collateral_token_balance_diff);
			expect(args["user"]).to.equal(accounts[0]);
			expect(args["lender"]).to.equal(loanToken.address);
			expect(args["loanId"]).to.equal(loan_id);
			expect(args["collateralToken"]).to.equal(RBTC.address);
			expect(args["loanToken"]).to.equal(SUSD.address);

			// For margin trade using collateral, the positionSize can be checked by getting the additional collateral token that is transferred into the protocol (difference between latest & previous balance)
			expect(args["positionSize"]).to.equal(sovryn_collateral_token_balance_diff);
		});

		it("Test increasing position of margin trade using collateral (with default path set & removed)", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, accounts[0]);

			const defaultPathConversion = [SUSD.address, RBTC.address, RBTC.address];
			await sovryn.setDefaultPathConversion(SUSD.address, RBTC.address, defaultPathConversion);
			expect(await sovryn.getDefaultPathConversion(SUSD.address, RBTC.address)).to.deep.equal(defaultPathConversion);

			const collateralTokenSent = new BN(wei("1", "ether"));
			const leverage = 2;

			const [loan_id] = await open_margin_trade_position(loanToken, RBTC, WRBTC, SUSD, accounts[0]);

			// deposit collateral to add margin to the loan created above
			await RBTC.approve(sovryn.address, oneEth);
			await sovryn.depositCollateral(loan_id, oneEth);
			await RBTC.approve(loanToken.address, oneEth);

			let sovryn_before_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			let previous_trader_collateral_token_balance = await RBTC.balanceOf(accounts[0]);

			let { receipt } = await loanToken.marginTrade(
				loan_id, // loanId  (0 for new loans)
				new BN(leverage).mul(oneEth), // leverageAmount
				0, // loanTokenSent
				collateralTokenSent, // collateral token sent
				RBTC.address, // collateralTokenAddress
				accounts[0], // trader,
				0,
				"0x", // loanDataBytes (only required with ether)
				{ from: accounts[0] }
			);

			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");

			// Verify event
			let sovryn_after_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			let latest_trader_collateral_token_balance = await RBTC.balanceOf(accounts[0]);

			const sovryn_collateral_token_balance_diff = sovryn_after_collateral_token_balance
				.sub(sovryn_before_collateral_token_balance)
				.toString();
			const trader_collateral_token_balance_diff = previous_trader_collateral_token_balance
				.sub(latest_trader_collateral_token_balance)
				.toString();
			const args = decode[0].args;

			expect(collateralTokenSent.toString()).to.equal(trader_collateral_token_balance_diff);
			expect(args["user"]).to.equal(accounts[0]);
			expect(args["lender"]).to.equal(loanToken.address);
			expect(args["loanId"]).to.equal(loan_id);
			expect(args["collateralToken"]).to.equal(RBTC.address);
			expect(args["loanToken"]).to.equal(SUSD.address);

			// For margin trade using collateral, the positionSize can be checked by getting the additional collateral token that is transferred into the protocol (difference between latest & previous balance)
			expect(args["positionSize"]).to.equal(sovryn_collateral_token_balance_diff);

			await sovryn.removeDefaultPathConversion(SUSD.address, RBTC.address);
			expect(await sovryn.getDefaultPathConversion(SUSD.address, RBTC.address)).to.deep.equal([]);

			// deposit collateral to add margin to the loan created above
			await RBTC.approve(sovryn.address, oneEth);
			await RBTC.approve(loanToken.address, oneEth);

			sovryn_before_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			previous_trader_collateral_token_balance = await RBTC.balanceOf(accounts[0]);

			let tx2 = await loanToken.marginTrade(
				loan_id, // loanId  (0 for new loans)
				new BN(leverage).mul(oneEth), // leverageAmount
				0, // loanTokenSent
				collateralTokenSent, // collateral token sent
				RBTC.address, // collateralTokenAddress
				accounts[0], // trader,
				0,
				"0x", // loanDataBytes (only required with ether)
				{ from: accounts[0] }
			);

			const decode2 = decodeLogs(tx2.receipt.rawLogs, LoanOpenings, "Trade");

			// Verify event
			sovryn_after_collateral_token_balance = await RBTC.balanceOf(sovryn.address);
			latest_trader_collateral_token_balance = await RBTC.balanceOf(accounts[0]);

			const sovryn_collateral_token_balance_diff2 = sovryn_after_collateral_token_balance
				.sub(sovryn_before_collateral_token_balance)
				.toString();
			const trader_collateral_token_balance_diff2 = previous_trader_collateral_token_balance
				.sub(latest_trader_collateral_token_balance)
				.toString();
			const args2 = decode2[0].args;

			expect(collateralTokenSent.toString()).to.equal(trader_collateral_token_balance_diff2);
			expect(args2["user"]).to.equal(accounts[0]);
			expect(args2["lender"]).to.equal(loanToken.address);
			expect(args2["loanId"]).to.equal(loan_id);
			expect(args2["collateralToken"]).to.equal(RBTC.address);
			expect(args2["loanToken"]).to.equal(SUSD.address);

			// For margin trade using collateral, the positionSize can be checked by getting the additional collateral token that is transferred into the protocol (difference between latest & previous balance)
			expect(args2["positionSize"]).to.equal(sovryn_collateral_token_balance_diff2);
		});

		it("Margin trade should revert if minEntryPrice is not fulfilled", async () => {
			// initial price that was set, 1 RBTC = 1e22 (10000 SUSD), so we can put 2 e(22-18) to trigger the invalid minEntryPrice
			await SUSD.transfer(loanToken.address, wei("1000000", "ether"));
			await RBTC.transfer(accounts[2], oneEth);
			await RBTC.approve(loanToken.address, oneEth, { from: accounts[2] });

			await expectRevert(
				loanToken.marginTrade(
					"0x0", // loanId  (0 for new loans)
					wei("2", "ether"), // leverageAmount
					0, // loanTokenSent (SUSD)
					10000, // collateral token sent
					RBTC.address, // collateralTokenAddress (RBTC)
					accounts[1], // trader,
					20000, // minEntryPrice
					"0x", // loanDataBytes (only required with ether)
					{ from: accounts[2] }
				),
				"principal too small"
			);

			await expectRevert(
				loanToken.marginTrade(
					"0x0", // loanId  (0 for new loans)
					wei("2", "ether"), // leverageAmount
					0, // loanTokenSent (SUSD)
					oneEth.toString(), // collateral token sent
					RBTC.address, // collateralTokenAddress (RBTC)
					accounts[1], // trader,
					2e14, // minEntryPrice
					"0x", // loanDataBytes (only required with ether)
					{ from: accounts[2] }
				),
				"entry price above the minimum"
			);
		});
	});
});
