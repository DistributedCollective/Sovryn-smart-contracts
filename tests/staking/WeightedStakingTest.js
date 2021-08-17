const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const { address, minerStart, minerStop, unlockedAccount, mineBlock, etherMantissa, etherUnsigned, setTime } = require("../Utils/Ethereum");

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");

const TOTAL_SUPPLY = "10000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DAY = 86400;
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract("WeightedStaking", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let root, a1, a2, a3;
	let token, staking;
	let kickoffTS, inOneWeek, inOneYear, inTwoYears, inThreeYears;

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
	});

	beforeEach(async () => {
		token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		await token.transfer(a2, "1000");
		await token.approve(staking.address, "1000", { from: a2 });

		kickoffTS = await staking.kickoffTS.call();
		inOneWeek = kickoffTS.add(new BN(DELAY));
		inOneYear = kickoffTS.add(new BN(DELAY * 26));
		inTwoYears = kickoffTS.add(new BN(DELAY * 26 * 2));
		inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));
	});

	describe("numCheckpoints", () => {
		it("returns the number of checkpoints for a user", async () => {
			await expect((await staking.numUserStakingCheckpoints.call(a1, inOneWeek)).toString()).to.be.equal("0");

			await staking.stake("100", inOneWeek, a1, a1, { from: a2 });
			await expect((await staking.numUserStakingCheckpoints.call(a1, inOneWeek)).toString()).to.be.equal("1");

			await expect(await staking.stake("50", inOneWeek, a1, a1, { from: a2 }));
			await expect((await staking.numUserStakingCheckpoints.call(a1, inOneWeek)).toString()).to.be.equal("2");
		});

		it("returns the number of checkpoints for a delegate and date", async () => {
			await expect((await staking.numDelegateStakingCheckpoints.call(a3, inOneWeek)).toString()).to.be.equal("0");

			await staking.stake("100", inOneWeek, a1, a3, { from: a2 });
			await expect((await staking.numDelegateStakingCheckpoints.call(a3, inOneWeek)).toString()).to.be.equal("1");

			await expect(await staking.stake("50", inOneWeek, a1, a1, { from: a2 }));
			await expect((await staking.numDelegateStakingCheckpoints.call(a3, inOneWeek)).toString()).to.be.equal("2");

			await staking.stake("100", inOneWeek, a2, a3, { from: a2 });
			await expect((await staking.numDelegateStakingCheckpoints.call(a3, inOneWeek)).toString()).to.be.equal("3");
		});

		it("returns the number of total staking checkpoints for a date", async () => {
			await expect((await staking.numTotalStakingCheckpoints.call(inOneWeek)).toString()).to.be.equal("0");

			await staking.stake("100", inOneWeek, a1, a3, { from: a2 });
			await expect((await staking.numTotalStakingCheckpoints.call(inOneWeek)).toString()).to.be.equal("1");

			await expect(await staking.stake("50", inOneWeek, a1, a1, { from: a2 }));
			await expect((await staking.numTotalStakingCheckpoints.call(inOneWeek)).toString()).to.be.equal("2");

			await staking.stake("100", inOneWeek, a2, a3, { from: a2 });
			await expect((await staking.numTotalStakingCheckpoints.call(inOneWeek)).toString()).to.be.equal("3");
		});
	});

	describe("checkpoints", () => {
		it("returns the correct checkpoint for an user", async () => {
			//shortest staking duration
			let result = await staking.stake("100", inOneWeek, a1, a3, { from: a2 });
			await expect((await staking.balanceOf(a1)).toString()).to.be.equal("100");
			let checkpoint = await staking.userStakingCheckpoints(a1, inOneWeek, 0);

			await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
			await expect(checkpoint.stake.toString()).to.be.equal("100");

			//max staking duration
			result = await staking.stake("100", inThreeYears, a2, a3, { from: a2 });
			checkpoint = await staking.userStakingCheckpoints(a2, inThreeYears, 0);
			await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
			await expect(checkpoint.stake.toString()).to.be.equal("100");
		});

		it("returns the correct checkpoint for a delegate", async () => {
			let result = await staking.stake("100", inOneWeek, a1, a3, { from: a2 });
			await expect((await staking.balanceOf(a1)).toString()).to.be.equal("100");

			let checkpoint = await staking.delegateStakingCheckpoints(a3, inOneWeek, 0);
			await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
			await expect(checkpoint.stake.toString()).to.be.equal("100");

			//add stake and change delegatee
			result = await staking.stake("200", inOneWeek, a1, a2, { from: a2 });
			await expect((await staking.balanceOf(a1)).toString()).to.be.equal("300");

			//old delegate
			checkpoint = await staking.delegateStakingCheckpoints(a3, inOneWeek, 1);
			await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
			await expect(checkpoint.stake.toString()).to.be.equal("0");

			//new delegate
			checkpoint = await staking.delegateStakingCheckpoints(a2, inOneWeek, 0);
			await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
			await expect(checkpoint.stake.toString()).to.be.equal("300");
		});

		it("returns the correct checkpoint for a total stakes", async () => {
			let result = await staking.stake("100", inOneWeek, a1, a3, { from: a2 });
			await expect((await staking.balanceOf(a1)).toString()).to.be.equal("100");
			let checkpoint = await staking.totalStakingCheckpoints(inOneWeek, 0);

			await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
			await expect(checkpoint.stake.toString()).to.be.equal("100");
		});

		it("returns the correct checkpoint for vested stakes", async() => {
			//TODO: unfinished
			let result = await staking.stake("100", inOneWeek, a1, a3, { from: a2 });
			await expect((await staking.balanceOf(a1)).toString()).to.be.equal("100");
			let checkpoint = await staking.totalStakingCheckpoints(inOneWeek, 0);
			
			vestingLogic = await VestingLogic.new();
			let vestingInstance = await Vesting.new(
				vestingLogic.address,
				token.address,
				staking.address,
				root,
				10,
				100,
				root
			);
			vestingInstance = await VestingLogic.at(vestingInstance.address);
			/** 
			let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
			let maxDuration = await staking.MAX_DURATION.call();
			let weightFactor = await staking.WEIGHT_FACTOR.call();
			console.log(weightingFunction(1000, DELAY * 26 * 2 - 14*24*60*60, maxDuration, maxVotingWeight, weightFactor.toNumber()));
			*/

			await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
			await expect(checkpoint.stake.toString()).to.be.equal("100");
		});
	});

	describe("total voting power computation", () => {
		it("should compute the expected voting power", async () => {
			await staking.stake("100", inThreeYears, a1, a2, { from: a2 });
			await staking.stake("100", inTwoYears, a2, a2, { from: a2 });
			let result = await staking.stake("100", inOneYear, a3, a3, { from: a2 });
			await mineBlock();

			let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
			let maxDuration = await staking.MAX_DURATION.call();
			let weightFactor = await staking.WEIGHT_FACTOR.call();

			//power on kickoff date
			let expectedPower =
				weightingFunction(100, DELAY * (26 * 3), maxDuration, maxVotingWeight, weightFactor.toNumber()) +
				weightingFunction(100, DELAY * 26 * 2, maxDuration, maxVotingWeight, weightFactor.toNumber()) +
				weightingFunction(100, DELAY * 26, maxDuration, maxVotingWeight, weightFactor.toNumber());
			let totalVotingPower = await staking.getPriorTotalVotingPower(result.receipt.blockNumber, kickoffTS);
			await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);

			//power 52 weeks later
			expectedPower =
				weightingFunction(100, DELAY * (26 * 2), maxDuration, maxVotingWeight, weightFactor.toNumber()) +
				weightingFunction(100, DELAY * 26 * 1, maxDuration, maxVotingWeight, weightFactor.toNumber()) +
				weightingFunction(100, DELAY * 26 * 0, maxDuration, maxVotingWeight, weightFactor.toNumber());
			totalVotingPower = await staking.getPriorTotalVotingPower(result.receipt.blockNumber, kickoffTS.add(new BN(DELAY * 26)));
			await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
		});

		it("should be unable to compute the total voting power for the current block", async () => {
			let result = await staking.stake("100", inOneYear, a3, a3, { from: a2 });
			await expectRevert(
				staking.getPriorTotalVotingPower(result.receipt.blockNumber, kickoffTS),
				"Staking::getPriorTotalStakesForDate: not yet determined"
			);
		});
	});

	describe("delegated voting power computation", () => {
		it("should compute the expected voting power", async () => {
			await staking.stake("100", inThreeYears, a1, a2, { from: a2 });
			await staking.stake("100", inTwoYears, a2, a3, { from: a2 });
			let result = await staking.stake("100", inOneYear, a3, a2, { from: a2 });
			await mineBlock();

			let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
			let maxDuration = await staking.MAX_DURATION.call();
			let weightFactor = await staking.WEIGHT_FACTOR.call();

			//power on kickoff date
			let expectedPower =
				weightingFunction(100, DELAY * (26 * 3), maxDuration, maxVotingWeight, weightFactor.toNumber()) +
				weightingFunction(100, DELAY * 26, maxDuration, maxVotingWeight, weightFactor.toNumber());
			let totalVotingPower = await staking.getPriorVotes(a2, result.receipt.blockNumber, kickoffTS);
			await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);

			//power 52 weeks later
			expectedPower =
				weightingFunction(100, DELAY * (26 * 2), maxDuration, maxVotingWeight, weightFactor.toNumber()) +
				weightingFunction(100, DELAY * 26 * 0, maxDuration, maxVotingWeight, weightFactor.toNumber());
			totalVotingPower = await staking.getPriorVotes(a2, result.receipt.blockNumber, kickoffTS.add(new BN(DELAY * 26)));
			await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
		});

		it("should be unable to compute the voting power for the current block", async () => {
			let result = await staking.stake("100", inOneYear, a3, a3, { from: a2 });
			await expectRevert(
				staking.getPriorVotes(a3, result.receipt.blockNumber, kickoffTS),
				"Staking::getPriorStakeByDateForDelegatee: not yet determined"
			);
		});

		it("should return the current votes", async () => {
			await staking.stake("100", inThreeYears, a2, a2, { from: a2 });
			await mineBlock();

			let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
			let maxDuration = await staking.MAX_DURATION.call();
			let weightFactor = await staking.WEIGHT_FACTOR.call();

			let expectedPower = weightingFunction(100, DELAY * (26 * 3), maxDuration, maxVotingWeight, weightFactor.toNumber());
			let currentVotes = await staking.getCurrentVotes.call(a2);
			await expect(currentVotes.toNumber()).to.be.equal(expectedPower);
		});
	});

	describe("user weighted stake computation", () => {
		it("should compute the expected weighted stake", async () => {
			await staking.stake("100", inThreeYears, a2, a2, { from: a2 });
			await staking.stake("100", inTwoYears, a1, a3, { from: a2 });
			let result = await staking.stake("100", inThreeYears, a2, a2, { from: a2 });
			await mineBlock();

			let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
			let maxDuration = await staking.MAX_DURATION.call();
			let weightFactor = await staking.WEIGHT_FACTOR.call();

			//power on kickoff date
			let expectedPower = weightingFunction(200, DELAY * (26 * 3), maxDuration, maxVotingWeight, weightFactor.toNumber());
			let totalVotingPower = await staking.getPriorWeightedStake(a2, result.receipt.blockNumber, kickoffTS);
			await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);

			//power 52 weeks later
			expectedPower = weightingFunction(200, DELAY * (26 * 2), maxDuration, maxVotingWeight, weightFactor.toNumber());
			totalVotingPower = await staking.getPriorWeightedStake(a2, result.receipt.blockNumber, kickoffTS.add(new BN(DELAY * 26)));
			await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
		});

		it("should be unable to compute the weighted stake for the current block", async () => {
			let result = await staking.stake("100", inOneYear, a3, a3, { from: a2 });
			await expectRevert(
				staking.getPriorWeightedStake(a3, result.receipt.blockNumber, kickoffTS),
				"Staking::getPriorUserStakeAndDate: not yet determined"
			);
		});
	});

	describe("vested weighted stake computation", () => {
		//TODO: copy and adapt from user weighted stake
	});

	describe("general weight computation", () => {
		it("should compute the expected weight for every staking duration", async () => {
			let kickoffTS = await staking.kickoffTS.call();
			let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
			let maxDuration = await staking.MAX_DURATION.call();
			let weightFactor = await staking.WEIGHT_FACTOR.call();
			let expectedWeight;
			for (let i = 0; i <= 78; i++) {
				expectedWeight = weightingFunction(100, i * DELAY, maxDuration, maxVotingWeight, weightFactor.toNumber());
				let newTime = kickoffTS.add(new BN(i * DELAY));
				let w = Math.floor((100 * (await staking.computeWeightByDate(newTime, kickoffTS)).toNumber()) / weightFactor.toNumber());
				await expect(w).to.be.equal(expectedWeight);
				//console.log(expectedWeight);
			}
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
	return Math.floor((stake * (Math.floor((maxVotingWeight * weightFactor * (mD2 - x * x)) / mD2) + weightFactor)) / weightFactor);
}
