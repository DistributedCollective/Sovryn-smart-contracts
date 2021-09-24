/** Speed optimized on branch hardhatTestRefactor, 2021-09-22
 * No bottlenecks found.
 *
 * Total time elapsed: 6.0s
 * After optimization: 5.8s
 *
 * Minor optimizations:
 * - removed unneeded variables
 *
 */

const { expect } = require("chai");
const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");

const { address, etherMantissa, encodeParameters, mineBlock } = require("../../Utils/Ethereum");

const GovernorAlpha = artifacts.require("GovernorAlpha");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");

const QUORUM_VOTES = etherMantissa(4000000);
const TOTAL_SUPPLY = etherMantissa(1000000000);

const DELAY = 86400 * 14;

contract("GovernorAlpha#propose/5", (accounts) => {
	let token, staking, gov, root, acct;
	let trivialProposal, targets, values, signatures, callDatas;
	let proposalBlock;

	before(async () => {
		[root, acct, ...accounts] = accounts;
		token = await TestToken.new("TestToken", "TST", 18, TOTAL_SUPPLY);

		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		gov = await GovernorAlpha.new(address(0), staking.address, address(0), 4, 0);

		targets = [root];
		// values = ["0"];
		values = [new BN("0")];
		signatures = ["getBalanceOf(address)"];
		callDatas = [encodeParameters(["address"], [acct])];

		await token.approve(staking.address, QUORUM_VOTES);
		let kickoffTS = await staking.kickoffTS.call();
		let stakingDate = kickoffTS.add(new BN(DELAY));
		await staking.stake(QUORUM_VOTES, stakingDate, acct, acct);
		await staking.delegate(root, stakingDate, { from: acct });

		await gov.propose(targets, values, signatures, callDatas, "do nothing");

		proposalBlock = +(await web3.eth.getBlockNumber());
		proposalId = await gov.latestProposalIds.call(root);
		trivialProposal = await gov.proposals.call(proposalId);
	});

	describe("simple initialization", () => {
		it("ID is set to a globally unique identifier", async () => {
			expect(trivialProposal.id.toString()).to.be.equal(proposalId.toString());
		});

		it("Proposer is set to the sender", async () => {
			expect(trivialProposal.proposer).to.be.equal(root);
		});

		it("Start block is set to the current block number plus vote delay", async () => {
			expect(trivialProposal.startBlock.toString()).to.be.equal(proposalBlock + 1 + "");
		});

		it("End block is set to the current block number plus the sum of vote delay and vote period", async () => {
			expect(trivialProposal.endBlock.toString()).to.be.equal(proposalBlock + 1 + 2880 + "");
		});

		it("ForVotes and AgainstVotes are initialized to zero", async () => {
			expect(trivialProposal.forVotes.toString()).to.be.equal("0");
			expect(trivialProposal.againstVotes.toString()).to.be.equal("0");
		});

		it("Executed and Canceled flags are initialized to false", async () => {
			expect(trivialProposal.canceled).to.be.equal(false);
			expect(trivialProposal.executed).to.be.equal(false);
		});

		it("ETA is initialized to zero", async () => {
			expect(trivialProposal.eta.toString()).to.be.equal("0");
		});

		it("Targets, Values, Signatures, Calldatas are set according to parameters", async () => {
			let dynamicFields = await gov.getActions.call(trivialProposal.id);
			expect(dynamicFields.targets).to.have.all.members(targets);
			expect(dynamicFields.values[0].toString()).to.be.equal(values[0].toString());
			expect(dynamicFields.signatures).to.have.all.members(signatures);
			expect(dynamicFields.calldatas).to.have.all.members(callDatas);
		});

		describe("This function must revert if", () => {
			it("the length of the values, signatures or calldatas arrays are not the same length,", async () => {
				await expectRevert(
					gov.propose.call(targets.concat(root), values, signatures, callDatas, "do nothing"),
					"GovernorAlpha::propose: proposal function information arity mismatch"
				);

				await expectRevert(
					gov.propose.call(targets, values.concat(values), signatures, callDatas, "do nothing"),
					"GovernorAlpha::propose: proposal function information arity mismatch"
				);

				await expectRevert(
					gov.propose.call(targets, values, signatures.concat(signatures), callDatas, "do nothing"),
					"GovernorAlpha::propose: proposal function information arity mismatch"
				);

				await expectRevert(
					gov.propose.call(targets, values, signatures, callDatas.concat(callDatas), "do nothing"),
					"GovernorAlpha::propose: proposal function information arity mismatch"
				);
			});

			it("or if that length is zero or greater than Max Operations.", async () => {
				await expectRevert(gov.propose.call([], [], [], [], "do nothing"), "GovernorAlpha::propose: must provide actions");
			});

			describe("Additionally, if there exists a pending or active proposal from the same proposer, we must revert.", () => {
				it("reverts with pending", async () => {
					await token.transfer(accounts[4], QUORUM_VOTES);
					await token.approve(staking.address, QUORUM_VOTES, { from: accounts[4] });
					let kickoffTS = await staking.kickoffTS.call();
					let stakingDate = kickoffTS.add(new BN(DELAY));
					await staking.stake(QUORUM_VOTES, stakingDate, accounts[4], accounts[4], { from: accounts[4] });
					await staking.delegate(accounts[4], stakingDate, { from: accounts[4] });

					await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: accounts[4] });
					await expectRevert(
						gov.propose.call(targets, values, signatures, callDatas, "do nothing", { from: accounts[4] }),
						"GovernorAlpha::propose: one live proposal per proposer, found an already pending proposal"
					);
				});

				it("reverts with active", async () => {
					await mineBlock();
					await mineBlock();

					await expectRevert(
						gov.propose.call(targets, values, signatures, callDatas, "do nothing"),
						"GovernorAlpha::propose: one live proposal per proposer, found an already active proposal"
					);
				});
			});
		});

		it("This function returns the id of the newly created proposal. # proposalId(n) = succ(proposalId(n-1))", async () => {
			await token.transfer(accounts[2], QUORUM_VOTES);
			await token.approve(staking.address, QUORUM_VOTES, { from: accounts[2] });
			let kickoffTS = await staking.kickoffTS.call();
			let stakingDate = kickoffTS.add(new BN(DELAY));
			await staking.stake(QUORUM_VOTES, stakingDate, accounts[2], accounts[2], { from: accounts[2] });
			await staking.delegate(accounts[2], stakingDate, { from: accounts[2] });

			await mineBlock();
			let nextProposalId = await gov.propose.call(targets, values, signatures, callDatas, "yoot", { from: accounts[2] });
			// let nextProposalId = await call(gov, 'propose', [targets, values, signatures, callDatas, "second proposal"], { from: accounts[2] });

			expect(+nextProposalId).to.be.equal(+trivialProposal.id + 1);
		});

		it("emits log with id and description", async () => {
			await token.transfer(accounts[3], QUORUM_VOTES);
			await token.approve(staking.address, QUORUM_VOTES, { from: accounts[3] });
			let kickoffTS = await staking.kickoffTS.call();
			let stakingDate = kickoffTS.add(new BN(DELAY));
			await staking.stake(QUORUM_VOTES, stakingDate, accounts[3], accounts[3], { from: accounts[3] });
			await staking.delegate(accounts[3], stakingDate, { from: accounts[3] });
			await mineBlock();

			// await updateTime(comp);
			let result = await gov.propose(targets, values, signatures, callDatas, "second proposal", { from: accounts[3] });
			let proposalId = await gov.latestProposalIds.call(accounts[3]);
			let blockNumber = (await web3.eth.getBlockNumber()) + 1;
			expectEvent(result, "ProposalCreated", {
				id: proposalId,
				targets: targets,
				// values: [new BN("0")]
				signatures: signatures,
				calldatas: callDatas,
				startBlock: new BN(blockNumber),
				endBlock: new BN(2880 + blockNumber),
				description: "second proposal",
				proposer: accounts[3],
			});
		});
	});
});
