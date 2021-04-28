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

contract("Escrow Rewards (Any User Functions)", (accounts) => {
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

	it("Except Multisig, no one should be able to call the init() function.", async () => {
		// Creating the contract instance.
		escrowReward = await EscrowReward.new(
			rewardToken.address,
			sov.address,
			multisig,
			zero,
			{ from: creator }
		);
		await expectRevert(escrowReward.init(zero, { from: userOne }), "Only Multisig can call this.");
	});

	it("Except Multisig, no one should be able to update the Multisig.", async () => {
		await expectRevert(escrowReward.updateMultisig(newMultisig, { from: userOne }), "Only Multisig can call this.");
	});

	it("Except Multisig, no one should be able to update the release time.", async () => {
		await expectRevert(escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: userOne }), "Only Multisig can call this.");
	});

	it("Anyone could deposit Tokens during Deposit State.", async () => {
		let value = randomValue() + 1;
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });
	});

	it("No one could deposit Tokens during any other State other than Deposit.", async () => {
		await escrowReward.changeStateToHolding({ from: multisig });
		let value = randomValue() + 1;
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });

		await expectRevert(escrowReward.depositTokens(value, { from: userOne }), "The contract is not in the right state.");
	});

	it("Except Multisig, no one should be able to change the contract to Holding State.", async () => {
		await expectRevert(escrowReward.changeStateToHolding({ from: userOne }), "Only Multisig can call this.");
	});

	it("Except Multisig, no one should be able to withdraw all token to safeVault.", async () => {
		await expectRevert(escrowReward.withdrawTokensByMultisig(safeVault, { from: userOne }), "Only Multisig can call this.");
	});

	it("Except Multisig, no one should be able to deposit tokens using depositTokensByMultisig.", async () => {
		await expectRevert(escrowReward.depositTokensByMultisig(zero, { from: userOne }), "Only Multisig can call this.");
	});

	it("Anyone should be able to withdraw all his tokens and bonus in the Withdraw State.", async () => {
		let value = (randomValue() + 100);
		let reward = Math.ceil(value/100);
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

		// TODO Delete the next few line.
		// let contractRewardBalance = await escrowReward.totalRewardDeposit();
		// console.log("Contract Reward Balance: "+contractRewardBalance);
		// let userContractBalance = await escrowReward.getUserBalance(userOne);
		// console.log("User Contract Balance: "+userContractBalance);
		// let contractReward = await escrowReward.getReward(userOne);
		// console.log("Calculated Reward: "+reward);
		// console.log("Contract Reward: "+contractReward);

		await escrowReward.withdrawTokensAndReward({ from: userOne });
	});

	it("Multiple users should be able to withdraw all their tokens and corresponding rewards in the Withdraw State.", async () => {

		let valueOne = (randomValue() + 100);
		await sov.mint(userOne, valueOne);
		await sov.approve(escrowReward.address, valueOne, { from: userOne });
		await escrowReward.depositTokens(valueOne, { from: userOne });

		let valueTwo = (randomValue() + 100);
		await sov.mint(userTwo, valueTwo);
		await sov.approve(escrowReward.address, valueTwo, { from: userTwo });
		await escrowReward.depositTokens(valueTwo, { from: userTwo });

		await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
		await escrowReward.changeStateToHolding({ from: multisig });
		await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });

		let totalDeposit = valueOne + valueTwo;
		let reward = Math.ceil(totalDeposit/100);
		await rewardToken.mint(multisig, reward);
		await rewardToken.approve(escrowReward.address, reward, { from: multisig });
		await escrowReward.depositRewardByMultisig(reward, { from: multisig });

		await sov.approve(escrowReward.address, totalDeposit, { from: multisig });
		await escrowReward.depositTokensByMultisig(totalDeposit, { from: multisig });

		// TODO Delete the next few line.
		// let contractRewardBalance = await escrowReward.totalRewardDeposit();
		// console.log("Contract Reward Balance: "+contractRewardBalance);
		// let userOneContractBalance = await escrowReward.getUserBalance(userOne);
		// console.log("userOne Contract Balance: "+userOneContractBalance);
		// let userTwoContractBalance = await escrowReward.getUserBalance(userTwo);
		// console.log("userTwo Contract Balance: "+userTwoContractBalance);
		// let userOneContractReward = await escrowReward.getReward(userOne);
		// let userTwoContractReward = await escrowReward.getReward(userTwo);
		// console.log("userOne Contract Reward: "+userOneContractReward);
		// console.log("userTwo Contract Reward: "+userTwoContractReward);

		await escrowReward.withdrawTokensAndReward({ from: userOne });
		await escrowReward.withdrawTokensAndReward({ from: userTwo });
	});

	it("No one should be able to withdraw unless in the Withdraw State.", async () => {
		await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
		let value = (randomValue() + 100);
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });

		await expectRevert(escrowReward.withdrawTokensAndReward({ from: userOne }), "The contract is not in the right state.");
	});

	it("No one should be able to withdraw unless the Release Time has not set (i.e. Zero).", async () => {
		let value = (randomValue() + 100);
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });
		await escrowReward.changeStateToHolding({ from: multisig });
		await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });
		await sov.approve(escrowReward.address, value, { from: multisig });
		await escrowReward.depositTokensByMultisig(value, { from: multisig });

		await expectRevert(escrowReward.withdrawTokensAndReward({ from: userOne }), "The release time has not started yet.");
	});

	it("No one should be able to withdraw unless the Release Time has not passed.", async () => {
		await escrowReward.updateReleaseTimestamp(currentTimestamp() + 1000, { from: multisig });
		let value = (randomValue() + 100);
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });
		await escrowReward.changeStateToHolding({ from: multisig });
		await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });
		await sov.approve(escrowReward.address, value, { from: multisig });
		await escrowReward.depositTokensByMultisig(value, { from: multisig });

		await expectRevert(escrowReward.withdrawTokensAndReward({ from: userOne }), "The release time has not started yet.");
	});

});
