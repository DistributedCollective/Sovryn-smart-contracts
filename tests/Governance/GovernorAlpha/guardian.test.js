// For this one, Governor Alpha Mockup is used to reduce the voting period to just 10 blocks.

/** Speed optimized on branch hardhatTestRefactor, 2021-09-23
 * Bottlenecks found on first and second test, but unfortunately the flow diverges at some point
 * so it is required to walk through it again.
 *
 * Total time elapsed: 4.9s
 * After optimization: 4.7s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to save initial snapshot for all tests.
 *
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
    expectRevert, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const {
    encodeParameters,
    increaseTime,
    blockNumber,
    mineBlock,
    advanceBlocks,
} = require("../../Utils/Ethereum");

const { assert } = require("chai");
const { ethers, waffle } = require("hardhat");
const { loadFixture } = waffle;

// Some constants we would be using in the contract.
let zero = new BN(0);
let delay = 86400 * 14 + 1;
const totalSupply = 100000000;
let quorumPercentageVotes = 10;
let minPercentageVotes = 5;
// const statePending = 0;
// const stateActive = 1;
const stateCancelled = 2;
// const stateDefeated = 3;
const stateSucceeded = 4;
const stateQueued = 5;
// const stateExpired = 6;
const stateExecuted = 7;

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
/*async function advanceBlocks(num) {
	let currentBlockNumber = await blockNumber();
	for (let i = currentBlockNumber; i < num; i++) {
		await mineBlock();
	}
}*/

contract("GovernorAlpha (Guardian Functions)", (accounts) => {
    let governorAlpha, stakingLogic, stakingProxy, timelock, testToken;
    let guardianOne, guardianTwo, voterOne, voterTwo, voterThree, userOne, userTwo;
    let targets, values, signatures, callDatas, proposalId;
    let newGovernorAlpha;

    async function deploymentAndInitFixture(_wallets, _provider) {
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

        // Calculating the tokens to be sent for the Voters to Stake.
        let amountOne = new BN((quorumPercentageVotes * totalSupply + 1) / 100);
        let amountTwo = new BN((minPercentageVotes * totalSupply + 1) / 100);

        // Transferring the calculated tokens.
        await testToken.transfer(voterOne, amountOne, { from: guardianOne });
        await testToken.transfer(voterTwo, amountTwo, { from: guardianOne });

        // Making the Voters to stake.
        await stake(testToken, stakingLogic, voterOne, constants.ZERO_ADDRESS, amountOne);
        await stake(testToken, stakingLogic, voterTwo, constants.ZERO_ADDRESS, amountTwo);

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
        //let currentBlock = await web3.eth.getBlock(await blockNumber());
        let currentBlock = await ethers.provider.getBlock("latest");
        let eta = new BN(currentBlock.timestamp).add(new BN(delay + 1));

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

        /// @dev Moved code from tests 1 and 2
        // Proposal Parameters
        targets = [testToken.address];
        values = [new BN("0")];
        signatures = ["balanceOf(address)"];
        callDatas = [encodeParameters(["address"], [voterOne])];

        let txReceipt = await governorAlpha.propose(
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
        await governorAlpha.castVote(proposalId, true, { from: voterOne });

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

        /// @dev From last tests
        // Creating the new Governor Contract Instance.
        newGovernorAlpha = await GovernorAlpha.new(
            timelock.address,
            stakingLogic.address,
            guardianTwo,
            quorumPercentageVotes,
            minPercentageVotes
        );
    }

    beforeEach("Initiating Accounts & Contracts", async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    it("Remove a successful proposal which was queued even if successful.", async () => {
        // Cancels the proposal by guardian.
        await governorAlpha.cancel(proposalId, { from: guardianOne });

        // Checking current state of proposal
        currentState = await governorAlpha.state(proposalId);

        // Checking if the proposal went to Cancelled state.
        assert.strictEqual(
            currentState.toNumber(),
            stateCancelled,
            "The correct state was not achieved after proposal added to queue."
        );
    });

    it("Cannot remove a proposal which is already executed.", async () => {
        // Puts the Proposal in Queue.
        await governorAlpha.queue(proposalId, { from: voterOne });

        // Checking current state of proposal
        currentState = await governorAlpha.state(proposalId);

        // Checking if the proposal went to Succeeded state.
        assert.strictEqual(
            currentState.toNumber(),
            stateQueued,
            "The correct state was not achieved after proposal added to queue."
        );

        await time.increase(delay);

        // Puts the Proposal to execution.
        await governorAlpha.execute(proposalId, { from: voterOne });

        // Checking current state of proposal
        currentState = await governorAlpha.state(proposalId);

        // Checking if the proposal went to Cancelled state.
        assert.strictEqual(
            currentState.toNumber(),
            stateExecuted,
            "The correct state was not achieved after proposal executed."
        );

        // Vote by anyone else should now revert.
        await expectRevert(
            governorAlpha.cancel(proposalId, { from: guardianOne }),
            "GovernorAlpha::cancel: cannot cancel executed proposal"
        );
    });

    it("Make a new Governor the admin of current Timelock with being pendingAdmin.", async () => {
        // Transaction details to make the above governor as the pending admin of the Timelock Instance.
        let currentBlock = await web3.eth.getBlock(await blockNumber());
        let eta = new BN(currentBlock.timestamp).add(new BN(delay + 1));

        // Adding the new governor as the Pending Admin to the Timelock Queue.
        await governorAlpha.__queueSetTimelockPendingAdmin(newGovernorAlpha.address, eta, {
            from: guardianOne,
        });
        // After the required delay time is over.
        await time.increase(delay + 1);
        // Executing the the new governor as the Pending Admin to the Timelock Queue.
        await governorAlpha.__executeSetTimelockPendingAdmin(newGovernorAlpha.address, eta, {
            from: guardianOne,
        });

        // Checking whether the current pending admin is set to the new governor.
        let newPendingAdmin = await timelock.pendingAdmin();
        assert.strictEqual(
            newPendingAdmin,
            newGovernorAlpha.address,
            "Pending admin was not set correctly."
        );

        // Using the new governor contract, we accept itself as the admin of current Timelock.
        await newGovernorAlpha.__acceptAdmin({ from: guardianTwo });
    });

    it("Should not be able to make a new Governor the admin of current Timelock without being pendingAdmin first.", async () => {
        await expectRevert(
            newGovernorAlpha.__acceptAdmin({ from: guardianTwo }),
            "Timelock::acceptAdmin: Call must come from pendingAdmin."
        );
    });

    it("Should be possible to abdicate being a guardian.", async () => {
        // Abdicating.
        await governorAlpha.__abdicate({ from: guardianOne });

        // Checking if the current guardian is zero address.
        let currentGuardian = await governorAlpha.guardian();
        assert.strictEqual(
            currentGuardian,
            constants.ZERO_ADDRESS,
            "Abdication was not successful."
        );
    });

    it("Should not be able to perform any task related to guardian after abdication.", async () => {
        // Creating the new Governor Contract Instance.
        newGovernorAlpha = await GovernorAlpha.new(
            timelock.address,
            stakingLogic.address,
            guardianOne,
            quorumPercentageVotes,
            minPercentageVotes
        );

        // Abdicating.
        await newGovernorAlpha.__abdicate({ from: guardianOne });

        // Adding the dummy address as the Pending Admin to the Timelock Queue.
        await expectRevert(
            newGovernorAlpha.__queueSetTimelockPendingAdmin(voterOne, 0, { from: guardianOne }),
            "GovernorAlpha::__queueSetTimelockPendingAdmin: sender must be gov guardian"
        );
    });
});
