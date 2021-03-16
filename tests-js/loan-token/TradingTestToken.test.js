const { expect } = require("chai");
const { expectRevert, BN } = require("@openzeppelin/test-helpers");

const {
	margin_trading_sending_loan_tokens,
	margin_trading_sov_reward_payment,
	margin_trading_sending_collateral_tokens,
	margin_trading_sending_collateral_tokens_sov_reward_payment,
	close_complete_margin_trade,
	close_complete_margin_trade_sov_reward_payment,
	close_partial_margin_trade,
	close_partial_margin_trade_sov_reward_payment,
} = require("./tradingFunctions");

const FeesEvents = artifacts.require("FeesEvents");
const TestToken = artifacts.require("TestToken");

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
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

contract("LoanTokenTrading", (accounts) => {
	let owner;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, SOV, priceFeeds;

	before(async () => {
		[owner] = accounts;
	});

	beforeEach(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		const loanTokenLogicStandard = await getLoanTokenLogic();
		loanToken = await getLoanToken(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

		SOV = await getSOV(sovryn, priceFeeds, SUSD);
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
			await margin_trading_sending_loan_tokens(accounts, sovryn, loanToken, SUSD, RBTC, priceFeeds, false);
			await margin_trading_sov_reward_payment(accounts, loanToken, SUSD, RBTC, SOV, FeesEvents);
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
				SUSD.address,
				RBTC.address,
				loanSize.mul(new BN(2)),
				new BN(50).mul(oneEth),
				false
			);
			await RBTC.mint(accounts[0], collateralTokenSent);
			await RBTC.mint(accounts[2], collateralTokenSent);
			// important! WRBTC is being held by the loanToken contract itself, all other tokens are transfered directly from
			// the sender and need approval
			await RBTC.approve(loanToken.address, collateralTokenSent);
			await RBTC.approve(loanToken.address, collateralTokenSent, { from: accounts[2] });

			const leverageAmount = new BN(5).mul(oneEth);
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
				RBTC,
				collateralTokenSent,
				leverageAmount,
				value,
				FeesEvents,
				SOV
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

		// test the correct max escrow amount is returned (considering that the function is actually returning a bit less than the max)
		it("Test margin trading without early access token should fail", async () => {
			const early_access_token = await TestToken.new("Sovryn Early Access Token", "SEAT", 1, 10);
			await early_access_token.transfer(accounts[1], await early_access_token.balanceOf(accounts[0]));
			await loanToken.setEarlyAccessToken(early_access_token.address);

			expectRevert(
				margin_trading_sending_loan_tokens(accounts, sovryn, loanToken, SUSD, RBTC, priceFeeds, false),
				"No early access tokens"
			);
		});
	});
});
