const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const { address, minerStart, minerStop, unlockedAccount, mineBlock, etherMantissa, etherUnsigned, setTime } = require("../Utils/Ethereum");

const EIP712 = require("../Utils/EIP712");
//const EIP712Ethers = require("../Utils/EIP712Ethers");
const { getAccountsPrivateKeysBuffer } = require("../Utils/hardhat_utils");

const StakingLogic = artifacts.require("Staking");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");

const TOTAL_SUPPLY = "10000000000000000000000000";
const DELAY = 86400 * 14;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1095));

const DAY = 86400;
const TWO_WEEKS = 1209600;

//const { ethers } = require("hardhat");

contract("Staking", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let root, a1, a2, a3, chainId;
	let pA1;
	let token, staking;
	let MAX_VOTING_WEIGHT;

	let kickoffTS, inThreeYears;
	let currentChainId;

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
		[pkbRoot, pkbA1] = getAccountsPrivateKeysBuffer();
		currentChainId = (await ethers.provider.getNetwork()).chainId;
	});

	beforeEach(async () => {
		chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
		await web3.eth.net.getId();
		token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);

		MAX_VOTING_WEIGHT = await staking.MAX_VOTING_WEIGHT.call();

		kickoffTS = await staking.kickoffTS.call();
		inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));
	});

	describe("metadata", () => {
		it("has given name", async () => {
			expect(await token.name.call()).to.be.equal(name);
		});

		it("has given symbol", async () => {
			expect(await token.symbol.call()).to.be.equal(symbol);
		});
	});

	describe("balanceOf", () => {
		it("grants to initial account", async () => {
			expect((await token.balanceOf.call(root)).toString()).to.be.equal(TOTAL_SUPPLY);
		});
	});

	describe("delegateBySig", () => {
		const Domain = (staking) => ({ name: "SOVStaking", chainId: currentChainId, verifyingContract: staking.address });
		const Types = {
			Delegation: [
				{ name: "delegatee", type: "address" },
				{ name: "lockDate", type: "uint256" },
				{ name: "nonce", type: "uint256" },
				{ name: "expiry", type: "uint256" },
			],
		};

		it("reverts if the signatory is invalid", async () => {
			const delegatee = root,
				nonce = 0,
				expiry = 0;
			await expectRevert(
				staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, 0, "0xbad", "0xbad"),
				"revert Staking::delegateBySig: invalid signature"
			);
		});

		it("reverts if the nonce is bad ", async () => {
			const delegatee = root,
				nonce = 1,
				expiry = 0,
				lockDate = inThreeYears;
			const { v, r, s } = EIP712.sign(
				Domain(staking),
				"Delegation",
				{
					delegatee,
					lockDate,
					nonce,
					expiry,
				},
				Types,
				pkbA1
				//pA1.privateKey
				//unlockedAccount(a1).secretKey
			);
			/*const { v, r, s } = EIP712Ethers.sign(
				Domain(staking),
				"Delegation",
				{
					delegatee,
					lockDate,
					nonce,
					expiry,
				},
				Types,
				pA1
			);*/

			await expectRevert(
				staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s),
				"revert Staking::delegateBySig: invalid nonce"
			);
		});

		it("reverts if the signature has expired", async () => {
			const delegatee = root,
				nonce = 0,
				expiry = 0,
				lockDate = inThreeYears;
			const { v, r, s } = EIP712.sign(
				Domain(staking),
				"Delegation",
				{
					delegatee,
					lockDate,
					nonce,
					expiry,
				},
				Types,
				pkbA1
			);
			await expectRevert(
				staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s),
				"revert Staking::delegateBySig: signature expired"
			);
		});

		it("delegates on behalf of the signatory", async () => {
			const delegatee = root,
				nonce = 0,
				expiry = 10e9,
				lockDate = inThreeYears;
			const { v, r, s } = EIP712.sign(
				Domain(staking),
				"Delegation",
				{
					delegatee,
					lockDate,
					nonce,
					expiry,
				},
				Types,
				pkbA1
				//unlockedAccount(a1).secretKey
			);

			expect(await staking.delegates.call(a1, inThreeYears)).to.be.equal(address(0));
			const tx = await staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s);
			expect(tx.gasUsed < 80000);
			expect(await staking.delegates.call(a1, inThreeYears)).to.be.equal(root);
		});
	});

	describe("numCheckpoints", () => {
		it("returns the number of checkpoints for a delegate", async () => {
			let guy = accounts[0];

			await token.transfer(guy, "1000"); //give an account a few tokens for readability

			await expect((await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()).to.be.equal("0");

			await token.approve(staking.address, "1000", { from: guy });
			await staking.stake("100", inThreeYears, a1, a1, { from: guy });
			await expect((await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()).to.be.equal("1");

			await staking.stake("50", inThreeYears, a1, a1, { from: guy });
			await expect((await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()).to.be.equal("2");
		});

		it("does not add more than one checkpoint in a block", async () => {
			let guy = accounts[1];
			await token.transfer(guy, "1000"); //give an account a few tokens for readability
			await expect((await staking.numUserStakingCheckpoints.call(a3, inThreeYears)).toString()).to.be.equal("0");

			await token.approve(staking.address, "1000", { from: guy });

			//await minerStop();
			let t1 = staking.stake("80", inThreeYears, a3, a3, { from: guy });

			let t2 = staking.delegate(a3, inThreeYears, { from: guy });
			let t3 = token.transfer(a2, 10, { from: guy });
			let t4 = token.transfer(a2, 10, { from: guy });

			//await minerStart();
			t1 = await t1;
			t2 = await t2;
			t3 = await t3;
			t4 = await t4;

			await expect((await staking.numUserStakingCheckpoints.call(a3, inThreeYears)).toString()).to.be.equal("1");

			let checkpoint0 = await staking.userStakingCheckpoints.call(a3, inThreeYears, 0);
			await expect(checkpoint0.fromBlock.toString()).to.be.equal(t1.receipt.blockNumber.toString());
			await expect(checkpoint0.stake.toString()).to.be.equal("80");

			let checkpoint1 = await staking.userStakingCheckpoints.call(a3, inThreeYears, 1);
			await expect(checkpoint1.fromBlock.toString()).to.be.equal("0");
			await expect(checkpoint1.stake.toString()).to.be.equal("0");

			let checkpoint2 = await staking.userStakingCheckpoints.call(a3, inThreeYears, 2);
			await expect(checkpoint2.fromBlock.toString()).to.be.equal("0");
			await expect(checkpoint2.stake.toString()).to.be.equal("0");

			await token.approve(staking.address, "20", { from: a2 });
			let t5 = await staking.stake("20", inThreeYears, a3, a3, { from: a2 });

			await expect((await staking.numUserStakingCheckpoints.call(a3, inThreeYears)).toString()).to.be.equal("2");

			checkpoint1 = await staking.userStakingCheckpoints.call(a3, inThreeYears, 1);
			await expect(checkpoint1.fromBlock.toString()).to.be.equal(t5.receipt.blockNumber.toString());
			await expect(checkpoint1.stake.toString()).to.be.equal("100");
		});
	});

	describe("getPriorVotes", () => {
		let amount = "1000";

		it("reverts if block number >= current block", async () => {
			let time = kickoffTS.add(new BN(DELAY));
			await expectRevert(
				staking.getPriorVotes.call(a1, 5e10, time),
				"revert WeightedStaking::getPriorStakeByDateForDelegatee: not yet determined"
			);
		});

		it("returns 0 if there are no checkpoints", async () => {
			expect((await staking.getPriorVotes.call(a1, 0, kickoffTS)).toString()).to.be.equal("0");
		});

		it("returns the latest block if >= last checkpoint block", async () => {
			await token.approve(staking.address, amount);
			let t1 = await staking.stake(amount, inThreeYears, a1, a1);
			await mineBlock();
			await mineBlock();

			let amountWithWeight = getAmountWithWeight(amount);
			expect((await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber), kickoffTS)).toString()).to.be.equal(
				amountWithWeight.toString()
			);
			expect((await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1), kickoffTS)).toString()).to.be.equal(
				amountWithWeight.toString()
			);
		});

		it("returns zero if < first checkpoint block", async () => {
			await mineBlock();
			await token.approve(staking.address, amount);
			let t1 = await staking.stake(amount, inThreeYears, a1, a1);
			await mineBlock();
			await mineBlock();

			let amountWithWeight = getAmountWithWeight(amount);
			expect((await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber - 1), kickoffTS)).toString()).to.be.equal("0");
			expect((await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1), kickoffTS)).toString()).to.be.equal(
				amountWithWeight.toString()
			);
		});

		it("generally returns the voting balance at the appropriate checkpoint", async () => {
			await token.approve(staking.address, "1000");
			await staking.stake("1000", inThreeYears, root, root);
			const t1 = await staking.delegate(a1, inThreeYears);
			await mineBlock();
			await mineBlock();
			await token.transfer(a2, 10);
			await token.approve(staking.address, "10", { from: a2 });
			const t2 = await staking.stake("10", inThreeYears, a1, a1, { from: a2 });
			await mineBlock();
			await mineBlock();
			await token.transfer(a3, 101);
			await token.approve(staking.address, "101", { from: a3 });
			const t3 = await staking.stake("101", inThreeYears, a1, a1, { from: a3 });
			await mineBlock();
			await mineBlock();

			expect((await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber - 1), kickoffTS)).toString()).to.be.equal("0");
			expect((await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber), kickoffTS)).toString()).to.be.equal(
				getAmountWithWeight("1000").toString()
			);
			expect((await staking.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1), kickoffTS)).toString()).to.be.equal(
				getAmountWithWeight("1000").toString()
			);
			expect((await staking.getPriorVotes.call(a1, new BN(t2.receipt.blockNumber), kickoffTS)).toString()).to.be.equal(
				getAmountWithWeight("1010").toString()
			);
			expect((await staking.getPriorVotes.call(a1, new BN(t2.receipt.blockNumber + 1), kickoffTS)).toString()).to.be.equal(
				getAmountWithWeight("1010").toString()
			);
			expect((await staking.getPriorVotes.call(a1, new BN(t3.receipt.blockNumber), kickoffTS)).toString()).to.be.equal(
				getAmountWithWeight("1111").toString()
			);
			expect((await staking.getPriorVotes.call(a1, new BN(t3.receipt.blockNumber + 1), kickoffTS)).toString()).to.be.equal(
				getAmountWithWeight("1111").toString()
			);
		});
	});

	function getAmountWithWeight(amount) {
		return new BN(MAX_VOTING_WEIGHT.toNumber() + 1).mul(new BN(amount));
	}
});
