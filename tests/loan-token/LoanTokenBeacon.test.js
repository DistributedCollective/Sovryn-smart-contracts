const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

const { CONSTANTS } = require("../Utils/initializer.js");

const LoanTokenLogicBeacon = artifacts.require("LoanTokenLogicBeacon");

contract("LoanTokenLogicBeacon", (accounts) => {
	let owner;
	let account1;
	let loanTokenLogicBeacon;

	before(async () => {
		[owner, account1] = accounts;
	});

	beforeEach(async () => {
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
	});
});
