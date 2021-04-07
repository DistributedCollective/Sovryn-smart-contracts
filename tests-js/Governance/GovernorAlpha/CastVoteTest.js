const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const {
	address,
	etherMantissa,
	etherUnsigned,
	encodeParameters,
	mineBlock,
	unlockedAccount,
	setTime,
	setNextBlockTimestamp,
} = require("../../Utils/Ethereum");
const EIP712 = require("../../Utils/EIP712");
const BigNumber = require("bignumber.js");

const { getAccountsPrivateKeys, getAccountsPrivateKeysBuffer } = require("../../Utils/hardhat_utils");
const { bufferToHex, privateToAddress, toChecksumAddress } = require("ethereumjs-util");

const GovernorAlpha = artifacts.require("GovernorAlphaMockup");
const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");

const DELAY = 86400 * 14;
const TWO_WEEKS = 86400 * 14;

const QUORUM_VOTES = etherMantissa(4000000);
const TOTAL_SUPPLY = etherMantissa(100000000);

async function enfranchise(token, comp, actor, amount) {
	await token.transfer(actor, amount);
	await token.approve(comp.address, amount, { from: actor });
	let kickoffTS = await comp.kickoffTS.call();
	await comp.stake(amount, kickoffTS.add(new BN(DELAY)), actor, actor, { from: actor });
}

contract("governorAlpha#castVote/2", (accounts) => {
	let token, staking, gov, root, a1;
	let pkbA1, currentChainId;
	let targets, values, signatures, callDatas, proposalId;

	before(async () => {
		[root, a1, ...accounts] = accounts;
		[pkbRoot, pkbA1, ...pkbAccounts] = getAccountsPrivateKeysBuffer();
		currentChainId = (await ethers.provider.getNetwork()).chainId;
		//let blockTimestamp = etherUnsigned(100);
		//await setTime(blockTimestamp.toNumber());
		block = await ethers.provider.getBlock("latest");
		setNextBlockTimestamp(block.timestamp + 100);
		token = await TestToken.new("TestToken", "TST", 18, TOTAL_SUPPLY);

		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		gov = await GovernorAlpha.new(address(0), staking.address, root, 4, 0);

		targets = [a1];
		values = ["0"];
		signatures = ["getBalanceOf(address)"];
		callDatas = [encodeParameters(["address"], [a1])];
		await enfranchise(token, staking, root, QUORUM_VOTES);
		await gov.propose(targets, values, signatures, callDatas, "do nothing");
		proposalId = await gov.latestProposalIds.call(root);
	});

	describe("We must revert if:", () => {
		it("There does not exist a proposal with matching proposal id where the current block number is between the proposal's start block (exclusive) and end block (inclusive)", async () => {
			await expectRevert(gov.castVote.call(proposalId, true), "revert GovernorAlpha::_castVote: voting is closed");
		});

		it("Such proposal already has an entry in its voters set matching the sender", async () => {
			await mineBlock();
			await mineBlock();

			await gov.castVote(proposalId, true, { from: accounts[4] });
			await expectRevert(
				gov.castVote.call(proposalId, true, { from: accounts[4] }),
				"revert GovernorAlpha::_castVote: voter already voted"
			);
		});
	});

	describe("Otherwise", () => {
		it("we add the sender to the proposal's voters set", async () => {
			await expect((await gov.getReceipt.call(proposalId, accounts[2])).hasVoted).to.be.equal(false);
			await gov.castVote(proposalId, true, { from: accounts[2] });
			await expect((await gov.getReceipt.call(proposalId, accounts[2])).hasVoted).to.be.equal(true);
		});

		describe("and we take the balance returned by GetPriorVotes for the given sender and the proposal's start block, which may be zero,", () => {
			let actor; // an account that will propose, receive tokens, delegate to self, and vote on own proposal

			it("and we add that ForVotes", async () => {
				actor = accounts[1];
				await enfranchise(token, staking, actor, QUORUM_VOTES);

				await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: actor });
				proposalId = await gov.latestProposalIds.call(actor);

				let beforeFors = (await gov.proposals.call(proposalId)).forVotes;
				await mineBlock();
				await gov.castVote(proposalId, true, { from: actor });

				let afterFors = (await gov.proposals.call(proposalId)).forVotes;
				let proposal = await gov.proposals.call(proposalId);
				let expectedVotes = await staking.getPriorVotes.call(actor, proposal.startBlock.toString(), proposal.startTime.toString());
				expect(new BigNumber(afterFors).toString()).to.be.equal(new BigNumber(expectedVotes.toString()).toString());
			});

			it("or AgainstVotes corresponding to the caller's support flag.", async () => {
				actor = accounts[3];

				await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: actor });
				proposalId = await gov.latestProposalIds.call(actor);

				let beforeAgainsts = (await gov.proposals.call(proposalId)).againstVotes;
				await mineBlock();
				await gov.castVote(proposalId, false, { from: actor });

				let afterAgainsts = (await gov.proposals.call(proposalId)).againstVotes;
				let proposal = await gov.proposals.call(proposalId);
				let expectedVotes = await staking.getPriorVotes.call(actor, proposal.startBlock.toString(), proposal.startTime.toString());
				expect(new BigNumber(afterAgainsts).toString()).to.be.equal(new BigNumber(expectedVotes.toString()).toString());
			});
		});

		describe("castVoteBySig", () => {
			const Domain = (gov) => ({
				name: "Sovryn Governor Alpha",
				chainId: currentChainId, //31337 - Hardhat, //1 - Mainnet, // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
				verifyingContract: gov.address,
			});
			const Types = {
				Ballot: [
					{ name: "proposalId", type: "uint256" },
					{ name: "support", type: "bool" },
				],
			};

			it("reverts if the signatory is invalid", async () => {
				await expectRevert(
					gov.castVoteBySig(proposalId, false, 0, "0xbad", "0xbad"),
					"revert GovernorAlpha::castVoteBySig: invalid signature"
				);
			});

			it("casts vote on behalf of the signatory", async () => {
				await enfranchise(token, staking, a1, QUORUM_VOTES);
				await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: a1 });
				proposalId = await gov.latestProposalIds.call(a1);

				const { v, r, s } = EIP712.sign(
					Domain(gov),
					"Ballot",
					{
						proposalId,
						support: true,
					},
					Types,
					pkbA1
					//unlockedAccount(a1).secretKey - this doesn't work with Hardhat
				);

				let beforeFors = (await gov.proposals.call(proposalId)).forVotes;
				await mineBlock();
				const tx = await gov.castVoteBySig(proposalId, true, v, r, s, { from: a1 });
				expect(tx.gasUsed < 80000);

				let proposal = await gov.proposals.call(proposalId);
				let expectedVotes = await staking.getPriorVotes.call(a1, proposal.startBlock.toString(), proposal.startTime.toString());
				let afterFors = (await gov.proposals.call(proposalId)).forVotes;
				expect(new BigNumber(afterFors).toString()).to.be.equal(new BigNumber(expectedVotes.toString()).toString());
			});
		});

		it("receipt uses one load", async () => {
			let actor = accounts[2];
			let actor2 = accounts[3];
			await enfranchise(token, staking, actor, QUORUM_VOTES);
			await enfranchise(token, staking, actor2, QUORUM_VOTES.multipliedBy(2));
			await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: actor });
			proposalId = await gov.latestProposalIds.call(actor);

			await mineBlock();
			await mineBlock();
			await gov.castVote(proposalId, true, { from: actor });
			await gov.castVote(proposalId, false, { from: actor2 });

			let trxReceipt = await gov.getReceipt.call(proposalId, actor);
			let trxReceipt2 = await gov.getReceipt.call(proposalId, actor2);

			let proposal = await gov.proposals.call(proposalId);
			let expectedVotes = await staking.getPriorVotes.call(actor, proposal.startBlock.toString(), proposal.startTime.toString());
			let expectedVotes2 = await staking.getPriorVotes.call(actor2, proposal.startBlock.toString(), proposal.startTime.toString());

			expect(new BigNumber(trxReceipt.votes.toString()).toString()).to.be.equal(new BigNumber(expectedVotes.toString()).toString());
			expect(trxReceipt.hasVoted).to.be.equal(true);
			expect(trxReceipt.support).to.be.equal(true);

			expect(new BigNumber(trxReceipt2.votes.toString()).toString()).to.be.equal(new BigNumber(expectedVotes2.toString()).toString());
			expect(trxReceipt2.hasVoted).to.be.equal(true);
			expect(trxReceipt2.support).to.be.equal(false);
		});
	});

	describe("Check votes for a proposal creator:", () => {
		it("compare votes", async () => {
			let actor = accounts[4];
			let amount = etherMantissa(1000000);
			await token.transfer(actor, amount);
			await token.approve(staking.address, amount, { from: actor });
			let kickoffTS = await staking.kickoffTS.call();
			await staking.stake(amount, kickoffTS.add(new BN(TWO_WEEKS)), actor, actor, { from: actor });

			await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: actor });
			proposalId = await gov.latestProposalIds.call(actor);

			let proposal = await gov.proposals.call(proposalId);
			expect(proposal.forVotes.toNumber()).to.be.equal(0);

			await mineBlock();
			await gov.castVote(proposalId, true, { from: actor });

			proposal = await gov.proposals.call(proposalId);
			let expectedVotes = await staking.getPriorVotes.call(actor, proposal.startBlock, proposal.startTime);
			expect(proposal.forVotes.toString()).to.be.equal(expectedVotes.toString());
			let receipt = await gov.getReceipt.call(proposalId, actor);
			expect(receipt.votes.toString()).to.be.equal(expectedVotes.toString());
			// console.log("\n" + proposal.forVotes.toString());
		});
	});
});
