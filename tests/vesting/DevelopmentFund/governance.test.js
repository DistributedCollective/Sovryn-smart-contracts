// For this test, governance contract and multisig wallet will be done by normal wallets.
// They will acts as locked and unlocked owner.

/** Speed optimized on branch hardhatTestRefactor, 2021-10-04
 * Bottleneck found at beforeEach hook, redeploying DevelopmentFund and token on every test.
 *
 * Total time elapsed: 4.9s
 * After optimization: 4.2s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Moved second deployment to fixture for last tests.
 */

const DevelopmentFund = artifacts.require("DevelopmentFund");
const TestToken = artifacts.require("TestToken");

const {
	BN, // Big Number support.
	expectRevert, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

// Some constants we would be using in the contract.
let zero = new BN(0);
const totalSupply = 1000000;
let releaseInterval = 600; // 10 minutes.
let releaseDuration = [];
let releaseTokenAmount = [];
let totalReleaseTokenAmount = 0;

/**
 * Function to create a random value.
 * It expects no parameter.
 *
 * @return {number} Random Value.
 */
function randomValue() {
	return Math.floor(Math.random() * 1000);
}

/**
 * Function to create a random token amount with 60 items (considering one for each month for 5 years).
 *
 * @returns releaseTokenAmounts The release token amount array.
 */
function createReleaseTokenAmount() {
	let balance = totalSupply;
	let releaseTokenAmounts = [];
	for (let times = 0; times < 60; times++) {
		let newValue = randomValue() * 10; // Get's a number between 0 to 10000.
		balance -= newValue;
		releaseTokenAmounts.push(newValue);
	}
	return releaseTokenAmounts;
}

/**
 * Function to calculate the sum of tokens in a schedule.
 *
 * @param releaseTokenAmounts The release token amount array.
 * @returns totalTokenAmounts The total number of tokens for the release.
 */
function calculateTotalTokenAmount(releaseTokenAmounts) {
	return releaseTokenAmounts.reduce((a, b) => a + b, 0);
}

contract("DevelopmentFund (Governance Functions)", (accounts) => {
	let developmentFund, testToken;
	let creator, governance, newGovernance, multisig, newMultisig, safeVault, userOne;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Creating a new release schedule.
		releaseDuration = [];
		// This is run 60 times for mimicking 5 years (12 months * 5), though the interval is small.
		for (let times = 0; times < 60; times++) {
			releaseDuration.push(releaseInterval);
		}

		// Creating a new release token schedule.
		releaseTokenAmount = createReleaseTokenAmount();

		// Creating the contract instance.
		developmentFund = await DevelopmentFund.new(
			testToken.address,
			governance,
			safeVault,
			multisig,
			zero,
			releaseDuration,
			releaseTokenAmount,
			{ from: creator }
		);

		// Calculating the total tokens in the release schedule.
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);

		// Minting new Tokens.
		await testToken.mint(creator, totalSupply, { from: creator });

		// Approving the development fund to do a transfer on behalf of governance.
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: creator });

		// Marking the contract as active.
		await developmentFund.init({ from: creator });

		/// @dev Last tests require another deployment
		developmentFundGov = await DevelopmentFund.new(testToken.address, governance, safeVault, multisig, zero, [0], [0], {
			from: governance,
		});
		await developmentFundGov.init({ from: governance });
	}

	before("Initiating Accounts & Creating Test Token Instance.", async () => {
		// Checking if we have enough accounts to test.
		assert.isAtLeast(accounts.length, 7, "Alteast 7 accounts are required to test the contracts.");
		[creator, governance, newGovernance, multisig, newMultisig, safeVault, userOne] = accounts;

		// Creating the instance of Test Token.
		testToken = await TestToken.new("TestToken", "TST", 18, zero);
	});

	beforeEach("Creating New Development Fund Instance.", async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	it("Locked Token Owner should not be able to call the init() more than once.", async () => {
		await expectRevert(developmentFund.init({ from: governance }), "The contract is not in the right state.");
	});

	it("Instance Locked Token Owner should be governance.", async () => {
		let lockedTokenOwner = await developmentFund.lockedTokenOwner();
		assert.strictEqual(lockedTokenOwner, governance, "The locked owner does not match.");
	});

	it("Should be able to add new Locked Token Owner.", async () => {
		await developmentFund.updateLockedTokenOwner(newGovernance, { from: governance });
	});

	it("Should not be able to approve the Locked Token Owner.", async () => {
		await expectRevert(developmentFund.approveLockedTokenOwner({ from: governance }), "Only Unlocked Token Owner can call this.");
	});

	it("Should be able to update the Unlocked Token Owner.", async () => {
		await developmentFund.updateUnlockedTokenOwner(newMultisig, { from: governance });
	});

	it("Only Locked Token Owner should be able to update the Release Schedule.", async () => {
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });
	});

	/// @dev TODO: Misleading test found while optimizing has been splitted into 2.
	///   Please review this test makes sense.
	it("Locked Token Owner should approve the contract to send tokens for the Release Schedule.", async () => {
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
	});

	/// @dev TODO: Misleading test found while optimizing has been splitted into 2.
	///   Please review this test makes sense.
	it("Shouldn't be able to change the release schedule of a vesting contract.", async () => {
		await expectRevert(
			developmentFundGov.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance }),
			"invalid transfer"
		);
	});

	it("Locked Token Owner should not be able to transfer all tokens to safeVault.", async () => {
		await expectRevert(
			developmentFundGov.transferTokensByUnlockedTokenOwner({ from: governance }),
			"Only Unlocked Token Owner can call this."
		);
	});

	it("Locked Token Owner should not be able to withdraw tokens after schedule duration passed.", async () => {
		await expectRevert(
			developmentFundGov.withdrawTokensByUnlockedTokenOwner(zero, { from: governance }),
			"Only Unlocked Token Owner can call this."
		);
	});

	it("Locked Token Owner should be able to transfer all tokens to a receiver.", async () => {
		await developmentFundGov.transferTokensByLockedTokenOwner(creator, { from: governance });
	});
});
