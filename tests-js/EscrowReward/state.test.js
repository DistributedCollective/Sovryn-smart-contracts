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
let zero = 0;
let zeroBN = new BN(0);
let zeroAddress = constants.ZERO_ADDRESS;
const depositLimit = 75000;
let [deployedStatus, depositStatus, holdingStatus, withdrawStatus, expiredStatus] = [0, 1, 2, 3, 4];

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

/**
 * Function to check the contract state.
 *
 * @param contractInstance The contract instance.
 * @param checkArray The items to be checked.
 * @param userAddr The user address for user balance and reward check.
 * @param totalDeposit The total tokens deposited by the user.
 * @param releaseTime The release timestamp for the tokens deposited.
 * @param depositLimit The deposit limit for the contract.
 * @param totalRewardDeposit The total reward tokens deposited.
 * @param SOVAddress The SOV token contract.
 * @param rewardTokenAddress The Reward token contract.
 * @param multisigAddr The last release time.
 * @param userDeposit The address to check user deposit balance.
 * @param userReward The address to check user reward.
 * @param status The current contract status.
 */
async function checkStatus(
	contractInstance,
	checkArray,
	userAddr,
	totalDeposit,
	releaseTime,
	depositLimit,
	totalRewardDeposit,
	SOVAddress,
	rewardTokenAddress,
	multisigAddr,
	userDeposit,
	userReward,
	status
) {
	if (checkArray[0] == 1) {
		let cValue = await contractInstance.totalDeposit();
		assert.strictEqual(totalDeposit, cValue.toNumber(), "The total deposit does not match.");
	}
	if (checkArray[1] == 1) {
		let cValue = await contractInstance.releaseTime();
		assert.strictEqual(releaseTime, cValue.toNumber(), "The release time does not match.");
	}
	if (checkArray[2] == 1) {
		let cValue = await contractInstance.depositLimit();
		assert.strictEqual(depositLimit, cValue.toNumber(), "The deposit limit does not match.");
	}
	if (checkArray[3] == 1) {
		let cValue = await contractInstance.totalRewardDeposit();
		assert.strictEqual(totalRewardDeposit, cValue.toNumber(), "The new locked owner does not match.");
	}
	if (checkArray[4] == 1) {
		let cValue = await contractInstance.SOV();
		assert.equal(SOVAddress, cValue, "The SOV Address does not match.");
	}
	if (checkArray[5] == 1) {
		let cValue = await contractInstance.rewardToken();
		assert.equal(rewardTokenAddress, cValue, "The reward token address does not match.");
	}
	if (checkArray[6] == 1) {
		let cValue = await contractInstance.multisig();
		assert.equal(multisigAddr, cValue, "The reward token address does not match.");
	}
	if (checkArray[7] == 1) {
		let cValue = 0;
		await contractInstance.getUserBalance(userAddr).then((data) => {
			cValue = data;
		});
		assert.equal(userDeposit, cValue.toNumber(), "The user deposit does not match.");
	}
	if (checkArray[8] == 1) {
		let cValue = 0;
		await contractInstance.getReward(userAddr).then((data) => {
			cValue = data;
		});
		assert.equal(userReward, cValue.toNumber(), "The user reward does not match.");
	}
	if (checkArray[9] == 1) {
		let cValue = await contractInstance.status();
		assert.equal(status, cValue.toNumber(), "The contract status does not match.");
	}
}

/**
 * Function to get the current token balance in contract.
 * It expects address and token instances as parameters.
 *
 * @param addr The user/contract address.
 * @param sovContract The SOV Contract.
 * @param rewardTokenContract The Reward Token Contract.
 *
 * @return [SOV Balance, Reward Token Balance].
 */
async function getTokenBalances(addr, sovContract, rewardTokenContract) {
	let sovBal = await sovContract.balanceOf(addr);
	let rewardBal = await rewardTokenContract.balanceOf(addr);
	return [sovBal, rewardBal];
}

/**
 * Creates random token deposits from the user accounts.
 *
 * @param sovContract The SOV Contract.
 * @param escrowRewardContract The Escrow Reward Contract.
 * @param userOne User on index one.
 * @param userTwo User on index two.
 * @param userThree User on index three.
 * @param userFour User on index four.
 * @param userFive User on index five.
 *
 * @returns values The values array which was deposited by each user.
 */
async function userDeposits(sovContract, escrowRewardContract, userOne, userTwo, userThree, userFour, userFive) {
	let values = [randomValue() + 1, randomValue() + 1, randomValue() + 1, randomValue() + 1, randomValue() + 1];
	await sovContract.mint(userOne, values[0]);
	await sovContract.approve(escrowRewardContract.address, values[0], { from: userOne });
	await escrowRewardContract.depositTokens(values[0], { from: userOne });
	await sovContract.mint(userTwo, values[1]);
	await sovContract.approve(escrowRewardContract.address, values[1], { from: userTwo });
	await escrowRewardContract.depositTokens(values[1], { from: userTwo });
	await sovContract.mint(userThree, values[2]);
	await sovContract.approve(escrowRewardContract.address, values[2], { from: userThree });
	await escrowRewardContract.depositTokens(values[2], { from: userThree });
	await sovContract.mint(userFour, values[3]);
	await sovContract.approve(escrowRewardContract.address, values[3], { from: userFour });
	await escrowRewardContract.depositTokens(values[3], { from: userFour });
	await sovContract.mint(userFive, values[4]);
	await sovContract.approve(escrowRewardContract.address, values[4], { from: userFive });
	await escrowRewardContract.depositTokens(values[4], { from: userFive });
	return values;
}

/**
 * The function is used to check the withdraw status in the wallet standpoint.
 *
 * @param sovContract The SOV Contract.
 * @param rewardTokenContract The Reward Token Contract.
 * @param escrowRewardContract The Escrow Reward Contract.
 * @param multisig The multisig contract address.
 * @param user The user address.
 * @param index The user index in values array.
 * @param values The values array containing the token deposits.
 * @param totalValue The total deposits calculated from values.
 * @param reward The reward tokens deposited.
 */
async function checkUserWithdraw(
	sovContract,
	rewardTokenContract,
	escrowRewardContract,
	multisig,
	user,
	index,
	values,
	totalValue,
	reward
) {
	let beforeUserBalance = await getTokenBalances(user, sovContract, rewardTokenContract);
	let userReward = Math.floor(Math.floor(values[index] * reward) / totalValue);
	let userContractReward = await escrowRewardContract.getReward(user);
	assert.equal(userReward, userContractReward, "The user reward does not match.");
	// checkStatus(escrowRewardContract, [0,0,0,0,0,0,1,1,0], user, zero, zero, zero, zeroAddress, zeroAddress, zeroAddress, values[index], userReward, zero);
	await escrowRewardContract.withdrawTokensAndReward({ from: user });
	let afterUserBalance = await getTokenBalances(user, sovContract, rewardTokenContract);
	assert.equal(
		afterUserBalance[0].toNumber(),
		beforeUserBalance[0].toNumber() + values[index],
		"User One SOV Token balance is not correct."
	);
	assert.equal(
		afterUserBalance[1].toNumber(),
		beforeUserBalance[1].toNumber() + userReward,
		"User One Reward Token balance is not correct."
	);
	checkStatus(
		escrowRewardContract,
		[0, 0, 0, 0, 0, 0, 1, 1, 0],
		user,
		zero,
		zero,
		zero,
		zeroAddress,
		zeroAddress,
		zeroAddress,
		zero,
		zero,
		zero
	);
}

/**
 * The function to initiate the SOV and Reward Token Withdraw.
 *
 * @param sov The SOV Contract.
 * @param rewardToken The Reward Token Contract.
 * @param escrowReward The Escrow Reward Contract.
 * @param multisig The multisig address.
 * @param userOne Different Users.
 * @param userTwo Different Users.
 * @param userThree Different Users.
 * @param userFour Different Users.
 * @param userFive Different Users.
 * @param percentage The percentage of reward compared to the total SOV Deposit.
 */
async function sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage) {
	let values = await userDeposits(sov, escrowReward, userOne, userTwo, userThree, userFour, userFive);
	let totalValue = values.reduce((a, b) => a + b, 0);
	let reward = Math.ceil((totalValue * percentage) / 100);

	await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
	await escrowReward.changeStateToHolding({ from: multisig });

	await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });

	await rewardToken.mint(multisig, reward);
	await rewardToken.approve(escrowReward.address, reward, { from: multisig });
	await escrowReward.depositRewardByMultisig(reward, { from: multisig });

	await sov.approve(escrowReward.address, totalValue, { from: multisig });
	await escrowReward.depositTokensByMultisig(totalValue, { from: multisig });

	await checkUserWithdraw(sov, rewardToken, escrowReward, multisig, userOne, 0, values, totalValue, reward);
	await checkUserWithdraw(sov, rewardToken, escrowReward, multisig, userTwo, 1, values, totalValue, reward);
	await checkUserWithdraw(sov, rewardToken, escrowReward, multisig, userThree, 2, values, totalValue, reward);
	await checkUserWithdraw(sov, rewardToken, escrowReward, multisig, userFour, 3, values, totalValue, reward);
	await checkUserWithdraw(sov, rewardToken, escrowReward, multisig, userFive, 4, values, totalValue, reward);
}

contract("Escrow Rewards (State)", (accounts) => {
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

	it("Creating an instance should set all the values correctly.", async () => {
		let timestamp = currentTimestamp() + 1000;
		let newEscrowReward = await EscrowReward.new(rewardToken.address, sov.address, multisig, timestamp, depositLimit, {
			from: creator,
		});
		checkStatus(
			newEscrowReward,
			[1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
			creator,
			zero,
			timestamp,
			depositLimit,
			zero,
			sov.address,
			rewardToken.address,
			multisig,
			zero,
			zero,
			deployedStatus
		);
	});

	it("Calling the init() should update the contract status to Deposit.", async () => {
		checkStatus(
			escrowReward,
			[0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			zeroAddress,
			zero,
			zero,
			zero,
			zero,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			zero,
			zero,
			depositStatus
		);
	});

	it("Updating the Multisig should update the multisig in Contract.", async () => {
		await escrowReward.updateMultisig(newMultisig, { from: multisig });
		checkStatus(
			escrowReward,
			[0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
			zeroAddress,
			zero,
			zero,
			zero,
			zero,
			zeroAddress,
			zeroAddress,
			newMultisig,
			zero,
			zero,
			zero
		);
	});

	it("Updating the release time should update the release timestamp in contract.", async () => {
		let timestamp = currentTimestamp();
		await escrowReward.updateReleaseTimestamp(timestamp, { from: multisig });
		checkStatus(
			escrowReward,
			[0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
			zeroAddress,
			zero,
			timestamp,
			zero,
			zero,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			zero,
			zero,
			zero
		);
	});

	it("Updating the deposit limit should update the deposit limit in contract.", async () => {
		let value = randomValue() + 1;
		await escrowReward.updateDepositLimit(value, { from: multisig });
		checkStatus(
			escrowReward,
			[0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
			zeroAddress,
			zero,
			zero,
			value,
			zero,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			zero,
			zero,
			zero
		);
	});

	it("Depositing Tokens by Users should update the user balance.", async () => {
		let value = randomValue() + 1;
		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });
		await escrowReward.depositTokens(value, { from: userOne });
		checkStatus(
			escrowReward,
			[0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
			userOne,
			zero,
			zero,
			zero,
			zero,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			value,
			zero,
			zero
		);
	});

	it("Trying to deposit Tokens higher than the deposit limit should only take till the deposit limit.", async () => {
		let limit = randomValue() + 1;
		let value = randomValue() + limit;
		await escrowReward.updateDepositLimit(limit, { from: multisig });

		await sov.mint(userOne, value);
		await sov.approve(escrowReward.address, value, { from: userOne });

		let beforeUserTokenBalance = await getTokenBalances(userOne, sov, rewardToken);
		await escrowReward.depositTokens(value, { from: userOne });
		let afterUserTokenBalance = await getTokenBalances(userOne, sov, rewardToken);

		assert.equal(
			beforeUserTokenBalance[0].toNumber(),
			afterUserTokenBalance[0].toNumber() + limit,
			"The user SOV balance is not right."
		);
		checkStatus(
			escrowReward,
			[1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
			userOne,
			limit,
			zero,
			zero,
			zero,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			limit,
			zero,
			zero
		);
	});

	it("Trying to deposit Tokens after the deposit limit has reached should refund entire amount.", async () => {
		let limit = randomValue() + 1;
		await escrowReward.updateDepositLimit(limit, { from: multisig });

		await sov.mint(userOne, limit);
		await sov.approve(escrowReward.address, limit, { from: userOne });
		await escrowReward.depositTokens(limit, { from: userOne });

		await sov.mint(userTwo, limit);
		await sov.approve(escrowReward.address, limit, { from: userTwo });
		let beforeUserTokenBalance = await getTokenBalances(userTwo, sov, rewardToken);
		await escrowReward.depositTokens(limit, { from: userTwo });
		let afterUserTokenBalance = await getTokenBalances(userTwo, sov, rewardToken);

		assert.equal(beforeUserTokenBalance[0].toNumber(), afterUserTokenBalance[0].toNumber(), "The userTwo SOV balance is not right.");
	});

	it("Changing the contract to Holding State should update the contract state.", async () => {
		await escrowReward.changeStateToHolding({ from: multisig });
		checkStatus(
			escrowReward,
			[0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			zeroAddress,
			zero,
			zero,
			zero,
			zero,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			zero,
			zero,
			holdingStatus
		);
	});

	it("Multisig token withdraw should update the receiver and escrow token balance.", async () => {
		let values = await userDeposits(sov, escrowReward, userOne, userTwo, userThree, userFour, userFive);
		let totalValue = values.reduce((a, b) => a + b, 0);

		await escrowReward.changeStateToHolding({ from: multisig });

		await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });
		let contractBalance = await getTokenBalances(escrowReward.address, sov, rewardToken);
		assert.equal(contractBalance[0], zero, "Contract SOV Token balance should be zero.");
		let safeVaultBalance = await getTokenBalances(safeVault, sov, rewardToken);
		assert.equal(safeVaultBalance[0], totalValue, "SafeVault SOV Token balance is not correct.");
	});

	it("Multisig token deposit should change the contract state to Withdraw.", async () => {
		let valuesOne = await userDeposits(sov, escrowReward, userOne, userTwo, userThree, userFour, userFive);
		let totalValueOne = valuesOne.reduce((a, b) => a + b, 0);
		let valuesTwo = await userDeposits(sov, escrowReward, userOne, userTwo, userThree, userFour, userFive);
		let totalValueTwo = valuesTwo.reduce((a, b) => a + b, 0);
		let totalValue = totalValueOne + totalValueTwo;

		await escrowReward.changeStateToHolding({ from: multisig });

		await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });

		await sov.mint(multisig, totalValueOne);
		await sov.approve(escrowReward.address, totalValueOne, { from: multisig });
		await escrowReward.depositTokensByMultisig(totalValueOne, { from: multisig });

		checkStatus(
			escrowReward,
			[0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			zeroAddress,
			zero,
			zero,
			zero,
			zero,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			zero,
			zero,
			holdingStatus
		);
		let contractBalance = await getTokenBalances(escrowReward.address, sov, rewardToken);
		assert.equal(contractBalance[0], totalValueOne, "Contract SOV Token balance is not correct.");

		await sov.mint(multisig, totalValueTwo);
		await sov.approve(escrowReward.address, totalValueTwo, { from: multisig });
		await escrowReward.depositTokensByMultisig(totalValueTwo, { from: multisig });

		checkStatus(
			escrowReward,
			[0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
			zeroAddress,
			zero,
			zero,
			zero,
			zero,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			zero,
			zero,
			withdrawStatus
		);
		contractBalance = await getTokenBalances(escrowReward.address, sov, rewardToken);
		assert.equal(contractBalance[0], totalValue, "Contract SOV Token balance is not correct.");
	});

	it("Updating the Reward Token Address should update the contract state.", async () => {
		let newRewardToken = await RewardToken.new("Sovryn Reward", "SVR", 18, zero);
		await escrowReward.updateRewardToken(newRewardToken.address, { from: multisig });
		checkStatus(
			escrowReward,
			[0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
			zeroAddress,
			zero,
			zero,
			zero,
			zero,
			zeroAddress,
			newRewardToken.address,
			zeroAddress,
			zero,
			zero,
			zero
		);
	});

	it("Multisig reward token deposit should update the contract state.", async () => {
		let reward = randomValue() + 1;
		await rewardToken.mint(multisig, reward);
		await rewardToken.approve(escrowReward.address, reward, { from: multisig });
		await escrowReward.depositRewardByMultisig(reward, { from: multisig });
		checkStatus(
			escrowReward,
			[0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
			zeroAddress,
			zero,
			zero,
			zero,
			reward,
			zeroAddress,
			zeroAddress,
			zeroAddress,
			zero,
			zero,
			zero
		);
	});

	it("SOV and Reward (0.001%) withdraw should update the contract state.", async () => {
		let percentage = 0.001;
		sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage);
	});

	it("SOV and Reward (0.01%) withdraw should update the contract state.", async () => {
		let percentage = 0.01;
		sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage);
	});

	it("SOV and Reward (0.1%) withdraw should update the contract state.", async () => {
		let percentage = 0.1;
		sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage);
	});

	it("SOV and Reward (1%) withdraw should update the contract state.", async () => {
		let percentage = 1;
		sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage);
	});

	it("SOV and Reward (10%) withdraw should update the contract state.", async () => {
		let percentage = 10;
		sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage);
	});

	it("SOV and Reward (50%) withdraw should update the contract state.", async () => {
		let percentage = 50;
		sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage);
	});

	it("SOV and Reward (100%) withdraw should update the contract state.", async () => {
		let percentage = 100;
		sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage);
	});

	it("SOV and Reward (200%) withdraw should update the contract state.", async () => {
		let percentage = 200;
		sovAndRewardWithdraw(sov, rewardToken, escrowReward, multisig, userOne, userTwo, userThree, userFour, userFive, percentage);
	});
});
