// For this test, governance contract and multisig wallet will be done by normal wallets
// They will acts as locked and unlocked owner,

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
 * Function to convert a BN array to number array.
 *
 * @param bnArray The array with BNs.
 * @return numArray The array with numbers.
 */
function convertBNArrayToNumArray(bnArray) {
	return bnArray.map((a) => a.toNumber());
}

/**
 * Function to check the contract state.
 *
 * @param contractInstance The contract instance.
 * @param checkArray The items to be checked.
 * @param lockedTokenOwner The locked token owner.
 * @param unlockedTokenOwner The unlocked token owner.
 * @param newLockedTokenOwner The new locked token owner.
 * @param lastReleaseTime The last release time.
 * @param remainingTokens The remaining tokens in contract.
 * @param releaseDuration The release duration of a schedule.
 * @param releaseTokenAmount The release token amount of a schedule.
 */
async function checkStatus(
	contractInstance,
	checkArray,
	lockedTokenOwner,
	unlockedTokenOwner,
	newLockedTokenOwner,
	lastReleaseTime,
	remainingTokens,
	releaseDuration,
	releaseTokenAmount
) {
	if (checkArray[0] == 1) {
		let cValue = await contractInstance.lockedTokenOwner();
		assert.strictEqual(lockedTokenOwner, cValue, "The locked owner does not match.");
	}
	if (checkArray[1] == 1) {
		let cValue = await contractInstance.unlockedTokenOwner();
		assert.strictEqual(unlockedTokenOwner, cValue, "The unlocked owner does not match.");
	}
	if (checkArray[2] == 1) {
		let cValue = await contractInstance.newLockedTokenOwner();
		assert.strictEqual(newLockedTokenOwner, cValue, "The new locked owner does not match.");
	}
	if (checkArray[3] == 1) {
		let cValue = await contractInstance.lastReleaseTime();
		assert.equal(lastReleaseTime, cValue.toNumber(), "The last release time does not match.");
	}
	if (checkArray[4] == 1) {
		let cValue = await contractInstance.remainingTokens();
		assert.equal(remainingTokens, cValue.toNumber(), "The remaining token does not match.");
	}
	if (checkArray[5] == 1) {
		let cValue = [];
		await contractInstance.getReleaseDuration().then((data) => {
			cValue = data;
		});
		cValue = convertBNArrayToNumArray(cValue);
		assert(cValue.length == releaseDuration.length, "The release duration length does not match.");
		assert(
			cValue.every((value, index) => value === releaseDuration[index]),
			"The release duration does not match."
		);
	}
	if (checkArray[6] == 1) {
		let cValue = [];
		await contractInstance.getReleaseTokenAmount().then((data) => {
			cValue = data;
		});
		cValue = convertBNArrayToNumArray(cValue);
		assert(cValue.length == releaseTokenAmount.length, "The release token length does not match.");
		assert(
			cValue.every((value, index) => value === releaseTokenAmount[index]),
			"The release token amount does not match."
		);
	}
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

	before("Initiating Accounts & Creating Test Token Instance.", async () => {
		// Checking if we have enough accounts to test.
		assert.isAtLeast(accounts.length, 7, "Alteast 7 accounts are required to test the contracts.");
		[creator, governance, newGovernance, multisig, newMultisig, safeVault, userOne] = accounts;

		// Creating the instance of Test Token.
		testToken = await TestToken.new("TestToken", "TST", 18, zero);
	});

	beforeEach("Creating New Development Fund Instance.", async () => {
		developmentFund = await DevelopmentFund.new(testToken.address, governance, safeVault, multisig);

		// Minting new Tokens.
		await testToken.mint(governance, totalSupply, { from: creator });

		// Creating a new release schedule.
		releaseDuration = [];
		// This is run 60 times for mimicking 5 years (12 months * 5), though the interval is small.
		for (let times = 0; times < 60; times++) {
			releaseDuration.push(releaseInterval);
		}

		// Creating a new release token schedule.
		releaseTokenAmount = createReleaseTokenAmount();

		// Calculating the total tokens in the release schedule.
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);

		// Approving the development fund to do a transfer on behalf of governance.
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount);
	});

	it("Instance Locked Token Owner should be governance.", async () => {
		await checkStatus(developmentFund, [1, 0, 0, 0, 0, 0, 0], governance, zero, zero, zero, zero, zero, zero);
	});

	it("Should be able to add new Locked Token Owner.", async () => {
		await developmentFund.updateLockedTokenOwner(newGovernance, { from: governance });
	});

	it("Should not be able to approve the Locked Token Owner.", async () => {
		await developmentFund.updateLockedTokenOwner(newGovernance, { from: governance });
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

	it("Locked Token Owner should approve the contract to send tokens for the Release Schedule.", async () => {
		releaseTokenAmount = createReleaseTokenAmount();
		await expectRevert(
			developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance }),
			"invalid transfer"
		);
	});

	it("Locked Token Owner should not be able to transfer all tokens to safeVault.", async () => {
		await expectRevert(
			developmentFund.transferTokensByUnlockedTokenOwner({ from: governance }),
			"Only Unlocked Token Owner can call this."
		);
	});

	it("Locked Token Owner should not be able to withdraw tokens after schedule duration passed.", async () => {
		let value = randomValue();
		await expectRevert(
			developmentFund.withdrawTokensByUnlockedTokenOwner(value, { from: governance }),
			"Only Unlocked Token Owner can call this."
		);
	});

	it("Locked Token Owner should be able to transfer all tokens to a receiver.", async () => {
		await developmentFund.transferTokensByLockedTokenOwner(creator, { from: governance });
	});
});
