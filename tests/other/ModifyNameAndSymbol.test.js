const { expect } = require("chai");
const LoanTokenLogicStandard = artifacts.require("LoanTokenLogicStandard");

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getPriceFeeds,
	getSovryn,
	getLoanTokenLogic,
	getLoanToken,
} = require("../Utils/initializer.js");

contract("ModifyNameAndSymbol", (accounts) => {
	let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds, loanToken;

	beforeEach(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		loanToken = await getLoanToken(accounts[0], sovryn, WRBTC, SUSD);
	});

	describe("Modifying name and symbol", () => {
		/*
		it("Test modifying name and symbol", async () => {
			const name = "TestName",
				symbol = "TSB";
			const localLoanToken = loanToken;

			await localLoanToken.changeLoanTokenNameAndSymbol(name, symbol);

			expect((await localLoanToken.name()) == name).to.be.true;
			expect((await localLoanToken.symbol()) == symbol).to.be.true;
		});*/
	});
});
