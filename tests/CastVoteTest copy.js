const hre = require("hardhat");
const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const { address, etherMantissa, etherUnsigned, encodeParameters, mineBlock, unlockedAccount, setTime } = require("../../Utils/Ethereum");
const EIP712 = require("../../Utils/EIP712");

const { getAccountsPrivateKeys, getAccountsPrivateKeysBuffer } = require("../../Utils/hardhat_utils");
const BigNumber = require("bignumber.js");
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
		console.log(accounts);
		[root, a1, ...accounts] = accounts;
		//a1 = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
		//a1 = "0x7b2512b985a3fc84b1578dc555c14dfa1cf5ace5";
		[pkbRoot, pkbA1, ...pkbAccounts] = getAccountsPrivateKeysBuffer();
		console.log(`PKBA1: `);
		console.log(pkbA1);
		console.log(`PKBA1:-- `);
		getAccountsPrivateKeysBuffer()[0];
		getAccountsPrivateKeysBuffer()[1];
		//console.log(ethers.provider);
		currentChainId = (await ethers.provider.getNetwork()).chainId;
		console.log(`CHAIN ID: ${currentChainId}`);
		//root = bufferToHex(privateToAddress(pbRoot));
		//a1 = bufferToHex(privateToAddress(pbA1));
		/*console.log(`unlockedAccount(a1).secretKey:`);*/
		/*console.log("===============================================");
		pkAcc.forEach((el) => console.log(bufferToHex(privateToAddress(el))));
		console.log("===============================================");
		console.log(`root: ${root}`);
		console.log(`a1: ${a1}`);
		console.log("===============================================");
		*/
		/*console.log("uask");
		const uask = unlockedAccount(a1).secretKey;
		console.log(bufferToHex(privateToAddress(uask)));
		console.log(bufferToHex(uask));
		console.log(uask);
		console.log("===============================================");
		*/
		//[pRoot, pA1] = getAccountsPrivateKeys();
		//root = bufferToHex(privateToAddress(pRoot));
		//root = privateToAddress(pRoot.privateKey);
		//a1 = bufferToHex(privateToAddress(pA1));
		//a1 = bufferToHex(privateToAddress(pA1.privateKey));
		/* paramA10 = pA1.privateKey;
		paramA11 = privateToAddress(pA1.privateKey);
		paramA12 = bufferToHex(privateToAddress(pA1.privateKey));
		paramA13 = pbA1;
		paramA14 = bufferToHex(pbA1);
		console.log("bufferToHex(privateToAddress(pbA1)): ");
		console.log(bufferToHex(privateToAddress(pbA1)));
		console.log("= = = = = = = = = = = = = = = = = = = = = = = = = "); */
		//pRoot = pRoot.privateKey;
		//pA1 = pA1.privateKey;
		/* console.log(pRoot);
		console.log(a1);
		console.log(root);
		console.log(a1); */
		/*console.log(`bufferToHex(pbA1): ${bufferToHex(pbA1)}`);

		console.log("= = = = = = = = = = = = = = = = = = = = = = = = = ");
		*/
		//console.log(pA1 === uask);

		// pkAcc.forEach((el) => console.log(el));
		/*console.log("===============================================");
		pkAcc.forEach((el) => console.log(bufferToHex(privateToAddress(el))));
		pkAcc.forEach((el) => console.log(bufferToHex(el)));
		console.log("|||||||||||||||||||||||||||||||||||||||||||||||||");

		console.log(bufferToHex(privateToAddress(pA1)));
		console.log("--------------------------------------------------------------------------");
		pkAcc.forEach((el) => console.log(bufferToHex(privateToAddress(el))));*/

		let blockTimestamp = etherUnsigned(100);
		await setTime(blockTimestamp.toNumber());
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
		console.log("callDatas: ");
		console.log(callDatas);
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
			const Domain = async (gov) => ({
				name: "Sovryn Governor Alpha",
				chainId: 31337, //currentChainId, // hh: 31337 default //await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
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

			it.only("casts vote on behalf of the signatory", async () => {
				await enfranchise(token, staking, a1, QUORUM_VOTES);
				await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: a1 });
				proposalId = await gov.latestProposalIds.call(a1);
				console.log("proposalId: ");
				console.log(proposalId.toString());
				console.log("currentChainId");
				console.log(currentChainId);
				//const signer = await new ethers.providers.JsonRpcProvider().getSigner(a1);
				const { v, r, s } = EIP712.sign(
					Domain(gov),
					"Ballot",
					{
						proposalId,
						support: true,
					},
					Types,
					pkbA1
					//unlockedAccount(a1).secretKey - doesn't work with hardhat
				);
				//console.log("unlockedAccount(a1).secretKey");
				//console.log(unlockedAccount(a1).secretKey);
				let beforeFors = (await gov.proposals.call(proposalId)).forVotes;
				console.log(`beforeFors`);
				console.log(beforeFors.toString(16));
				await mineBlock();
				const tx = await gov.castVoteBySig(proposalId, true, v, r, s, { from: a1 });
				console.log("tx: ");
				console.log(tx.logs[0].args);
				expect(tx.gasUsed < 80000);

				let proposal = await gov.proposals.call(proposalId);
				console.log(proposal);
				console.log("************************");
				console.log(proposal.startBlock.toString());
				console.log(proposal.startTime.toString());
				console.log("************************");
				let expectedVotes = await staking.getPriorVotes.call(a1, proposal.startBlock.toString(), proposal.startTime.toString());
				let afterFors = (await gov.proposals.call(proposalId)).forVotes;
				console.log("afterFors: ");
				console.log(afterFors.toString());
				console.log("************************");
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
			console.log("\n" + proposal.forVotes.toString());
		});
	});
});
