const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

const LoanTokenLogicBeacon = artifacts.require("LoanTokenLogicBeacon");
const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");

const { getSUSD, getRBTC, getWRBTC, getBZRX, getLoanTokenLogic, getPriceFeeds, getSovryn, CONSTANTS } = require("../Utils/initializer.js");

contract("LoanTokenLogicBeacon", (accounts) => {
	let owner;
	let account1;
	let loanTokenLogicBeacon;
	let sovryn;

	before(async () => {
		[owner, account1] = accounts;
	});

	beforeEach(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		loanTokenLogicBeacon = await LoanTokenLogicBeacon.new();
	});

	describe("Loan Token Logic Beacon", () => {
		it("Register module with non-admin address should fail", async () => {
			await expectRevert(loanTokenLogicBeacon.registerLoanTokenModule(CONSTANTS.ZERO_ADDRESS, { from: account1 }), "unauthorized");
		});

		it("Register module with 0 address should fail", async () => {
			await expectRevert(
				loanTokenLogicBeacon.registerLoanTokenModule(CONSTANTS.ZERO_ADDRESS),
				"LoanTokenModuleAddress is not a contract"
			);
		});

		it("Cannot get implementation address in pause mode", async () => {
			// Pause loan token logic beacon
			await loanTokenLogicBeacon.pause();
			const sig1 = web3.eth.abi.encodeFunctionSignature("testFunction1");

			await expectRevert(loanTokenLogicBeacon.getTarget(sig1), "LoanTokenLogicBeacon:paused mode");
		});

		it("Update the module address", async () => {
			const initLoanTokenLogic = await getLoanTokenLogic(true); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
			loanTokenLogic = initLoanTokenLogic[0];
			loanTokenLogicBeacon = initLoanTokenLogic[1];

			const sig1 = web3.eth.abi.encodeFunctionSignature("testFunction1");

			expect(await loanTokenLogicBeacon.getTarget(sig1)).to.equal(CONSTANTS.ZERO_ADDRESS);

			loanTokenLogicLM = await LoanTokenLogicLM.new();

			/** Register New Loan Token Logic LM to the Beacon */
			await loanTokenLogicBeacon.registerLoanTokenModule(loanTokenLogicLM.address);

			expect(await loanTokenLogicBeacon.getTarget(web3.eth.abi.encodeFunctionSignature("borrowInterestRate()"))).to.equal(
				loanTokenLogicLM.address
			);
		});

		it("Registering module without getListFunctionSignatures() in the target should fail", async () => {
			const initLoanTokenLogic = await getLoanTokenLogic(true); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
			loanTokenLogic = initLoanTokenLogic[0];
			loanTokenLogicBeacon = initLoanTokenLogic[1];

			/** Register New Loan Token Logic LM to the Beacon */
			await expectRevert(
				loanTokenLogicBeacon.registerLoanTokenModule(SUSD.address),
				"function selector was not recognized and there's no fallback function"
			);
		});
	});
});
