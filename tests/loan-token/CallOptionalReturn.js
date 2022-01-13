const { expectRevert } = require("@openzeppelin/test-helpers");
const { lend_to_the_pool } = require("./helpers");

const TestToken = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");
const sovrynProtocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const ISovryn = artifacts.require("ISovryn");
const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicProxy = artifacts.require("LoanTokenLogicProxy");
const LoanTokenLogicBeacon = artifacts.require("LoanTokenLogicBeacon");
const LoanTokenLogicLMMockup = artifacts.require("LoanTokenLogicLMMockup");
const LoanTokenSettingsLowerAdmin = artifacts.require("LoanTokenSettingsLowerAdmin");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const Affiliates = artifacts.require("Affiliates");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const LoanClosingsLiquidation = artifacts.require("LoanClosingsLiquidation");
const LoanClosingsRollover = artifacts.require("LoanClosingsRollover");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");
const SwapsExternal = artifacts.require("SwapsExternal");
const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwap");
const LockedSOVMockup = artifacts.require("LockedSOVMockup");

const TOTAL_SUPPLY = web3.utils.toWei("1000", "ether");
const wei = web3.utils.toWei;

contract("CallOptionalReturn", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let lender, account1;
	let underlyingToken, testWrbtc;
	let sovryn, loanToken;

	before(async () => {
		[lender, account1, ...accounts] = accounts;
	});

	beforeEach(async () => {
		//Token
		underlyingToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
		testWrbtc = await TestWrbtc.new();

		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);

		await sovryn.replaceContract((await LoanClosingsLiquidation.new()).address);
		await sovryn.replaceContract((await LoanClosingsRollover.new()).address);
		await sovryn.replaceContract((await LoanClosingsWith.new()).address);
		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.replaceContract((await LoanSettings.new()).address);
		await sovryn.replaceContract((await LoanMaintenance.new()).address);
		await sovryn.replaceContract((await SwapsExternal.new()).address);
		await sovryn.replaceContract((await LoanOpenings.new()).address);
		await sovryn.replaceContract((await Affiliates.new()).address);

		await sovryn.setWrbtcToken(testWrbtc.address);

		feeds = await PriceFeedsLocal.new(testWrbtc.address, sovryn.address);
		await feeds.setRates(underlyingToken.address, testWrbtc.address, wei("0.01", "ether"));
		const swaps = await SwapsImplSovrynSwap.new();
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
		const sov = await TestToken.new("SOV", "SOV", 18, TOTAL_SUPPLY);
		await sovryn.setProtocolTokenAddress(sov.address);
		await sovryn.setSOVTokenAddress(sov.address);
		await sovryn.setLockedSOVAddress((await LockedSOVMockup.new(sov.address, [accounts[0]])).address);

		/** Deploy LoanTokenLogicBeacon */
		let loanTokenLogicBeacon = await LoanTokenLogicBeacon.new();

		/** Deploy  LoanTokenSettingsLowerAdmin*/
		const loanTokenSettingsLowerAdmin = await LoanTokenSettingsLowerAdmin.new();

		/** Register Loan Token Modules to the Beacon */
		await loanTokenLogicBeacon.registerLoanTokenModule(loanTokenSettingsLowerAdmin.address);

		let loanTokenLogicLM = await LoanTokenLogicLMMockup.new();

		/** Register Loan Token Logic LM to the Beacon */
		await loanTokenLogicBeacon.registerLoanTokenModule(loanTokenLogicLM.address);

		/** Deploy LoanTokenLogicProxy */
		let loanTokenLogic = await LoanTokenLogicProxy.new(loanTokenLogicBeacon.address);

		loanToken = await LoanToken.new(lender, loanTokenLogic.address, sovryn.address, testWrbtc.address);
		await loanToken.initialize(underlyingToken.address, name, symbol); //iToken

		const loanTokenAddress = await loanToken.loanTokenAddress();

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			lender, // address owner; // owner of this object
			underlyingToken.address, // address loanToken; // the token being loaned
			testWrbtc.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		/** Initialize the loan token logic proxy */
		loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
		await loanToken.setBeaconAddress(loanTokenLogicBeacon.address);

		/** Use interface of LoanTokenModules */
		loanToken = await ILoanTokenModules.at(loanToken.address);

		await loanToken.setupLoanParams([params], false);

		if (lender == (await sovryn.owner())) await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);
		await testWrbtc.mint(sovryn.address, wei("500", "ether"));
	});

	describe("Token should be a contract address", () => {
		it("Check that it reverts when internal function _callOptionalReturn is called", async () => {
			await lend_to_the_pool(loanToken, lender, underlyingToken, testWrbtc, sovryn);

			// above functionn also opens a trading position, so I need to add some more funds to be able to withdraw everything
			const balanceOf0 = await loanToken.assetBalanceOf(lender);
			await underlyingToken.approve(loanToken.address, balanceOf0.toString());
			await loanToken.mint(account1, balanceOf0.toString());
			const profitBefore = await loanToken.profitOf(lender);
			const iTokenBalance = await loanToken.balanceOf(lender);

			// burn everything -> profit should be 0
			await expectRevert(loanToken.burn(lender, iTokenBalance.toString()), "call to a non-contract address");
		});
	});
});
