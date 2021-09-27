// For this test, governance contract and multisig wallet will be done by normal wallets.
// They will acts as locked and unlocked owner.

const DevelopmentFund = artifacts.require("DevelopmentFund");
const TestToken = artifacts.require("TestToken");

const {
	BN, // Big Number support.
	expectRevert, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");

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

contract("DevelopmentFund (Any User Functions)", (accounts) => {
	let developmentFund, testToken;
	let creator, governance, newGovernance, multisig, newMultisig, safeVault, userOne;

	before("Initiating Accounts & Creating Test Token Instance.", async () => {
		// Checking if we have enough accounts to test.
		assert.isAtLeast(accounts.length, 7, "At least 7 accounts are required to test the contracts.");
		[creator, governance, newGovernance, multisig, newMultisig, safeVault, userOne] = accounts;

		// Creating the instance of Test Token.
		testToken = await TestToken.new("TestToken", "TST", 18, zero);
	});

	beforeEach("Creating New Development Fund Instance.", async () => {
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
	});

	it("Anyone should be able to fund the initial token release schedule amount to make contract active.", async () => {
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
		await testToken.mint(userOne, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: userOne });
		await developmentFund.init({ from: userOne });
	});

	it("No one should be able to call the init() more than once.", async () => {
		await expectRevert(developmentFund.init({ from: userOne }), "The contract is not in the right state.");
	});

	it("Except Locked Token Owner, no one should be able to add new Locked Token Owner.", async () => {
		await expectRevert(
			developmentFund.updateLockedTokenOwner(newGovernance, { from: userOne }),
			"Only Locked Token Owner can call this."
		);
	});

	it("Except current Unlocked Token Owner, no one should be able to approve Locked Token Owner.", async () => {
		await expectRevert(developmentFund.approveLockedTokenOwner({ from: userOne }), "Only Unlocked Token Owner can call this.");
	});

	it("Except Locked Token Owner, no one should be able to update Unlocked Token Owner.", async () => {
		await expectRevert(
			developmentFund.updateUnlockedTokenOwner(newMultisig, { from: userOne }),
			"Only Locked Token Owner can call this."
		);
	});

	it("Anyone could deposit Tokens.", async () => {
		let value = randomValue() + 1;
		await testToken.mint(userOne, value);
		await testToken.approve(developmentFund.address, value, { from: userOne });
		await developmentFund.depositTokens(value, { from: userOne });
	});

	it("Except Locked Token Owner, no one should be able to change the release schedule.", async () => {
		await expectRevert(
			developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: userOne }),
			"Only Locked Token Owner can call this."
		);
	});

	it("Except Unlocked Token Owner, no one should be able to transfer all token to safeVault.", async () => {
		await expectRevert(
			developmentFund.transferTokensByUnlockedTokenOwner({ from: userOne }),
			"Only Unlocked Token Owner can call this."
		);
	});

	it("Except Unlocked Token Owner, no one should be able to withdraw tokens from schedule.", async () => {
		await expectRevert(
			developmentFund.withdrawTokensByUnlockedTokenOwner(zero, { from: userOne }),
			"Only Unlocked Token Owner can call this."
		);
	});

	it("Except Locked Token Owner, no one should be able to transfer all tokens to a receiver.", async () => {
		await expectRevert(
			developmentFund.transferTokensByLockedTokenOwner(creator, { from: userOne }),
			"Only Locked Token Owner can call this."
		);
	});
});
