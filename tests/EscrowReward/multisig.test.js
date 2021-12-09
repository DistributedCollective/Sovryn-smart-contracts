// For this test, multisig wallet will be done by normal wallets.

/** Speed optimized on branch hardhatTestRefactor, 2021-09-21
 * No bottlenecks found, all tests run smoothly.
 *
 * Total time elapsed: 4.4s
 * After optimization: 4.3s
 *
 * Other minor optimizations:
 * - fixed some comments
 *
 * Notes: Moved to before hook several mints and approvals.
 *
 */

const EscrowReward = artifacts.require("EscrowReward");
const LockedSOV = artifacts.require("LockedSOVMockup"); // Ideally should be using actual LockedSOV for testing.
const SOV = artifacts.require("TestToken");

const {
	BN, // Big Number support.
	expectRevert,
	constants, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = new BN(0);
let zeroAddress = constants.ZERO_ADDRESS;
const depositLimit = 75000000;

/**
 * Function to create a random value.
 * It expects no parameter.
 *
 * @return {number} Random Value.
 */
function randomValue() {
	return Math.floor(Math.random() * 1000000);
}

/**
 * Function to get the current timestamp.
 * It expects no parameter.
 *
 *  @return {number} Current Timestamp.
 */
function currentTimestamp() {
	return Math.floor(Date.now() / 1000);
}

contract("Escrow Rewards (Multisig Functions)", (accounts) => {
	let escrowReward, newEscrowReward, sov, lockedSOV;
	let creator, multisig, newMultisig, safeVault, userOne, userTwo, userThree, userFour, userFive;
	let reward, value, approvalCheckValue;

	before("Initiating Accounts & Creating Test Token Instance.", async () => {
		// Checking if we have enough accounts to test.
		assert.isAtLeast(accounts.length, 9, "At least 9 accounts are required to test the contracts.");
		[creator, multisig, newMultisig, safeVault, userOne, userTwo, userThree, userFour, userFive] = accounts;

		// Creating the instance of SOV Token.
		sov = await SOV.new("Sovryn", "SOV", 18, zero);

		// Creating the instance of LockedSOV Contract.
		lockedSOV = await LockedSOV.new(sov.address, [multisig]);

		// Creating the contract instance.
		escrowReward = await EscrowReward.new(lockedSOV.address, sov.address, multisig, zero, depositLimit, { from: creator });

		// Marking the contract as active.
		await escrowReward.init({ from: multisig });

		// Adding the contract as an admin in the lockedSOV.
		await lockedSOV.addAdmin(escrowReward.address, { from: multisig });

		/// @dev Minting, approval and test values calculation moved here for optimization
		value = randomValue() + 1;
		await sov.mint(multisig, value);
		reward = randomValue() + 1;
		await sov.mint(multisig, reward);
		await sov.approve(escrowReward.address, value + reward, { from: multisig });
		approvalCheckValue = value + reward + randomValue(); /// @dev Setting a higher value than default approval
	});

	it("Multisig should be able to call the init() function.", async () => {
		// Creating the contract instance.
		newEscrowReward = await EscrowReward.new(lockedSOV.address, sov.address, multisig, zero, depositLimit, { from: creator });
		await newEscrowReward.init({ from: multisig });
	});

	it("Multisig should be able to update the Multisig.", async () => {
		await newEscrowReward.updateMultisig(newMultisig, { from: multisig });
	});

	it("Multisig should not be able to update the Multisig with a Zero Address.", async () => {
		await expectRevert(escrowReward.updateMultisig(zeroAddress, { from: multisig }), "New Multisig address invalid.");
	});

	it("Multisig should be able to update the release time.", async () => {
		await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
	});

	it("Multisig should be able to update the deposit limit.", async () => {
		await escrowReward.updateDepositLimit(zero, { from: multisig });
	});

	it("Multisig should not be able to update the deposit limit lower than total deposits.", async () => {
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.updateDepositLimit(value, { from: multisig });
		await escrowReward.depositTokens(value, { from: userOne });
		await expectRevert(
			escrowReward.updateDepositLimit(value - 1, { from: multisig }),
			"Deposit already higher than the limit trying to be set."
		);
	});

	it("Multisig should be able to change the contract to Holding State.", async () => {
		await escrowReward.changeStateToHolding({ from: multisig });
	});

	it("Multisig should not be able to change the contract to Holding State twice.", async () => {
		await expectRevert(escrowReward.changeStateToHolding({ from: multisig }), "The contract is not in the right state.");
	});

	it("Multisig should be able to withdraw all token to safeVault.", async () => {
		await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });
	});

	it("Multisig should not be able to withdraw all token to safeVault if not in Holding Phase.", async () => {
		await expectRevert(
			newEscrowReward.withdrawTokensByMultisig(safeVault, { from: newMultisig }),
			"The contract is not in the right state."
		);
	});

	it("Multisig should be approved before depositing reward tokens using depositRewardByMultisig.", async () => {
		await expectRevert(escrowReward.depositRewardByMultisig(approvalCheckValue, { from: multisig }), "invalid transfer");
	});

	it("Multisig should not be able to deposit zero reward tokens using depositRewardByMultisig.", async () => {
		await expectRevert(escrowReward.depositRewardByMultisig(zero, { from: multisig }), "Amount needs to be bigger than zero.");
	});

	it("Multisig should be able to deposit reward tokens using depositRewardByMultisig.", async () => {
		await escrowReward.depositRewardByMultisig(reward, { from: multisig });
	});

	it("Multisig should be able to deposit tokens using depositTokensByMultisig.", async () => {
		await escrowReward.depositTokensByMultisig(value, { from: multisig });
	});

	it("Multisig should not be able to deposit tokens using depositTokensByMultisig if not in Holding State.", async () => {
		await expectRevert(newEscrowReward.depositTokensByMultisig(zero, { from: newMultisig }), "The contract is not in the right state.");
	});

	it("Multisig should not be able to deposit zero tokens using depositTokensByMultisig.", async () => {
		await newEscrowReward.changeStateToHolding({ from: newMultisig });
		await expectRevert(newEscrowReward.depositTokensByMultisig(zero, { from: newMultisig }), "Amount needs to be bigger than zero.");
	});

	it("Multisig should be able to update the Locked SOV Address.", async () => {
		let newLockedSOV = await LockedSOV.new(sov.address, [multisig]);
		await escrowReward.updateLockedSOV(newLockedSOV.address, { from: multisig });
	});

	it("Multisig should not be able to update the Locked SOV Address as a Zero Address.", async () => {
		await expectRevert(escrowReward.updateLockedSOV(zeroAddress, { from: multisig }), "Invalid Reward Token Address.");
	});

	it("Multisig should not be able to deposit reward tokens using depositRewardByMultisig during Withdraw State.", async () => {
		// Creating the contract instance.
		escrowReward = await EscrowReward.new(lockedSOV.address, sov.address, multisig, zero, depositLimit, { from: creator });

		// Marking the contract as active.
		await escrowReward.init({ from: multisig });

		// Adding the contract as an admin in the lockedSOV.
		await lockedSOV.addAdmin(escrowReward.address, { from: multisig });

		let value = randomValue() + 1;
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });

		await escrowReward.changeStateToHolding({ from: multisig });

		await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });

		await sov.mint(multisig, value);
		await sov.approve(escrowReward.address, value, { from: multisig });
		await escrowReward.depositTokensByMultisig(value, { from: multisig });

		let reward = randomValue() + 1;
		await sov.mint(multisig, reward);
		await sov.approve(escrowReward.address, reward, { from: multisig });
		await expectRevert(
			escrowReward.depositRewardByMultisig(reward, { from: multisig }),
			"Reward Token deposit is only allowed before User Withdraw starts."
		);
	});
});
