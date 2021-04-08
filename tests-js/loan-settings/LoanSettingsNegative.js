const { assert } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time, ether } = require("@openzeppelin/test-helpers");

const TestToken = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");

const sovrynProtocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const ISovryn = artifacts.require("ISovryn");

const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicWrbtc = artifacts.require("LoanTokenLogicWrbtc");
const LoanTokenLogicStandard = artifacts.require("LoanTokenLogicStandard");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");
const LoanClosingsBase = artifacts.require("LoanClosingsBase");
const SwapsExternal = artifacts.require("SwapsExternal");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplLocal = artifacts.require("SwapsImplLocal");

const TOTAL_SUPPLY = ether("1000");

contract("LoanSettingsNegative", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let lender, account1, account2, account3, account4;
	let underlyingToken, testWrbtc;
	let sovryn, loanToken;
	let loanParams, loanParamsId, tx;

	before(async () => {
		[lender, account1, account2, account3, account4, ...accounts] = accounts;
	});

	beforeEach(async () => {
		//Token
		underlyingToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
		testWrbtc = await TestWrbtc.new();

		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);

		await sovryn.replaceContract((await LoanClosingsWith.new()).address);
		await sovryn.replaceContract((await LoanClosingsBase.new()).address);
		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.replaceContract((await LoanSettings.new()).address);
		await sovryn.replaceContract((await LoanMaintenance.new()).address);
		await sovryn.replaceContract((await SwapsExternal.new()).address);
		await sovryn.replaceContract((await LoanOpenings.new()).address);

		await sovryn.setWrbtcToken(testWrbtc.address);

		feeds = await PriceFeedsLocal.new(testWrbtc.address, sovryn.address);
		await feeds.setRates(underlyingToken.address, testWrbtc.address, ether("0.01"));
		const swaps = await SwapsImplLocal.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([underlyingToken.address, testWrbtc.address], [true, true]);
		await sovryn.setPriceFeedContract(
			feeds.address //priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swaps.address // swapsImpl
		);
		await sovryn.setFeesController(lender);

		loanTokenLogicWrbtc = await LoanTokenLogicWrbtc.new();
		loanToken = await LoanToken.new(lender, loanTokenLogicWrbtc.address, sovryn.address, testWrbtc.address);
		await loanToken.initialize(testWrbtc.address, "iWRBTC", "iWRBTC"); //iToken
		loanToken = await LoanTokenLogicWrbtc.at(loanToken.address);

		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (lender == (await sovryn.owner())) await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

		await testWrbtc.mint(sovryn.address, ether("500"));

		loanParams = {
			id: "0x0000000000000000000000000000000000000000000000000000000000000000",
			active: false,
			owner: constants.ZERO_ADDRESS,
			loanToken: underlyingToken.address,
			collateralToken: testWrbtc.address,
			minInitialMargin: ether("50"),
			maintenanceMargin: ether("15"),
			maxLoanTerm: "2419200",
		};

		tx = await sovryn.setupLoanParams([Object.values(loanParams)]);
		loanParamsId = tx.logs[1].args.id;
	});

	describe("test LoanSettingsNegative", async () => {
		it("test disable unauthorized owner LoanSettings", async () => {
			await expectRevert(sovryn.disableLoanParams([loanParamsId], { from: account1 }), "unauthorized owner");
		});

		it("test LoanSettings loanParam exists", async () => {
			await expectRevert(sovryn.setupLoanParams([Object.values(loanParams), Object.values(loanParams)]), "loanParams exists");
		});

		it("test LoanSettings other requires", async () => {
			let localLoanParams;

			localLoanParams = JSON.parse(JSON.stringify(loanParams));
			localLoanParams["minInitialMargin"] = ether("50");
			localLoanParams["maintenanceMargin"] = ether("15");
			localLoanParams["loanToken"] = constants.ZERO_ADDRESS;
			await expectRevert(sovryn.setupLoanParams([Object.values(localLoanParams)]), "invalid params");

			localLoanParams = JSON.parse(JSON.stringify(loanParams));
			localLoanParams["minInitialMargin"] = ether("50");
			localLoanParams["maintenanceMargin"] = ether("15");
			localLoanParams["collateralToken"] = constants.ZERO_ADDRESS;
			await expectRevert(sovryn.setupLoanParams([Object.values(localLoanParams)]), "invalid params");

			localLoanParams = JSON.parse(JSON.stringify(loanParams));
			localLoanParams["maintenanceMargin"] = ether("15");
			localLoanParams["minInitialMargin"] = ether("10");
			await expectRevert(sovryn.setupLoanParams([Object.values(localLoanParams)]), "invalid params");

			localLoanParams = JSON.parse(JSON.stringify(loanParams));
			localLoanParams["minInitialMargin"] = ether("50");
			localLoanParams["maintenanceMargin"] = ether("15");
			localLoanParams["maxLoanTerm"] = 1;
			await expectRevert(sovryn.setupLoanParams([Object.values(localLoanParams)]), "invalid params");
		});
	});
});
