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

contract("Escrow Rewards (Creator Functions)", (accounts) => {
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
		escrowReward = await EscrowReward.new(
			rewardToken.address,
			sov.address,
			multisig,
			zero,
			{ from: creator }
		);

		// Marking the contract as active.
		await escrowReward.init(zero, { from: multisig });
	});

	it("Creator should not be able to call the init() function.", async () => {
		// Creating the contract instance.
		escrowReward = await EscrowReward.new(
			rewardToken.address,
			sov.address,
			multisig,
			zero,
			{ from: creator }
		);
		await expectRevert(escrowReward.init(zero, { from: creator }), "Only Multisig can call this.");
	});

	it("Creator should not be able to update the Multisig.", async () => {
		await expectRevert(escrowReward.updateMultisig(newMultisig, { from: creator }), "Only Multisig can call this.");
	});

	it("Creator should not be able to update the release time.", async () => {
		await expectRevert(escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: creator }), "Only Multisig can call this.");
	});

	it("Creator could deposit Tokens during Deposit State.", async () => {
		let value = randomValue() + 1;
		await sov.mint(creator, value);
		await sov.approve(escrowReward.address, value, { from: creator });
		await escrowReward.depositTokens(value, { from: creator });
	});

	it("Creator could not deposit Tokens during any other State other than Deposit.", async () => {
		await escrowReward.changeStateToHolding({ from: multisig });
		let value = randomValue() + 1;
		await sov.mint(creator, value);
		await sov.approve(escrowReward.address, value, { from: creator });

		await expectRevert(escrowReward.depositTokens(value, { from: creator }), "The contract is not in the right state.");
	});

	it("Creator should not be able to change the contract to Holding State.", async () => {
		await expectRevert(escrowReward.changeStateToHolding({ from: creator }), "Only Multisig can call this.");
	});

	it("Creator should not be able to withdraw all token to safeVault.", async () => {
		await expectRevert(escrowReward.withdrawTokensByMultisig(safeVault, { from: creator }), "Only Multisig can call this.");
	});

	it("Creator should not be able to deposit tokens using depositTokensByMultisig.", async () => {
		await expectRevert(escrowReward.depositTokensByMultisig(zero, { from: creator }), "Only Multisig can call this.");
	});

	it("Creator should be able to withdraw all his tokens and bonus in the Withdraw State.", async () => {
		let value = (randomValue() + 100);
		let reward = Math.ceil(value/100);
		await sov.mint(creator, value);
		await sov.approve(escrowReward.address, value, { from: creator });
		await escrowReward.depositTokens(value, { from: creator });

		await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
		await escrowReward.changeStateToHolding({ from: multisig });
		await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });

		await rewardToken.mint(multisig, reward);
		await rewardToken.approve(escrowReward.address, reward, { from: multisig });
		await escrowReward.depositRewardByMultisig(reward, { from: multisig });

		await sov.approve(escrowReward.address, value, { from: multisig });
		await escrowReward.depositTokensByMultisig(value, { from: multisig });

		await escrowReward.withdrawTokensAndReward({ from: creator });
	});

	it("Creator should not be able to withdraw unless in the Withdraw State.", async () => {
		await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
		let value = (randomValue() + 100);
		await sov.mint(creator, value);
		await sov.approve(escrowReward.address, value, { from: creator });
		await escrowReward.depositTokens(value, { from: creator });

		await expectRevert(escrowReward.withdrawTokensAndReward({ from: creator }), "The contract is not in the right state.");
	});

	it("Creator should not be able to withdraw unless the Release Time has not passed.", async () => {
		let value = (randomValue() + 100);
		await sov.mint(creator, value);
		await sov.approve(escrowReward.address, value, { from: creator });
		await escrowReward.depositTokens(value, { from: creator });
		await escrowReward.changeStateToHolding({ from: multisig });
		await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });
		await sov.approve(escrowReward.address, value, { from: multisig });
		await escrowReward.depositTokensByMultisig(value, { from: multisig });

		await expectRevert(escrowReward.withdrawTokensAndReward({ from: creator }), "The release time has not started yet.");
	});

});
