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
	});
});
