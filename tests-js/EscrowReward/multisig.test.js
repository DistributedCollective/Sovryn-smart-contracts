// For this test, multisig wallet will be done by normal wallets.

const EscrowReward = artifacts.require("EscrowReward");
const SOV = artifacts.require("TestToken");
const RewardToken = artifacts.require("TestToken");

const {
	BN, // Big Number support.
	expectRevert,
	constants, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = new BN(0);
const totalSupply = 1000000;

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

contract("Escrow Rewards (Multisig Functions)", (accounts) => {
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
		escrowReward = await EscrowReward.new(rewardToken.address, sov.address, multisig, zero, { from: creator });

		// Marking the contract as active.
		await escrowReward.init(zero, { from: multisig });
	});

	it("Multisig should be able to call the init() function.", async () => {
		// Creating the contract instance.
		escrowReward = await EscrowReward.new(rewardToken.address, sov.address, multisig, zero, { from: creator });
		await escrowReward.init(zero, { from: multisig });
	});

	it("Multisig should be able to update the Multisig.", async () => {
		await escrowReward.updateMultisig(newMultisig, { from: multisig });
	});

	it("Multisig should be able to update the release time.", async () => {
		await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
	});

	it("Multisig should be able to change the contract to Holding State.", async () => {
		await escrowReward.changeStateToHolding({ from: multisig });
	});

	it("Multisig should not be able to change the contract to Holding State twice.", async () => {
		await escrowReward.changeStateToHolding({ from: multisig });
		await expectRevert(escrowReward.changeStateToHolding({ from: multisig }), "The contract is not in the right state.");
	});

	it("Multisig should be able to withdraw all token to safeVault.", async () => {
		await escrowReward.changeStateToHolding({ from: multisig });

		await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });
	});

	it("Multisig should not be able to withdraw all token to safeVault if not in Holding Phase.", async () => {
		await expectRevert(escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig }), "The contract is not in the right state.");
	});

	it("Multisig should be able to deposit tokens using depositTokensByMultisig.", async () => {
		let value = randomValue() + 1;
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });

		await escrowReward.changeStateToHolding({ from: multisig });

		await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });

		await sov.mint(multisig, value);
		await sov.approve(escrowReward.address, value, { from: multisig });
		await escrowReward.depositTokensByMultisig(value, { from: multisig });
	});

	it("Multisig should not be able to deposit tokens using depositTokensByMultisig if not in Holding State.", async () => {
		await expectRevert(escrowReward.depositTokensByMultisig(zero, { from: multisig }), "The contract is not in the right state.");
	});

	it("Multisig should be able to update the Reward Token Address.", async () => {
		let newRewardToken = await RewardToken.new("Sovryn Reward", "SVR", 18, zero);
		await escrowReward.updateRewardToken(newRewardToken.address, { from: multisig });
	});

	it("Multisig should be able to deposit reward tokens using depositRewardByMultisig.", async () => {
		let reward = randomValue() + 1;
		await rewardToken.mint(multisig, reward);
		await rewardToken.approve(escrowReward.address, reward, { from: multisig });
		await escrowReward.depositRewardByMultisig(reward, { from: multisig });
	});
});
