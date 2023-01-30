/** Speed optimized on branch hardhatTestRefactor, 2021-10-04
 * Bottleneck found at beforeEach hook, redeploying token and staking ... on every test.
 *
 * Total time elapsed: 6.6s
 * After optimization: 5.9s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");
const { waffle, ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const { BN } = require("@openzeppelin/test-helpers");

const { mineBlock, setTime } = require("../Utils/Ethereum");
const { deployAndGetIStaking } = require("../Utils/initializer");

const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");
const VestingLogic = artifacts.require("VestingLogicMockup");
const Vesting = artifacts.require("TeamVesting");

const TOTAL_SUPPLY = "10000000000000000000000000";
const WEEK = new BN(24 * 60 * 60 * 7);

const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

const ZERO_ADDRESS = ethers.constants.AddressZero;

contract("WeightedStaking", (accounts) => {
    const name = "Test token";
    const symbol = "TST";

    let root, a1, a2, a3;
    let token, staking;
    let kickoffTS, inTwoWeeks, inOneYear, inTwoYears, inThreeYears;

    async function fundAccountAndApproveForStaking(account, amount) {
        await token.transfer(account, amount);
        await token.approve(staking.address, amount, { from: account });
    }

    async function deploymentAndInitFixture(_wallets, _provider) {
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        /// Staking Modules
        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(token.address);
        staking = await deployAndGetIStaking(stakingProxy.address);

        //await token.transfer(a2, "1000");
        //await token.approve(staking.address, "1000", { from: a2 });
        await fundAccountAndApproveForStaking(a2, "1000");

        kickoffTS = await staking.kickoffTS.call();
        inTwoWeeks = kickoffTS.add(new BN(DELAY));
        inOneYear = kickoffTS.add(new BN(DELAY * 26));
        inTwoYears = kickoffTS.add(new BN(DELAY * 26 * 2));
        inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));
    }

    before(async () => {
        [root, a1, a2, a3, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("numCheckpoints", () => {
        it("returns the number of checkpoints for a user", async () => {
            await expect(
                parseInt(await staking.numUserStakingCheckpoints.call(a1, inTwoWeeks))
            ).to.be.equal(0);

            await staking.stake("100", inTwoWeeks, a1, a1, { from: a2 });
            await expect(
                parseInt(await staking.numUserStakingCheckpoints.call(a1, inTwoWeeks))
            ).to.be.equal(1);

            await expect(await staking.stake("50", inTwoWeeks, a1, a1, { from: a2 }));
            await expect(
                parseInt(await staking.numUserStakingCheckpoints.call(a1, inTwoWeeks))
            ).to.be.equal(2);
        });

        it("returns the number of checkpoints for a delegate and date", async () => {
            await expect(
                parseInt(await staking.numDelegateStakingCheckpoints.call(a3, inTwoWeeks))
            ).to.be.equal(0);

            await fundAccountAndApproveForStaking(a1, "150");
            await staking.stake("100", inTwoWeeks, a1, a3, { from: a1 });
            await expect(
                parseInt(await staking.numDelegateStakingCheckpoints.call(a3, inTwoWeeks))
            ).to.be.equal(1);

            await expect(await staking.stake("50", inTwoWeeks, a1, a1, { from: a1 }));
            await expect(
                parseInt(await staking.numDelegateStakingCheckpoints.call(a3, inTwoWeeks))
            ).to.be.equal(2);

            await staking.stake("100", inTwoWeeks, a2, a3, { from: a2 });
            await expect(
                parseInt(await staking.numDelegateStakingCheckpoints.call(a3, inTwoWeeks))
            ).to.be.equal(3);
        });

        it("returns the number of total staking checkpoints for a date", async () => {
            await expect(
                parseInt(await staking.numTotalStakingCheckpoints.call(inTwoWeeks))
            ).to.be.equal(0);

            await fundAccountAndApproveForStaking(a1, "150");
            await staking.stake("100", inTwoWeeks, a1, a3, { from: a1 });
            await expect(
                parseInt(await staking.numTotalStakingCheckpoints.call(inTwoWeeks))
            ).to.be.equal(1);

            await expect(await staking.stake("50", inTwoWeeks, a1, a1, { from: a1 }));
            await expect(
                parseInt(await staking.numTotalStakingCheckpoints.call(inTwoWeeks))
            ).to.be.equal(2);

            await staking.stake("100", inTwoWeeks, a2, a3, { from: a2 });
            await expect(
                parseInt(await staking.numTotalStakingCheckpoints.call(inTwoWeeks))
            ).to.be.equal(3);
        });
    });

    describe("checkpoints", () => {
        it("returns the correct checkpoint for an user", async () => {
            // shortest staking duration
            await fundAccountAndApproveForStaking(a1, "100");
            let result = await staking.stake("100", inTwoWeeks, a1, a3, { from: a1 });
            await expect((await staking.balanceOf(a1)).toString()).to.be.equal("100");
            let checkpoint = await staking.userStakingCheckpoints(a1, inTwoWeeks, 0);

            await expect(parseInt(checkpoint.fromBlock)).to.be.equal(result.receipt.blockNumber);
            await expect(checkpoint.stake.toString()).to.be.equal("100");

            // max staking duration
            result = await staking.stake("100", inThreeYears, a2, a3, { from: a2 });
            checkpoint = await staking.userStakingCheckpoints(a2, inThreeYears, 0);
            await expect(parseInt(checkpoint.fromBlock)).to.be.equal(result.receipt.blockNumber);
            await expect(checkpoint.stake.toString()).to.be.equal("100");
        });

        it("returns the correct checkpoint for a delegate", async () => {
            await fundAccountAndApproveForStaking(a1, "300");
            let result = await staking.stake("100", inTwoWeeks, a1, a3, { from: a1 });
            await expect((await staking.balanceOf(a1)).toString()).to.be.equal("100");

            let checkpoint = await staking.delegateStakingCheckpoints(a3, inTwoWeeks, 0);
            await expect(parseInt(checkpoint.fromBlock)).to.be.equal(result.receipt.blockNumber);
            await expect(checkpoint.stake.toString()).to.be.equal("100");

            // add stake and change delegate
            result = await staking.stake("200", inTwoWeeks, a1, a2, { from: a1 });
            await expect((await staking.balanceOf(a1)).toString()).to.be.equal("300");

            // old delegate
            checkpoint = await staking.delegateStakingCheckpoints(a3, inTwoWeeks, 1);
            await expect(parseInt(checkpoint.fromBlock)).to.be.equal(result.receipt.blockNumber);
            await expect(checkpoint.stake.toString()).to.be.equal("0");

            // new delegate
            checkpoint = await staking.delegateStakingCheckpoints(a2, inTwoWeeks, 0);
            await expect(parseInt(checkpoint.fromBlock)).to.be.equal(result.receipt.blockNumber);
            await expect(checkpoint.stake.toString()).to.be.equal("300");
        });

        it("returns the correct checkpoint for a total stakes", async () => {
            await fundAccountAndApproveForStaking(a1, "100");
            let result = await staking.stake("100", inTwoWeeks, a1, a3, { from: a1 });
            await expect((await staking.balanceOf(a1)).toString()).to.be.equal("100");
            let checkpoint = await staking.totalStakingCheckpoints(inTwoWeeks, 0);

            await expect(parseInt(checkpoint.fromBlock)).to.be.equal(result.receipt.blockNumber);
            await expect(checkpoint.stake.toString()).to.be.equal("100");
        });

        it("returns the correct checkpoint for vested stakes", async () => {
            //verify that regular staking does not create a vesting checkpoint
            await fundAccountAndApproveForStaking(a1, "100");
            await staking.stake("100", inTwoWeeks, a1, a3, { from: a1 });
            await expect(
                (await staking.numVestingCheckpoints(kickoffTS.add(new BN(DELAY)))).toNumber()
            ).to.be.equal(0);

            //verify that vested staking does
            let { vestingInstance, blockNumber } = await createVestingContractWithSingleDate(
                2 * WEEK,
                1000,
                token,
                staking,
                root
            );

            await expect(
                (await staking.balanceOf(vestingInstance.address)).toString()
            ).to.be.equal("1000");

            await expect(
                (await staking.numVestingCheckpoints(kickoffTS.add(new BN(DELAY)))).toNumber()
            ).to.be.equal(1);

            checkpoint = await staking.vestingCheckpoints(kickoffTS.add(new BN(DELAY)), 0);

            await expect(parseInt(checkpoint.fromBlock)).to.be.equal(blockNumber);
            await expect(checkpoint.stake.toString()).to.be.equal("1000");
        });
    });

    describe("total voting power computation", () => {
        it("should compute the expected voting power", async () => {
            await fundAccountAndApproveForStaking(a1, "100");
            await staking.stake("100", inThreeYears, a1, a2, { from: a1 });
            await staking.stake("100", inTwoYears, a2, a2, { from: a2 });
            let result = await staking.stake("100", inOneYear, a3, a3, { from: a2 });
            await mineBlock();

            let maxVotingWeight = await staking.getStorageMaxVotingWeight.call();
            let maxDuration = await staking.getStorageMaxDurationToStakeTokens.call();
            let weightFactor = await staking.getStorageWeightFactor.call();

            // power on kickoff date
            let expectedPower =
                weightingFunction(
                    100,
                    DELAY * (26 * 3),
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26 * 2,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                );
            let totalVotingPower = await staking.getPriorTotalVotingPower(
                result.receipt.blockNumber,
                kickoffTS
            );
            await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);

            // power 52 weeks later
            expectedPower =
                weightingFunction(
                    100,
                    DELAY * (26 * 2),
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26 * 1,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26 * 0,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                );
            totalVotingPower = await staking.getPriorTotalVotingPower(
                result.receipt.blockNumber,
                kickoffTS.add(new BN(DELAY * 26))
            );
            await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
        });

        it("should be unable to compute the total voting power for the current block", async () => {
            let result = await staking.stake("100", inOneYear, a3, a3, { from: a2 });
            await expect(
                staking.getPriorTotalVotingPower(result.receipt.blockNumber, kickoffTS)
            ).to.be.revertedWith("not determined");
        });
    });

    describe("delegated voting power computation", () => {
        it("should compute the expected voting power", async () => {
            await fundAccountAndApproveForStaking(a1, "100");
            await staking.stake("100", inThreeYears, a1, a2, { from: a1 });
            await staking.stake("100", inTwoYears, a2, a3, { from: a2 });
            await fundAccountAndApproveForStaking(a3, "100");
            let result = await staking.stake("100", inOneYear, a3, a2, { from: a3 });
            await mineBlock();

            let maxVotingWeight = await staking.getStorageMaxVotingWeight.call();
            let maxDuration = await staking.getStorageMaxDurationToStakeTokens.call();
            let weightFactor = await staking.getStorageWeightFactor.call();

            // power on kickoff date
            let expectedPower =
                weightingFunction(
                    100,
                    DELAY * (26 * 3),
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                );
            let totalVotingPower = await staking.getPriorVotes(
                a2,
                result.receipt.blockNumber,
                kickoffTS
            );
            await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);

            // power 52 weeks later
            expectedPower =
                weightingFunction(
                    100,
                    DELAY * (26 * 2),
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26 * 0,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                );
            totalVotingPower = await staking.getPriorVotes(
                a2,
                result.receipt.blockNumber,
                kickoffTS.add(new BN(DELAY * 26))
            );
            await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
        });

        it("should be unable to compute the voting power for the current block", async () => {
            let result = await staking.stake("100", inOneYear, a3, a3, { from: a2 });
            await expect(
                staking.getPriorVotes(a3, result.receipt.blockNumber, kickoffTS)
            ).to.be.revertedWith("not determined yet");
        });

        it("should return the current votes", async () => {
            await staking.stake("100", inThreeYears, a2, a2, { from: a2 });
            await mineBlock();

            let maxVotingWeight = await staking.getStorageMaxVotingWeight.call();
            let maxDuration = await staking.getStorageMaxDurationToStakeTokens.call();
            let weightFactor = await staking.getStorageWeightFactor.call();

            let expectedPower = weightingFunction(
                100,
                DELAY * (26 * 3),
                maxDuration,
                maxVotingWeight,
                weightFactor.toNumber()
            );
            let currentVotes = await staking.getCurrentVotes.call(a2);
            await expect(currentVotes.toNumber()).to.be.equal(expectedPower);
        });
    });

    describe("user weighted stake computation", () => {
        it("should compute the expected weighted stake", async () => {
            await staking.stake("100", inThreeYears, a2, a2, { from: a2 });
            await fundAccountAndApproveForStaking(a1, "100");
            await staking.stake("100", inTwoYears, a1, a3, { from: a1 });
            let result = await staking.stake("100", inThreeYears, a2, a2, { from: a2 });
            await mineBlock();

            let maxVotingWeight = await staking.getStorageMaxVotingWeight.call();
            let maxDuration = await staking.getStorageMaxDurationToStakeTokens.call();
            let weightFactor = await staking.getStorageWeightFactor.call();

            // power on kickoff date
            let expectedPower = weightingFunction(
                200,
                DELAY * (26 * 3),
                maxDuration,
                maxVotingWeight,
                weightFactor.toNumber()
            );
            let totalVotingPower = await staking.getPriorWeightedStake(
                a2,
                result.receipt.blockNumber,
                kickoffTS
            );
            await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);

            // power 52 weeks later
            expectedPower = weightingFunction(
                200,
                DELAY * (26 * 2),
                maxDuration,
                maxVotingWeight,
                weightFactor.toNumber()
            );
            totalVotingPower = await staking.getPriorWeightedStake(
                a2,
                result.receipt.blockNumber,
                kickoffTS.add(new BN(DELAY * 26))
            );
            await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
        });

        it("should be unable to compute the weighted stake for the current block", async () => {
            let result = await staking.stake("100", inOneYear, a3, a3, { from: a2 });
            await expect(
                staking.getPriorWeightedStake(a3, result.receipt.blockNumber, kickoffTS)
            ).to.be.revertedWith("not determined");
        });
    });

    describe("vested weighted stake computation", () => {
        it("should compute the expected vesting weighted stake", async () => {
            await createVestingContractWithSingleDate(3 * 52 * WEEK, 100, token, staking, root);
            await createVestingContractWithSingleDate(2 * 52 * WEEK, 100, token, staking, root);
            let { blockNumber } = await createVestingContractWithSingleDate(
                1 * 52 * WEEK,
                100,
                token,
                staking,
                root
            );
            await mineBlock();

            let maxVotingWeight = await staking.getStorageMaxVotingWeight.call();
            let maxDuration = await staking.getStorageMaxDurationToStakeTokens.call();
            let weightFactor = await staking.getStorageWeightFactor.call();

            //power on kickoff date
            let expectedPower =
                weightingFunction(
                    100,
                    DELAY * (26 * 3),
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26 * 2,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                );
            let totalVotingPower = await staking.getPriorTotalVotingPower(blockNumber, kickoffTS);
            await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
            let vestedVotingPower = await staking.getPriorVestingWeightedStake(
                blockNumber,
                kickoffTS
            );
            await expect(vestedVotingPower.toNumber()).to.be.equal(expectedPower);

            //power 52 weeks later
            expectedPower =
                weightingFunction(
                    100,
                    DELAY * (26 * 2),
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26 * 1,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                ) +
                weightingFunction(
                    100,
                    DELAY * 26 * 0,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                );
            totalVotingPower = await staking.getPriorTotalVotingPower(
                blockNumber,
                kickoffTS.add(new BN(DELAY * 26))
            );
            await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
            vestedVotingPower = await staking.getPriorVestingWeightedStake(
                blockNumber,
                kickoffTS.add(new BN(DELAY * 26))
            );
            await expect(vestedVotingPower.toNumber()).to.be.equal(expectedPower);
        });
    });

    describe("general weight computation", () => {
        it("should compute the expected weight for every staking duration", async () => {
            let kickoffTS = await staking.kickoffTS.call();
            let maxVotingWeight = await staking.getStorageMaxVotingWeight.call();
            let maxDuration = await staking.getStorageMaxDurationToStakeTokens.call();
            let weightFactor = await staking.getStorageWeightFactor.call();
            console.log("maxVotingWeight", maxVotingWeight.toString());
            console.log("weightFactor", weightFactor.toString());
            let expectedWeight,
                total = 0;
            for (let i = 0; i <= 39; i++) {
                expectedWeight = weightingFunction(
                    100,
                    i * DELAY * 2,
                    maxDuration,
                    maxVotingWeight,
                    weightFactor.toNumber()
                );
                let newTime = kickoffTS.add(new BN(i * DELAY * 2));
                let w = Math.floor(
                    (100 * (await staking.computeWeightByDate(newTime, kickoffTS)).toNumber()) /
                        weightFactor.toNumber()
                );
                await expect(w).to.be.equal(expectedWeight);
                console.log(expectedWeight);
                total += expectedWeight;
            }
            console.log(total / 39);
        });
    });

    describe("security tests", () => {
        it("should only allow to change delegatee by the stakeFor address to prevent stealing VP", async () => {
            const staker = a2;
            const attacker = a3;
            const delegatee = a1;
            //init attacker
            await token.transfer(attacker, "10");
            await token.approve(staking.address, "10", { from: attacker });

            //1. stake by staker
            const tx1 = await staking.stake("100", inThreeYears, staker, staker, { from: staker });
            await mineBlock();
            const stakerVP1 = await staking.getPriorVotes(
                staker,
                tx1.receipt.blockNumber,
                kickoffTS
            );

            //2. stake any amount by the attacker for the staker with delegatee set to zero address should not change delagatee for the same until date as previous stake by the staker
            const tx2 = await staking.stake("1", inThreeYears, staker, ZERO_ADDRESS, {
                from: attacker,
            });
            mineBlock();
            const attackerVP1 = await staking.getPriorVotes(
                attacker,
                tx2.receipt.blockNumber,
                kickoffTS
            );
            const stakerVP2 = await staking.getPriorVotes(
                staker,
                tx2.receipt.blockNumber,
                kickoffTS
            );
            expect(stakerVP2.toNumber()).to.eq(1010);
            expect(attackerVP1.toNumber()).to.eq(0);

            //3. staker can set delegatee - all VP is transferred to the delegatee
            const tx3 = await staking.stake("1", inThreeYears, staker, delegatee, {
                from: staker,
            });
            await mineBlock();
            const stakerVP3 = await staking.getPriorVotes(
                staker,
                tx3.receipt.blockNumber,
                kickoffTS
            );
            const delegateeVP1 = await staking.getPriorVotes(
                delegatee,
                tx3.receipt.blockNumber,
                kickoffTS
            );
            expect(stakerVP3.toNumber()).eq(0);
            expect(delegateeVP1.toNumber()).to.eq(1020);

            //4. no delegatee changed when staking by the attacker to the staker's address -
            const tx4 = await staking.stake("1", inThreeYears, staker, delegatee, {
                from: attacker,
            });
            mineBlock();
            const attackerVP2 = await staking.getPriorVotes(
                attacker,
                tx4.receipt.blockNumber,
                kickoffTS
            );
            const delegateeVP2 = await staking.getPriorVotes(
                delegatee,
                tx4.receipt.blockNumber,
                kickoffTS
            );
            expect(stakerVP3.toNumber()).eq(0);
            expect(attackerVP2.toNumber()).to.eq(0);
            expect(delegateeVP2.toNumber()).to.eq(1030);

            //4. trying to change delegatee by an attacker (non-staker)
            await expect(
                staking.stake("1", inThreeYears, staker, attacker, { from: attacker })
            ).to.be.revertedWith("Only stakeFor account is allowed to change delegatee");
        });
    });
});

async function updateTime(staking, multiplier) {
    let kickoffTS = await staking.kickoffTS.call();
    let newTime = kickoffTS.add(new BN(DELAY).mul(new BN(multiplier)));
    await setTime(newTime);
    return newTime;
}

function weightingFunction(stake, time, maxDuration, maxVotingWeight, weightFactor) {
    let x = maxDuration - time;
    let mD2 = maxDuration * maxDuration;
    return Math.floor(
        (stake *
            (Math.floor((maxVotingWeight * weightFactor * (mD2 - x * x)) / mD2) + weightFactor)) /
            weightFactor
    );
}

async function createVestingContractWithSingleDate(cliff, amount, token, staking, tokenOwner) {
    vestingLogic = await VestingLogic.new();
    let vestingInstance = await Vesting.new(
        vestingLogic.address,
        token.address,
        staking.address,
        tokenOwner,
        cliff,
        cliff,
        tokenOwner
    );
    vestingInstance = await VestingLogic.at(vestingInstance.address);
    //important, so it's recognized as vesting contract
    await staking.addContractCodeHash(vestingInstance.address);

    await token.approve(vestingInstance.address, amount);
    let result = await vestingInstance.stakeTokens(amount);
    return { vestingInstance: vestingInstance, blockNumber: result.receipt.blockNumber };
}
