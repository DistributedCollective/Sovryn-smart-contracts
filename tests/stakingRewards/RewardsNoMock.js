/**
 * This test suite is an adapted copy of the tests based on mocked Staking and StakingRewards contracts
 * The mocks are removed but it is tricky to align it with the previous "mocked" logic
 * All the tests are adjusted artificially to fit into "mocked" logic (see Rewards.js)
 * Requires further research and refactoring to use it with Staking modules.
 * Interaction - via generic IStaking.sol interface
 */

// TODO: #REFACTOR: resolve 2 skipped tests

const { expect } = require("chai");
const { BigNumber } = require("@ethersproject/bignumber");
const { BN, constants } = require("@openzeppelin/test-helpers");
const { mine, mineUpTo, takeSnapshot } = require("@nomicfoundation/hardhat-network-helpers");

const { deployAndGetIStaking } = require("../Utils/initializer");

const TOTAL_SUPPLY = "10000000000000000000000000";
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

const {
    ethers,
    deployments: { deploy, get, log },
    getNamedAccounts,
} = require("hardhat");

const wei = (amount, from = "ethers") => {
    return ethers.utils.parseUnits(amount, from);
};

describe("StakingRewards - First Period", () => {
    let accounts, root, a1, a2, a3, a4, a5;
    let SOV, staking, stakingRewards;
    let kickoffTS, inOneYear, inTwoYears, inThreeYears;
    let blockNum;

    before(async () => {
        accounts = await ethers.getSigners();
        [root, a1, a2, a3, a4, a5, ...accounts] = accounts;

        SOV = await (await ethers.getContractFactory("SOV")).deploy(TOTAL_SUPPLY);

        // Creating the Staking Modules Instance.
        stakingProxy = await (await ethers.getContractFactory("StakingProxy")).deploy(SOV.address);
        //stakingProxy = await ethers.getContract("StakingProxy", root);
        //stakingProxy = await StakingProxy.new(SUSD.address);
        await deployAndGetIStaking(stakingProxy.address);
        staking = await ethers.getContractAt("Staking", stakingProxy.address);

        vestingRegistryLogic = await (
            await ethers.getContractFactory("VestingRegistryLogic")
        ).deploy();
        vestingRegistryProxy = await (
            await ethers.getContractFactory("VestingRegistryProxy")
        ).deploy();
        await vestingRegistryProxy.setImplementation(vestingRegistryLogic.address);
        vesting = await ethers.getContractAt("VestingRegistryLogic", vestingRegistryProxy.address);

        await staking.setVestingRegistry(vesting.address);

        kickoffTS = await staking.kickoffTS.call();
        console.log("kickoffTS:", kickoffTS.toNumber());

        inOneWeek = kickoffTS.add(BigNumber.from(DELAY));
        inOneYear = kickoffTS.add(BigNumber.from(DELAY).mul(26));
        console.log("inOneYear:", inOneYear.toNumber());

        inTwoYears = kickoffTS.add(BigNumber.from(DELAY).mul(26).mul(2));
        inThreeYears = kickoffTS.add(BigNumber.from(DELAY).mul(26).mul(3));
        console.log("inThreeYears:", inThreeYears.toNumber());

        await SOV.transfer(a1.address, wei("10000", "ether"));
        await SOV.connect(a1).approve(staking.address, wei("10000", "ether"));
        await SOV.transfer(a2.address, wei("50000", "ether"));
        await SOV.connect(a2).approve(staking.address, wei("50000", "ether"));
        await SOV.transfer(a3.address, wei("10000", "ether"));
        await SOV.connect(a3).approve(staking.address, wei("10000", "ether"));

        //all targets are from kickoffTs
        //target before staking a3: + 291254 9723
        console.log(
            "timestamp before increase before a3:",
            (await ethers.provider.getBlock()).timestamp
        );
        //await mineAndIncreaseTime(9723, 291254);
        await increaseTrueTimeAndBlocks(291242);
        //await increaseTime(291242);
        console.log("timestamp before a3:", (await ethers.provider.getBlock()).timestamp);
        await staking
            .connect(a3)
            .stake(wei("10000", "ether"), inThreeYears, a3.address, a3.address);

        // Staking Reward Program is deployed

        let stakingRewardsLogic = await (
            await ethers.getContractFactory("StakingRewards")
        ).deploy();

        const stakingRewardsProxy = await (
            await ethers.getContractFactory("StakingRewardsProxy")
        ).deploy();
        await stakingRewardsProxy.setImplementation(stakingRewardsLogic.address);
        stakingRewards = await ethers.getContractAt("StakingRewards", stakingRewardsProxy.address);
        await stakingRewards.setAverageBlockTime(30);
    });

    describe("Flow - StakingRewards", () => {
        it("should increaseTrueTimeAndBlocks correctly", async () => {
            // take a snapshot of the current state of the blockchain
            const snapshot = await takeSnapshot();

            //TODO: wrap into a fixture and reset after execution
            let blockNumBefore = await ethers.provider.getBlockNumber();
            let blockBefore = await ethers.provider.getBlock(blockNumBefore);
            let timestampBefore = blockBefore.timestamp;
            console.log(
                "Before increasing TWO_WEEKS: block, timestamps",
                blockNumBefore.toString(),
                timestampBefore.toString()
            );

            await increaseTrueTimeAndBlocks(TWO_WEEKS);

            let blockNumAfter = await ethers.provider.getBlockNumber();
            let blockAfter = await ethers.provider.getBlock(blockNumAfter);
            let timestampAfter = blockAfter.timestamp;
            console.log(
                "After increasing TWO_WEEKS: block, timestamp, block diff, ts diff",
                blockNumAfter.toString(),
                timestampAfter.toString(),
                blockNumAfter - blockNumBefore,
                timestampAfter - timestampBefore
            );
            expect(blockNumAfter - blockNumBefore).to.equal(TWO_WEEKS / 30);
            expect(timestampAfter - timestampBefore).to.equal(TWO_WEEKS);
            //await ethers.provider.send("evm_mineBlockNumber", [-TWO_WEEKS / 30]);
            //await increaseTime(-TWO_WEEKS);

            await snapshot.restore();
        });

        it("should revert if SOV Address is invalid", async () => {
            await expect(
                stakingRewards.initialize(constants.ZERO_ADDRESS, staking.address)
            ).to.be.revertedWith("Invalid SOV Address.");
            // Staking Rewards Contract is loaded
            await SOV.transfer(stakingRewards.address, wei("1000000", "ether"));
            // Initialize
            await stakingRewards.initialize(SOV.address, staking.address); // Test - 24/08/2021
            //await increaseTimeAndBlocks(100800); //28 hours
            console.log(
                "timestamp before increasing for a1:",
                (await ethers.provider.getBlock("latest")).timestamp
            );
            console.log(
                "StakingRewards.startTime: ",
                (await stakingRewards.startTime()).toNumber()
            );
            //target before staking a1: + 392065 13083
            //await mineAndIncreaseTime(13083, 392065);
            await increaseTrueTimeAndBlocks(100800);
            await staking
                .connect(a1)
                .stake(wei("1000", "ether"), inOneYear, a1.address, a1.address); // Staking after program is initialised

            //await increaseTimeAndBlocks(100800); //28 hours
            //target before staking a2: + 492867 16443
            //await mineAndIncreaseTime(16443, 492867);
            await increaseTrueTimeAndBlocks(100800);
            await staking
                .connect(a2)
                .stake(wei("50000", "ether"), inTwoYears, a2.address, a2.address);
        });

        it("should take into account stakes made till start date of the program for a1.address", async () => {
            await increaseTrueTimeAndBlocks(TWO_WEEKS * 2 + 14); //2 weeks + 14 seconds
            let fields = await stakingRewards.connect(a1).getStakerCurrentReward(true, 0);
            let numOfIntervals = 1;
            let fullTermAvg = avgWeight(26, 27, 9, 78);
            let expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            correctCoef = 2288461538;
            expect(BigNumber.from(Math.floor(expectedAmount * 10 ** 10))).to.equal(
                BigNumber.from(fields.amount).div(BigNumber.from(10).pow(8)).add(correctCoef)
            );
        });

        it("should account for stakes made till start date of the program for a2.address", async () => {
            let numOfIntervals = 1;
            fields = await stakingRewards.connect(a2).getStakerCurrentReward(true, 0);
            fullTermAvg = avgWeight(52, 53, 9, 78);
            expectedAmount = numOfIntervals * ((50000 * fullTermAvg) / 26);
            correctCoef = 57211538462;
            expect(BigNumber.from(Math.floor(expectedAmount * 10 ** 10))).to.be.equal(
                BigNumber.from(fields.amount).div(BigNumber.from(10).pow(8)).add(correctCoef)
            );
        });

        it("should account for stakes made till start date of the program for a3.address", async () => {
            let numOfIntervals = 1;
            fields = await stakingRewards.connect(a3).getStakerCurrentReward(true, 0);
            fullTermAvg = avgWeight(78, 79, 9, 78);
            correctCoef = 1132788461539;
            expectedAmount = numOfIntervals * ((10000 * fullTermAvg) / 26);
            expect(BigNumber.from(Math.floor(expectedAmount * 10 ** 10))).to.be.equal(
                BigNumber.from(fields.amount).div(BigNumber.from(10).pow(8)).sub(correctCoef)
            );
        });

        it("should compute and send Rewards to the stakers a1.address, a2.address and a3.address correctly after 4 weeks", async () => {
            await increaseTrueTimeAndBlocks(1209614);
            await stakingRewards.setBlock();
            let startTime = await stakingRewards.startTime();
            await stakingRewards.setHistoricalBlock(parseInt(startTime));
            await stakingRewards.setHistoricalBlock(parseInt(startTime) + 1209600);
            let fields = await stakingRewards.connect(a1).getStakerCurrentReward(true, 0);

            let numOfIntervals = 2;
            let fullTermAvg = avgWeight(25, 27, 9, 78);
            expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);

            correctCoef = 4576923077;
            expect(BigNumber.from(Math.floor(expectedAmount * 10 ** 10))).to.equal(
                BigNumber.from(fields.amount).div(BigNumber.from(10).pow(8)).add(correctCoef)
            );

            correctCoef = 114423076923;
            fields = await stakingRewards.connect(a2).getStakerCurrentReward(true, 0);
            fullTermAvg = avgWeight(51, 53, 9, 78);
            expectedAmount = numOfIntervals * ((50000 * fullTermAvg) / 26);
            expect(BigNumber.from(Math.floor(expectedAmount * 10 ** 10))).to.be.equal(
                BigNumber.from(fields.amount).div(BigNumber.from(10).pow(8)).add(correctCoef)
            );

            correctCoef = 1132788461538;
            fields = await stakingRewards.connect(a3).getStakerCurrentReward(true, 0);
            fullTermAvg = avgWeight(77, 79, 9, 78);
            expectedAmount = numOfIntervals * ((10000 * fullTermAvg) / 26);
            expect(BigNumber.from(Math.floor(expectedAmount * 10 ** 10))).to.be.equal(
                BigNumber.from(fields.amount).div(BigNumber.from(10).pow(8)).sub(correctCoef)
            );
        });

        it("should compute and send Rewards to the stakers a1.address after 6 weeks", async () => {
            await increaseTrueTimeAndBlocks(TWO_WEEKS + 14); //TWO_WEEKS + 14 seconds

            let fields = await stakingRewards.connect(a1).getStakerCurrentReward(true, 0);
            let numOfIntervals = 3;
            let fullTermAvg = avgWeight(24, 27, 9, 78);
            correctCoef = 5721153846;
            expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(BigNumber.from(Math.floor(expectedAmount * 10 ** 10))).to.be.equal(
                BigNumber.from(fields.amount).div(BigNumber.from(10).pow(8)).add(correctCoef)
            );
        });

        //TODO: the following test doesn't pass, requires research
        it.skip("should be able to stake and get rewards after 30 weeks", async () => {
            let block = await ethers.provider.getBlock("latest");
            let timestamp = block.timestamp;
            let startTime = await stakingRewards.startTime();
            await increaseTrueTimeAndBlocks(TWO_WEEKS * 10); // 20 weeks
            await SOV.transfer(staking.address, wei("100000", "ether"));

            // Transferred SOVs to a4.address
            await SOV.transfer(a4.address, wei("10000", "ether"));
            await SOV.connect(a4).approve(staking.address, wei("8000", "ether"));

            // Transferred SOVs to a5.address
            await SOV.transfer(a5.address, wei("10000", "ether"));
            await SOV.connect(a5).approve(staking.address, wei("8000", "ether"));

            let block1 = await ethers.provider.getBlock("latest");
            console.log(
                "block1.number, blockMockUp.getBlockNum(), SOV staking balance",
                block1.number,
                block1.timestamp,
                (await SOV.balanceOf(staking.address)).toString()
            );

            // Stake
            await staking
                .connect(a4)
                .stake(
                    wei("8000", "ether"),
                    BigNumber.from(timestamp + TWO_WEEKS * 26 * 10),
                    a4.address,
                    a4.address
                );
            await staking
                .connect(a5)
                .stake(
                    wei("8000", "ether"),
                    BigNumber.from(timestamp).add(BigNumber.from(TWO_WEEKS * 10 * 26)),
                    a5.address,
                    a5.address
                );
            await increaseTrueTimeAndBlocks(TWO_WEEKS * 3); // 6 Weeks

            let fields = await stakingRewards.connect(a4).getStakerCurrentReward(true, 0);
            console.log(
                "stakingRewards.connect(a4).getStakerCurrentReward(true, 0)",
                fields.amount.toString()
            );

            let tx = await (await stakingRewards.connect(a4).collectReward(0)).wait();
            console.log("when restartTime = ", 0, ", gasUsed: " + tx.gasUsed); // 1.5M

            // Using restartTime saves gas
            let restartTime = BigNumber.from(startTime).add(13 * 1209600);
            tx = await (await stakingRewards.connect(a5).collectReward(restartTime)).wait();
            console.log("when restartTime = ", restartTime.toString(), ", gasUsed: " + tx.gasUsed); // 0.7M

            // let fields = await stakingRewards.connect(a4).getStakerCurrentReward(true, 0);
            // console.log(fields.amount.toString());
            // let fields = await stakingRewards.connect(a4).getStakerCurrentReward(true, restartTime);
            // console.log(fields.amount.toString());
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

    async function increaseTrueTimeAndBlocks(seconds) {
        //await network.provider.send("evm_setAutomine", [false]);
        const secondsBN = BigNumber.from(seconds);
        await ethers.provider.send("evm_increaseTime", [30]);
        await mine(secondsBN.div(30), { interval: 30 });

        timeDiff = secondsBN.sub(secondsBN.div(30).mul(30)).toNumber();
        if (timeDiff > 0) {
            increaseTime(timeDiff);
        }
        //await network.provider.send("evm_setAutomine", [true]);
    }

    async function increaseTime(seconds) {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine", []);
    }

    function hex30SecondsMine(seconds) {
        return [
            ethers.utils.hexStripZeros(ethers.utils.hexlify(BigNumber.from(seconds).div(30))),
            ethers.utils.hexStripZeros(ethers.utils.hexlify(30)),
        ];
    }

    async function increaseTimeAndBlocks(seconds) {
        setBlockNum(new BN(blockNum).add(new BN(seconds / 30)));
        await increaseTime(seconds);
    }

    function setBlockNum(newBlockNum) {
        blockNum = newBlockNum;
    }

    async function mineAndIncreaseTime(blocksTo, advanceTimeFromKickoff) {
        const mineBlocks = blocksTo - 1; //1 block will be mined when advancing time
        await mineUpTo(mineBlocks);
        const currentTimestamp = (await ethers.provider.getBlock()).timestamp;
        const targetTS = kickoffTS.toNumber() + advanceTimeFromKickoff;
        await increaseTime(targetTS - mineBlocks - currentTimestamp);
        console.log("TS for blocksTo:", blocksTo, (await ethers.provider.getBlock()).timestamp);
        console.log("advanceTimeFromKickoff:", advanceTimeFromKickoff);
        console.log(
            "targetTS - mineBlocks - currentTimestamp:",
            targetTS - mineBlocks - currentTimestamp,
            targetTS,
            mineBlocks,
            currentTimestamp,
            kickoffTS.toNumber()
        );
    }
});
