const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const {
	etherUnsigned,
	encodeParameters,
	etherMantissa,
	mineBlock,
	setTime,
	increaseTime,
	setNextBlockTimestamp,
	blockNumber,
} = require("../../Utils/Ethereum");

const path = require("path");
const solparse = require("solparse");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("TimelockHarness");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");

const governorAlphaPath = path.join(__dirname, "../../..", "contracts", "governance/GovernorAlpha.sol");

const statesInverted = solparse
	.parseFile(governorAlphaPath)
	.body.find((k) => k.type === "ContractStatement")
	.body.find((k) => k.name === "ProposalState").members;

const states = Object.entries(statesInverted).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});

const TWO_PERCENTAGE_VOTES = etherMantissa(200000);
const QUORUM_VOTES = etherMantissa(4000000);
const QUORUM_VOTES_MUL_2 = etherMantissa(4000000 * 2);
const TOTAL_SUPPLY = etherMantissa(1000000000);

const DELAY = 86400 * 14;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const QUORUM = 4;
const MAJORITY = 50;

contract("GovernorAlpha#state/1", (accounts) => {
	let token, staking, gov, root, acct, acct2, delay, timelock;
	let trivialProposal, targets, values, signatures, callDatas;

	before(async () => {
		[root, acct, acct2, ...accounts] = accounts;
	});

	beforeEach(async () => {
		//await setTime(100);
		block = await ethers.provider.getBlock("latest");
		setNextBlockTimestamp(block.timestamp + 100);

		token = await TestToken.new("TestToken", "TST", 18, TOTAL_SUPPLY);

		await deployGovernor();

		await token.approve(staking.address, QUORUM_VOTES);
		await staking.stake(QUORUM_VOTES, block.timestamp + MAX_DURATION, root, root);

		await token.transfer(acct, QUORUM_VOTES);
		await token.approve(staking.address, QUORUM_VOTES, { from: acct });
		let kickoffTS = await staking.kickoffTS.call();
		let stakingDate = kickoffTS.add(new BN(MAX_DURATION));
		await staking.stake(QUORUM_VOTES, stakingDate, acct, acct, { from: acct });

		await token.transfer(accounts[3], TWO_PERCENTAGE_VOTES);
		await token.approve(staking.address, TWO_PERCENTAGE_VOTES, { from: accounts[3] });
		kickoffTS = await staking.kickoffTS.call();
		stakingDate = kickoffTS.add(new BN(MAX_DURATION));
		await staking.stake(TWO_PERCENTAGE_VOTES, stakingDate, accounts[3], accounts[3], { from: accounts[3] });

		//
		targets = [root];
		values = ["0"];
		signatures = ["getBalanceOf(address)"];
		callDatas = [encodeParameters(["address"], [acct])];

		await mineBlock();
		await updateTime(staking);
		await gov.propose(targets, values, signatures, callDatas, "do nothing");
		proposalId = await gov.latestProposalIds.call(root);
		trivialProposal = await gov.proposals.call(proposalId);
	});

	it("Invalid for proposal not found", async () => {
		await expectRevert(gov.state.call("5"), "GovernorAlpha::state: invalid proposal id");
	});

	it("Pending", async () => {
		expect((await gov.state.call(trivialProposal.id)).toString()).to.be.equal(states["Pending"].toString());
	});

	it("Active", async () => {
		await mineBlock();
		await mineBlock();
		expect((await gov.state.call(trivialProposal.id)).toString()).to.be.equal(states["Active"].toString());
	});

	it("Canceled", async () => {
		await mineBlock();
		await updateTime(staking);
		await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
		let newProposalId = await gov.proposalCount.call();

		await gov.cancel(newProposalId);

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Canceled"]);
	});

	it("Defeated by time", async () => {
		// travel to end block
		await advanceBlocks(20);

		expect((await gov.state(trivialProposal.id)).toString()).to.be.equal(states["Defeated"]);
	});

	it("Defeated by quorum", async () => {
		await mineBlock();
		await updateTime(staking);

		await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: accounts[3] });
		let newProposalId = await gov.latestProposalIds.call(accounts[3]);
		await mineBlock();

		await updateTime(staking);
		await gov.castVote(newProposalId, true, { from: accounts[3] });
		await advanceBlocks(20);

		//2% of votes
		let proposal = await gov.proposals.call(newProposalId);
		let totalVotes = proposal.forVotes.add(proposal.againstVotes);
		expect(totalVotes).to.be.bignumber.lessThan(proposal.quorum);

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Defeated"]);
	});

	it("Defeated by minPercentageVotes", async () => {
		let stakeAmount = QUORUM_VOTES_MUL_2;
		await token.transfer(acct2, stakeAmount);
		await token.approve(staking.address, stakeAmount, { from: acct2 });
		let kickoffTS = await staking.kickoffTS.call();
		let stakingDate = kickoffTS.add(new BN(MAX_DURATION));
		await staking.stake(stakeAmount, stakingDate, acct2, acct2, { from: acct2 });

		await mineBlock();
		await updateTime(staking);

		await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
		let newProposalId = await gov.latestProposalIds.call(acct);
		await mineBlock();

		await updateTime(staking);
		await gov.castVote(newProposalId, true, { from: acct });
		await gov.castVote(newProposalId, false, { from: acct2 });
		await advanceBlocks(20);

		//48% of votes
		let proposal = await gov.proposals.call(newProposalId);
		let totalVotes = proposal.forVotes.add(proposal.againstVotes);
		expect(totalVotes).to.be.bignumber.greaterThan(proposal.quorum);
		expect(proposal.forVotes).to.be.bignumber.lessThan(totalVotes.mul(new BN(MAJORITY)).div(new BN(100)));

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Defeated"]);
	});

	it("Succeeded", async () => {
		await mineBlock();
		await updateTime(staking);

		await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
		let newProposalId = await gov.latestProposalIds.call(acct);
		await mineBlock();

		await updateTime(staking);
		await gov.castVote(newProposalId, true);
		await gov.castVote(newProposalId, true, { from: accounts[3] });
		await advanceBlocks(20);

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Succeeded"]);
	});

	it("Queued", async () => {
		await mineBlock();
		await updateTime(staking);
		await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
		let newProposalId = await gov.latestProposalIds.call(acct);
		await mineBlock();

		await updateTime(staking);
		await gov.castVote(newProposalId, true);
		await gov.castVote(newProposalId, true, { from: accounts[3] });
		await advanceBlocks(20);

		await gov.queue(newProposalId, { from: acct });
		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Queued"]);
	});

	it("Expired", async () => {
		await mineBlock();
		await updateTime(staking);
		await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
		let newProposalId = await gov.latestProposalIds.call(acct);
		await mineBlock();

		await updateTime(staking);
		await gov.castVote(newProposalId, true);
		await gov.castVote(newProposalId, true, { from: accounts[3] });
		await advanceBlocks(20);

		await increaseTime(1);
		await gov.queue(newProposalId, { from: acct });

		let gracePeriod = await timelock.GRACE_PERIOD.call();
		let p = await gov.proposals.call(newProposalId);
		let eta = etherUnsigned(p.eta);

		//await setTime(eta.plus(gracePeriod).minus(1).toNumber());
		setNextBlockTimestamp(eta.plus(gracePeriod).minus(1).toNumber());

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Queued"]);

		await increaseTime(1 /*eta.plus(gracePeriod).toNumber()*/);
		await mineBlock();

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Expired"]);
	});

	it("Executed", async () => {
		await mineBlock();
		await updateTime(staking);
		await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
		let newProposalId = await gov.latestProposalIds.call(acct);

		await mineBlock();
		await updateTime(staking);
		await gov.castVote(newProposalId, true);
		await gov.castVote(newProposalId, true, { from: accounts[3] });
		await advanceBlocks(20);

		await gov.queue(newProposalId, { from: acct });

		let gracePeriod = await timelock.GRACE_PERIOD.call();
		let p = await gov.proposals.call(newProposalId);
		let eta = etherUnsigned(p.eta);

		//await setTime(eta.plus(gracePeriod).minus(1).toNumber());
		setNextBlockTimestamp(eta.plus(gracePeriod).minus(1).toNumber());

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Queued"]);
		await gov.execute(newProposalId, { from: acct });

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Executed"]);

		// still executed even though would be expired
		// await setTime(eta.plus(gracePeriod).toNumber());
		setNextBlockTimestamp(eta.plus(gracePeriod).toNumber());

		expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Executed"]);
	});

	it("Shouldn't be canceled", async () => {
		await deployGovernor();
		await token.approve(staking.address, TOTAL_SUPPLY);
		let kickoffTS = await staking.kickoffTS.call();

		//stakes tokens for user 1, 99% of voting power
		await staking.stake(99000, kickoffTS.add(new BN(DELAY)), root, root);
		await mineBlock();

		//stakes tokens for user 2 (proposer), we need more than 1% of voting power
		await staking.stake(1100, kickoffTS.add(new BN(DELAY)), acct, acct);
		await mineBlock();

		//proposer creates proposal
		await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
		let proposalId = await gov.latestProposalIds.call(acct);
		await mineBlock();

		//voting
		// await gov.castVote(proposalId, true);

		//queue proposal
		// await advanceBlocks(10);
		// await gov.queue(proposalId);

		//increase proposal threshold - stakes tokens for user 3
		// await staking.stake(10000, kickoffTS.add(new BN(DELAY)), accounts[3], accounts[3]);
		// await mineBlock();

		//cancel proposal
		await expectRevert(gov.cancel(proposalId, { from: acct }), "GovernorAlpha::cancel: sender isn't a guardian");
	});

	async function deployGovernor() {
		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		delay = etherUnsigned(2 * 24 * 60 * 60).multipliedBy(2);
		timelock = await Timelock.new(root, delay);
		delay = etherUnsigned(10);
		await timelock.setDelayWithoutChecking(delay);

		gov = await GovernorAlpha.new(timelock.address, staking.address, root, QUORUM, MAJORITY);

		await timelock.harnessSetAdmin(gov.address);
	}
});

async function advanceBlocks(number) {
	for (let i = 0; i < number; i++) {
		await mineBlock();
	}
}

async function getTimeFromKickoff(delay) {
	let kickoffTS = await staking.kickoffTS.call();
	return kickoffTS.add(new BN(delay));
}
async function updateTime(staking) {
	let kickoffTS = await staking.kickoffTS.call();
	let newTime = kickoffTS.add(new BN(DELAY).mul(new BN(2)));
	// await setTime(newTime);
	let block = await ethers.provider.getBlock("latest");
	await setNextBlockTimestamp(Math.max(newTime.toNumber(), block.timestamp + 1));
}
