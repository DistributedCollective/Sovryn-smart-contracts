// For this test, governance contract and multisig wallet will be done by normal wallets.
// They will acts as locked and unlocked owner.

/** Speed optimized on branch hardhatTestRefactor, 2021-10-05
 * Bottleneck found at beforeEach hook, redeploying DevelopmentFund and token on every test.
 *
 * Total time elapsed: 5.2s
 * After optimization: 4.5s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Moved some init code from test into fixture.
 */

const DevelopmentFund = artifacts.require("DevelopmentFund");
const TestToken = artifacts.require("TestToken");

const {
	time, // Convert different time units to seconds. Available helpers are: seconds, minutes, hours, days, weeks and years.
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

contract("DevelopmentFund (Multisig Functions)", (accounts) => {
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

		/// @dev Moved from tests
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
	}

	before("Initiating Accounts & Creating Test Token Instance.", async () => {
		// Checking if we have enough accounts to test.
		assert.isAtLeast(accounts.length, 7, "At least 7 accounts are required to test the contracts.");
		[creator, governance, newGovernance, multisig, newMultisig, safeVault, userOne] = accounts;

		// Creating the instance of Test Token.
		testToken = await TestToken.new("TestToken", "TST", 18, zero);
	});

	beforeEach("Creating New Development Fund Instance.", async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	it("Unlocked Token Owner should not be able to call the init() more than once.", async () => {
		await expectRevert(developmentFund.init({ from: multisig }), "The contract is not in the right state.");
	});

	it("Unlocked Token Owner should not be able to add Locked Token Owner.", async () => {
		await expectRevert(
			developmentFund.updateLockedTokenOwner(newGovernance, { from: multisig }),
			"Only Locked Token Owner can call this."
		);
	});

	it("Unlocked Token Owner should be able to approve a Locked Token Owner.", async () => {
		await developmentFund.updateLockedTokenOwner(newGovernance, { from: governance });
		await developmentFund.approveLockedTokenOwner({ from: multisig });
	});

	it("Unlocked Token Owner should not be able to approve a Locked Token Owner, if not added by governance.", async () => {
		await expectRevert(developmentFund.approveLockedTokenOwner({ from: multisig }), "No new locked owner added.");
	});

	it("Unlocked Token Owner should not be able to update Unlocked Token Owner.", async () => {
		await expectRevert(
			developmentFund.updateUnlockedTokenOwner(newMultisig, { from: multisig }),
			"Only Locked Token Owner can call this."
		);
	});

	it("Unlocked Token Owner should not be able to change the release schedule.", async () => {
		await expectRevert(
			developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: multisig }),
			"Only Locked Token Owner can call this."
		);
	});

	it("Unlocked Token Owner should be able to transfer all tokens to safeVault.", async () => {
		let value = randomValue() + 1;
		await testToken.mint(userOne, value);
		await testToken.approve(developmentFund.address, value, { from: userOne });
		await developmentFund.depositTokens(value, { from: userOne });
		await developmentFund.transferTokensByUnlockedTokenOwner({ from: multisig });
	});

	it("Unlocked Token Owner should be able to withdraw tokens after schedule.", async () => {
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + 1);

		await developmentFund.withdrawTokensByUnlockedTokenOwner(releaseTokenAmount[releaseTokenAmount.length - 1], { from: multisig });
	});

	it("Unlocked Token Owner should be able to withdraw part of the tokens after schedule.", async () => {
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + 1);

		await developmentFund.withdrawTokensByUnlockedTokenOwner(Math.floor(releaseTokenAmount[releaseTokenAmount.length - 1] / 2), {
			from: multisig,
		});
	});

	it("Unlocked Token Owner should be able to withdraw tokens after multiple schedule is passed.", async () => {
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + releaseDuration[releaseDuration.length - 2] + 1);

		await developmentFund.withdrawTokensByUnlockedTokenOwner(
			releaseTokenAmount[releaseTokenAmount.length - 1] + Math.floor(releaseTokenAmount[releaseTokenAmount.length - 2] / 2),
			{ from: multisig }
		);
	});

	it("Unlocked Token Owner should not be able to withdraw tokens higher than the schedule.", async () => {
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + 1);

		// Checking token balance of multisig contract before tx
		let beforeTokenBalance = await testToken.balanceOf(multisig);

		await developmentFund.withdrawTokensByUnlockedTokenOwner(
			releaseTokenAmount[releaseTokenAmount.length - 1] + Math.floor(releaseTokenAmount[releaseTokenAmount.length - 2] / 2),
			{ from: multisig }
		);

		// Checking token balance of multisig contract after tx
		let afterTokenBalance = await testToken.balanceOf(multisig);

		assert.strictEqual(
			beforeTokenBalance.toNumber(),
			afterTokenBalance.toNumber() - releaseTokenAmount[releaseTokenAmount.length - 1],
			"Token amount not correct."
		);
	});

	it("Unlocked Token Owner should not be able to withdraw tokens without any duration is complete.", async () => {
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });
		let value = randomValue() + 1;
		await expectRevert(developmentFund.withdrawTokensByUnlockedTokenOwner(value, { from: multisig }), "No release schedule reached.");
	});

	it("Unlocked Token Owner should not be able to transfer all tokens to a receiver.", async () => {
		await expectRevert(
			developmentFund.transferTokensByLockedTokenOwner(creator, { from: multisig }),
			"Only Locked Token Owner can call this."
		);
	});
});
