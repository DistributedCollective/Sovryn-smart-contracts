// For this test, multisig wallet will be done by normal wallets.

/** Speed optimized on branch hardhatTestRefactor, 2021-09-21
 * No bottlenecks found, all tests run smoothly.
 *
 * Total time elapsed: 4.2s
 * After optimization: 4.1s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Found 3 escrow reward contract deployments. It's been reduced
 *  to just 2 of them by reordering tests and moving some code to
 *  the before hook. Last escrow is required because test needs to go through
 *  the entire status flow of the escrow.
 * 
 *  Found 2 LockedSOV mock deployments, but both are needed, the former to
 *  be attached to the escrow, and the latter to have a new and different
 *  address to check events for updating are working ok.
 */

const EscrowReward = artifacts.require("EscrowReward");
const LockedSOV = artifacts.require("LockedSOVMockup"); // Ideally should be using actual LockedSOV for testing.
const SOV = artifacts.require("TestToken");

const {
	BN, // Big Number support.
	expectEvent,
	constants, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = new BN(0);
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

contract("Escrow Rewards (Events)", (accounts) => {
	let escrowReward, newEscrowReward, sov, lockedSOV;
	let creator, multisig, newMultisig, safeVault, userOne, userTwo, userThree, userFour, userFive;
	let txReceiptEscrowRewardDeployment;

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
		txReceiptEscrowRewardDeployment = await escrowReward.init({ from: multisig });

		// Adding the contract as an admin in the lockedSOV.
		await lockedSOV.addAdmin(escrowReward.address, { from: multisig });
	});

	it("Calling the init() will emit EscrowActivated Event.", async () => {
		/// @dev using the init call from the before hook, for optimization
		expectEvent(txReceiptEscrowRewardDeployment, "EscrowActivated");
	});

	it("Updating the release time should emit TokenReleaseUpdated Event.", async () => {
		let timestamp = currentTimestamp();
		let txReceipt = await escrowReward.updateReleaseTimestamp(timestamp, { from: multisig });
		expectEvent(txReceipt, "TokenReleaseUpdated", {
			_initiator: multisig,
			_releaseTimestamp: new BN(timestamp),
		});
	});

	it("Updating the deposit limit should emit TokenDepositLimitUpdated Event.", async () => {
		let txReceipt = await escrowReward.updateDepositLimit(zero, { from: multisig });
		expectEvent(txReceipt, "TokenDepositLimitUpdated", {
			_initiator: multisig,
			_depositLimit: new BN(zero),
		});
	});

	it("Depositing Tokens by Users should emit TokenDeposit Event.", async () => {
		let value = randomValue() + 1;
		await escrowReward.updateDepositLimit(value + 1, { from: multisig });
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		let txReceipt = await escrowReward.depositTokens(value, { from: userOne });
		expectEvent(txReceipt, "TokenDeposit", {
			_initiator: userOne,
			_amount: new BN(value),
		});
	});

	it("Reaching the Deposit Limit should emit TokenDeposit Event.", async () => {
		let value = randomValue() + 1;

		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });

		let txReceipt = await escrowReward.depositTokens(value, { from: userOne });
		expectEvent(txReceipt, "DepositLimitReached");
	});

	it("Changing the contract to Holding State should emit EscrowInHoldingState Event.", async () => {
		let txReceipt = await escrowReward.changeStateToHolding({ from: multisig });
		expectEvent(txReceipt, "EscrowInHoldingState");
	});

	it("Multisig token withdraw should emit TokenWithdrawByMultisig Event.", async () => {
		let beforeSafeVaultSOVBalance = await sov.balanceOf(safeVault);
		let txReceipt = await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });
		let afterSafeVaultSOVBalance = await sov.balanceOf(safeVault);
		expectEvent(txReceipt, "TokenWithdrawByMultisig", {
			_initiator: multisig,
			_amount: new BN(afterSafeVaultSOVBalance - beforeSafeVaultSOVBalance),
		});
	});

	it("Multisig reward token deposit should emit RewardDepositsByMultisig Event.", async () => {
		let reward = randomValue() + 1;
		await sov.mint(multisig, reward);
		await sov.approve(escrowReward.address, reward, { from: multisig });
		let txReceipt = await escrowReward.depositRewardByMultisig(reward, { from: multisig });
		expectEvent(txReceipt, "RewardDepositByMultisig", {
			_initiator: multisig,
			_amount: new BN(reward),
		});
	});

	it("Multisig token deposit should emit TokenDepositByMultisig Event.", async () => {
		let value = randomValue() + 1;
		await sov.mint(multisig, value);
		await sov.approve(escrowReward.address, value, { from: multisig });
		let txReceipt = await escrowReward.depositTokensByMultisig(value, { from: multisig });
		expectEvent(txReceipt, "TokenDepositByMultisig", {
			_initiator: multisig,
			_amount: new BN(value),
		});
	});

	it("Updating the Multisig should emit NewMultisig Event.", async () => {
		let txReceipt = await escrowReward.updateMultisig(newMultisig, { from: multisig });
		expectEvent(txReceipt, "NewMultisig", {
			_initiator: multisig,
			_newMultisig: newMultisig,
		});
	});

	it("Updating the Locked SOV Contract Address should emit LockedSOVUpdated Event.", async () => {
		let newLockedSOV = await LockedSOV.new(sov.address, [multisig]);
		let txReceipt = await escrowReward.updateLockedSOV(newLockedSOV.address, { from: newMultisig });
		expectEvent(txReceipt, "LockedSOVUpdated", {
			_initiator: newMultisig,
			_lockedSOV: newLockedSOV.address,
		});
	});

	it("SOV and Reward withdraw should emit TokenWithdraw and RewardTokenWithdraw Events", async () => {
		// Creating the contract instance.
		escrowReward = await EscrowReward.new(lockedSOV.address, sov.address, multisig, zero, depositLimit, { from: creator });

		// Marking the contract as active.
		await escrowReward.init({ from: multisig });

		// Adding the contract as an admin in the lockedSOV.
		await lockedSOV.addAdmin(escrowReward.address, { from: multisig });

		let value = randomValue() + 100;
		let reward = Math.ceil(value / 100);
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });
		await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
		await escrowReward.changeStateToHolding({ from: multisig });
		await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });
		await sov.mint(multisig, reward);
		await sov.approve(escrowReward.address, reward, { from: multisig });
		await escrowReward.depositRewardByMultisig(reward, { from: multisig });
		await sov.approve(escrowReward.address, value, { from: multisig });
		await escrowReward.depositTokensByMultisig(value, { from: multisig });

		let txReceipt = await escrowReward.withdrawTokensAndReward({ from: userOne });
		expectEvent(txReceipt, "TokenWithdraw", {
			_initiator: userOne,
		});
		expectEvent(txReceipt, "RewardTokenWithdraw", {
			_initiator: userOne,
		});
	});
});
