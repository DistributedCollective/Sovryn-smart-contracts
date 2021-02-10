// For this test, governance contract and multisig wallet will be done by normal wallets
// They will acts as locked and unlocked owner,

const DevelopmentFund = artifacts.require("DevelopmentFund");
const TestToken = artifacts.require("TestToken");

const {
	time, // Convert different time units to seconds. Available helpers are: seconds, minutes, hours, days, weeks and years.
	BN, // Big Number support.
	constants, // Common constants, like the zero address and largest integers.
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
 * @param lockedTokenOwner The Locked Token Owner.
 * @param unlockedTokenOwner The Unlocked Token Owner.
 * @param newLockedTokenOwner The new Locked Token Owner.
 * @param lastReleaseTime The last release time.
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
	if (checkArray[5] == 1) {
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

contract("DevelopmentFund (State)", (accounts) => {
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

	it("Successfully created an instance without any error.", async () => {
		developmentFund = await DevelopmentFund.new(testToken.address, governance, safeVault, multisig);

		let currentTime = await time.latest();

		// Minting new Tokens
		await testToken.mint(governance, totalSupply, { from: creator });

		// Creating a new release token schedule.
		releaseTokenAmount = createReleaseTokenAmount();

		// Calculating the total tokens in the release schedule.
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);

		// Approving the development fund to do a transfer on behalf of governance.
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount);

		await checkStatus(
			developmentFund,
			[1, 1, 0, 1, 0, 0],
			governance,
			multisig,
			zero,
			currentTime,
			releaseDuration,
			releaseTokenAmount
		);
	});

	it("Adding new Locked Token Owner should update the new Locked Token Owner storage.", async () => {
		await developmentFund.updateLockedTokenOwner(newGovernance, { from: governance });
		await checkStatus(developmentFund, [0, 0, 1, 0, 0, 0], zero, zero, newGovernance, zero, zero, zero);
	});

	it("Approving new Locked Token Owner should update the Locked Token Owner.", async () => {
		await developmentFund.updateLockedTokenOwner(newGovernance, { from: governance });
		await developmentFund.approveLockedTokenOwner({ from: multisig });
		await checkStatus(developmentFund, [1, 0, 0, 0, 0, 0], newGovernance, zero, zero, zero, zero, zero);
	});

	it("After approval of new Locked Token Owner, newLockedTokenOwner should be zero address.", async () => {
		await developmentFund.updateLockedTokenOwner(newGovernance, { from: governance });
		await developmentFund.approveLockedTokenOwner({ from: multisig });
		await checkStatus(developmentFund, [0, 0, 1, 0, 0, 0], zero, zero, constants.ZERO_ADDRESS, zero, zero, zero);
	});

	it("Adding new Deposit should update the remaining token and contract token balance.", async () => {
		let value = randomValue();
		await testToken.mint(userOne, value);
		await testToken.approve(developmentFund.address, value, { from: userOne });
		await developmentFund.depositTokens(value, { from: userOne });
		let tokenBalance = await testToken.balanceOf(developmentFund.address);
		assert.equal(tokenBalance.toNumber(), value, "Token Balance in contract does not match the deposited amount.");
	});

	it("The contract should be approved to make token transfer for deposit.", async () => {
		let value = randomValue();
		await expectRevert(developmentFund.depositTokens(value, { from: userOne }), "invalid transfer");
	});

	it("Zero Tokens could not be deposited.", async () => {
		await expectRevert(developmentFund.depositTokens(0, { from: userOne }), "Amount needs to be bigger than zero.");
	});

	it("Updating the release schedule should update the lastReleaseTime, releaseDuration and releaseTokenAmount.", async () => {
		let newReleaseTime = randomValue();
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.changeTokenReleaseSchedule(newReleaseTime, releaseDuration, releaseTokenAmount, { from: governance });
		await checkStatus(developmentFund, [0, 0, 0, 1, 1, 1], zero, zero, zero, newReleaseTime, releaseDuration, releaseTokenAmount);
		let tokenBalance = await testToken.balanceOf(developmentFund.address);
		assert.equal(tokenBalance.toNumber(), totalReleaseTokenAmount, "Token Balance in contract does not match the correct amount.");
	});

	it("Updating the release schedule twice should update the lastReleaseTime, releaseDuration and releaseTokenAmount accordingly.", async () => {
		// First Time
		let newReleaseTime = randomValue();
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.changeTokenReleaseSchedule(newReleaseTime, releaseDuration, releaseTokenAmount, { from: governance });
		await checkStatus(developmentFund, [0, 0, 0, 1, 1, 1], zero, zero, zero, newReleaseTime, releaseDuration, releaseTokenAmount);
		let tokenBalance = await testToken.balanceOf(developmentFund.address);
		assert.equal(tokenBalance.toNumber(), totalReleaseTokenAmount, "Token Balance in contract does not match the correct amount.");

		// Second Time
		newReleaseTime = randomValue();
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.changeTokenReleaseSchedule(newReleaseTime, releaseDuration, releaseTokenAmount, { from: governance });
		await checkStatus(developmentFund, [0, 0, 0, 1, 1, 1], zero, zero, zero, newReleaseTime, releaseDuration, releaseTokenAmount);
		tokenBalance = await testToken.balanceOf(developmentFund.address);
		assert.equal(tokenBalance.toNumber(), totalReleaseTokenAmount, "Token Balance in contract does not match the correct amount.");
	});

	it("While updating release schedule, extra tokens should be sent back.", async () => {
		let newReleaseTime = randomValue();
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);

		// Sending extra token and total release amount through deposit.
		let extraTokens = 100 + randomValue();
		let completeAmount = extraTokens + totalReleaseTokenAmount;
		await testToken.mint(governance, completeAmount);
		await testToken.approve(developmentFund.address, completeAmount, { from: governance });
		await developmentFund.depositTokens(completeAmount, { from: governance });

		// Checking token balance of governance contract before tx
		let beforeTokenBalance = await testToken.balanceOf(governance);

		await developmentFund.changeTokenReleaseSchedule(newReleaseTime, releaseDuration, releaseTokenAmount, { from: governance });

		// Checking token balance of governance contract after tx
		let afterTokenBalance = await testToken.balanceOf(governance);

		assert.strictEqual(beforeTokenBalance.toNumber(), afterTokenBalance.toNumber() - extraTokens, "Extra tokens not sent back.");
		await checkStatus(developmentFund, [0, 0, 0, 1, 1, 1], zero, zero, zero, newReleaseTime, releaseDuration, releaseTokenAmount);
		let tokenBalance = await testToken.balanceOf(developmentFund.address);
		assert.equal(tokenBalance.toNumber(), totalReleaseTokenAmount, "Token Balance in contract does not match the correct amount.");
	});

	it("While updating release schedule, deficient tokens should be sent to contract.", async () => {
		let newReleaseTime = randomValue();
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);

		// Sending extra token and total release amount through deposit.
		let deficitTokens = 100 + randomValue();
		let completeAmount = totalReleaseTokenAmount - deficitTokens;
		await testToken.mint(governance, completeAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.depositTokens(completeAmount, { from: governance });

		// Checking token balance of governance contract before tx
		let beforeTokenBalance = await testToken.balanceOf(governance);

		await developmentFund.changeTokenReleaseSchedule(newReleaseTime, releaseDuration, releaseTokenAmount, { from: governance });

		// Checking token balance of governance contract after tx
		let afterTokenBalance = await testToken.balanceOf(governance);

		assert.strictEqual(beforeTokenBalance.toNumber(), afterTokenBalance.toNumber() + deficitTokens, "Extra tokens not sent back.");
		await checkStatus(developmentFund, [0, 0, 0, 1, 1, 1], zero, zero, zero, newReleaseTime, releaseDuration, releaseTokenAmount);
		let tokenBalance = await testToken.balanceOf(developmentFund.address);
		assert.equal(tokenBalance.toNumber(), totalReleaseTokenAmount, "Token Balance in contract does not match the correct amount.");
	});

	it("Unequal array for duration and tokens should not be accepted for token release schedule.", async () => {
		let newReleaseTime = randomValue();
		releaseTokenAmount = createReleaseTokenAmount();
		releaseTokenAmount.pop();
		await expectRevert(
			developmentFund.changeTokenReleaseSchedule(newReleaseTime, releaseDuration, releaseTokenAmount, { from: governance }),
			"Release Schedule does not match."
		);
	});

	it("Transferring all tokens to a safeVault by Unlocked Token Owner should update the remainingToken.", async () => {
		let value = randomValue();
		await testToken.mint(userOne, value);
		await testToken.approve(developmentFund.address, value, { from: userOne });
		await developmentFund.depositTokens(value, { from: userOne });
		await developmentFund.transferTokensByUnlockedTokenOwner({ from: multisig });
		let tokenBalance = await testToken.balanceOf(developmentFund.address);
		assert.equal(tokenBalance.toNumber(), 0, "Token Balance in contract does not match the correct amount.");
	});

	it("After withdrawing all tokens after a particular schedule, the release array size should decrease.", async () => {
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + 1);

		await developmentFund.withdrawTokensByUnlockedTokenOwner(releaseTokenAmount[releaseTokenAmount.length - 1], { from: multisig });

		releaseDuration.pop();
		releaseTokenAmount.pop();
		await checkStatus(developmentFund, [0, 0, 0, 0, 1, 1], zero, zero, zero, zero, releaseDuration, releaseTokenAmount);
	});

	it("After withdrawing all tokens after 2 particular schedule, the release array size should decrease.", async () => {
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + releaseDuration[releaseDuration.length - 2] + 1);

		await developmentFund.withdrawTokensByUnlockedTokenOwner(
			releaseTokenAmount[releaseTokenAmount.length - 1] + releaseTokenAmount[releaseTokenAmount.length - 2],
			{ from: multisig }
		);

		releaseDuration.pop();
		releaseDuration.pop();
		releaseTokenAmount.pop();
		releaseTokenAmount.pop();
		await checkStatus(developmentFund, [0, 0, 0, 0, 1, 1], zero, zero, zero, zero, releaseDuration, releaseTokenAmount);
	});

	it("After withdrawing part of tokens after a particular schedule, the release token amount should decrease.", async () => {
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + 1);

		let withdrawAmount = Math.floor(releaseTokenAmount[releaseTokenAmount.length - 1] / 2);
		await developmentFund.withdrawTokensByUnlockedTokenOwner(withdrawAmount, { from: multisig });
		releaseTokenAmount[releaseTokenAmount.length - 1] = releaseTokenAmount[releaseTokenAmount.length - 1] - withdrawAmount;
		await checkStatus(developmentFund, [0, 0, 0, 0, 1, 1], zero, zero, zero, zero, releaseDuration, releaseTokenAmount);
	});

	it("After withdrawing all tokens after a particular schedule, the release time should be updated based on duration.", async () => {
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });
		await developmentFund.changeTokenReleaseSchedule(zero, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + 1);

		let lastReleaseTime = await developmentFund.lastReleaseTime();

		await developmentFund.withdrawTokensByUnlockedTokenOwner(releaseTokenAmount[releaseTokenAmount.length - 1], { from: multisig });

		await checkStatus(
			developmentFund,
			[0, 0, 0, 1, 0, 0],
			zero,
			zero,
			zero,
			lastReleaseTime.toNumber() + releaseDuration[releaseDuration.length - 1],
			zero,
			zero
		);
	});

	it("After withdrawing part of tokens after a particular schedule, the release time should not be updated based on duration.", async () => {
		releaseTokenAmount = createReleaseTokenAmount();
		totalReleaseTokenAmount = calculateTotalTokenAmount(releaseTokenAmount);
		await testToken.mint(governance, totalReleaseTokenAmount);
		await testToken.approve(developmentFund.address, totalReleaseTokenAmount, { from: governance });

		// This time we will be changing the last release time.
		let currentTime = await time.latest();
		await developmentFund.changeTokenReleaseSchedule(currentTime, releaseDuration, releaseTokenAmount, { from: governance });

		// Increasing the time to pass atleast one duration.
		await time.increase(releaseDuration[releaseDuration.length - 1] + 1);

		let withdrawAmount = Math.floor(releaseTokenAmount[releaseTokenAmount.length - 1] / 2);
		await developmentFund.withdrawTokensByUnlockedTokenOwner(withdrawAmount, { from: multisig });
		await checkStatus(developmentFund, [0, 0, 0, 1, 0, 0], zero, zero, zero, currentTime, zero, zero);
	});

	it("Zero Tokens could not be withdrawed from release schedule.", async () => {
		await expectRevert(developmentFund.withdrawTokensByUnlockedTokenOwner(zero, { from: multisig }), "Zero can't be withdrawn.");
	});

	it("Transferring all tokens to a receiver by Locked Token should update the remainingToken.", async () => {
		let value = randomValue();
		await testToken.mint(userOne, value);
		await testToken.approve(developmentFund.address, value, { from: userOne });
		await developmentFund.depositTokens(value, { from: userOne });
		await developmentFund.transferTokensByLockedTokenOwner(creator, { from: governance });
		let tokenBalance = await testToken.balanceOf(developmentFund.address);
		assert.equal(tokenBalance.toNumber(), 0, "Token Balance in contract does not match the correct amount.");
	});
});
