const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { increaseTime, lastBlock } = require("../Utils/Ethereum");
const { deployAndGetIStaking, initializeStakingModulesAt } = require("../Utils/initializer");
const hre = require("hardhat");
const { ethers } = hre;

const StakingLogic = artifacts.require("IStaking");
const StakingProxy = artifacts.require("StakingProxy");
const SOV = artifacts.require("SOV");
const TestWrbtc = artifacts.require("TestWrbtc");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorMockup");
const VestingLogic = artifacts.require("FourYearVestingLogic");
const Vesting = artifacts.require("FourYearVesting");
const VestingFactory = artifacts.require("FourYearVestingFactory");
//Upgradable Vesting Registry
const VestingRegistry = artifacts.require("VestingRegistryMockup");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const WEEK = new BN(7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "10000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";
const ONE_ETHER = "1000000000000000000";

const maxWithdrawIterations = 50;
const increaseTimeEthers = async (time) => {
    await ethers.provider.send("evm_increaseTime", [time]);
    await ethers.provider.send("evm_mine");
};

contract("FourYearVesting", (accounts) => {
    let root, a1, a2, a3;
    let token, staking, stakingLogic, stakingProxy, feeSharingCollectorProxy;
    let vestingLogic;
    let vestingFactory;
    let kickoffTS;

    let cliff = 4 * WEEK;
    let duration = 156 * WEEK;

    before(async () => {
        [root, a1, a2, a3, ...accounts] = accounts;
        token = await SOV.new(TOTAL_SUPPLY);
        wrbtc = await TestWrbtc.new();

        vestingLogic = await VestingLogic.new();
        vestingFactory = await VestingFactory.new();

        feeSharingCollectorProxy = await FeeSharingCollectorProxy.new(
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS
        );

        // Creating the Staking Instance (Staking Modules Interface).
        stakingProxy = await StakingProxy.new(token.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        //Upgradable Vesting Registry
        vestingRegistry = await VestingRegistry.new();
        vestingReg = await VestingRegistryProxy.new();
        await vestingReg.setImplementation(vestingRegistry.address);
        vestingReg = await VestingRegistry.at(vestingReg.address);

        console.log(`staking owner: ${await staking.owner()}`);
        await staking.setVestingRegistry(vestingReg.address);
        await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

        await token.transfer(a2, "1000");
        await token.approve(staking.address, "1000", { from: a2 });

        kickoffTS = await staking.kickoffTS.call();
    });

    describe("vestingfactory", () => {
        it("sets the expected values", async () => {
            let vestingInstance = await vestingFactory.deployFourYearVesting(
                token.address,
                staking.address,
                a1,
                feeSharingCollectorProxy.address,
                root,
                vestingLogic.address,
                52 * WEEK
            );
            vestingInstance = await VestingLogic.at(vestingInstance.logs[0].address);

            // Check data
            let _sov = await vestingInstance.SOV();
            let _stackingAddress = await vestingInstance.staking();
            let _tokenOwner = await vestingInstance.tokenOwner();
            let _cliff = await vestingInstance.cliff();
            let _duration = await vestingInstance.duration();
            let _feeSharingCollectorProxy = await vestingInstance.feeSharingCollector();
            let _extendDurationFor = await vestingInstance.extendDurationFor();

            assert.equal(_sov, token.address);
            assert.equal(_stackingAddress, staking.address);
            assert.equal(_tokenOwner, a1);
            assert.equal(_cliff.toString(), cliff);
            assert.equal(_duration.toString(), duration);
            assert.equal(_feeSharingCollectorProxy, feeSharingCollectorProxy.address);
            assert.equal(_extendDurationFor, 52 * WEEK);
        });
    });

    describe("constructor", () => {
        it("sets the expected values", async () => {
            let vestingInstance = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vestingInstance = await VestingLogic.at(vestingInstance.address);

            // Check data
            let _sov = await vestingInstance.SOV();
            let _stackingAddress = await vestingInstance.staking();
            let _tokenOwner = await vestingInstance.tokenOwner();
            let _cliff = await vestingInstance.cliff();
            let _duration = await vestingInstance.duration();
            let _feeSharingCollectorProxy = await vestingInstance.feeSharingCollector();
            let _extendDurationFor = await vestingInstance.extendDurationFor();

            assert.equal(_sov, token.address);
            assert.equal(_stackingAddress, staking.address);
            assert.equal(_tokenOwner, root);
            assert.equal(_cliff.toString(), cliff);
            assert.equal(_duration.toString(), duration);
            assert.equal(_feeSharingCollectorProxy, feeSharingCollectorProxy.address);
            assert.equal(_extendDurationFor, 52 * WEEK);
        });

        it("fails if the 0 address is passed as SOV address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    constants.ZERO_ADDRESS,
                    staking.address,
                    root,
                    feeSharingCollectorProxy.address,
                    52 * WEEK
                ),
                "SOV address invalid"
            );
        });

        it("fails if the 0 address is passed as token owner address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    staking.address,
                    constants.ZERO_ADDRESS,
                    feeSharingCollectorProxy.address,
                    52 * WEEK
                ),
                "token owner address invalid"
            );
        });

        it("fails if the 0 address is passed as staking address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    constants.ZERO_ADDRESS,
                    root,
                    feeSharingCollectorProxy.address,
                    52 * WEEK
                ),
                "staking address invalid"
            );
        });

        it("fails if the 0 address is passed as feeSharingCollectorProxy address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    staking.address,
                    root,
                    constants.ZERO_ADDRESS,
                    52 * WEEK
                ),
                "feeSharingCollector address invalid"
            );
        });

        it("fails if logic is not a contract address", async () => {
            await expectRevert(
                Vesting.new(
                    a1,
                    token.address,
                    staking.address,
                    a1,
                    feeSharingCollectorProxy.address,
                    52 * WEEK
                ),
                "_logic not a contract"
            );
        });

        it("fails if SOV is not a contract address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    a1,
                    staking.address,
                    a1,
                    feeSharingCollectorProxy.address,
                    52 * WEEK
                ),
                "_SOV not a contract"
            );
        });

        it("fails if staking address is not a contract address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    a1,
                    a1,
                    feeSharingCollectorProxy.address,
                    52 * WEEK
                ),
                "_stakingAddress not a contract"
            );
        });

        it("fails if fee sharing is not a contract address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    staking.address,
                    a1,
                    a1,
                    52 * WEEK
                ),
                "_feeSharingCollector not a contract"
            );
        });

        it("fails if extendDurationFor is not rounding to month", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    staking.address,
                    a1,
                    feeSharingCollectorProxy.address,
                    6 * WEEK
                ),
                "invalid duration"
            );
        });
    });

    describe("delegate", () => {
        let vesting;
        it("should stake tokens and delegate voting power", async () => {
            let toStake = ONE_MILLON;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a2,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }

            // check delegatee
            let data = await staking.getStakes.call(vesting.address);
            /// @dev Optimization: This loop through 40 steps is a bottleneck
            for (let i = 0; i < data.dates.length; i++) {
                let delegatee = await staking.delegates(vesting.address, data.dates[i]);
                expect(delegatee).equal(a2);
            }

            // delegate
            let tx = await vesting.delegate(a1, { from: a2 });

            expectEvent(tx, "VotesDelegated", {
                caller: a2,
                delegatee: a1,
            });

            // check new delegatee
            data = await staking.getStakes.call(vesting.address);
            /// @dev Optimization: This loop through 40 steps is a bottleneck
            for (let i = 0; i < data.dates.length; i++) {
                let delegatee = await staking.delegates(vesting.address, data.dates[i]);
                expect(delegatee).equal(a1);
            }
        });

        it("fails if delegatee is zero address", async () => {
            await expectRevert(
                vesting.delegate(constants.ZERO_ADDRESS, { from: a2 }),
                "delegatee address invalid"
            );
        });

        it("fails if not a token owner", async () => {
            await expectRevert(vesting.delegate(a1, { from: a1 }), "unauthorized");
        });
    });

    describe("stakeTokens", () => {
        // Check random scenarios
        let vesting;
        it("should stake 1,000,000 SOV with a duration of 156 weeks and a 4 week cliff", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await token.approve(vesting.address, ONE_MILLON);
            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                let tx = await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                expectEvent(tx, "TokensStaked");
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }

            // check delegatee
            let data = await staking.getStakes.call(vesting.address);
            for (let i = 0; i < data.dates.length; i++) {
                let delegatee = await staking.delegates(vesting.address, data.dates[i]);
                expect(delegatee).equal(root);
            }
        });

        it("should stake 1,000,000 SOV with a duration of 156 weeks and a 4 week cliff", async () => {
            let block = await lastBlock();
            let timestamp = parseInt(block.timestamp);

            let kickoffTS = await staking.kickoffTS();

            let start = timestamp + 4 * WEEK;
            let end = timestamp + 156 * WEEK;

            let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
            let stakedPerInterval = ONE_MILLON / numIntervals;

            // positive case
            for (let i = start; i <= end; i += 4 * WEEK) {
                let periodFromKickoff = Math.floor((i - kickoffTS.toNumber()) / (2 * WEEK));
                let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
                let userStakingCheckpoints = await staking.userStakingCheckpoints(
                    vesting.address,
                    startBuf,
                    0
                );

                assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);

                let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(
                    vesting.address,
                    startBuf
                );
                assert.equal(numUserStakingCheckpoints.toString(), "1");
            }

            // negative cases

            // start-100 to avoid coming to active checkpoint
            let periodFromKickoff = Math.floor((start - 100 - kickoffTS.toNumber()) / (2 * WEEK));
            let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
            let userStakingCheckpoints = await staking.userStakingCheckpoints(
                vesting.address,
                startBuf,
                0
            );

            assert.equal(parseInt(userStakingCheckpoints.fromBlock), 0);
            assert.equal(userStakingCheckpoints.stake.toString(), 0);

            let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(
                vesting.address,
                startBuf
            );
            assert.equal(numUserStakingCheckpoints.toString(), "0");
            periodFromKickoff = Math.floor((end + 3 * WEEK - kickoffTS.toNumber()) / (2 * WEEK));
            startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
            userStakingCheckpoints = await staking.userStakingCheckpoints(
                vesting.address,
                startBuf,
                0
            );

            assert.equal(parseInt(userStakingCheckpoints.fromBlock), 0);
            assert.equal(userStakingCheckpoints.stake.toString(), 0);

            numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(
                vesting.address,
                startBuf
            );
            assert.equal(numUserStakingCheckpoints.toString(), "0");
        });

        it("should not allow to stake 2 times 1,000,000 SOV with a duration of 156 weeks and a 4 week cliff", async () => {
            let amount = ONE_MILLON;
            let cliff = 4 * WEEK;
            let duration = 156 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, amount);
            let remainingStakeAmount = amount;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }

            await increaseTimeEthers(52 * WEEK);
            await token.approve(vesting.address, amount);
            await expectRevert(vesting.stakeTokens(amount, 0), "create new vesting address");
        });
    });

    describe("stakeTokensWithApproval", () => {
        let vesting;

        it("fails if invoked directly", async () => {
            let amount = 1000;
            let cliff = 4 * WEEK;
            let duration = 39 * 4 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await expectRevert(vesting.stakeTokensWithApproval(root, amount, 0), "unauthorized");
        });

        it("fails if pass wrong method in data", async () => {
            let amount = 1000;
            let cliff = 4 * WEEK;
            let duration = 39 * 4 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            let contract = new web3.eth.Contract(vesting.abi, vesting.address);
            let sender = root;
            let data = contract.methods.stakeTokens(amount, 0).encodeABI();

            await expectRevert(
                token.approveAndCall(vesting.address, amount, data, { from: sender }),
                "method is not allowed"
            );
        });

        it("should stake ONE MILLION tokens with a duration of 156 weeks and a 4 week cliff", async () => {
            let amount = ONE_MILLON;
            let cliff = 4 * WEEK;
            let duration = 39 * 4 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            let contract = new web3.eth.Contract(vesting.abi, vesting.address);
            let sender = root;
            let data = contract.methods.stakeTokensWithApproval(sender, amount, 0).encodeABI();
            let tx = await token.approveAndCall(vesting.address, amount, data, { from: sender });
            let lastStakingSchedule = await vesting.lastStakingSchedule();
            let remainingStakeAmount = await vesting.remainingStakeAmount();

            data = contract.methods
                .stakeTokensWithApproval(sender, remainingStakeAmount, lastStakingSchedule)
                .encodeABI();
            await token.approveAndCall(vesting.address, remainingStakeAmount, data, {
                from: sender,
            });
            lastStakingSchedule = await vesting.lastStakingSchedule();
            remainingStakeAmount = await vesting.remainingStakeAmount();

            data = contract.methods
                .stakeTokensWithApproval(sender, remainingStakeAmount, lastStakingSchedule)
                .encodeABI();
            await token.approveAndCall(vesting.address, remainingStakeAmount, data, {
                from: sender,
            });
            lastStakingSchedule = await vesting.lastStakingSchedule();
            remainingStakeAmount = await vesting.remainingStakeAmount();
            assert.equal(remainingStakeAmount, 0);
        });

        it("should stake 39000 tokens with a duration of 156 weeks and a 4 week cliff", async () => {
            let amount = 39000;
            let cliff = 4 * WEEK;
            let duration = 156 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            let contract = new web3.eth.Contract(vesting.abi, vesting.address);
            let sender = root;
            let data = contract.methods.stakeTokensWithApproval(sender, amount, 0).encodeABI();
            await token.approveAndCall(vesting.address, amount, data, { from: sender });
            let lastStakingSchedule = await vesting.lastStakingSchedule();
            let remainingStakeAmount = await vesting.remainingStakeAmount();

            data = contract.methods
                .stakeTokensWithApproval(sender, remainingStakeAmount, lastStakingSchedule)
                .encodeABI();
            await token.approveAndCall(vesting.address, remainingStakeAmount, data, {
                from: sender,
            });
            lastStakingSchedule = await vesting.lastStakingSchedule();
            remainingStakeAmount = await vesting.remainingStakeAmount();

            data = contract.methods
                .stakeTokensWithApproval(sender, remainingStakeAmount, lastStakingSchedule)
                .encodeABI();
            await token.approveAndCall(vesting.address, remainingStakeAmount, data, {
                from: sender,
            });
            lastStakingSchedule = await vesting.lastStakingSchedule();
            remainingStakeAmount = await vesting.remainingStakeAmount();
            assert.equal(remainingStakeAmount, 0);

            let block = await ethers.provider.getBlock("latest");
            let timestamp = block.timestamp;

            let start = timestamp + cliff;
            let end = timestamp + duration;

            let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
            let stakedPerInterval = Math.floor(amount / numIntervals);

            // positive case
            for (let i = start; i <= end; i += 4 * WEEK) {
                let periodFromKickoff = Math.floor((i - kickoffTS.toNumber()) / (2 * WEEK));
                let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
                let userStakingCheckpoints = await staking.userStakingCheckpoints(
                    vesting.address,
                    startBuf,
                    0
                );

                assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);

                let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(
                    vesting.address,
                    startBuf
                );
                assert.equal(numUserStakingCheckpoints.toString(), "1");
            }
        });
    });

    describe("withdrawTokens", () => {
        let vesting;
        it("should withdraw unlocked tokens", async () => {
            // Save current amount
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

            await token.approve(vesting.address, toStake);
            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }

            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(104 * WEEK);

            // withdraw
            tx = await vesting.withdrawTokens(root);

            // check event
            expectEvent(tx, "TokensWithdrawn", {
                caller: root,
                receiver: root,
            });

            // verify amount
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake)).toString(),
                amountAfterStake.toString()
            );
            expect(previousAmount).to.be.bignumber.greaterThan(amount);
            expect(amount).to.be.bignumber.greaterThan(amountAfterStake);
        });

        it("should not withdraw unlocked tokens in the first year", async () => {
            // Save current amount
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }

            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(34 * WEEK);

            // withdraw
            tx = await vesting.withdrawTokens(root);

            // verify amount
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake)).toString(),
                amountAfterStake.toString()
            );
            expect(previousAmount).to.be.bignumber.greaterThan(amount);
            assert.equal(amountAfterStake.toString(), amount.toString());
        });

        it("should not allow for 2 stakes and withdrawal for the first year", async () => {
            // Save current amount
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_ETHER;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake, 0);
            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(20 * WEEK);
            await token.approve(vesting.address, toStake);
            await expectRevert(vesting.stakeTokens(toStake, 0), "create new vesting address");

            // withdraw
            tx = await vesting.withdrawTokens(root);

            // verify amount
            let amount = await token.balanceOf(root);

            expect(previousAmount).to.be.bignumber.greaterThan(amount);
            assert.equal(amountAfterStake.toString(), amount.toString());
        });

        it("should do nothing if withdrawing a second time", async () => {
            let amountOld = await token.balanceOf(root);
            // withdraw
            tx = await vesting.withdrawTokens(root);

            // verify amount
            let amount = await token.balanceOf(root);
            assert.equal(amountOld.toString(), amount.toString());
        });

        it("should do nothing if withdrawing before reaching the cliff", async () => {
            let toStake = ONE_MILLON;

            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a1,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }
            let amountOld = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(2 * WEEK);

            // withdraw
            tx = await vesting.withdrawTokens(a2, { from: a1 });

            // verify amount
            let amount = await token.balanceOf(root);
            assert.equal(amountOld.toString(), amount.toString());
        });

        it("should fail if the caller is not token owner", async () => {
            await expectRevert(vesting.withdrawTokens(root, { from: a2 }), "unauthorized");
            await expectRevert(vesting.withdrawTokens(root, { from: a3 }), "unauthorized");

            await expectRevert(vesting.withdrawTokens(root, { from: root }), "unauthorized");
            await increaseTimeEthers(30 * WEEK);
            await expectRevert(vesting.withdrawTokens(root, { from: a2 }), "unauthorized");
        });

        it("shouldn't be possible to use cancelTeamVesting by anyone but owner", async () => {
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }

            await expectRevert(
                staking.cancelTeamVesting(vesting.address, root, 0, { from: a1 }),
                "unauthorized"
            );
        });

        it("shouldn't be possible to use governanceWithdrawVesting by anyone but owner", async () => {
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);

            await expectRevert(
                staking.governanceWithdrawVesting(vesting.address, root, { from: a1 }),
                "unauthorized"
            );
        });

        it("shouldn't be possible to use governanceWithdraw by user", async () => {
            await expectRevert(
                staking.governanceWithdraw(100, kickoffTS.toNumber() + 52 * WEEK, root),
                "unauthorized"
            );
        });
    });

    describe("collectDividends", async () => {
        let vesting;
        it("should fail if the caller is neither owner nor token owner", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a1,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await expectRevert(
                vesting.collectDividends(root, 10, a1, { from: a2 }),
                "unauthorized"
            );
            await expectRevert(
                vesting.collectDividends(root, 10, a1, { from: a3 }),
                "unauthorized"
            );
        });

        it("should fail if receiver address is invalid", async () => {
            let maxCheckpoints = new BN(10);
            await expectRevert(
                vesting.collectDividends(a1, maxCheckpoints, constants.ZERO_ADDRESS, { from: a1 }),
                "receiver address invalid"
            );
        });

        it("should collect dividends", async () => {
            let maxCheckpoints = new BN(10);
            await expectRevert(vesting.collectDividends(a1, maxCheckpoints, a2), "unauthorized");
            let tx = await vesting.collectDividends(a1, maxCheckpoints, a2, { from: a1 });

            let testData = await feeSharingCollectorProxy.testData.call();
            expect(testData.loanPoolToken).to.be.equal(a1);
            expect(testData.maxCheckpoints).to.be.bignumber.equal(maxCheckpoints);
            expect(testData.receiver).to.be.equal(a2);

            expectEvent(tx, "DividendsCollected", {
                caller: a1,
                loanPoolToken: a1,
                receiver: a2,
                maxCheckpoints: maxCheckpoints,
            });
        });
    });

    describe("migrateToNewStakingContract", async () => {
        let vesting;
        it("should set the new staking contract", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a1,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            // 1. set new staking contract address on staking contract

            // Creating the Staking Instance (Staking Modules Interface).
            const stakingProxy = await StakingProxy.new(token.address);
            const newStaking = await deployAndGetIStaking(stakingProxy.address);

            await staking.setNewStakingContract(newStaking.address);

            // 2. call migrateToNewStakingContract - not implemented in Staking
            //uncomment when implemented
            /*let tx = await vesting.migrateToNewStakingContract();
            expectEvent(tx, "MigratedToNewStakingContract", {
                caller: root,
                newStakingContract: newStaking.address,
            });
            let _staking = await vesting.staking();
            assert.equal(_staking, newStaking.address);*/
            await expectRevert(vesting.migrateToNewStakingContract(), "not implemented");
        });

        it("should fail if there is no new staking contract set", async () => {
            let newStaking = await StakingProxy.new(token.address);
            await newStaking.setImplementation(await stakingProxy.getImplementation()); //setting StakingModulesProxy address
            await initializeStakingModulesAt(newStaking.address); // deployes and initializes modules in the newStaking storage using previous StakingModulesProxy contact

            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                newStaking.address,
                a1,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await expectRevert(
                vesting.migrateToNewStakingContract(),
                "there is no new staking contract set"
            );
        });

        it("should fail if the caller is neither owner nor token owner", async () => {
            let newStaking = await StakingProxy.new(token.address);
            await newStaking.setImplementation(await stakingProxy.getImplementation()); //setting StakingModulesProxy address
            await initializeStakingModulesAt(newStaking.address); // deploys and initializes modules in the newStaking storage using previous StakingModulesProxy contact
            newStaking = await StakingLogic.at(newStaking.address);

            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                newStaking.address,
                a1,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);

            await newStaking.setNewStakingContract(newStaking.address);

            await expectRevert(vesting.migrateToNewStakingContract({ from: a2 }), "unauthorized");
            await expectRevert(vesting.migrateToNewStakingContract({ from: a3 }), "unauthorized");
        });
    });

    describe("fouryearvesting", async () => {
        let vesting, dates0, dates3, dates5;
        it("staking schedule must fail if sufficient tokens aren't approved", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await token.approve(vesting.address, 1000);
            await expectRevert(
                vesting.stakeTokens(ONE_MILLON, 0),
                "transfer amount exceeds allowance"
            );
        });

        it("staking schedule must fail for incorrect parameters", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await token.approve(vesting.address, ONE_MILLON);

            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
            lastStakingSchedule = await vesting.lastStakingSchedule();
            remainingStakeAmount = await vesting.remainingStakeAmount();
            await expectRevert(
                vesting.stakeTokens(remainingStakeAmount + 100, lastStakingSchedule),
                "invalid params"
            );
            await expectRevert(
                vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule + 100),
                "invalid params"
            );
        });

        it("staking schedule must run for max duration", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await token.approve(vesting.address, ONE_MILLON);

            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }

            let data = await staking.getStakes.call(vesting.address);
            assert.equal(data.dates.length, 39);
            assert.equal(data.stakes.length, 39);
            expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[15]);
            dates0 = data.dates[0];
            dates5 = data.dates[5];
        });

        it("should extend duration of first 5 staking periods", async () => {
            await increaseTimeEthers(20 * WEEK);
            tx = await vesting.extendStaking();
            data = await staking.getStakes.call(vesting.address);
            expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[15]);
            expect(dates0).to.be.bignumber.not.equal(data.dates[0]);
            expect(dates5).to.be.bignumber.equal(data.dates[0]);
            dates0 = data.dates[0];
            dates5 = data.dates[5];
        });

        it("should extend duration of next 5 staking periods", async () => {
            await increaseTimeEthers(20 * WEEK);
            tx = await vesting.extendStaking();
            data = await staking.getStakes.call(vesting.address);
            expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[15]);
            expect(dates0).to.be.bignumber.not.equal(data.dates[0]);
            expect(dates5).to.be.bignumber.equal(data.dates[0]);
            dates0 = data.dates[0];
            dates3 = data.dates[3];
        });

        it("should extend duration of next 3 staking periods only", async () => {
            await increaseTimeEthers(20 * WEEK);
            tx = await vesting.extendStaking();
            data = await staking.getStakes.call(vesting.address);
            expect(data.stakes[0]).to.be.bignumber.equal(data.stakes[15]);
            expect(dates0).to.be.bignumber.not.equal(data.dates[0]);
            expect(dates3).to.be.bignumber.equal(data.dates[0]);
        });

        it("should not withdraw unlocked tokens if receiver address is 0", async () => {
            // withdraw
            await expectRevert(
                vesting.withdrawTokens(constants.ZERO_ADDRESS),
                "receiver address invalid"
            );
        });

        it("should withdraw unlocked tokens for four year vesting after first year", async () => {
            // time travel
            await increaseTimeEthers(104 * WEEK);

            await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

            // withdraw
            tx = await vesting.withdrawTokens(root);

            // check event
            expectEvent(tx, "TokensWithdrawn", {
                caller: root,
                receiver: root,
            });
        });
    });

    describe("setMaxInterval", async () => {
        it("should set/alter maxInterval", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a2,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            let maxIntervalOld = await vesting.maxInterval();
            await vesting.setMaxInterval(60 * WEEK);
            let maxIntervalNew = await vesting.maxInterval();
            expect(maxIntervalOld).to.be.bignumber.not.equal(maxIntervalNew);
        });

        it("should not set/alter maxInterval", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a2,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await expectRevert(vesting.setMaxInterval(7 * WEEK), "invalid interval");
        });
    });

    describe("extend duration and delegate", async () => {
        it("must delegate for all intervals", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await token.approve(vesting.address, ONE_MILLON);

            let remainingStakeAmount = ONE_MILLON;
            let lastStakingSchedule = 0;
            while (remainingStakeAmount > 0) {
                await vesting.stakeTokens(remainingStakeAmount, lastStakingSchedule);
                lastStakingSchedule = await vesting.lastStakingSchedule();
                remainingStakeAmount = await vesting.remainingStakeAmount();
            }

            let data = await staking.getStakes.call(vesting.address);
            for (let i = 0; i < data.dates.length; i++) {
                let delegatee = await staking.delegates(vesting.address, data.dates[i]);
                expect(delegatee).equal(root);
            }

            await increaseTimeEthers(80 * WEEK);
            let tx = await vesting.extendStaking();
            // delegate
            tx = await vesting.delegate(a1);
            console.log("gasUsed: " + tx.receipt.gasUsed);
            expectEvent(tx, "VotesDelegated", {
                caller: root,
                delegatee: a1,
            });
            data = await staking.getStakes.call(vesting.address);
            for (let i = 0; i < data.dates.length; i++) {
                let delegatee = await staking.delegates(vesting.address, data.dates[i]);
                expect(delegatee).equal(a1);
            }
        });
    });

    describe("changeTokenOwner", async () => {
        let vesting;
        it("should not change token owner if vesting owner didn't approve", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a1,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vesting.address);
            await expectRevert(vesting.changeTokenOwner(a2, { from: a1 }), "unauthorized");
        });

        it("changeTokenOwner should revert if address is zero", async () => {
            await expectRevert(
                vesting.changeTokenOwner(constants.ZERO_ADDRESS),
                "invalid new token owner address"
            );
        });

        it("changeTokenOwner should revert if new owner is the same owner", async () => {
            await expectRevert(vesting.changeTokenOwner(a1), "same owner not allowed");
        });

        it("approveOwnershipTransfer should revert if new token address is zero", async () => {
            await expectRevert(vesting.approveOwnershipTransfer({ from: a1 }), "invalid address");
        });

        it("should not change token owner if token owner hasn't approved", async () => {
            await vesting.changeTokenOwner(a2, { from: root });
            let newTokenOwner = await vesting.tokenOwner();
            expect(newTokenOwner).to.be.not.equal(a2);
        });

        it("approveOwnershipTransfer should revert if not signed by vesting owner", async () => {
            await expectRevert(vesting.approveOwnershipTransfer({ from: a2 }), "unauthorized");
        });

        it("should be able to change token owner", async () => {
            let tx = await vesting.approveOwnershipTransfer({ from: a1 });
            // check event
            expectEvent(tx, "TokenOwnerChanged", {
                newOwner: a2,
                oldOwner: a1,
            });
            let newTokenOwner = await vesting.tokenOwner();
            assert.equal(newTokenOwner, a2);
        });
    });

    describe("setImplementation", async () => {
        let vesting, newVestingLogic, vestingObject;
        const NewVestingLogic = artifacts.require("MockFourYearVestingLogic");
        it("should not change implementation if token owner didn't sign", async () => {
            vestingObject = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a1,
                feeSharingCollectorProxy.address,
                52 * WEEK
            );
            vesting = await VestingLogic.at(vestingObject.address);
            newVestingLogic = await NewVestingLogic.new();
            await expectRevert(
                vesting.setImpl(newVestingLogic.address, { from: a3 }),
                "unauthorized"
            );
            await expectRevert(vesting.setImpl(newVestingLogic.address), "unauthorized");
            await expectRevert(
                vesting.setImpl(constants.ZERO_ADDRESS, { from: a1 }),
                "invalid new implementation address"
            );
        });

        it("should not change implementation if still unauthorized by vesting owner", async () => {
            await vesting.setImpl(newVestingLogic.address, { from: a1 });
            let newImplementation = await vestingObject.getImplementation();
            expect(newImplementation).to.not.equal(newVestingLogic.address);
        });

        it("setImplementation should revert if not signed by vesting owner", async () => {
            await expectRevert(
                vestingObject.setImplementation(newVestingLogic.address, { from: a1 }),
                "Proxy:: access denied"
            );
        });

        it("setImplementation should revert if logic address is not a contract", async () => {
            await expectRevert(
                vestingObject.setImplementation(a3, { from: root }),
                "_implementation not a contract"
            );
        });

        it("setImplementation should revert if address mismatch", async () => {
            await expectRevert(
                vestingObject.setImplementation(vestingLogic.address, { from: root }),
                "address mismatch"
            );
        });

        it("should be able to change implementation", async () => {
            await vestingObject.setImplementation(newVestingLogic.address);
            vesting = await NewVestingLogic.at(vesting.address);

            let durationLeft = await vesting.getDurationLeft();
            await token.approve(vesting.address, ONE_MILLON);
            await vesting.stakeTokens(ONE_MILLON, 0);
            let durationLeftNew = await vesting.getDurationLeft();
            expect(durationLeft).to.be.bignumber.not.equal(durationLeftNew);
        });
    });
});
