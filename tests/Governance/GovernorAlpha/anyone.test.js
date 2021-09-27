// For this one, Governor Alpha Mockup is used to reduce the voting period to just 10 blocks.

/** Speed optimized on branch hardhatTestRefactor, 2021-09-22
 * Bottleneck is found on tests initialization. Common code is already moved into the
 *  beforeEach hook, but there is still a lot of initialization code running at
 *  the start of every test.
 *
 * Total time elapsed: 7.6s
 * After optimization: 5.2s
 *
 * Other minor optimizations:
 * - fixed some comments
 * - removed unneeded variables
 *
 * Notes: Applied waffle fixture to beforeEach hook.
 *  Tests are using a similar time-consuming flow, all of them, but small changes in
 *  the particular flow of every test are preventing to apply a generic function or
 *  a fixture to improve their performance. But it's possible to unify some very similar
 *  tests into one, like for example queueing a successful proposal and checking whether
 *  ProposalQueued event is emitted.
 *  Before optimization, these 2 tests are running the entire flow and it's better to
 *  use the same flow for both of them.
 *
 */

const { ethers, waffle } = require("hardhat");
const { loadFixture } = waffle;

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("Timelock");
const TestToken = artifacts.require("TestToken");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const SetGet = artifacts.require("setGet");

const {
	time, // Convert different time units to seconds. Available helpers are: seconds, minutes, hours, days, weeks and years.
	BN, // Big Number support.
	constants, // Common constants, like the zero address and largest integers.
	expectEvent, // Assertions for emitted events.
	expectRevert, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

// const web3 = require("Web3");

const { encodeParameters, increaseTime, blockNumber, mineBlock } = require("../../Utils/Ethereum");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = new BN(0);
let delay = 86400 * 14 + 2;
const totalSupply = 100000000;
let quorumPercentageVotes = 10;
let minPercentageVotes = 5;
const statePending = 0;
const stateActive = 1;
const stateCancelled = 2;
const stateDefeated = 3;
const stateSucceeded = 4;
const stateQueued = 5;
const stateExpired = 6;
const stateExecuted = 7;

/**
 * Function to create a random value.
 * It expects no parameter.
 *
 * @return {number} Random Value
 */
function randomValue() {
	return Math.floor(Math.random() * 1000);
}

/**
 * This function stakes token into the smart contract.
 *
 * @param {object} tokenInstance The Token used for Staking.
 * @param {object} stakingInstance The Staking Contract Instance.
 * @param stakeFor The person who is staking.
 * @param delegatee The person who has the right to vote on behalf of staker.
 * @param {number} amount The amount to stake.
 */
async function stake(tokenInstance, stakingInstance, stakeFor, delegatee, amount) {
	await tokenInstance.approve(stakingInstance.address, amount, {
		from: stakeFor,
	});
	let currentTimeStamp = await time.latest();
	await stakingInstance.stake(amount, currentTimeStamp.add(new BN(delay)), stakeFor, delegatee, { from: stakeFor });
}

/**
 * Advance Blocks to a particular block number from the current block.
 *
 * @param {number} num The block number you want to reach.
 */
async function advanceBlocks(num) {
	let currentBlockNumber = await blockNumber();
	for (let i = currentBlockNumber; i < num; i++) {
		await mineBlock();
	}
}

contract("GovernorAlpha (Any User Functions)", (accounts) => {
	let governorAlpha, stakingLogic, stakingProxy, timelock, testToken, setGet;
	let guardianOne, guardianTwo, voterOne, voterTwo, voterThree, userOne, userTwo;
	let targets, values, signatures, callDatas, eta, proposalId;

	before("Initiating Accounts & Contracts", async () => {
		// Checking if we have enough accounts to test.
		assert.isAtLeast(accounts.length, 7, "At least 7 accounts are required to test the contracts.");
		[guardianOne, guardianTwo, voterOne, voterTwo, voterThree, userOne, userTwo] = accounts;

		// Creating the instance of Test Token.
		testToken = await TestToken.new("TestToken", "TST", 18, totalSupply);

		// Creating the Staking Contract instance.
		stakingLogic = await StakingLogic.new(testToken.address);
		stakingProxy = await StakingProxy.new(testToken.address);
		await stakingProxy.setImplementation(stakingLogic.address);
		stakingLogic = await StakingLogic.at(stakingProxy.address);

		// Creating the Timelock Contract instance.
		// We would be assigning the `guardianOne` as the admin for now.
		timelock = await Timelock.new(guardianOne, delay);

		// Creating the Governor Contract Instance.
		governorAlpha = await GovernorAlpha.new(
			timelock.address,
			stakingLogic.address,
			guardianOne,
			quorumPercentageVotes,
			minPercentageVotes
		);

		// Transaction details to make the above governor as the admin of the Timelock Instance.
		let target = timelock.address;
		let value = zero;
		let signature = "setPendingAdmin(address)";
		let callData = encodeParameters(["address"], [governorAlpha.address]);
		let currentBlock = await ethers.provider.getBlock("latest");
		// console.log(currentBlock.timestamp);
		// let currentBlock = await web3.eth.getBlock(await blockNumber());
		// let currentBlock = await ethers.provider.getBlock("latest");
		eta = new BN(currentBlock.timestamp).add(new BN(delay + 1));

		// Adding the setPendingAdmin() to the Timelock Queue.
		await timelock.queueTransaction(target, value, signature, callData, eta, {
			from: guardianOne,
		});
		// After the required delay time is over.
		await increaseTime(delay + 2);
		// The setPendingAdmin() transaction is executed.
		await timelock.executeTransaction(target, value, signature, callData, eta, {
			from: guardianOne,
		});

		// Using the current governor contract, we accept itself as the admin of Timelock.
		await governorAlpha.__acceptAdmin({ from: guardianOne });

		// Creating a new instance of SetGet
		setGet = await SetGet.new();
	});

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Calculating the tokens to be sent for the Voters to Stake.
		let amount = new BN((quorumPercentageVotes * totalSupply + 1) / 100);

		// Minting new Tokens
		await testToken.mint(guardianOne, amount * 2, { from: guardianOne });

		// Transferring the calculated tokens.
		await testToken.transfer(voterOne, amount, { from: guardianOne });
		await testToken.transfer(voterTwo, amount, { from: guardianOne });

		// Making the Voters to stake.
		await stake(testToken, stakingLogic, voterOne, constants.ZERO_ADDRESS, amount);
		await stake(testToken, stakingLogic, voterTwo, constants.ZERO_ADDRESS, amount);
	}

	beforeEach("", async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	it("Cannot execute proposal out of queue, can queue a successful proposal, emit ProposalQueued, execute it, emit ProposalExecuted, cannot remove it, and cannot execute it again", async () => {
		// Proposal Parameters
		targets = [testToken.address];
		values = [new BN("0")];
		signatures = ["balanceOf(address)"];
		callDatas = [encodeParameters(["address"], [voterOne])];

		let txReceipt = await governorAlpha.propose(targets, values, signatures, callDatas, "Checking Token Balance", { from: voterOne });

		// Getting the proposal id of the newly created proposal.
		proposalId = await governorAlpha.latestProposalIds(voterOne);

		await mineBlock();

		// Votes in majority.
		await governorAlpha.castVote(proposalId, true, { from: voterOne });

		// Finishing up the voting.
		let endBlock = txReceipt["logs"]["0"]["args"].endBlock.toNumber() + 1;
		await advanceBlocks(endBlock);

		// Checking current state of proposal
		let currentState = await governorAlpha.state(proposalId);

		// Checking if the proposal went to Succeeded state.
		assert.strictEqual(currentState.toNumber(), stateSucceeded, "The correct state was not achieved after endBlock passed.");

		/// @dev Former Cannot execute a proposal which is not queued. test
		/// integrated into this one, to optimize test performance
		// Trying to put the Proposal to execute.
		await expectRevert(
			governorAlpha.execute(proposalId, { from: userOne }),
			"GovernorAlpha::execute: proposal can only be executed if it is queued"
		);

		// Puts the Proposal in Queue.
		let txReceiptQueue = await governorAlpha.queue(proposalId, { from: userOne });

		// Checking current state of proposal
		currentState = await governorAlpha.state(proposalId);

		// Checking if the proposal went to Queue state.
		assert.strictEqual(currentState.toNumber(), stateQueued, "The correct state was not achieved after proposal added to queue.");

		/// @dev Former "Adding a proposal to queue should emit ProposalQueued event." test
		/// integrated into this one, to optimize test performance
		expectEvent.inTransaction(txReceiptQueue.tx, governorAlpha, "ProposalQueued", {
			id: proposalId,
		});

		/// @dev Former "Can execute a queued proposal." test
		/// integrated into this one, to optimize test performance
		let eta = txReceiptQueue["logs"]["0"]["args"].eta;
		await time.increaseTo(eta);
		await mineBlock();

		// Puts the Proposal to execute.
		txReceiptExecute = await governorAlpha.execute(proposalId, { from: userOne });

		// Checking current state of proposal
		currentState = await governorAlpha.state(proposalId);

		// Checking if the proposal went to Executed state.
		assert.strictEqual(currentState.toNumber(), stateExecuted, "The correct state was not achieved after proposal executed.");

		/// @dev Former "Executing a proposal should emit the ProposalExecuted Event." test
		/// integrated into this one, to optimize test performance
		expectEvent.inTransaction(txReceiptExecute.tx, governorAlpha, "ProposalExecuted", {
			id: proposalId,
		});

		/// @dev Former "Cannot remove a proposal which is already executed." test
		/// integrated into this one, to optimize test performance
		// Trying to put the Proposal to execute again.
		await expectRevert(governorAlpha.cancel(proposalId, { from: userOne }), "GovernorAlpha::cancel: cannot cancel executed proposal");

		/// @dev Former "Cannot execute a proposal which is already executed." test
		/// integrated into this one, to optimize test performance
		// Trying to put the Proposal to execute again.
		await expectRevert(
			governorAlpha.execute(proposalId, { from: userOne }),
			"GovernorAlpha::execute: proposal can only be executed if it is queued"
		);
	});

	it("Cannot queue a defeated proposal.", async () => {
		// Proposal Parameters
		targets = [testToken.address];
		values = [new BN("0")];
		signatures = ["balanceOf(address)"];
		callDatas = [encodeParameters(["address"], [voterTwo])];

		let txReceipt = await governorAlpha.propose(targets, values, signatures, callDatas, "Checking Token Balance", { from: voterOne });

		// Getting the proposal id of the newly created proposal.
		proposalId = await governorAlpha.latestProposalIds(voterOne);

		await mineBlock();

		// Finishing up the voting.
		let endBlock = txReceipt["logs"]["0"]["args"].endBlock.toNumber() + 1;
		await advanceBlocks(endBlock);

		// Checking current state of proposal
		let currentState = await governorAlpha.state(proposalId);

		// Checking if the proposal is in Defeated state.
		assert.strictEqual(currentState.toNumber(), stateDefeated, "The correct state was not achieved after endBlock passed.");

		// Tries to put the Proposal in Queue.
		await expectRevert(
			governorAlpha.queue(proposalId, { from: userOne }),
			"GovernorAlpha::queue: proposal can only be queued if it is succeeded"
		);
	});

	it("All actions mentioned in the queue of a proposal should be executed correctly.", async () => {
		let value = randomValue() + 1;
		// Proposal Parameters
		targets = [setGet.address];
		values = [new BN("0")];
		signatures = ["set(uint256)"];
		callDatas = [encodeParameters(["uint256"], [value])];

		let txReceipt = await governorAlpha.propose(targets, values, signatures, callDatas, "Setting new Value", { from: voterOne });

		// Getting the proposal id of the newly created proposal.
		proposalId = await governorAlpha.latestProposalIds(voterOne);

		await mineBlock();

		// Votes in majority.
		await governorAlpha.castVote(proposalId, true, { from: voterOne });

		// Finishing up the voting.
		let endBlock = txReceipt["logs"]["0"]["args"].endBlock.toNumber() + 1;
		await advanceBlocks(endBlock);

		// Puts the Proposal in Queue.
		txReceipt = await governorAlpha.queue(proposalId, { from: userOne });

		let eta = txReceipt["logs"]["0"]["args"].eta;
		await time.increaseTo(eta);
		await mineBlock();

		// Puts the Proposal to execute.
		await governorAlpha.execute(proposalId, { from: userOne });

		// Getting the value has been updated.
		let cValue = await setGet.value();

		// Checking if the value in the contract and the expected value is same.
		assert.strictEqual(cValue.toNumber(), value, "Value was not correctly updated in the contract.");
	});
});
