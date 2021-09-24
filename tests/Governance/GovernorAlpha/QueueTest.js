/** Speed optimized on branch hardhatTestRefactor, 2021-09-22
 * Bottlenecks found redeploying staking and governance.
 *
 * Notes:
 * Init deployments (token, staking and gov) has been isolated into the before hook.
 * As there are only two tests, and run independently (hardhat vs ganache) there's not
 * advantage on creating a fixture for the init deployments.
 */

const { expectRevert, BN } = require("@openzeppelin/test-helpers");

const { etherMantissa, encodeParameters, mineBlock, increaseTime } = require("../../Utils/Ethereum");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const Timelock = artifacts.require("TimelockHarness");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");

const DELAY = 86400 * 14;

const QUORUM_VOTES = etherMantissa(4000000);
const TOTAL_SUPPLY = etherMantissa(10000000000000); /// @dev increased to share the same value in both tests.

async function enfranchise(token, staking, actor, amount) {
	await token.transfer(actor, amount);
	await token.approve(staking.address, amount, { from: actor });
	let kickoffTS = await staking.kickoffTS.call();
	let stakingDate = kickoffTS.add(new BN(DELAY));
	await staking.stake(amount, stakingDate, actor, actor, { from: actor });

	await staking.delegate(actor, stakingDate, { from: actor });
}

contract("GovernorAlpha#queue/1", (accounts) => {
	let root, a1, a2;
	let token, staking, gov;

	before(async () => {
		[root, a1, a2, ...accounts] = accounts;

		const timelock = await Timelock.new(root, DELAY);
		token = await TestToken.new("TestToken", "TST", 18, TOTAL_SUPPLY);

		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		gov = await GovernorAlpha.new(timelock.address, staking.address, root, 4, 0);

		await timelock.harnessSetAdmin(gov.address);

		await enfranchise(token, staking, a1, QUORUM_VOTES);
		await mineBlock();
	});

	describe("overlapping actions", () => {
		it("reverts on queueing overlapping actions in same proposal", async () => {
			const targets = [staking.address, staking.address];
			const values = ["0", "0"];
			const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
			const calldatas = [encodeParameters(["address"], [root]), encodeParameters(["address"], [root])];

			await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a1 });
			let proposalId1 = await gov.proposalCount.call();
			await mineBlock();

			await gov.castVote(proposalId1, true, { from: a1 });
			await advanceBlocks(10);
			await expectRevert(gov.queue(proposalId1), "GovernorAlpha::_queueOrRevert: proposal action already queued at eta");
		});

		it("reverts on queueing overlapping actions in different proposals, works if waiting; using Ganache", async () => {
			await enfranchise(token, staking, a2, QUORUM_VOTES);
			await mineBlock();

			const targets = [staking.address];
			const values = ["0"];
			const signatures = ["getBalanceOf(address)"];
			const calldatas = [encodeParameters(["address"], [root])];

			await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a1 });
			let proposalId1 = await gov.proposalCount.call();

			await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a2 });
			let proposalId2 = await gov.proposalCount.call();
			await mineBlock();

			await gov.castVote(proposalId1, true, { from: a1 });
			await gov.castVote(proposalId2, true, { from: a2 });
			await advanceBlocks(30);

			await expectRevert(
				gov.queueProposals([proposalId1, proposalId2]),
				"GovernorAlpha::_queueOrRevert: proposal action already queued at eta"
			);

			await gov.queue(proposalId1);
			await increaseTime(60);
			await gov.queue(proposalId2);
		});
	});
});

async function advanceBlocks(number) {
	for (let i = 0; i < number; i++) {
		await mineBlock();
	}
}
