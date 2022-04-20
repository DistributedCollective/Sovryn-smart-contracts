/** Speed optimized on branch hardhatTestRefactor, 2021-09-23
 * No bottlenecks found, all tests run smoothly, flow is optimus.
 *
 * Total time elapsed: 4.6s
 *
 */

const GovernorAlpha = artifacts.require("GovernorAlpha");
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

const { encodeParameters, increaseTime, blockNumber } = require("../../Utils/Ethereum");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = new BN(0);
let delay = 86400 * 14 + 1;
const totalSupply = 100000000;
let quorumPercentageVotes = 10;
let minPercentageVotes = 5;

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

contract("GovernorAlpha (Proposer Functions)", (accounts) => {
    let governorAlpha, stakingLogic, stakingProxy, timelock, testToken;
    let guardianOne, guardianTwo, voterOne, voterTwo, voterThree, userOne, userTwo;
    let targets, values, signatures, callDatas, eta;

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

    it("Should not create a new proposal if not enough staked.", async () => {
        // Proposal Parameters
        targets = [testToken.address];
        values = [new BN("0")];
        signatures = ["mint(address,uint256)"];
        callDatas = [encodeParameters(["address", "uint256"], [voterThree, 100])];

        // Getting the staked value of voterThree
        let blockNum = await blockNumber();
        let currentBlock = await web3.eth.getBlock(blockNum);
        voterThreeStake = await stakingLogic.getPriorVotes(
            voterThree,
            blockNum - 1,
            currentBlock.timestamp
        );

        // Making sure that voterThree had no stake.
        assert.strictEqual(voterThreeStake.toNumber(), 0, "Voter Three had some stake.");

        await expectRevert(
            governorAlpha.propose(targets, values, signatures, callDatas, "Minting New Token", {
                from: voterThree,
            }),
            "GovernorAlpha::propose: proposer votes below proposal threshold"
        );
    });
});
