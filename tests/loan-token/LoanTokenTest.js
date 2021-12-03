/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * No bottlenecks found. The beforeEach hook deploys contracts but there is only one test.
 *
 * Total time elapsed: 4.1s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes:
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use SUSD as underlying token, instead of custom underlyingToken.
 */

const { constants, expectRevert, BN } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenLogicWrbtc,
	getLoanTokenWRBTC,
	loan_pool_setup,
	set_demand_curve,
	getPriceFeeds,
	getSovryn,
	decodeLogs,
	getSOV,
} = require("../Utils/initializer.js");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("TimelockHarness");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");

const LoanToken = artifacts.require("LoanToken");
const LoanTokenSettings = artifacts.require("LoanTokenSettingsLowerAdmin");

const PreviousLoanTokenSettings = artifacts.require("PreviousLoanTokenSettingsLowerAdmin");
const PreviousLoanToken = artifacts.require("PreviousLoanToken");

const TestCoverage = artifacts.require("TestCoverage");

const TWO_DAYS = 86400 * 2;

contract("LoanTokenUpgrade", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let root, account1, account2, account3, account4;
	let staking, gov, timelock;
	let loanTokenSettings, loanToken, SUSD;

	before(async () => {
		[root, ...accounts] = accounts;
	});

	/// @dev In case more tests were being added to this file,
	///   the beforeEach hook should be calling a fixture
	///   to avoid repeated deployments.
	beforeEach(async () => {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
		await sovryn.setSovrynProtocolAddress(sovryn.address);

		// Staking
		let stakingLogic = await StakingLogic.new(SUSD.address);
		staking = await StakingProxy.new(SUSD.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		// Governor
		timelock = await Timelock.new(root, TWO_DAYS);
		gov = await GovernorAlpha.new(timelock.address, staking.address, root, 4, 0);
		await timelock.harnessSetAdmin(gov.address);

		// Settings
		loanTokenSettings = await PreviousLoanTokenSettings.new();
		loanToken = await PreviousLoanToken.new(root, loanTokenSettings.address, loanTokenSettings.address, SUSD.address);
		loanToken = await PreviousLoanTokenSettings.at(loanToken.address);

		await sovryn.transferOwnership(timelock.address);
	});

	describe("change settings", () => {
		it("admin field should be readable", async () => {
			let previousSovrynContractAddress = await loanToken.sovrynContractAddress();
			let previousWrbtcTokenAddress = await loanToken.wrbtcTokenAddress();

			let newLoanTokenSettings = await LoanTokenSettings.new();

			let loanTokenProxy = await PreviousLoanToken.at(loanToken.address);
			await loanTokenProxy.setTarget(newLoanTokenSettings.address);

			loanToken = await LoanTokenSettings.at(loanToken.address);

			// check that previous admin is address(0)
			let admin = await loanToken.admin();
			assert.equal(admin, constants.ZERO_ADDRESS);

			// await expectRevert(loanToken.changeLoanTokenNameAndSymbol("newName", "newSymbol", { from: account1 }), "unauthorized");

			// change admin
			await loanToken.setAdmin(root);

			admin = await loanToken.admin();
			assert.equal(admin, root);

			// await loanToken.changeLoanTokenNameAndSymbol("newName", "newSymbol");

			let sovrynContractAddress = await loanToken.sovrynContractAddress();
			let wrbtcTokenAddress = await loanToken.wrbtcTokenAddress();

			assert.equal(sovrynContractAddress, previousSovrynContractAddress);
			assert.equal(wrbtcTokenAddress, previousWrbtcTokenAddress);
		});
	});

	describe("Test coverage for LoanToken.sol", () => {
		it("Call constructor w/ target not a contract", async () => {
			await expectRevert(LoanToken.new(root, ZERO_ADDRESS, loanTokenSettings.address, SUSD.address), "target not a contract");
		});
		it("Call constructor w/ protocol not a contract", async () => {
			await expectRevert(LoanToken.new(root, loanTokenSettings.address, ZERO_ADDRESS, SUSD.address), "sovryn not a contract");
		});
		it("Call constructor w/ wrbtc not a contract", async () => {
			await expectRevert(
				LoanToken.new(root, loanTokenSettings.address, loanTokenSettings.address, ZERO_ADDRESS),
				"wrbtc not a contract"
			);
		});
		it("Call LoanToken::setTarget", async () => {
			let newLloanToken = await LoanToken.new(root, loanTokenSettings.address, loanTokenSettings.address, SUSD.address);
			let newLoanTokenSettings = await LoanTokenSettings.new();
			await newLloanToken.setTarget(newLoanTokenSettings.address);
		});
	});

	describe("Test coverage for AdvancedToken::_mint", () => {
		it("Call _mint w/ address 0 as receiver", async () => {
			testCoverage = await TestCoverage.new();
			let tokenAmount = new BN(1);
			let assetAmount = new BN(1);
			let price = new BN(1);
			await expectRevert(testCoverage.testMint(ZERO_ADDRESS, tokenAmount, assetAmount, price), "15");
		});
	});

	describe("Test coverage for LoanTokenLogicStorage::stringToBytes32", () => {
		it("stringToBytes32 when tempEmptyStringTest.length == 0", async () => {
			testCoverage = await TestCoverage.new();
			let result = await testCoverage.testStringToBytes32("");
			// console.log("result: ", result);
			expect(result).to.be.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
		});
	});
});
