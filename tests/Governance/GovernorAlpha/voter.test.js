// For this one, Governor Alpha Mockup is used to reduce the voting period to just 10 blocks.

/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * No bottlenecks found. But flow is repeated along test 1 and 2.
 *
 * Total time elapsed: 4.7s
 * After optimization: 4.4s
 *
 * Minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Tests have been reordered so as to run through the flow just once, instead of twice.
 * This way, first test now checks the voteCast event and second test starts from the previous state.
 */

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("Timelock");
const TestToken = artifacts.require("TestToken");
const StakingLogic = artifacts.require("StakingMockup");
const StakingProxy = artifacts.require("StakingProxy");

const {
    time, // Convert different time units to seconds. Available helpers are: seconds, minutes, hours, days, weeks and years.
    BN, // Big Number support.
    constants, // Common constants, like the zero address and largest integers.
    expectEvent, // Assertions for emitted events.
    expectRevert, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { encodeParameters, increaseTime, blockNumber, mineBlock } = require("../../Utils/Ethereum");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = new BN(0);
let delay = 86400 * 14 + 1;
const totalSupply = 100000000;
let quorumPercentageVotes = 10;
let minPercentageVotes = 5;
// const statePending = 0;
// const stateActive = 1;
// const stateCanceled = 2;
// const stateDefeated = 3;
const stateSucceeded = 4;
const stateQueued = 5;
// const stateExpired = 6;
// const stateExecuted = 7;

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
    await stakingInstance.stake(amount, currentTimeStamp.add(new BN(delay)), stakeFor, delegatee, {
        from: stakeFor,
    });
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

contract("GovernorAlpha (Voter Functions)", (accounts) => {
    let governorAlpha, stakingLogic, stakingProxy, timelock, testToken;
    let guardianOne, guardianTwo, voterOne, voterTwo, voterThree, userOne, userTwo;
    let targets, values, signatures, callDatas, eta, proposalId;
    let txReceipt;

    before("Initiating Accounts & Contracts", async () => {
        // Checking if we have enough accounts to test.
        assert.isAtLeast(
            accounts.length,
            7,
            "At least 7 accounts are required to test the contracts."
        );
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
        let currentBlock = await web3.eth.getBlock(await blockNumber());
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

        // Calculating the tokens to be sent for the Voters to Stake.
        let amountOne = new BN((quorumPercentageVotes * totalSupply + 1) / 100);
        let amountTwo = new BN((minPercentageVotes * totalSupply + 1) / 100);

        // Transferring the calculated tokens.
        await testToken.transfer(voterOne, amountOne, { from: guardianOne });
        await testToken.transfer(voterTwo, amountTwo, { from: guardianOne });

        // Making the Voters to stake.
        await stake(testToken, stakingLogic, voterOne, constants.ZERO_ADDRESS, amountOne);
        await stake(testToken, stakingLogic, voterTwo, constants.ZERO_ADDRESS, amountTwo);
    });

    it("Voting should emit the VoteCast Event.", async () => {
        // Proposal Parameters
        targets = [testToken.address];
        values = [new BN("0")];
        signatures = ["balanceOf(address)"];
        callDatas = [encodeParameters(["address"], [voterOne])];

        txReceipt = await governorAlpha.propose(
            targets,
            values,
            signatures,
            callDatas,
            "Checking Token Balance",
            { from: voterOne }
        );

        // Getting the proposal id of the newly created proposal.
        proposalId = await governorAlpha.latestProposalIds(voterOne);

        await mineBlock();

        // Votes in majority.
        let txReceiptCastVote = await governorAlpha.castVote(proposalId, true, { from: voterOne });

        expectEvent.inTransaction(txReceiptCastVote.tx, governorAlpha, "VoteCast", {
            voter: voterOne,
            proposalId: proposalId,
            support: true,
        });
    });

    it("Should not be allowed to vote on a proposal with any other state than active.", async () => {
        // Finishing up the voting.
        let endBlock = txReceipt["logs"]["0"]["args"].endBlock.toNumber() + 1;
        await advanceBlocks(endBlock);

        // Checking current state of proposal
        let currentState = await governorAlpha.state(proposalId);

        // Checking if the proposal went to Succeeded state.
        assert.strictEqual(
            currentState.toNumber(),
            stateSucceeded,
            "The correct state was not achieved after endBlock passed."
        );

        // Puts the Proposal in Queue.
        await governorAlpha.queue(proposalId, { from: voterOne });

        // Checking current state of proposal
        currentState = await governorAlpha.state(proposalId);

        // Checking if the proposal went to Queued state.
        assert.strictEqual(
            currentState.toNumber(),
            stateQueued,
            "The correct state was not achieved after proposal added to queue."
        );

        // Vote by anyone else should now revert.
        await expectRevert(
            governorAlpha.castVote(proposalId, false, { from: voterTwo }),
            "GovernorAlpha::_castVote: voting is closed"
        );
    });
});
