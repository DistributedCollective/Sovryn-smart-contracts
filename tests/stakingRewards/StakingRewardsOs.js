//TODO: #REFACTOR this contract needs refactoring - remove mock contracts and use it with Staking modules.
// interaction - via generic IStaking.sol interface
const { expect } = require("chai");
const { expectRevert, BN, constants } = require("@openzeppelin/test-helpers");
const { increaseTime, blockNumber } = require("../Utils/Ethereum.js");
const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getPriceFeeds,
    getSovryn,
    getSOV,
} = require("../Utils/initializer.js");
const { takeSnapshot } = require("@nomicfoundation/hardhat-network-helpers");

const {
    deployAndGetIStaking,
    getStakingModulesWithBlockMockup,
} = require("../Utils/initializer.js");

const OsSOV = artifacts.require("OsSOV");

const StakingProxy = artifacts.require("StakingProxy");

const StakingRewards = artifacts.require("StakingRewardsOsMockUp");
const StakingRewardsProxy = artifacts.require("StakingRewardsOsProxy");
const FeeSharingCollector = artifacts.require("FeeSharingCollector");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");

// Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");
const BlockMockUp = artifacts.require("BlockMockUp");
const IStakingModuleBlockMockup = artifacts.require("IStakingModuleBlockMockup");

const wei = web3.utils.toWei;

const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("StakingRewardsOs", (accounts) => {
    let root, a1, a2, a3;
    let SOV, osSOV, staking, stakingRewards, blockMockUp;
    let kickoffTS, inOneYear, inTwoYears, inThreeYears;
    let totalRewards;

    const initStakingModules = async () => {
        const stakingProxy = await StakingProxy.new(SOV.address);
        iStaking = await deployAndGetIStaking(
            stakingProxy.address,
            await getStakingModulesWithBlockMockup()
        );

        return await IStakingModuleBlockMockup.at(iStaking.address); // applying extended mockup interface
    };

    before(async () => {
        snapshot = await takeSnapshot();
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
        staking = await initStakingModules();

        // FeeSharingCollectorProxy
        let feeSharingCollector = await FeeSharingCollector.new();
        feeSharingCollectorProxyObj = await FeeSharingCollectorProxy.new(
            sovryn.address,
            staking.address
        );
        await feeSharingCollectorProxyObj.setImplementation(feeSharingCollector.address);
        feeSharingCollectorProxy = await FeeSharingCollector.at(
            feeSharingCollectorProxyObj.address
        );
        await staking.setFeeSharing(feeSharingCollectorProxy.address);

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
        stakingRewards = await StakingRewards.at(stakingRewards.address);
        stakingRewards.setAverageBlockTime(30);
        await stakingRewards.setBlockMockUpAddr(blockMockUp.address);
        await staking.setBlockMockUpAddr(blockMockUp.address);

        //@todo add osSOV test of deployment and default admin
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
    });

    after(async () => {
        // we need to revert time travelling after these tests so that the next tests would work correctly
        await snapshot.restore();
    });

    describe("Flow - StakingRewards", () => {
        it("should revert if rewards are claimed before completion of two weeks from start date", async () => {
            await expectRevert(stakingRewards.collectReward(0, { from: a2 }), "No valid reward");
        });

        it("should compute rewards to the stakers a1, a2 and a3 correctly after 2 weeks", async () => {
            await increaseTimeAndBlocks(1295994); //~2 weeks + 1 day

            let fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 });
            let numOfIntervals = 1;
            let fullTermAvg = avgWeight(26, 27, 9, 78);
            let expectedAmount = numOfIntervals * ((1000 * fullTermAvg) / 26);
            expect(new BN(fields.amount).div(new BN(10).pow(new BN(8)))).to.be.bignumber.equal(
                new BN(Math.floor(expectedAmount * 10 ** 10))
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

        it("should compute rewards to the stakers a1, a2 and a3 correctly after 4 weeks", async () => {
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

        it("should compute and send rewards to the staker including added staking", async () => {
            await increaseTimeAndBlocks(86400);
            await staking.stake(wei("3000", "ether"), inTwoYears, a2, a2, { from: a2 });

            await increaseTimeAndBlocks(1209600);
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            beforeBalance = await osSOV.balanceOf(a2);
            expect(beforeBalance).to.be.bignumber.equal("0");
            await stakingRewards.collectReward(0, { from: a2 });
            afterBalance = await osSOV.balanceOf(a2);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            const totalRewards = await osSOV.totalSupply();
            expect(totalRewards).to.be.bignumber.equal(afterBalance);
        });

        it("should revert if the user tries to claim rewards early", async () => {
            await increaseTimeAndBlocks(86400); // One day
            await expectRevert(stakingRewards.collectReward(0, { from: a2 }), "No valid reward");
        });

        it("should compute and send rewards to the staker after recalculating withdrawn stake", async () => {
            await increaseTimeAndBlocks(32659200); // More than a year - first stake expires
            feeSharingCollectorProxy = await FeeSharingCollectorProxy.new(
                sovryn.address,
                staking.address
            );
            await staking.withdraw(wei("1000", "ether"), inTwoYears, a2, { from: a2 }); // Withdraw first stake
            await increaseTimeAndBlocks(3600);
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 }); // For entire duration
            beforeBalance = await osSOV.balanceOf(a2);
            await stakingRewards.collectReward(0, { from: a2 }); // For maxDuration only
            afterBalance = await osSOV.balanceOf(a2);
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
            beforeBalance = await osSOV.balanceOf(a2);
            await stakingRewards.collectReward(0, { from: a2 });
            afterBalance = await osSOV.balanceOf(a2);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should compute and send rewards to the staker a3 as applicable", async () => {
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a3 }); // For entire duration
            beforeBalance = await osSOV.balanceOf(a3);
            let tx = await stakingRewards.collectReward(0, { from: a3 });
            console.log("gasUsed: " + tx.receipt.gasUsed);
            afterBalance = await osSOV.balanceOf(a3);
            rewards = afterBalance.sub(beforeBalance); // For maxDuration only
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should NOT pay rewards for staking after the program stops", async () => {
            await increaseTimeAndBlocks(1209600); // 2 Weeks
            await staking.stake(wei("1000", "ether"), inTwoYears, a2, a2, { from: a2 });
            await expectRevert(
                stakingRewards.collectReward(0, { from: a2 }),
                "Entire reward already paid"
            );
        });

        it("should stop getting rewards when the staking ends after the program stops", async () => {
            await increaseTimeAndBlocks(1209600); // 2 Weeks
            await staking.withdraw(wei("1000", "ether"), inTwoYears, a2, { from: a2 });
            await staking.withdraw(wei("3000", "ether"), inTwoYears, a2, { from: a2 }); // Withdraw second stake
            await increaseTimeAndBlocks(3600); // Increase a few blocks
            beforeBalance = await osSOV.balanceOf(a2);
            await expectRevert(
                stakingRewards.collectReward(0, { from: a2 }),
                "Entire reward already paid"
            );
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a2 });
            expect(fields.amount).to.be.bignumber.equal(new BN(0));
        });

        it("should process for max duration at a time", async () => {
            await increaseTimeAndBlocks(7890000); // 3 Months
            await expectRevert(stakingRewards.stop(), "Already stopped");
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 }); // For entire duration
            beforeBalance = await osSOV.balanceOf(a1);
            await stakingRewards.collectReward(0, { from: a1 }); // For maxDuration only
            afterBalance = await osSOV.balanceOf(a1);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("should be able to process again immediately when processing after the max duration", async () => {
            const fields = await stakingRewards.getStakerCurrentReward(true, 0, { from: a1 });
            beforeBalance = await osSOV.balanceOf(a1);
            await stakingRewards.collectReward(0, { from: a1 });
            afterBalance = await osSOV.balanceOf(a1);
            rewards = afterBalance.sub(beforeBalance);
            expect(rewards).to.be.bignumber.equal(fields.amount);
            totalRewards = new BN(totalRewards).add(new BN(rewards));
            expect(afterBalance).to.be.bignumber.greaterThan(beforeBalance);
        });

        it("osSOV is non-transferable", async () => {
            await expectRevert(
                osSOV.transfer(a3, await osSOV.balanceOf(a2), { from: a2 }),
                "NonTransferable()"
            );
        });

        it("osSOV is non-approvable", async () => {
            await expectRevert(
                osSOV.approve(a3, await osSOV.balanceOf(a2), { from: a2 }),
                "NonApprovable()"
            );
        });

        it("osSOV is non-receivable", async () => {
            tx = {
                to: osSOV.address,
                value: ethers.utils.parseEther("1", "ether"),
            };
            const signer = ethers.provider.getSigner(a2);
            await expectRevert(signer.sendTransaction(tx), "NonReceivable()");
        });

        it("osSOV is 100M capped", async () => {
            expect(await osSOV.cap()).to.be.bignumber.equal(
                new BN(ethers.utils.parseEther("100000000").toString())
            );
        });

        it("osSOV - StakingRewardsOs contract is an authorised minter", async () => {
            const authMinterHash = await osSOV.AUTHORISED_MINTER_ROLE();
            expect(await osSOV.hasRole(authMinterHash, stakingRewards.address));
        });

        it("osSOV - StakingRewardsOs contract is an authorised minter", async () => {
            const authMinterHash = await osSOV.AUTHORISED_MINTER_ROLE();
            expect(await osSOV.hasRole(authMinterHash, stakingRewards.address));
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
        return (weight / 100) * 0.09;
    }

    async function increaseTimeAndBlocks(seconds) {
        let latest = await blockMockUp.getBlockNum();
        let blockNum = new BN(latest).add(new BN(seconds / 30));
        await blockMockUp.setBlockNum(blockNum);
        await increaseTime(seconds);
    }
});
