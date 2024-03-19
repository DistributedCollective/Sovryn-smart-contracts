// For this test, multisig wallet will be done by normal wallets.

/** Speed optimized on branch hardhatTestRefactor, 2021-09-21
 * Greatest bottlenecks found at sovAndRewardWithdraw tests,
 * requiring each one an escrowReward deployment.
 *
 * Total time elapsed: 7.4s
 * After optimization: 6.5s
 *
 * Other minor optimizations:
 * - fixed some comments
 *
 * Notes: Used fixture to avoid redeployments on sovAndRewardWithdraw tests
 *
 */

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployAndGetIStaking } = require("../Utils/initializer");

const EscrowReward = artifacts.require("EscrowReward");
const LockedSOV = artifacts.require("LockedSOV"); // Ideally should be using actual LockedSOV for testing.
const VestingLogic = artifacts.require("VestingLogic");
const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorMockup");
const SOV = artifacts.require("TestToken");

const {
    BN,
    constants, // Assertions for transactions that should fail.
} = require("@openzeppelin/test-helpers");

const { assert } = require("chai");

// Some constants we would be using in the contract.
let zero = 0;
let zeroAddress = constants.ZERO_ADDRESS;
let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.
const depositLimit = 75000000;
let [deployedStatus, depositStatus, holdingStatus, withdrawStatus, expiredStatus] = [
    0, 1, 2, 3, 4,
];
const maxRandom = 1000000;
const infiniteTokens = maxRandom * 100; // A lot of tokens, enough to run all tests w/o extra minting

/**
 * Function to create a random value.
 * It expects no parameter.
 *
 * @return {number} Random Value.
 */
function randomValue() {
    return Math.floor(Math.random() * maxRandom);
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
 * @param lockedSOVAddress The Locked SOV contract address.
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
    lockedSOVAddress,
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
        assert.strictEqual(
            totalRewardDeposit,
            cValue.toNumber(),
            "The total reward deposit does not match."
        );
    }
    if (checkArray[4] == 1) {
        let cValue = await contractInstance.SOV();
        assert.equal(SOVAddress, cValue, "The SOV Address does not match.");
    }
    if (checkArray[5] == 1) {
        let cValue = await contractInstance.lockedSOV();
        assert.equal(lockedSOVAddress, cValue, "The reward token address does not match.");
    }
    if (checkArray[6] == 1) {
        let cValue = await contractInstance.multisig();
        assert.equal(multisigAddr, cValue, "The multisig address does not match.");
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
 * @param lockedSOVContract The Locked SOV Contract.
 *
 * @return [SOV Balance, Reward Token Balance].
 */
async function getTokenBalances(addr, sovContract, lockedSOVContract) {
    let sovBal = new BN(await sovContract.balanceOf(addr));
    let rewardBal = new BN(await lockedSOVContract.getLockedBalance(addr));
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
async function userDeposits(
    sovContract,
    escrowRewardContract,
    userOne,
    userTwo,
    userThree,
    userFour,
    userFive
) {
    let values = [
        randomValue() + 1,
        randomValue() + 1,
        randomValue() + 1,
        randomValue() + 1,
        randomValue() + 1,
    ];
    await escrowRewardContract.depositTokens(values[0], { from: userOne });
    await escrowRewardContract.depositTokens(values[1], { from: userTwo });
    await escrowRewardContract.depositTokens(values[2], { from: userThree });
    await escrowRewardContract.depositTokens(values[3], { from: userFour });
    await escrowRewardContract.depositTokens(values[4], { from: userFive });
    return values;
}

/**
 * The function is used to check the withdraw status in the wallet standpoint.
 *
 * @param sovContract The SOV Contract.
 * @param lockedSOVContract The Locked SOV Contract.
 * @param escrowRewardContract The Escrow Reward Contract.
 * @param user The user address.
 * @param index The user index in values array.
 * @param values The values array containing the token deposits.
 * @param totalValue The total deposits calculated from values.
 * @param reward The reward tokens deposited.
 */
async function checkUserWithdraw(
    sovContract,
    lockedSOVContract,
    escrowRewardContract,
    user,
    index,
    values,
    totalValue,
    reward
) {
    let beforeUserBalance = await getTokenBalances(user, sovContract, lockedSOVContract);
    let userReward = Math.floor(Math.floor(values[index] * reward) / totalValue);
    let userContractReward = await escrowRewardContract.getReward(user);
    assert.equal(userReward, userContractReward, "The user reward does not match.");
    // checkStatus(escrowRewardContract, [0,0,0,0,0,0,0,1,1,0], user, zero, zero, zero, zeroAddress, zeroAddress, zeroAddress, values[index], userReward, zero);
    await escrowRewardContract.withdrawTokensAndReward({ from: user });
    let afterUserBalance = await getTokenBalances(user, sovContract, lockedSOVContract);
    assert(
        afterUserBalance[0].eq(beforeUserBalance[0].add(new BN(values[index]))),
        "User One SOV Token balance is not correct."
    );
    assert(
        afterUserBalance[1].eq(beforeUserBalance[1].add(new BN(userReward))),
        "User One Reward Token balance is not correct."
    );
    await checkStatus(
        escrowRewardContract,
        [0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
        user,
        zero,
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
 * @param lockedSOV The Locked SOV Contract.
 * @param escrowReward The Escrow Reward Contract.
 * @param multisig The multisig address.
 * @param userOne Different Users.
 * @param userTwo Different Users.
 * @param userThree Different Users.
 * @param userFour Different Users.
 * @param userFive Different Users.
 * @param percentage The percentage of reward compared to the total SOV Deposit.
 */
async function sovAndRewardWithdraw(
    sov,
    lockedSOV,
    escrowReward,
    multisig,
    userOne,
    userTwo,
    userThree,
    userFour,
    userFive,
    percentage
) {
    let values = await userDeposits(
        sov,
        escrowReward,
        userOne,
        userTwo,
        userThree,
        userFour,
        userFive
    );
    let totalValue = values.reduce((a, b) => a + b, 0);
    let reward = Math.ceil((totalValue * percentage) / 100);

    await escrowReward.updateReleaseTimestamp(currentTimestamp(), { from: multisig });
    await escrowReward.changeStateToHolding({ from: multisig });

    await escrowReward.withdrawTokensByMultisig(constants.ZERO_ADDRESS, { from: multisig });

    await escrowReward.depositRewardByMultisig(reward, { from: multisig });
    await escrowReward.depositTokensByMultisig(totalValue, { from: multisig });

    await checkUserWithdraw(sov, lockedSOV, escrowReward, userOne, 0, values, totalValue, reward);
    await checkUserWithdraw(sov, lockedSOV, escrowReward, userTwo, 1, values, totalValue, reward);
    await checkUserWithdraw(
        sov,
        lockedSOV,
        escrowReward,
        userThree,
        2,
        values,
        totalValue,
        reward
    );
    await checkUserWithdraw(sov, lockedSOV, escrowReward, userFour, 3, values, totalValue, reward);
    await checkUserWithdraw(sov, lockedSOV, escrowReward, userFive, 4, values, totalValue, reward);
}

/**
 * Function to create Escrow Reward.
 *
 * @param {*} lockedSOV
 * @param {*} sov
 * @param {*} multisig
 * @param {*} releaseTime
 * @param {*} depositLimit
 * @param {*} creator
 * @returns
 */
async function createEscrowReward(lockedSOV, sov, multisig, releaseTime, depositLimit, creator) {
    // Creating the contract instance.
    let escrowReward = await EscrowReward.new(
        lockedSOV.address,
        sov.address,
        multisig,
        releaseTime,
        depositLimit,
        { from: creator }
    );

    // Marking the contract as active.
    await escrowReward.init({ from: multisig });

    // Adding the contract as an admin in the lockedSOV.
    await lockedSOV.addAdmin(escrowReward.address, { from: multisig });

    return escrowReward;
}

contract("Escrow Rewards (State)", (accounts) => {
    let escrowReward, newEscrowReward, sov, lockedSOV;
    let creator, multisig, newMultisig, safeVault, userOne, userTwo, userThree, userFour, userFive;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Checking if we have enough accounts to test.
        assert.isAtLeast(
            accounts.length,
            9,
            "At least 9 accounts are required to test the contracts."
        );
        [
            creator,
            multisig,
            newMultisig,
            safeVault,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
        ] = accounts;

        // Creating the instance of SOV Token.
        sov = await SOV.new("Sovryn", "SOV", 18, zero);

        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(sov.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        // Creating the FeeSharing Instance.
        feeSharingCollectorProxy = await FeeSharingCollectorProxy.new(
            constants.ZERO_ADDRESS,
            staking.address
        );

        // Creating the Vesting Instance.
        vestingLogic = await VestingLogic.new();
        vestingFactory = await VestingFactory.new(vestingLogic.address);
        vestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            sov.address,
            staking.address,
            feeSharingCollectorProxy.address,
            creator // This should be Governance Timelock Contract.
        );
        vestingFactory.transferOwnership(vestingRegistry.address);

        // Creating the instance of newLockedSOV Contract.
        lockedSOV = await LockedSOV.new(sov.address, vestingRegistry.address, cliff, duration, [
            multisig,
        ]);

        // Creating the contract instance.
        escrowReward = await createEscrowReward(lockedSOV, sov, multisig, zero, depositLimit);

        /// @dev Minting, approval calculation moved here for optimization
        await sov.mint(userOne, infiniteTokens);
        await sov.mint(userTwo, infiniteTokens);
        await sov.mint(userThree, infiniteTokens);
        await sov.mint(userFour, infiniteTokens);
        await sov.mint(userFive, infiniteTokens);
        await sov.approve(escrowReward.address, infiniteTokens, { from: userOne });
        await sov.approve(escrowReward.address, infiniteTokens, { from: userTwo });
        await sov.approve(escrowReward.address, infiniteTokens, { from: userThree });
        await sov.approve(escrowReward.address, infiniteTokens, { from: userFour });
        await sov.approve(escrowReward.address, infiniteTokens, { from: userFive });

        await sov.mint(multisig, infiniteTokens);
        await sov.approve(escrowReward.address, infiniteTokens, { from: multisig });
    }

    before("Initiating Accounts & Creating Test Token Instance.", async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    it("Creating an instance should set all the values correctly.", async () => {
        let timestamp = currentTimestamp() + 1000;
        newEscrowReward = await EscrowReward.new(
            lockedSOV.address,
            sov.address,
            multisig,
            timestamp,
            depositLimit,
            {
                from: creator,
            }
        );
        await checkStatus(
            newEscrowReward,
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            creator,
            zero,
            timestamp,
            depositLimit,
            zero,
            sov.address,
            lockedSOV.address,
            multisig,
            zero,
            zero,
            deployedStatus
        );
        await newEscrowReward.init({ from: multisig });
    });

    it("Calling the init() should update the contract status to Deposit.", async () => {
        await checkStatus(
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
        await newEscrowReward.updateMultisig(newMultisig, { from: multisig });
        await checkStatus(
            newEscrowReward,
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
        await checkStatus(
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
        await newEscrowReward.updateDepositLimit(value, { from: newMultisig });
        await checkStatus(
            newEscrowReward,
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
        await newEscrowReward.updateDepositLimit(value, { from: newMultisig });
        await sov.mint(userOne, value);
        await sov.approve(newEscrowReward.address, value, { from: userOne });
        await newEscrowReward.depositTokens(value, { from: userOne });
        await checkStatus(
            newEscrowReward,
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

        let [beforeUserTokenBalance] = await getTokenBalances(userOne, sov, lockedSOV);
        await escrowReward.depositTokens(value, { from: userOne });
        let [afterUserTokenBalance] = await getTokenBalances(userOne, sov, lockedSOV);

        assert(
            beforeUserTokenBalance.eq(afterUserTokenBalance.add(new BN(limit))),
            "The user SOV balance is not right."
        );
        await checkStatus(
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
        let value = randomValue() + 1;

        await sov.mint(userTwo, value);
        await sov.approve(escrowReward.address, value, { from: userTwo });
        let [beforeUserTokenBalance] = await getTokenBalances(userTwo, sov, lockedSOV);
        await escrowReward.depositTokens(value, { from: userTwo });
        let [afterUserTokenBalance] = await getTokenBalances(userTwo, sov, lockedSOV);

        assert(
            beforeUserTokenBalance.eq(afterUserTokenBalance),
            "The userTwo SOV balance is not right."
        );
    });

    it("Changing the contract to Holding State should update the contract state.", async () => {
        await escrowReward.changeStateToHolding({ from: multisig });
        await checkStatus(
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
        let totalValue = await sov.balanceOf(escrowReward.address);

        await escrowReward.withdrawTokensByMultisig(safeVault, { from: multisig });
        let [contractBalance] = await getTokenBalances(escrowReward.address, sov, lockedSOV);
        assert.equal(contractBalance, zero, "Contract SOV Token balance should be zero.");
        let [safeVaultBalance] = await getTokenBalances(safeVault, sov, lockedSOV);
        assert(safeVaultBalance.eq(totalValue), "SafeVault SOV Token balance is not correct.");
    });

    it("Multisig token deposit should change the contract state to Withdraw.", async () => {
        let value = await sov.balanceOf(safeVault);
        let totalValueOne = Math.ceil(value / 2);
        let totalValueTwo = Math.floor(value / 2);

        await sov.mint(multisig, value);
        await sov.approve(escrowReward.address, value, { from: multisig });
        await escrowReward.depositTokensByMultisig(totalValueOne, { from: multisig });

        await checkStatus(
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
        let [contractBalance] = await getTokenBalances(escrowReward.address, sov, lockedSOV);
        assert.equal(contractBalance, totalValueOne, "Contract SOV Token balance is not correct.");

        await escrowReward.depositTokensByMultisig(totalValueTwo, { from: multisig });

        await checkStatus(
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
        [contractBalance] = await getTokenBalances(escrowReward.address, sov, lockedSOV);
        assert(contractBalance.eq(value), "Contract SOV Token balance is not correct.");
    });

    it("Updating the Reward Token Address should update the contract state.", async () => {
        let newLockedSOV = await LockedSOV.new(
            sov.address,
            vestingRegistry.address,
            cliff,
            duration,
            [multisig]
        );
        await escrowReward.updateLockedSOV(newLockedSOV.address, { from: multisig });
        checkStatus(
            escrowReward,
            [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
            zeroAddress,
            zero,
            zero,
            zero,
            zero,
            zeroAddress,
            newLockedSOV.address,
            zeroAddress,
            zero,
            zero,
            zero
        );
    });

    it("Multisig reward token deposit should update the contract state.", async () => {
        let reward = randomValue() + 1;
        await sov.mint(newMultisig, reward);
        await sov.approve(newEscrowReward.address, reward, { from: newMultisig });
        await newEscrowReward.depositRewardByMultisig(reward, { from: newMultisig });
        await checkStatus(
            newEscrowReward,
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
        await loadFixture(deploymentAndInitFixture);
        await sovAndRewardWithdraw(
            sov,
            lockedSOV,
            escrowReward,
            multisig,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
            percentage
        );
    });

    it("SOV and Reward (0.01%) withdraw should update the contract state.", async () => {
        let percentage = 0.01;
        await loadFixture(deploymentAndInitFixture);
        await sovAndRewardWithdraw(
            sov,
            lockedSOV,
            escrowReward,
            multisig,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
            percentage
        );
    });

    it("SOV and Reward (0.1%) withdraw should update the contract state.", async () => {
        let percentage = 0.1;
        await loadFixture(deploymentAndInitFixture);
        await sovAndRewardWithdraw(
            sov,
            lockedSOV,
            escrowReward,
            multisig,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
            percentage
        );
    });

    it("SOV and Reward (1%) withdraw should update the contract state.", async () => {
        let percentage = 1;
        await loadFixture(deploymentAndInitFixture);
        await sovAndRewardWithdraw(
            sov,
            lockedSOV,
            escrowReward,
            multisig,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
            percentage
        );
    });

    it("SOV and Reward (10%) withdraw should update the contract state.", async () => {
        let percentage = 10;
        await loadFixture(deploymentAndInitFixture);
        await sovAndRewardWithdraw(
            sov,
            lockedSOV,
            escrowReward,
            multisig,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
            percentage
        );
    });

    it("SOV and Reward (50%) withdraw should update the contract state.", async () => {
        let percentage = 50;
        await loadFixture(deploymentAndInitFixture);
        await sovAndRewardWithdraw(
            sov,
            lockedSOV,
            escrowReward,
            multisig,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
            percentage
        );
    });

    it("SOV and Reward (100%) withdraw should update the contract state.", async () => {
        let percentage = 100;
        await loadFixture(deploymentAndInitFixture);
        await sovAndRewardWithdraw(
            sov,
            lockedSOV,
            escrowReward,
            multisig,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
            percentage
        );
    });

    it("SOV and Reward (200%) withdraw should update the contract state.", async () => {
        let percentage = 200;
        await loadFixture(deploymentAndInitFixture);
        await sovAndRewardWithdraw(
            sov,
            lockedSOV,
            escrowReward,
            multisig,
            userOne,
            userTwo,
            userThree,
            userFour,
            userFive,
            percentage
        );
    });
});
