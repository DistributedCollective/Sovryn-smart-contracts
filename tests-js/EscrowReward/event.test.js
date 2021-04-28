// For this test, multisig wallet will be done by normal wallets.

const EscrowReward = artifacts.require("EscrowReward");
const SOV = artifacts.require("TestToken");
const RewardToken = artifacts.require("TestToken");

const {
	BN, // Big Number support.
	expectEvent,
	constants, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = new BN(0);
const depositLimit = 75000;

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
 * Function to get the current timestamp.
 * It expects no parameter.
 *
 *  @return {number} Current Timestamp.
 */
function currentTimestamp() {
	return Math.floor(Date.now() / 1000);
}

contract("Escrow Rewards (Events)", (accounts) => {
	let escrowReward, sov, rewardToken;
	let creator, multisig, newMultisig, safeVault, userOne, userTwo, userThree, userFour, userFive;

	before("Initiating Accounts & Creating Test Token Instance.", async () => {
		// Checking if we have enough accounts to test.
		assert.isAtLeast(accounts.length, 9, "Alteast 9 accounts are required to test the contracts.");
		[creator, multisig, newMultisig, safeVault, userOne, userTwo, userThree, userFour, userFive] = accounts;

		// Creating the instance of SOV Token.
		sov = await SOV.new("Sovryn", "SOV", 18, zero);
		// Creating the instance of Reward Token.
		rewardToken = await RewardToken.new("Sovryn Reward", "SVR", 18, zero);
	});

	beforeEach("Creating New Escrow Contract Instance.", async () => {
		// Creating the contract instance.
		escrowReward = await EscrowReward.new(rewardToken.address, sov.address, multisig, zero, depositLimit, { from: creator });

		// Marking the contract as active.
		await escrowReward.init({ from: multisig });
	});

	it("Calling the init() will emit EscrowActivated Event.", async () => {
		// Creating the contract instance.
		escrowReward = await EscrowReward.new(rewardToken.address, sov.address, multisig, zero, depositLimit, { from: creator });
		let txReceipt = await escrowReward.init({ from: multisig });
		expectEvent(txReceipt, "EscrowActivated");
	});

	it("Updating the Multisig should emit NewMultisig Event.", async () => {
		let txReceipt = await escrowReward.updateMultisig(newMultisig, { from: multisig });
		expectEvent(txReceipt, "NewMultisig", {
			_initiator: multisig,
			_newMultisig: newMultisig,
		});
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

		await escrowReward.updateDepositLimit(value, { from: multisig });

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
		await escrowReward.changeStateToHolding({ from: multisig });

		let beforeSafeVaultSOVBalance = await sov.balanceOf(safeVault);
		let txReceipt = await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });
		let afterSafeVaultSOVBalance = await sov.balanceOf(safeVault);
		expectEvent(txReceipt, "TokenWithdrawByMultisig", {
			_initiator: multisig,
			_amount: new BN(afterSafeVaultSOVBalance - beforeSafeVaultSOVBalance),
		});
	});

	it("Multisig token deposit should emit TokenDepositByMultisig Event.", async () => {
		let value = randomValue() + 1;
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });

		await escrowReward.changeStateToHolding({ from: multisig });

		await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });

		await sov.mint(multisig, value);
		await sov.approve(escrowReward.address, value, { from: multisig });
		let txReceipt = await escrowReward.depositTokensByMultisig(value, { from: multisig });
		expectEvent(txReceipt, "TokenDepositByMultisig", {
			_initiator: multisig,
			_amount: new BN(value),
		});
	});

	it("Updating the Reward Token Address should emit RewardTokenUpdated Event.", async () => {
		let newRewardToken = await RewardToken.new("Sovryn Reward", "SVR", 18, zero);
		let txReceipt = await escrowReward.updateRewardToken(newRewardToken.address, { from: multisig });
		expectEvent(txReceipt, "RewardTokenUpdated", {
			_initiator: multisig,
			_rewardToken: newRewardToken.address,
		});
	});

	it("Multisig reward token deposit should emit RewardDepositsByMultisig Event.", async () => {
		let reward = randomValue() + 1;
		await rewardToken.mint(multisig, reward);
		await rewardToken.approve(escrowReward.address, reward, { from: multisig });
		let txReceipt = await escrowReward.depositRewardByMultisig(reward, { from: multisig });
		expectEvent(txReceipt, "RewardDepositByMultisig", {
			_initiator: multisig,
			_amount: new BN(reward),
		});
	});

	it("SOV and Reward withdraw should emit TokenWithdraw and RewardTokenWithdraw Events", async () => {
		let value = randomValue() + 100;
		let reward = Math.ceil(value / 100);
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });
		await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
		await escrowReward.changeStateToHolding({ from: multisig });
		await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });
		await rewardToken.mint(multisig, reward);
		await rewardToken.approve(escrowReward.address, reward, { from: multisig });
		await escrowReward.depositRewardByMultisig(reward, { from: multisig });
		await sov.approve(escrowReward.address, value, { from: multisig });
		await escrowReward.depositTokensByMultisig(value, { from: multisig });

		let txReceipt = await escrowReward.withdrawTokensAndReward({ from: userOne });
		expectEvent(txReceipt, "TokenWithdraw", {
			_initiator: userOne,
			_amount: new BN(value),
		});
		expectEvent(txReceipt, "RewardTokenWithdraw", {
			_initiator: userOne,
			_amount: new BN(reward),
		});
	});
});
