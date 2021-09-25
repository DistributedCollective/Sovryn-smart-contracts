/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * No bottlenecks found. The beforeEach hook deploys contracts but there is only one test.
 *
 * Total time elapsed: 4.1s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 */

const { constants, BN } = require("@openzeppelin/test-helpers");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("TimelockHarness");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");

const Protocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettings");

const LoanTokenSettings = artifacts.require("LoanTokenSettingsLowerAdmin");

const PreviousLoanTokenSettings = artifacts.require("PreviousLoanTokenSettingsLowerAdmin");
const PreviousLoanToken = artifacts.require("PreviousLoanToken");

const TOTAL_SUPPLY = 100;

const TWO_DAYS = 86400 * 2;

contract("LoanTokenUpgrade", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let root;
	let token, staking, gov, timelock;
	let protocolSettings, loanTokenSettings, protocol, loanToken;

	before(async () => {
		[root, ...accounts] = accounts;
	});

	/// @dev In case more tests were being added to this file,
	///   the beforeEach hook should be calling a fixture
	///   to avoid repeated deployments.
	beforeEach(async () => {
		// Token
		token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

		// Staking
		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		// Governor
		timelock = await Timelock.new(root, TWO_DAYS);
		gov = await GovernorAlpha.new(timelock.address, staking.address, root, 4, 0);
		await timelock.harnessSetAdmin(gov.address);

		// Settings
		loanTokenSettings = await PreviousLoanTokenSettings.new();
		loanToken = await PreviousLoanToken.new(root, loanTokenSettings.address, loanTokenSettings.address, token.address);
		loanToken = await PreviousLoanTokenSettings.at(loanToken.address);
		// await loanToken.transferOwnership(timelock.address);

		protocolSettings = await ProtocolSettings.new();
		protocol = await Protocol.new();
		await protocol.replaceContract(protocolSettings.address);
		protocol = await ProtocolSettings.at(protocol.address);
		await protocol.transferOwnership(timelock.address);
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
});
