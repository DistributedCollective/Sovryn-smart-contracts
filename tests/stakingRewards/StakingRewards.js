/** Speed optimized on branch hardhatTestRefactor, 2021-09-14
 * Greatest bottlenecks found at:
 * 	- should revert if contract doesn't have enough funds to reward user (4055ms)
 * 		Due to the tx => stakingRewards.collectReward
 * 			Due to call => getStakerCurrentReward (up to 2s)
 *  - initialization on before hook takes 4s.
 *
 * Total time elapsed: 34s
 * After optimization: 32s
 *
 * Other minor optimizations:
 *  - removed unused lines of code
 *  - reformatted code comments
 *
 * Notes:
 *   StakingRewards test suite takes around 30 seconds to run. Contract deployment is
 *   only performed at first step, the before hook, and never again, so fixture strategy
 *   is not applicable. Major bottleneck in this test is executing the reward calculation
 *   transactions taking around 2 seconds each one, and every test is a different staking
 *   scenario so it seems like this calculation cannot be spared.
 *
 *   Updated to use the initializer.js functions for protocol deployment.
 *   Updated to use the SOV test token from initializer.js.
 */

const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");
const { increaseTime, blockNumber } = require("../Utils/Ethereum");
const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanTokenLogic,
    getLoanToken,
    getLoanTokenLogicWrbtc,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    getPriceFeeds,
    getSovryn,
    decodeLogs,
    getSOV,
} = require("../Utils/initializer.js");

const StakingLogic = artifacts.require("StakingMockupMix");
const StakingProxy = artifacts.require("StakingProxy");
const StakingRewards = artifacts.require("StakingRewardsMockUp");
const StakingRewardsProxy = artifacts.require("StakingRewardsProxy");
const FeeSharingLogic = artifacts.require("FeeSharingLogic");
const FeeSharingProxy = artifacts.require("FeeSharingProxy");

// Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const BlockMockUp = artifacts.require("BlockMockUp");

const wei = web3.utils.toWei;

const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("StakingRewards", (accounts) => {
    let root, a1, a2, a3;
    let SOV, staking;
    let kickoffTS, inOneYear, inTwoYears, inThreeYears;
    let totalRewards;

    before(async () => {
        [root, a1, a2, a3, a4, ...accounts] = accounts;

        // Deploying sovrynProtocol w/ generic function from initializer.js
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        // Custom tokens
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        // BlockMockUp
        blockMockUp = await BlockMockUp.new();

        // Deployed Staking Functionality
        let stakingLogic = await StakingLogic.new(SOV.address);
        staking = await StakingProxy.new(SOV.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address); // Test - 01/07/2021

        // FeeSharingProxy
        let feeSharingLogic = await FeeSharingLogic.new();
        feeSharingProxyObj = await FeeSharingProxy.new(sovryn.address, staking.address);
        await feeSharingProxyObj.setImplementation(feeSharingLogic.address);
        feeSharingProxy = await FeeSharingLogic.at(feeSharingProxyObj.address);
        await staking.setFeeSharing(feeSharingProxy.address);

        //Upgradable Vesting Registry
        vestingRegistryLogic = await VestingRegistryLogic.new();
        vesting = await VestingRegistryProxy.new();
        await vesting.setImplementation(vestingRegistryLogic.address);
        vesting = await VestingRegistryLogic.at(vesting.address);

        await staking.setVestingRegistry(vesting.address);

        kickoffTS = await staking.kickoffTS.call();
        inOneWeek = kickoffTS.add(new BN(DELAY));
        inOneYear = kickoffTS.add(new BN(DELAY * 26));
        inTwoYears = kickoffTS.add(new BN(DELAY * 26 * 2));
        inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));

        // Transferred SOVs to a1
        await SOV.transfer(a1, wei("10000", "ether"));
        await SOV.approve(staking.address, wei("10000", "ether"), { from: a1 });

        // Transferred SOVs to a2
        await SOV.transfer(a2, wei("10000", "ether"));
        await SOV.approve(staking.address, wei("10000", "ether"), { from: a2 });

        // Transferred SOVs to a3
        await SOV.transfer(a3, wei("10000", "ether"));
        await SOV.approve(staking.address, wei("10000", "ether"), { from: a3 });

        // Transferred SOVs to a4
        await SOV.transfer(a4, wei("10000", "ether"));
        await SOV.approve(staking.address, wei("10000", "ether"), { from: a4 });

        await staking.stake(wei("1000", "ether"), inOneYear, a1, a1, { from: a1 }); // Test - 15/07/2021
        await staking.stake(wei("1000", "ether"), inTwoYears, a2, a2, { from: a2 }); // Test - 15/07/2021
        await staking.stake(wei("1000", "ether"), inThreeYears, a3, a3, { from: a3 });
        await staking.stake(wei("1000", "ether"), inThreeYears, a4, a4, { from: a4 });

        let latest = await blockNumber();
        let blockNum = new BN(latest).add(new BN(1295994 / 30));
        await blockMockUp.setBlockNum(blockNum);
        await increaseTime(291242);

        // Staking Reward Program is deployed
        let stakingRewardsLogic = await StakingRewards.new();
        stakingRewards = await StakingRewardsProxy.new();
        await stakingRewards.setImplementation(stakingRewardsLogic.address);
        stakingRewards = await StakingRewards.at(stakingRewards.address); //Test - 12/08/2021
        stakingRewards.setAverageBlockTime(30);
        await stakingRewards.setBlockMockUpAddr(blockMockUp.address);
        await staking.setBlockMockUpAddr(blockMockUp.address);
    });

    describe("Flow - StakingRewards", () => {
        it("should revert if SOV Address is not a contract address", async () => {
            await expectRevert(
                stakingRewards.initialize(a3, staking.address),
                "_SOV not a contract"
            );
        });

        it("should revert if SOV Address is invalid", async () => {
            await expectRevert(
                stakingRewards.initialize(constants.ZERO_ADDRESS, staking.address),
                "Invalid SOV Address."
            );
            // Staking Rewards Contract is loaded
            await SOV.transfer(stakingRewards.address, wei("1000000", "ether"));
            // Initialize
            await stakingRewards.initialize(SOV.address, staking.address);
        });

        it("should revert if rewards are claimed before completion of two weeks from start date", async () => {
            await expectRevert(stakingRewards.collectReward(0, { from: a2 }), "no valid reward");
        });

        it("should compute and send rewards to the stakers a1, a2 and a3 correctly after 2 weeks", async () => {
            await increaseTimeAndBlocks(1295994);

            let fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 });
            let numOfIntervals = 1;
            let fullTermAvg = avgWeight(26, 27, 9, 78);
            let expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );

            fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            fullTermAvg = avgWeight(52, 53, 9, 78);
            expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );

            fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a3 });
            fullTermAvg = avgWeight(78, 79, 9, 78);
            expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );
        });

        it("should compute and send rewards to the stakers a1, a2 and a3 correctly after 4 weeks", async () => {
            await increaseTimeAndBlocks(1295994);

            let fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 });
            let numOfIntervals = 2;
            let fullTermAvg = avgWeight(25, 27, 9, 78);
            expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );

            fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            fullTermAvg = avgWeight(51, 53, 9, 78);
            expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );

            fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a3 });
            fullTermAvg = avgWeight(77, 79, 9, 78);
            expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );
        });

        it("should compute send rewards to the staker including added staking", async () => {
            await increaseTimeAndBlocks(86400);
            await staking.stake(wei("3000", "ether"), inTwoYears, a2, a2, { from: a2 });

            await increaseTimeAndBlocks(1209600);
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            beforeBalance = await SOV.balanceOf(a2);
            await stakingRewards.collectReward(0, { from: a2 });
            afterBalance = await SOV.balanceOf(a2);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should revert if the user tries to claim rewards early", async () => {
            await increaseTimeAndBlocks(86400); // One day
            await expectRevert(stakingRewards.collectReward(0, { from: a2 }), "no valid reward");
        });

        it("should compute and send rewards to the staker after recalculating withdrawn stake", async () => {
            await increaseTimeAndBlocks(32659200); // More than a year - first stake expires
            feeSharingProxy = await FeeSharingProxy.new(sovryn.address, staking.address);
            await staking.withdraw(wei("1000", "ether"), inTwoYears, a2, { from: a2 }); // Withdraw first stake
            await increaseTimeAndBlocks(3600);
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 }); // For entire duration
            beforeBalance = await SOV.balanceOf(a2);
            await stakingRewards.collectReward(0, { from: a2 }); // For maxDuration only
            afterBalance = await SOV.balanceOf(a2);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should consider max duration", async () => {
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a4 });
            const fieldsTotal = await stakingRewards.getStakerCurrentReward(false, 0, {
                from: a4,
            });
            expect(fieldsTotal.amount).to.be.bignumber.greaterThan(fields.amount);
        });

        it("should continue getting rewards for the staking period even after the program stops", async () => {
            await increaseTimeAndBlocks(1209600); // Second Payment - 13 days approx
            await stakingRewards.stop();
            await increaseTimeAndBlocks(3600); // Increase a few blocks
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            beforeBalance = await SOV.balanceOf(a2);
            await stakingRewards.collectReward(0, { from: a2 });
            afterBalance = await SOV.balanceOf(a2);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should compute and send rewards to the staker a3 as applicable", async () => {
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a3 }); // For entire duration
            beforeBalance = await SOV.balanceOf(a3);
            let tx = await stakingRewards.collectReward(0, { from: a3 });
            console.log("gasUsed: " + tx.receipt.gasUsed);
            afterBalance = await SOV.balanceOf(a3);
            rewards = afterBalance.sub(beforeBalance); // For maxDuration only
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should NOT pay rewards for staking after the program stops", async () => {
            await increaseTimeAndBlocks(1209600); // 2 Weeks
            await staking.stake(wei("1000", "ether"), inTwoYears, a2, a2, { from: a2 });
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            beforeBalance = await SOV.balanceOf(a2);
            await stakingRewards.collectReward(0, { from: a2 });
            afterBalance = await SOV.balanceOf(a2);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should stop getting rewards when the staking ends after the program stops", async () => {
            await increaseTimeAndBlocks(1209600); // 2 Weeks
            await staking.withdraw(wei("1000", "ether"), inTwoYears, a2, { from: a2 });
            await staking.withdraw(wei("3000", "ether"), inTwoYears, a2, { from: a2 }); // Withdraw second stake
            await increaseTimeAndBlocks(3600); // Increase a few blocks
            beforeBalance = await SOV.balanceOf(a2);
            await expectRevert(stakingRewards.collectReward(0, { from: a2 }), "no valid reward");
            afterBalance = await SOV.balanceOf(a2);
            rewards = afterBalance.sub(beforeBalance);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.equal(beforeBalance);
        });

        it("should be getting correct rewards after stopblock", async () => {
            let block = await web3.eth.getBlock("latest");
            let timestamp = block.timestamp;

            const BASE_RATE = await stakingRewards.BASE_RATE();
            const DIVISOR = await stakingRewards.DIVISOR();
            const multiplier = new BN(2);
            const MOCK_WEIGHTED_STAKE = multiplier.mul(DIVISOR).div(BASE_RATE);
            const stopBlock = await stakingRewards.stopBlock();
            const startTime = await stakingRewards.withdrawals(a2);
            const endTime = await staking.timestampToLockDate(timestamp);
            const wsIteration = endTime.sub(startTime).div(new BN(1209600 /** two weeks */));

            // Since the stake has been withdrawn, mock the current weighted stake.
            await staking.MOCK_priorWeightedStake(MOCK_WEIGHTED_STAKE.mul(new BN(multiplier)));

            await staking.MOCK_priorWeightedStakeAtBlock(
                MOCK_WEIGHTED_STAKE,
                stopBlock.toString()
            );
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            expect(fields[1].toString()).to.equal(
                multiplier.mul(wsIteration).sub(new BN(1)).toString()
            );
            await staking.MOCK_priorWeightedStakeAtBlock(0, stopBlock.toString());
        });

        it("should process for max duration at a time", async () => {
            await increaseTimeAndBlocks(7890000); // 3 Months
            await expectRevert(stakingRewards.stop(), "Already stopped");
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 }); // For entire duration
            beforeBalance = await SOV.balanceOf(a1);
            await stakingRewards.collectReward(0, { from: a1 }); // For maxDuration only
            afterBalance = await SOV.balanceOf(a1);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should be able to process again immediately when processing after the max duration", async () => {
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 });
            beforeBalance = await SOV.balanceOf(a1);
            await stakingRewards.collectReward(0, { from: a1 });
            afterBalance = await SOV.balanceOf(a1);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should revert withdraw all tokens if address is invalid", async () => {
            await expectRevert(
                stakingRewards.withdrawTokensByOwner(constants.ZERO_ADDRESS),
                "invalid transfer"
            );
        });

        it("should revert withdraw all tokens if sender isn't the owner", async () => {
            await expectRevert(
                stakingRewards.withdrawTokensByOwner(a3, { from: a3 }),
                "unauthorized"
            );
        });

        it("should withdraw all tokens", async () => {
            beforeBalance = await SOV.balanceOf(a3);
            await stakingRewards.withdrawTokensByOwner(a3);
            afterBalance = await SOV.balanceOf(a3);
            let amount = new BN(wei("1000000", "ether")).sub(totalRewards);
            expect(afterBalance.sub(beforeBalance)).to.be.bignumber.equal(amount);
        });

        it("should revert while withdrawing 0 amount", async () => {
            await expectRevert(stakingRewards.withdrawTokensByOwner(a3), "amount invalid");
        });

        it("should revert if contract doesn't have enough funds to reward user", async () => {
            await increaseTimeAndBlocks(1209600); // 2 Weeks

            /// @dev Optimization: Following tx takes 4s to execute on a standard laptop!
            await expectRevert(
                stakingRewards.collectReward(0, { from: a3 }),
                "not enough funds to reward user"
            );
        });

        it("should revert if sender is a ZERO Address", async () => {
            await expectRevert(
                stakingRewards.collectReward(0, { from: constants.ZERO_ADDRESS }),
                "unknown account 0x0000000000000000000000000000000000000000"
            );
        });
    });

    function avgWeight(from, to, maxWeight, maxDuration) {
        let weight = 0;
        for (let i = from; i < to; i++) {
            weight += Math.floor(
                ((maxWeight * (maxDuration ** 2 - (maxDuration - i) ** 2)) / maxDuration ** 2 +
                    1) *
                    10,
                2
            );
        }
        weight /= to - from;
        return (weight / 100) * 0.2975;
    }

    async function increaseTimeAndBlocks(seconds) {
        let latest = await blockMockUp.getBlockNum();
        let blockNum = new BN(latest).add(new BN(seconds / 30));
        await blockMockUp.setBlockNum(blockNum);
        await increaseTime(seconds);
    }
});
