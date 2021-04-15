const { expect } = require("chai");
const { expectRevert, BN, expectEvent } = require("@openzeppelin/test-helpers");

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenWRBTC,
	loan_pool_setup,
	getPriceFeeds,
	getSovryn,
	CONSTANTS,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const hunEth = new BN(wei("100", "ether"));

const initialize_test_transfer = async (SUSD, accounts, _loan_token) => {
	const sender = accounts[0];
	const receiver = accounts[1];
	const amount_to_buy = hunEth;
	await SUSD.approve(_loan_token.address, amount_to_buy);
	await _loan_token.mint(sender, amount_to_buy);
	const sender_initial_balance = await _loan_token.balanceOf(sender);
	const amount_sent = sender_initial_balance.div(new BN(2));

	return { amount_sent, receiver, sender };
};

contract("LoanTokenFunctionality", (accounts) => {
	let owner;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC;

	before(async () => {
		[owner] = accounts;
	});

	beforeEach(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		const loanTokenLogicStandard = await getLoanTokenLogic();
		loanToken = await getLoanToken(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);
	});

	describe("Test token transfer functionality of the loan token contract", () => {
		it("Test transfer", async () => {
			const { amount_sent, receiver, sender } = await initialize_test_transfer(SUSD, accounts, loanToken);

			const tx = await loanToken.transfer(receiver, amount_sent.toString());
			expect((await loanToken.balanceOf(sender)).eq(amount_sent)).to.be.true;
			expect((await loanToken.balanceOf(receiver)).eq(amount_sent)).to.be.true;
			expect((await loanToken.checkpointPrice(sender)).eq(await loanToken.initialPrice())).to.be.true;
			expect((await loanToken.checkpointPrice(receiver)).eq(await loanToken.initialPrice())).to.be.true;

			expectEvent(tx, "Transfer", { from: sender, to: receiver, value: amount_sent.toString() });
		});

		it("Test transfer with insufficient balance", async () => {
			const { amount_sent, sender, receiver } = await initialize_test_transfer(SUSD, accounts, loanToken);
			expectRevert(loanToken.transfer(sender, amount_sent.toString(), { from: receiver }), "14");
		});

		it("Test transfer to zero account should fail", async () => {
			const { amount_sent } = await initialize_test_transfer(SUSD, accounts, loanToken);
			expectRevert(loanToken.transfer(CONSTANTS.ZERO_ADDRESS, amount_sent.toString()), "14");
		});

		it("Test transfer to self", async () => {
			const { amount_sent, sender } = await initialize_test_transfer(SUSD, accounts, loanToken);
			const initial_balance = await loanToken.balanceOf(sender);
			// transfer the tokens to the sender
			await loanToken.transfer(sender, amount_sent);
			expect((await loanToken.balanceOf(sender)).eq(initial_balance)).to.be.true;
		});

		it("Test transfer to from", async () => {
			const { amount_sent, sender, receiver } = await initialize_test_transfer(SUSD, accounts, loanToken);
			await loanToken.approve(receiver, amount_sent);

			expect((await loanToken.allowance(sender, receiver)).eq(amount_sent)).to.be.true;

			await loanToken.transferFrom(sender, receiver, amount_sent, { from: receiver });
			expect((await loanToken.balanceOf(sender)).eq(amount_sent)).to.be.true;
			expect((await loanToken.balanceOf(receiver)).eq(amount_sent)).to.be.true;
		});
	});
});
