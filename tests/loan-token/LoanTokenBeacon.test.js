const { expect } = require("chai");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");

const LoanTokenLogicBeacon = artifacts.require("LoanTokenLogicBeacon");
const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const LoanTokenSettingsLowerAdmin = artifacts.require("LoanTokenSettingsLowerAdmin");
const LoanTokenLogicLMV1Mockup = artifacts.require("LoanTokenLogicLMV1Mockup");
const LoanTokenLogicLMV2Mockup = artifacts.require("LoanTokenLogicLMV2Mockup");

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
		const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

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
			const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
			loanTokenLogic = initLoanTokenLogic[0];
			loanTokenLogicBeacon = initLoanTokenLogic[1];

			// Validate the current active module index
			loanTokenSettingsLowerAdmin = await LoanTokenSettingsLowerAdmin.new();
			loanTokenLogicLM = await LoanTokenLogicLM.new();

			const listSigsLowerAdmin = await loanTokenSettingsLowerAdmin.getListFunctionSignatures();
			const listSigsLM = await loanTokenLogicLM.getListFunctionSignatures();
			const moduleNameLowerSettings = listSigsLowerAdmin[1];
			const moduleNameLM = listSigsLM[1];

			const prevLoanTokenLogicLowerAdminAddress = await loanTokenLogicBeacon.getTarget(
				web3.eth.abi.encodeFunctionSignature("setAdmin(address)")
			);
			const prevLoanTokenLogicLMAddress = await loanTokenLogicBeacon.getTarget(
				web3.eth.abi.encodeFunctionSignature("borrowInterestRate()")
			);

			expect((await loanTokenLogicBeacon.activeModuleIndex(moduleNameLowerSettings)).toString()).to.equal(new BN(0).toString());
			expect((await loanTokenLogicBeacon.activeModuleIndex(moduleNameLM)).toString()).to.equal(new BN(0).toString());

			// Double check all module for lower settings
			for (let i = 0; i < listSigsLowerAdmin[0].length; i++) {
				expect((await loanTokenLogicBeacon.getActiveFuncSignatureList(moduleNameLowerSettings))[i]).to.be.equal(
					listSigsLowerAdmin[0][i]
				);
			}

			// Double check all module for LM
			for (let i = 0; i < listSigsLM[0].length; i++) {
				expect((await loanTokenLogicBeacon.getActiveFuncSignatureList(moduleNameLM))[i]).to.be.equal(listSigsLM[0][i]);
			}

			expect((await loanTokenLogicBeacon.getModuleUpgradeLogLength(moduleNameLowerSettings)).toString()).to.equal(
				new BN(1).toString()
			);
			expect((await loanTokenLogicBeacon.getModuleUpgradeLogLength(moduleNameLM)).toString()).to.equal(new BN(1).toString());

			const log1LowerAdmin = await loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLowerSettings, 0);
			const log1LM = await loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLM, 0);

			expect(log1LowerAdmin[0]).to.equal(prevLoanTokenLogicLowerAdminAddress);
			expect(log1LM[0]).to.equal(prevLoanTokenLogicLMAddress);

			await expectRevert(loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLowerSettings, 1), "invalid opcode");
			await expectRevert(loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLM, 1), "invalid opcode");

			const sig1 = web3.eth.abi.encodeFunctionSignature("testFunction1");

			expect(await loanTokenLogicBeacon.getTarget(sig1)).to.equal(CONSTANTS.ZERO_ADDRESS);

			/** Register New Loan Token Logic LM to the Beacon */
			loanTokenLogicLM = await LoanTokenLogicLMV1Mockup.new();
			await loanTokenLogicBeacon.registerLoanTokenModule(loanTokenLogicLM.address);

			// The totalSupply function signature should not be exist in this v1 mockup
			expect(await loanTokenLogicBeacon.getTarget(web3.eth.abi.encodeFunctionSignature("totalSupply()"))).to.equal(
				CONSTANTS.ZERO_ADDRESS
			);

			expect((await loanTokenLogicBeacon.activeModuleIndex(moduleNameLM)).toString()).to.equal(new BN(1).toString());

			expect((await loanTokenLogicBeacon.getModuleUpgradeLogLength(moduleNameLM)).toString()).to.equal(new BN(2).toString());

			const log2LM = await loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLM, 1);
			expect(log2LM[0]).to.equal(loanTokenLogicLM.address);

			expect(await loanTokenLogicBeacon.getTarget(web3.eth.abi.encodeFunctionSignature("borrowInterestRate()"))).to.equal(
				loanTokenLogicLM.address
			);
		});

		it("Rollback the module address", async () => {
			const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
			loanTokenLogic = initLoanTokenLogic[0];
			loanTokenLogicBeacon = initLoanTokenLogic[1];

			// Validate the current active module index
			loanTokenSettingsLowerAdmin = await LoanTokenSettingsLowerAdmin.new();
			loanTokenLogicLM = await LoanTokenLogicLM.new();

			const listSigsLowerAdmin = await loanTokenSettingsLowerAdmin.getListFunctionSignatures();
			const listSigsLM = await loanTokenLogicLM.getListFunctionSignatures();
			const moduleNameLowerSettings = listSigsLowerAdmin[1];
			const moduleNameLM = listSigsLM[1];

			const prevLoanTokenLogicLowerAdminAddress = await loanTokenLogicBeacon.getTarget(
				web3.eth.abi.encodeFunctionSignature("setAdmin(address)")
			);
			const prevLoanTokenLogicLMAddress = await loanTokenLogicBeacon.getTarget(
				web3.eth.abi.encodeFunctionSignature("borrowInterestRate()")
			);

			expect((await loanTokenLogicBeacon.activeModuleIndex(moduleNameLowerSettings)).toString()).to.equal(new BN(0).toString());
			expect((await loanTokenLogicBeacon.activeModuleIndex(moduleNameLM)).toString()).to.equal(new BN(0).toString());

			expect((await loanTokenLogicBeacon.getModuleUpgradeLogLength(moduleNameLowerSettings)).toString()).to.equal(
				new BN(1).toString()
			);
			expect((await loanTokenLogicBeacon.getModuleUpgradeLogLength(moduleNameLM)).toString()).to.equal(new BN(1).toString());

			const log1LowerAdmin = await loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLowerSettings, 0);
			const log1LM = await loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLM, 0);

			expect(log1LowerAdmin[0]).to.equal(prevLoanTokenLogicLowerAdminAddress);
			expect(log1LM[0]).to.equal(prevLoanTokenLogicLMAddress);

			await expectRevert(loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLowerSettings, 1), "invalid opcode");
			await expectRevert(loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLM, 1), "invalid opcode");

			// There should not be testNewFunction signature registered in the real LM
			expect(await loanTokenLogicBeacon.getTarget(web3.eth.abi.encodeFunctionSignature("testNewFunction()"))).to.equal(
				CONSTANTS.ZERO_ADDRESS
			);

			/** Register New Loan Token Logic LM to the Beacon */
			loanTokenLogicLM = await LoanTokenLogicLMV2Mockup.new();
			await loanTokenLogicBeacon.registerLoanTokenModule(loanTokenLogicLM.address);

			// There should be testNewFunction signature registered in v2Mockup
			expect(await loanTokenLogicBeacon.getTarget(web3.eth.abi.encodeFunctionSignature("testNewFunction()"))).to.equal(
				loanTokenLogicLM.address
			);

			expect((await loanTokenLogicBeacon.activeModuleIndex(moduleNameLM)).toString()).to.equal(new BN(1).toString());

			expect((await loanTokenLogicBeacon.getModuleUpgradeLogLength(moduleNameLM)).toString()).to.equal(new BN(2).toString());

			const log2LM = await loanTokenLogicBeacon.moduleUpgradeLog(moduleNameLM, 1);
			expect(log2LM[0]).to.equal(loanTokenLogicLM.address);

			expect(await loanTokenLogicBeacon.getTarget(web3.eth.abi.encodeFunctionSignature("borrowInterestRate()"))).to.equal(
				loanTokenLogicLM.address
			);

			/** Rollback */
			await loanTokenLogicBeacon.rollback(moduleNameLM, 0);
			expect((await loanTokenLogicBeacon.activeModuleIndex(moduleNameLM)).toString()).to.equal(new BN(0).toString());
			expect(await loanTokenLogicBeacon.getTarget(web3.eth.abi.encodeFunctionSignature("borrowInterestRate()"))).to.equal(log1LM[0]);

			/// After rolledback, the testNewFunction signature should not be exist anymore
			expect(await loanTokenLogicBeacon.getTarget(web3.eth.abi.encodeFunctionSignature("testNewFunction()"))).to.equal(
				CONSTANTS.ZERO_ADDRESS
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
