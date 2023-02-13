/** Speed optimized on branch hardhatTestRefactor, 2021-10-05
 * Bottlenecks found:
 *  + Many tests are redeploying vesting contract, but w/ different parameters on each case.
 *  + should stake tokens 2 times and delegate voting power (1352ms)
 *  + should withdraw unlocked tokens for 2 stakes (895ms)
 *
 * Total time elapsed: 10.8s
 * After optimization: 8.1s
 *
 * Notes: tests have continuous flow, so fixture cannot be applied.
 *   Bottlenecks are related to loops through 40 steps w/ transaction.
 *   Couldn't find a workaround other that reducing vesting duration.
 */

const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const {
    deployAndGetIStaking,
    initializeStakingModulesAt,
    decodeLogs,
} = require("../Utils/initializer");
const StakingLogic = artifacts.require("IStaking");
const StakingProxy = artifacts.require("StakingProxy");
const StakingWithdrawModule = artifacts.require("StakingWithdrawModule");
const SOV = artifacts.require("SOV");
const TestWrbtc = artifacts.require("TestWrbtc");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxyMockup");
const VestingLogic = artifacts.require("VestingLogicMockup");
const Vesting = artifacts.require("TeamVesting");
//Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogicMockup");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const WEEK = new BN(7 * 24 * 60 * 60);

const TOTAL_SUPPLY = "20000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";
const TWO_WEEKS = 1209600;

const hre = require("hardhat");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { ethers } = hre;

const increaseTimeEthers = async (time) => {
    await ethers.provider.send("evm_increaseTime", [time]);
    await ethers.provider.send("evm_mine");
};

contract("Vesting", (accounts) => {
    const name = "Test token";
    const symbol = "TST";
    const maxWithdrawIterations = 10;

    let root, a1, a2, a3;
    let token, staking, stakingProxy, feeSharingCollectorProxy;
    let vestingLogic;
    let kickoffTS;

    let cliff = "10";
    let duration = "100";

    before(async () => {
        [root, a1, a2, a3, ...accounts] = accounts;
        token = await SOV.new(TOTAL_SUPPLY);
        wrbtc = await TestWrbtc.new();

        vestingLogic = await VestingLogic.new();

        feeSharingCollectorProxy = await FeeSharingCollectorProxy.new(
            constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS
        );

        // Creating the Staking Instance (Staking Modules Interface).
        stakingProxy = await StakingProxy.new(token.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        //Upgradable Vesting Registry
        vestingRegistryLogic = await VestingRegistryLogic.new();
        vestingReg = await VestingRegistryProxy.new();
        await vestingReg.setImplementation(vestingRegistryLogic.address);
        vestingReg = await VestingRegistryLogic.at(vestingReg.address);
        await staking.setVestingRegistry(vestingReg.address);

        await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

        await token.transfer(a2, "1000");
        await token.approve(staking.address, "1000", { from: a2 });

        kickoffTS = await staking.kickoffTS.call();
    });

    describe("constructor", () => {
        it("sets the expected values", async () => {
            let vestingInstance = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                cliff,
                duration,
                feeSharingCollectorProxy.address
            );
            vestingInstance = await VestingLogic.at(vestingInstance.address);

            // Check data
            let _sov = await vestingInstance.SOV();
            let _stackingAddress = await vestingInstance.staking();
            let _tokenOwner = await vestingInstance.tokenOwner();
            let _cliff = await vestingInstance.cliff();
            let _duration = await vestingInstance.duration();
            let _feeSharingCollectorProxy = await vestingInstance.feeSharingCollector();

            assert.equal(_sov, token.address);
            assert.equal(_stackingAddress, staking.address);
            assert.equal(_tokenOwner, root);
            assert.equal(_cliff.toString(), cliff);
            assert.equal(_duration.toString(), duration);
            assert.equal(_feeSharingCollectorProxy, feeSharingCollectorProxy.address);
        });

        it("fails if the 0 address is passed as SOV address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    constants.ZERO_ADDRESS,
                    staking.address,
                    root,
                    cliff,
                    duration,
                    feeSharingCollectorProxy.address
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
                    cliff,
                    duration,
                    feeSharingCollectorProxy.address
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
                    cliff,
                    duration,
                    feeSharingCollectorProxy.address
                ),
                "staking address invalid"
            );
        });

        it("fails if the vesting duration is bigger than the max staking duration", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    staking.address,
                    root,
                    cliff,
                    MAX_DURATION.add(new BN(1)),
                    feeSharingCollectorProxy.address
                ),
                "duration may not exceed the max duration"
            );
        });

        it("fails if the vesting duration is shorter than the cliff", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    staking.address,
                    root,
                    100,
                    99,
                    feeSharingCollectorProxy.address
                ),
                "duration must be bigger than or equal to the cliff"
            );
        });

        it("fails if the 0 address is passed as feeSharingCollectorProxy address", async () => {
            await expectRevert(
                Vesting.new(
                    vestingLogic.address,
                    token.address,
                    staking.address,
                    root,
                    cliff,
                    duration,
                    constants.ZERO_ADDRESS
                ),
                "feeSharingCollector address invalid"
            );
        });
    });

    describe("delegate", () => {
        let vesting;
        it("should stake tokens 2 times and delegate voting power", async () => {
            let toStake = ONE_MILLON;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a2,
                16 * WEEK,
                26 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTimeEthers(20 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

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

        it("should stake tokens 1 time and delegate voting power (using vesting logic with bug in delegation)", async () => {
            let toStake = ONE_MILLON;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a2,
                16 * WEEK,
                26 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            // check delegatee
            let data = await staking.getStakes.call(vesting.address);
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
        let vesting;
        it("should stake 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff with correct self-delegation", async () => {
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await token.approve(vesting.address, ONE_MILLON);
            let tx = await vesting.stakeTokens(ONE_MILLON);

            expectEvent(tx, "TokensStaked", {
                caller: root,
                amount: ONE_MILLON,
            });

            // check delegatee
            let data = await staking.getStakes.call(vesting.address);
            for (let i = 0; i < data.dates.length; i++) {
                let delegatee = await staking.delegates(vesting.address, data.dates[i]);
                expect(delegatee).equal(root);
            }
        });

        it("should stake 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff", async () => {
            let block = await ethers.provider.getBlock("latest");
            let timestamp = parseInt(block.timestamp);

            let kickoffTS = await staking.kickoffTS();

            let start = timestamp + 26 * WEEK;
            let end = timestamp + 104 * WEEK;

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

                assert.equal(parseInt(userStakingCheckpoints.fromBlock), block.number);
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

            periodFromKickoff = Math.floor((end + 1 - kickoffTS.toNumber()) / (2 * WEEK));
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

        it("should stake 2 times 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff", async () => {
            let amount = 1000;
            let cliff = 28 * WEEK;
            let duration = 104 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                cliff,
                duration,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, amount);
            await vesting.stakeTokens(amount);

            let block1 = await ethers.provider.getBlock("latest");
            let timestamp1 = block1.timestamp;

            let start = timestamp1 + cliff;
            let end = timestamp1 + duration;

            let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
            let stakedPerInterval = amount / numIntervals;

            await increaseTimeEthers(52 * WEEK);
            await token.approve(vesting.address, amount);
            await vesting.stakeTokens(amount);

            let block2 = await ethers.provider.getBlock("latest");
            let timestamp2 = block2.timestamp;

            let start2 = await staking.timestampToLockDate(timestamp2 + cliff);
            let end2 = timestamp2 + duration;

            // positive case
            for (let i = start; i <= end2; i += 4 * WEEK) {
                let lockedTS = await staking.timestampToLockDate(i);
                let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(
                    vesting.address,
                    lockedTS
                );
                let userStakingCheckpoints = await staking.userStakingCheckpoints(
                    vesting.address,
                    lockedTS,
                    numUserStakingCheckpoints - 1
                );
                if (i < start2 || i > end) {
                    assert.equal(numUserStakingCheckpoints.toString(), "1");
                    assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);
                } else {
                    assert.equal(numUserStakingCheckpoints.toString(), "2");
                    assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval * 2);
                }
            }
        });

        it("should stake 1000 tokens with a duration of 34 weeks and a 26 week cliff (dust on rounding)", async () => {
            let amount = 1000;
            let cliff = 26 * WEEK;
            let duration = 34 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                cliff,
                duration,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, amount);
            await vesting.stakeTokens(amount);

            let block = await ethers.provider.getBlock("latest");
            let timestamp = parseInt(block.timestamp);

            let start = timestamp + cliff;
            let end = timestamp + duration;

            let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
            let stakedPerInterval = Math.floor(amount / numIntervals);

            let stakeForFirstInterval = amount - stakedPerInterval * (numIntervals - 1);

            // positive case
            for (let i = start; i <= end; i += 4 * WEEK) {
                let periodFromKickoff = Math.floor((i - kickoffTS.toNumber()) / (2 * WEEK));
                let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
                let userStakingCheckpoints = await staking.userStakingCheckpoints(
                    vesting.address,
                    startBuf,
                    0
                );

                assert.equal(parseInt(userStakingCheckpoints.fromBlock), block.number);
                if (i === start) {
                    assert.equal(userStakingCheckpoints.stake.toString(), stakeForFirstInterval);
                } else {
                    assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);
                }

                let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(
                    vesting.address,
                    startBuf
                );
                assert.equal(numUserStakingCheckpoints.toString(), "1");
            }
        });
    });

    describe("stakeTokensWithApproval", () => {
        let vesting;

        it("fails if invoked directly", async () => {
            let amount = 1000;
            let cliff = 26 * WEEK;
            let duration = 34 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                cliff,
                duration,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await expectRevert(vesting.stakeTokensWithApproval(root, amount), "unauthorized");
        });

        it("fails if pass wrong method in data", async () => {
            let amount = 1000;
            let cliff = 26 * WEEK;
            let duration = 34 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                cliff,
                duration,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            let contract = new web3.eth.Contract(vesting.abi, vesting.address);
            let sender = root;
            let data = contract.methods.stakeTokens(amount).encodeABI();

            await expectRevert(
                token.approveAndCall(vesting.address, amount, data, { from: sender }),
                "method is not allowed"
            );
        });

        it("should stake 1000 tokens with a duration of 34 weeks and a 26 week cliff (dust on rounding)", async () => {
            let amount = 1000;
            let cliff = 26 * WEEK;
            let duration = 34 * WEEK;
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                cliff,
                duration,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            let contract = new web3.eth.Contract(vesting.abi, vesting.address);
            let sender = root;
            let data = contract.methods.stakeTokensWithApproval(sender, amount).encodeABI();
            await token.approveAndCall(vesting.address, amount, data, { from: sender });

            let block = await ethers.provider.getBlock("latest");
            let timestamp = parseInt(block.timestamp);

            let start = timestamp + cliff;
            let end = timestamp + duration;

            let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
            let stakedPerInterval = Math.floor(amount / numIntervals);

            let stakeForFirstInterval = amount - stakedPerInterval * (numIntervals - 1);

            // positive case
            for (let i = start; i <= end; i += 4 * WEEK) {
                let periodFromKickoff = Math.floor((i - kickoffTS.toNumber()) / (2 * WEEK));
                let startBuf = periodFromKickoff * 2 * WEEK + kickoffTS.toNumber();
                let userStakingCheckpoints = await staking.userStakingCheckpoints(
                    vesting.address,
                    startBuf,
                    0
                );

                assert.equal(parseInt(userStakingCheckpoints.fromBlock), block.number);
                if (i === start) {
                    assert.equal(userStakingCheckpoints.stake.toString(), stakeForFirstInterval);
                } else {
                    assert.equal(userStakingCheckpoints.stake.toString(), stakedPerInterval);
                }

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

        it("should withdraw unlocked tokens (cliff = 3 weeks)", async () => {
            // Save current amount
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            await increaseTimeEthers(3 * WEEK);

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                3 * WEEK,
                3 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(3 * WEEK);

            // withdraw
            let tx = await vesting.withdrawTokens(root);

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
            assert.equal(previousAmount.toString(), amount.toString());
        });

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
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(104 * WEEK);

            // withdraw
            let tx = await vesting.withdrawTokens(root);

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
            assert.equal(previousAmount.toString(), amount.toString());
        });

        it("should withdraw unlocked tokens for 2 stakes", async () => {
            // Save current amount
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                16 * WEEK,
                34 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTimeEthers(20 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(34 * WEEK);

            // withdraw
            let tx = await vesting.withdrawTokens(root);

            // check event
            expectEvent(tx, "TokensWithdrawn", {
                caller: root,
                receiver: root,
            });

            // verify amount
            let amount = await token.balanceOf(root);
            assert.equal(
                previousAmount.sub(new BN(toStake).mul(new BN(2))).toString(),
                amountAfterStake.toString()
            );
            assert.equal(previousAmount.toString(), amount.toString());
        });

        it("should withdraw unlocked tokens for 2 stakes (current time >= last locking date of the second stake)", async () => {
            // Save current amount
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                4 * WEEK,
                20 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTimeEthers(2 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(20 * WEEK);

            // withdraw
            let tx = await vesting.withdrawTokens(root);

            // check event
            expectEvent(tx, "TokensWithdrawn", {
                caller: root,
                receiver: root,
            });

            // verify amount
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake).mul(new BN(2))).toString(),
                amountAfterStake.toString()
            );

            assert.equal(previousAmount.toString(), amount.toString());
        });

        it("should withdraw unlocked tokens for 2 stakes (shouldn't withdraw the latest stake)", async () => {
            // Save current amount
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                4 * WEEK,
                20 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTimeEthers(2 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(18 * WEEK);

            // withdraw
            await vesting.withdrawTokens(root);

            let stakes = await staking.getStakes(vesting.address);
            expect(stakes.dates.length).equal(1);
        });

        it("should do nothing if withdrawing a second time", async () => {
            // This part should be tested on staking contract, function getPriorUserStakeByDate
            let previousAmount = await token.balanceOf(root);
            await vesting.withdrawTokens(root);
            let amount = await token.balanceOf(root);

            assert.equal(previousAmount.toString(), amount.toString());
        });

        it("should do nothing if withdrawing before reaching the cliff", async () => {
            let toStake = ONE_MILLON;

            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a1,
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await staking.setMaxVestingWithdrawIterations(maxWithdrawIterations);

            let previousAmount = await token.balanceOf(root);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            // time travel
            await increaseTimeEthers(25 * WEEK);

            await vesting.withdrawTokens(root, { from: a1 });
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake)).toString(),
                amountAfterStake.toString()
            );
            assert.equal(amountAfterStake.toString(), amount.toString());
        });

        it("should fail if the caller is neither owner nor token owner", async () => {
            await expectRevert(vesting.withdrawTokens(root, { from: a2 }), "unauthorized");
            await expectRevert(vesting.withdrawTokens(root, { from: a3 }), "unauthorized");

            await vesting.withdrawTokens(root, { from: root });
            await vesting.withdrawTokens(root, { from: a1 });
        });

        it("cancelTeamVesting should fail if recipient is zero address", async () => {
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                26 * WEEK,
                142 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await vestingReg.setTeamVesting(vesting.address, 0);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await expectRevert(
                staking.cancelTeamVesting(vesting.address, ZERO_ADDRESS, 0),
                "receiver address invalid"
            );
        });

        it("cancelTeamVesting should emit incompletion event if greater the max iterations (with 0 starting iteration)", async () => {
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                26 * WEEK,
                142 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await vestingReg.setTeamVesting(vesting.address, 0);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            const getStartDate = vesting.startDate();
            const getCliff = vesting.cliff();
            const getMaxIterations = staking.getMaxVestingWithdrawIterations();

            const [startDate, cliff, maxIterations] = await Promise.all([
                getStartDate,
                getCliff,
                getMaxIterations,
            ]);
            const startIteration = startDate.add(cliff);

            const { receipt } = await staking.cancelTeamVesting(vesting.address, root, 0);

            const decodedIncompleteEvent = decodeLogs(
                receipt.rawLogs,
                StakingWithdrawModule,
                "TeamVestingPartiallyCancelled"
            )[0].args;
            expect(decodedIncompleteEvent["caller"]).to.equal(root);
            expect(decodedIncompleteEvent["receiver"]).to.equal(root);
            // last processed date = starIteration + ( (max_iterations - 1) * 1209600 )  // 1209600 is TWO_WEEKS
            expect(decodedIncompleteEvent["lastProcessedDate"].toString()).to.equal(
                startIteration
                    .add(new BN(maxIterations.sub(new BN(1))).mul(new BN(TWO_WEEKS)))
                    .toString()
            );
        });

        it("cancelTeamVesting utilizing lastProcessedDate from incompletion event", async () => {
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                26 * WEEK,
                142 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await vestingReg.setTeamVesting(vesting.address, 0);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            const getStartDate = vesting.startDate();
            const getCliff = vesting.cliff();
            const getMaxIterations = staking.getMaxVestingWithdrawIterations();

            const [startDate, cliff, maxIterations] = await Promise.all([
                getStartDate,
                getCliff,
                getMaxIterations,
            ]);
            const startIteration = startDate.add(cliff);

            const tx = await staking.cancelTeamVesting(vesting.address, root, 0);

            let decodedIncompleteEvent = decodeLogs(
                tx.receipt.rawLogs,
                StakingWithdrawModule,
                "TeamVestingPartiallyCancelled"
            )[0].args;
            expect(decodedIncompleteEvent["caller"]).to.equal(root);
            expect(decodedIncompleteEvent["receiver"]).to.equal(root);
            // last processed date = starIteration + ( (max_iterations - 1) * 1209600 )  // 1209600 is TWO_WEEKS
            expect(decodedIncompleteEvent["lastProcessedDate"].toString()).to.equal(
                startIteration
                    .add(new BN(maxIterations.sub(new BN(1))).mul(new BN(TWO_WEEKS)))
                    .toString()
            );

            // Withdrawn another one (next start from should be added by TWO WEEKS)
            const nextStartIteration = new BN(decodedIncompleteEvent["lastProcessedDate"]).add(
                new BN(TWO_WEEKS)
            );
            const tx2 = await staking.cancelTeamVesting(vesting.address, root, nextStartIteration);
            decodedIncompleteEvent = decodeLogs(
                tx2.receipt.rawLogs,
                StakingWithdrawModule,
                "TeamVestingPartiallyCancelled"
            )[0].args;
            expect(decodedIncompleteEvent["caller"]).to.equal(root);
            expect(decodedIncompleteEvent["receiver"]).to.equal(root);
            // last processed date = starIteration + ( (max_iterations - 1) * 1209600 )  // 1209600 is TWO_WEEKS
            expect(decodedIncompleteEvent["lastProcessedDate"].toString()).to.equal(
                nextStartIteration
                    .add(new BN(maxIterations.sub(new BN(1))).mul(new BN(TWO_WEEKS)))
                    .toString()
            );
        });

        it("cancelTeamVesting utilizing lastProcessedDate from incompletion event (should be able to retrieve reward for the accidental skip date)", async () => {
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                26 * WEEK,
                142 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await vestingReg.setTeamVesting(vesting.address, 0);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            const getStartDate = vesting.startDate();
            const getCliff = vesting.cliff();
            const getMaxIterations = staking.getMaxVestingWithdrawIterations();

            const [startDate, cliff, maxIterations] = await Promise.all([
                getStartDate,
                getCliff,
                getMaxIterations,
            ]);
            const startIteration = startDate.add(cliff);

            const tx = await staking.cancelTeamVesting(vesting.address, root, 0);

            let decodedIncompleteEvent = decodeLogs(
                tx.receipt.rawLogs,
                StakingWithdrawModule,
                "TeamVestingPartiallyCancelled"
            )[0].args;
            expect(decodedIncompleteEvent["caller"]).to.equal(root);
            expect(decodedIncompleteEvent["receiver"]).to.equal(root);
            // last processed date = starIteration + ( (max_iterations - 1) * 1209600 )  // 1209600 is TWO_WEEKS
            expect(decodedIncompleteEvent["lastProcessedDate"].toString()).to.equal(
                startIteration
                    .add(new BN(maxIterations.sub(new BN(1))).mul(new BN(TWO_WEEKS)))
                    .toString()
            );

            // Withdrawn another one but skip 10 iterations
            const nextStartIteration = new BN(decodedIncompleteEvent["lastProcessedDate"]).add(
                new BN(15).mul(new BN(TWO_WEEKS))
            );
            await staking.cancelTeamVesting(vesting.address, root, nextStartIteration);

            // Withdrawn skipped iterations
            const skippedIterations = new BN(decodedIncompleteEvent["lastProcessedDate"]).add(
                new BN(TWO_WEEKS)
            );
            let block = await ethers.provider.getBlock("latest");
            let currentBlockNumber = block.number;

            const previousStake = await staking.getPriorUserStakeByDate(
                vesting.address,
                skippedIterations,
                currentBlockNumber - 1
            );

            expect(previousStake).to.be.bignumber.to.greaterThan(new BN(1));

            const previousReceiverBalance = await token.balanceOf(root);
            const previousTotalStakesForDate = [];
            const previousVestingStakeByDate = [];
            const previousStakeByDelegatee = [];

            for (
                let i = skippedIterations.toNumber();
                i < skippedIterations.add(maxIterations.mul(new BN(TWO_WEEKS))).toNumber();
                i += TWO_WEEKS
            ) {
                let lockedTS = await staking.timestampToLockDate(i);
                // caching the stakeByDateForDelegatee for each lock dates before cancellation
                previousStakeByDelegatee[i] = await staking.getPriorStakeByDateForDelegatee(
                    root,
                    lockedTS,
                    currentBlockNumber - 1
                );

                // caching the totalStakesForDate for each lock dates before cancellation
                previousTotalStakesForDate[i] = await staking.getPriorTotalStakesForDate(
                    lockedTS,
                    currentBlockNumber - 1
                );

                // caching the vestingStakeByDate for each lock dates before cancellation
                previousVestingStakeByDate[i] = await staking.getPriorVestingStakeByDate(
                    lockedTS,
                    currentBlockNumber - 1
                );
            }

            const tx2 = await staking.cancelTeamVesting(vesting.address, root, skippedIterations);
            await increaseTimeEthers(1000);

            const latestReceiverBalance = await token.balanceOf(root);

            expect(latestReceiverBalance).to.be.bignumber.greaterThan(previousReceiverBalance);

            decodedIncompleteEvent = decodeLogs(
                tx2.receipt.rawLogs,
                StakingWithdrawModule,
                "TeamVestingPartiallyCancelled"
            )[0].args;
            expect(decodedIncompleteEvent["caller"]).to.equal(root);
            expect(decodedIncompleteEvent["receiver"]).to.equal(root);
            expect(decodedIncompleteEvent["lastProcessedDate"].toString()).to.equal(
                skippedIterations
                    .add(new BN(maxIterations.sub(new BN(1))).mul(new BN(TWO_WEEKS)))
                    .toString()
            );

            block = await ethers.provider.getBlock("latest");
            currentBlockNumber = block.number;
            const latestTotalStakesForDate = [];
            const latestVestingStakeByDate = [];
            const latestStakeByDelegatee = [];

            for (
                let i = skippedIterations.toNumber();
                i < skippedIterations.add(maxIterations.mul(new BN(TWO_WEEKS))).toNumber();
                i += TWO_WEEKS
            ) {
                let lockedTS = await staking.timestampToLockDate(i);

                const latestStake = await staking.getPriorUserStakeByDate(
                    vesting.address,
                    i,
                    currentBlockNumber - 1
                );

                // caching the stakeByDateForDelegatee for each lock dates after cancellation
                latestStakeByDelegatee[i] = await staking.getPriorStakeByDateForDelegatee(
                    root,
                    lockedTS,
                    currentBlockNumber - 1
                );

                // caching the totalStakesForDate for each lock dates after cancellation
                latestTotalStakesForDate[i] = await staking.getPriorTotalStakesForDate(
                    lockedTS,
                    currentBlockNumber - 1
                );

                // caching the vestingStakeByDate for each lock dates after cancellation
                latestVestingStakeByDate[i] = await staking.getPriorVestingStakeByDate(
                    lockedTS,
                    currentBlockNumber - 1
                );

                // the stakeByDateForDelegatee will be decreased after cancellation
                if (latestStakeByDelegatee[i] > 0 && previousStakeByDelegatee[i] > 0) {
                    expect(latestStakeByDelegatee[i]).to.be.bignumber.lessThan(
                        previousStakeByDelegatee[i]
                    );
                }

                // the totalStakesForDate will be decreased after cancellation
                if (latestTotalStakesForDate[i] > 0 && previousTotalStakesForDate[i] > 0) {
                    expect(latestTotalStakesForDate[i]).to.be.bignumber.lessThan(
                        previousTotalStakesForDate[i]
                    );
                }

                // the vestingStakeByDate will be decreased after cancellation
                if (latestVestingStakeByDate[i] > 0 && previousVestingStakeByDate[i] > 0) {
                    expect(latestVestingStakeByDate[i]).to.be.bignumber.lessThan(
                        previousVestingStakeByDate[i]
                    );
                }

                expect(latestStake.toString()).to.equal("1");
            }
        });

        it("should not allow other than team vesting to withdraw from cancelTeamVesting", async () => {
            const WEEK = new BN(7 * 24 * 60 * 60);
            let vestingLogic = await VestingLogic.new();
            const ONE_MILLON = "1000000000000000000000000";
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                16 * WEEK,
                38 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTimeEthers(20 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            // governance withdraw until duration must withdraw all staked tokens without fees
            await expectRevert(
                staking.cancelTeamVesting(vesting.address, root, 0),
                "Only team vesting allowed"
            );
        });

        it("Shouldn't be possible to use cancelTeamVesting by not owner", async () => {
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await expectRevert(
                staking.cancelTeamVesting(vesting.address, root, 0, { from: a1 }),
                "unauthorized"
            );
        });

        it("governanceWithdrawTokens", async () => {
            let previousAmount = await token.balanceOf(root);
            let toStake = ONE_MILLON;

            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                16 * WEEK,
                38 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await vestingReg.setTeamVesting(vesting.address, 0);

            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            await increaseTimeEthers(10 * WEEK);
            await token.approve(vesting.address, toStake);
            await vesting.stakeTokens(toStake);

            let amountAfterStake = await token.balanceOf(root);

            await staking.addAdmin(a1);
            // governance withdraw until duration must withdraw all staked tokens without fees
            let tx = await staking.cancelTeamVesting(vesting.address, root, 0, {
                from: a1,
            });

            const getStartDate = vesting.startDate();
            const getCliff = vesting.cliff();
            const getMaxIterations = staking.getMaxVestingWithdrawIterations();

            const [startDate, cliff, maxIterations] = await Promise.all([
                getStartDate,
                getCliff,
                getMaxIterations,
            ]);
            const startIteration = startDate.add(cliff);

            const decodedIncompleteEvent = decodeLogs(
                tx.receipt.rawLogs,
                StakingWithdrawModule,
                "TeamVestingPartiallyCancelled"
            )[0].args;
            // last processed date = starIteration + ( (max_iterations - 1) * 1209600 )  // 1209600 is TWO_WEEKS
            expect(decodedIncompleteEvent["lastProcessedDate"].toString()).to.equal(
                startIteration
                    .add(new BN(maxIterations.sub(new BN(1))).mul(new BN(TWO_WEEKS)))
                    .toString()
            );

            // Withdraw another iteration
            await staking.cancelTeamVesting(
                vesting.address,
                root,
                new BN(decodedIncompleteEvent["lastProcessedDate"]).add(new BN(TWO_WEEKS))
            );

            // verify amount
            let amount = await token.balanceOf(root);

            assert.equal(
                previousAmount.sub(new BN(toStake).mul(new BN(2))).toString(),
                amountAfterStake.toString()
            );
            assert.equal(previousAmount.toString(), amount.toString());

            let vestingBalance = await staking.balanceOf(vesting.address);
            expect(vestingBalance).to.be.bignumber.equal(new BN(0));

            /// should emit token withdrawn event for complete withdrawal
            const end = vesting.endDate();
            tx = await staking.cancelTeamVesting(
                vesting.address,
                root,
                new BN(end.toString()).add(new BN(TWO_WEEKS))
            );

            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                StakingWithdrawModule,
                "TeamVestingCancelled",
                {
                    caller: root,
                    receiver: root,
                }
            );
        });

        it("governanceWithdrawTokens should be reverted", async () => {
            // Stake
            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                root,
                16 * WEEK,
                38 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            await vestingReg.setTeamVesting(vesting.address, 0);

            await expectRevert(
                vesting.governanceWithdrawTokens(root),
                "deprecated, use cancelTeamVesting from the staking contract"
            );
        });
    });

    describe("collectDividends", async () => {
        it("should fail if the caller is neither owner nor token owner", async () => {
            let vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a1,
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
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

        it("should collect dividends", async () => {
            let vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                staking.address,
                a1,
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            let maxCheckpoints = new BN(10);
            let tx = await vesting.collectDividends(a1, maxCheckpoints, a2);

            let testData = await feeSharingCollectorProxy.testData.call();
            expect(testData.loanPoolToken).to.be.equal(a1);
            expect(testData.maxCheckpoints).to.be.bignumber.equal(maxCheckpoints);
            expect(testData.receiver).to.be.equal(a2);

            expectEvent(tx, "DividendsCollected", {
                caller: root,
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
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);
            // 1. set new staking contract address on staking contract

            let newStaking = await StakingProxy.new(token.address);
            await newStaking.setImplementation(await stakingProxy.getImplementation()); //setting StakingModulesProxy address
            await initializeStakingModulesAt(newStaking.address); // deployes and initializes modules in the newStaking storage using previous StakingModulesProxy contact

            await staking.setNewStakingContract(newStaking.address);

            // 2. call migrateToNewStakingContract
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
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
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
            await initializeStakingModulesAt(newStaking.address); // deployes and initializes modules in the newStaking storage using previous StakingModulesProxy contact
            newStaking = await StakingLogic.at(newStaking.address);

            vesting = await Vesting.new(
                vestingLogic.address,
                token.address,
                newStaking.address,
                a1,
                26 * WEEK,
                104 * WEEK,
                feeSharingCollectorProxy.address
            );
            vesting = await VestingLogic.at(vesting.address);

            await newStaking.setNewStakingContract(staking.address); // can be any address, asing the staking.address for simplicity

            await expectRevert(vesting.migrateToNewStakingContract({ from: a2 }), "unauthorized");
            await expectRevert(vesting.migrateToNewStakingContract({ from: a3 }), "unauthorized");
        });
    });
});
