/** Speed optimized on branch hardhatTestRefactor, 2021-09-30
 * No bottlenecks found.
 *
 * Total time elapsed: 5.6s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes:
 *   Updated to spare the protocol deployment. Tests don't need it.
 */

//TODO: #REFACTOR this contract needs refactoring - remove mock contracts and use it with Staking modules.
//Interaction - via IStaking.sol interface

const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");
const { increaseTime, blockNumber } = require("../Utils/Ethereum");
const { deployAndGetIStaking, getStakingModulesWithBlockMockup } = require("../Utils/initializer");
const { takeSnapshot, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const sov_ABI = artifacts.require("SOV");
const StakingProxy = artifacts.require("StakingProxy");
const OsSOV = artifacts.require("OsSOV");
const StakingRewards = artifacts.require("StakingRewardsOsMockUp");
const StakingRewardsProxy = artifacts.require("StakingRewardsOsProxy");
const IStakingModuleBlockMockup = artifacts.require("IStakingModuleBlockMockup");

// Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const BlockMockUp = artifacts.require("BlockMockUp");

const wei = web3.utils.toWei;

const TOTAL_SUPPLY = "10000000000000000000000000";
const TWO_WEEKS = 1209600;
const TWO_WEEKS_ADD_14 = TWO_WEEKS + 14;
const DELAY = TWO_WEEKS;

const {
    ethers,
    deployments: { createFixture, get, deploy },
} = hre;

contract("StakingRewardsOs - First Period", (accounts) => {
    let root, a1, a2, a3, a4, a5;
    let sov, osSOV, staking, blockMockUp, stakingRewards;
    let kickoffTS, inOneYear, inTwoYears, inThreeYears;
    let snapshot;
    // const setupTest = createFixture(async ({ deployments, getNamedAccounts }) => {
    //     await deployments.fixture(["StakingRewardsOs", "OsSOV"]);

    // });
    //  beforeEach(async () => {
    //      await loadFixture(setupTest);
    //  });
    before(async () => {
        // we need to take snapshot and then revert time travelling after these tests so that the next tests would work correctly
        snapshot = await takeSnapshot();
        [root, a1, a2, a3, a4, a5, ...accounts] = accounts;
        sov = await sov_ABI.new(TOTAL_SUPPLY);

        // BlockMockUp
        blockMockUp = await BlockMockUp.new();

        // Deployed Staking Functionality
        const stakingProxy = await StakingProxy.new(sov.address);
        iStaking = await deployAndGetIStaking(
            stakingProxy.address,
            await getStakingModulesWithBlockMockup()
        );
        staking = await IStakingModuleBlockMockup.at(iStaking.address); // applying extended mockup interface

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
        await sov.transfer(a1, wei("10000", "ether"));
        await sov.approve(staking.address, wei("10000", "ether"), { from: a1 });

        // Transferred SOVs to a2
        await sov.transfer(a2, wei("50000", "ether"));
        await sov.approve(staking.address, wei("50000", "ether"), { from: a2 });

        // Transferred SOVs to a3
        await sov.transfer(a3, wei("10000", "ether"));
        await sov.approve(staking.address, wei("10000", "ether"), { from: a3 });

        let latest = await blockNumber();
        let blockNum = new BN(latest).add(new BN(291242 / 30));
        await blockMockUp.setBlockNum(blockNum);
        await increaseTime(291242);
        await staking.stake(wei("10000", "ether"), inThreeYears, a3, a3, { from: a3 });

        // Staking Reward Program is deployed
        //await deployments.fixture(["OsSOV"]);

        let stakingRewardsLogic = await StakingRewards.new();
        stakingRewardsProxy = await StakingRewardsProxy.new();
        await stakingRewardsProxy.setImplementation(stakingRewardsLogic.address);
        stakingRewards = await StakingRewards.at(stakingRewardsProxy.address);
        await stakingRewards.setBlockMockUpAddr(blockMockUp.address);
        await staking.setBlockMockUpAddr(blockMockUp.address);

        osSOV = await OsSOV.new();
        await osSOV.setAuthorisedMinterRole(stakingRewards.address);

        await expectRevert(
            stakingRewards.initialize(constants.ZERO_ADDRESS, staking.address, 30),
            "Invalid OsSOV Address"
        );
        await expectRevert(
            stakingRewards.initialize(a1, staking.address, 30),
            "OsSOV is not a contract"
        );
        // Staking Rewards Contract is loaded
        //await sov.transfer(stakingRewards.address, wei("1000000", "ether"));
        // Initialize
        await stakingRewards.initialize(osSOV.address, staking.address, 30);

        await increaseTimeAndBlocks(100800); //28 hours, 3360 blocks (30 seconds per block)
        await staking.stake(wei("1000", "ether"), inOneYear, a1, a1, { from: a1 }); // Staking after program is initialised
        await increaseTimeAndBlocks(100800); //28 hours, 3360 blocks (30 seconds per block)
        await staking.stake(wei("50000", "ether"), inTwoYears, a2, a2, { from: a2 });
    });

    after(async () => {
        // we need to revert time travelling after these tests so that the next tests would work correctly
        await snapshot.restore();
    });

    describe("Flow - StakingRewards", () => {
        it("should account for stakes made till start date of the program for a1", async () => {
            await increaseTimeAndBlocks(TWO_WEEKS_ADD_14);

            let fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 });
            let numOfIntervals = 1;
            let fullTermAvg = avgWeight(26, 27, 9, 78);
            let expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );
        });

        it("should account for stakes made till start date of the program for a2", async () => {
            let numOfIntervals = 1;
            fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            fullTermAvg = avgWeight(52, 53, 9, 78);
            expectedAmount = numOfIntervals * ((50000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );
        });

        it("should account for stakes made till start date of the program for a3", async () => {
            let numOfIntervals = 1;
            fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a3 });
            fullTermAvg = avgWeight(78, 79, 9, 78);
            expectedAmount = numOfIntervals * ((10000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );
        });

        it("should compute and send Rewards to the stakers a1, a2 and a3 correctly after 4 weeks", async () => {
            await increaseTimeAndBlocks(TWO_WEEKS_ADD_14);
            await stakingRewards.setBlock();
            let startTime = await stakingRewards.getRewardsProgramStartTime();
            await stakingRewards.setHistoricalBlock(parseInt(startTime));
            await stakingRewards.setHistoricalBlock(parseInt(startTime) + 1209600);

            let fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 });
            let numOfIntervals = 2;
            let fullTermAvg = avgWeight(25, 27, 9, 78);
            a1ExpectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(a1ExpectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );

            fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            fullTermAvg = avgWeight(51, 53, 9, 78);
            a2ExpectedAmount = numOfIntervals * ((50000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(a2ExpectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );

            fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a3 });
            fullTermAvg = avgWeight(77, 79, 9, 78);
            a3ExpectedAmount = numOfIntervals * ((10000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(a3ExpectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );

            // claiming rewards
            let balancesBefore = {
                a2: await osSOV.balanceOf(a2),
                a3: await osSOV.balanceOf(a3),
            };
            Object.keys(balancesBefore).forEach((account) =>
                expect(balancesBefore[account]).to.be.bignumber.equal("0")
            );

            await Promise.all(
                [a2, a3].map((account) => stakingRewards.collectReward(0, { from: account }))
            );

            const [a2Balance, a3Balance] = await Promise.all(
                [a2, a3].map((account) => osSOV.balanceOf(account))
            );

            expect(new BN(Math.floor(a2ExpectedAmount * 10 ** 10))).to.be.bignumber.equal(
                a2Balance.div(new BN(10).pow(new BN(8)))
            );
            expect(new BN(Math.floor(a3ExpectedAmount * 10 ** 10))).to.be.bignumber.equal(
                a3Balance.div(new BN(10).pow(new BN(8)))
            );
        });

        it("should compute and send Rewards to the stakers a1 after 6 weeks", async () => {
            await increaseTimeAndBlocks(TWO_WEEKS_ADD_14);

            let fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 });
            let numOfIntervals = 3;
            let fullTermAvg = avgWeight(24, 27, 9, 78);
            expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                new BN(fields.amount).div(new BN(10).pow(new BN(8)))
            );

            await stakingRewards.collectReward(0, { from: a1 });
            const balance = await osSOV.balanceOf(a1);
            expect(new BN(Math.floor(expectedAmount * 10 ** 10))).to.be.bignumber.equal(
                balance.div(new BN(10).pow(new BN(8)))
            );
        });

        it("should be able to stake and get rewards after 30 weeks", async () => {
            let block = await web3.eth.getBlock("latest");
            let timestamp = block.timestamp;
            let startTime = await stakingRewards.getRewardsProgramStartTime();
            await increaseTimeAndBlocks(12096000); // 20 weeks

            // Transferred SOVs to a4
            await sov.transfer(a4, wei("10000", "ether"));
            await sov.approve(staking.address, wei("8000", "ether"), { from: a4 });

            // Transferred SOVs to a5
            await sov.transfer(a5, wei("10000", "ether"));
            await sov.approve(staking.address, wei("8000", "ether"), { from: a5 });

            // Stake
            await staking.stake(
                wei("8000", "ether"),
                new BN(timestamp).add(new BN(TWO_WEEKS * 10 * 26)),
                a4,
                a4,
                { from: a4 }
            );
            await staking.stake(
                wei("8000", "ether"),
                new BN(timestamp).add(new BN(TWO_WEEKS * 10 * 26)),
                a5,
                a5,
                { from: a5 }
            );

            await increaseTimeAndBlocks(3628800); // 6 Weeks

            let tx = await stakingRewards.collectReward(0, { from: a4 });
            console.log("when restartTime = ", 0, ", gasUsed: " + tx.receipt.gasUsed); // 2.6M

            // Using restartTime saves gas
            let restartTime = new BN(startTime).add(new BN(13 * 1209600));
            tx = await stakingRewards.collectReward(restartTime, { from: a5 });
            console.log(
                "when restartTime = ",
                restartTime.toString(),
                ", gasUsed: " + tx.receipt.gasUsed
            ); // 0.7M

            // let fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a4 });
            // console.log(fields.amount.toString());
            // let fields = await stakingRewards.getStakerCurrentReward(true, restartTime, { from: a4 });
            // console.log(fields.amount.toString());
        });
    });

    function avgWeight(from, to, maxWeight, maxDuration) {
        // 26, 27, 9, 78
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
        return (weight / 100) * 0.09; //0.09 - 9% - max reward
    }

    async function increaseTimeAndBlocks(seconds) {
        let latest = await blockMockUp.getBlockNum();
        let blockNum = new BN(latest).add(new BN(seconds / 30));
        await blockMockUp.setBlockNum(blockNum);
        await increaseTime(seconds);
    }
});
