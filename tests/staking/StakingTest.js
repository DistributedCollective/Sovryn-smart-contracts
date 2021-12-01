/** Speed optimized on branch hardhatTestRefactor, 2021-10-04
 * Bottleneck found at beforeEach hook, redeploying token and staking ... on every test.
 *
 * Total time elapsed: 6.6s
 * After optimization: 5.6s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");

const { address, mineBlock } = require("../Utils/Ethereum");

const EIP712 = require("../Utils/EIP712");
// const EIP712Ethers = require("../Utils/EIP712Ethers");
const { getAccountsPrivateKeysBuffer } = require("../Utils/hardhat_utils");

const StakingLogic = artifacts.require("StakingMockup");
const StakingProxy = artifacts.require("StakingProxy");
const TestToken = artifacts.require("TestToken");
const VestingLogic = artifacts.require("VestingLogic");
//Upgradable Vesting Registry
const VestingRegistryLogic = artifacts.require("VestingRegistryLogic");
const VestingRegistryProxy = artifacts.require("VestingRegistryProxy");

const TOTAL_SUPPLY = "10000000000000000000000000";
const DELAY = 86400 * 14;
const TWO_WEEKS = 1209600;

contract("Staking", (accounts) => {
	const name = "Test token";
	const symbol = "TST";

	let root, a1, a2, a3, chainId;
	let pA1;
	let token, staking;
	let MAX_VOTING_WEIGHT;

	let kickoffTS, inThreeYears;
	let currentChainId;

	let vestingLogic1, vestingLogic2;

	async function deploymentAndInitFixture(_wallets, _provider) {
		chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
		await web3.eth.net.getId();
		token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

		let stakingLogic = await StakingLogic.new(token.address);
		staking = await StakingProxy.new(token.address);
		await staking.setImplementation(stakingLogic.address);
		staking = await StakingLogic.at(staking.address);
		//Upgradable Vesting Registry
		vestingRegistryLogic = await VestingRegistryLogic.new();
		vesting = await VestingRegistryProxy.new();
		await vesting.setImplementation(vestingRegistryLogic.address);
		vesting = await VestingRegistryLogic.at(vesting.address);

		await staking.setVestingRegistry(vesting.address);

		MAX_VOTING_WEIGHT = await staking.MAX_VOTING_WEIGHT.call();

		kickoffTS = await staking.kickoffTS.call();
		inThreeYears = kickoffTS.add(new BN(DELAY * 26 * 3));
	}

	before(async () => {
		[root, a1, a2, a3, ...accounts] = accounts;
		[pkbRoot, pkbA1] = getAccountsPrivateKeysBuffer();
		currentChainId = (await ethers.provider.getNetwork()).chainId;

		vestingLogic1 = await VestingLogic.new();
		vestingLogic2 = await VestingLogic.new();
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	// describe("metadata", () => {
	// 	it("has given name", async () => {
	// 		expect(await token.name.call()).to.be.equal(name);
	// 	});
	//
	// 	it("has given symbol", async () => {
	// 		expect(await token.symbol.call()).to.be.equal(symbol);
	// 	});
	// });
	//
	// describe("balanceOf", () => {
	// 	it("grants to initial account", async () => {
	// 		expect((await token.balanceOf.call(root)).toString()).to.be.equal(TOTAL_SUPPLY);
	// 	});
	// });
	//
	// describe("delegateBySig", () => {
	// 	const Domain = (staking) => ({ name: "SOVStaking", chainId: currentChainId, verifyingContract: staking.address });
	// 	const Types = {
	// 		Delegation: [
	// 			{ name: "delegatee", type: "address" },
	// 			{ name: "lockDate", type: "uint256" },
	// 			{ name: "nonce", type: "uint256" },
	// 			{ name: "expiry", type: "uint256" },
	// 		],
	// 	};
	//
	// 	it("reverts if the signatory is invalid", async () => {
	// 		const delegatee = root,
	// 			nonce = 0,
	// 			expiry = 0;
	// 		await expectRevert(
	// 			staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, 0, "0xbad", "0xbad"),
	// 			"Staking::delegateBySig: invalid signature"
	// 		);
	// 	});
	//
	// 	it("reverts if the nonce is bad ", async () => {
	// 		const delegatee = root,
	// 			nonce = 1,
	// 			expiry = 0,
	// 			lockDate = inThreeYears;
	// 		const { v, r, s } = EIP712.sign(
	// 			Domain(staking),
	// 			"Delegation",
	// 			{
	// 				delegatee,
	// 				lockDate,
	// 				nonce,
	// 				expiry,
	// 			},
	// 			Types,
	// 			pkbA1
	// 			//pA1.privateKey
	// 			//unlockedAccount(a1).secretKey
	// 		);
	// 		/*const { v, r, s } = EIP712Ethers.sign(
	// 			Domain(staking),
	// 			"Delegation",
	// 			{
	// 				delegatee,
	// 				lockDate,
	// 				nonce,
	// 				expiry,
	// 			},
	// 			Types,
	// 			pA1
	// 		);*/
	//
	// 		await expectRevert(
	// 			staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s),
	// 			"Staking::delegateBySig: invalid nonce"
	// 		);
	// 	});
	//
	// 	it("reverts if the signature has expired", async () => {
	// 		const delegatee = root,
	// 			nonce = 0,
	// 			expiry = 0,
	// 			lockDate = inThreeYears;
	// 		const { v, r, s } = EIP712.sign(
	// 			Domain(staking),
	// 			"Delegation",
	// 			{
	// 				delegatee,
	// 				lockDate,
	// 				nonce,
	// 				expiry,
	// 			},
	// 			Types,
	// 			pkbA1
	// 		);
	// 		await expectRevert(
	// 			staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s),
	// 			"Staking::delegateBySig: signature expired"
	// 		);
	// 	});
	//
	// 	it("delegates on behalf of the signatory", async () => {
	// 		const delegatee = root,
	// 			nonce = 0,
	// 			expiry = 10e9,
	// 			lockDate = inThreeYears;
	// 		const { v, r, s } = EIP712.sign(
	// 			Domain(staking),
	// 			"Delegation",
	// 			{
	// 				delegatee,
	// 				lockDate,
	// 				nonce,
	// 				expiry,
	// 			},
	// 			Types,
	// 			pkbA1
	// 			//unlockedAccount(a1).secretKey
	// 		);
	//
	// 		expect(await staking.delegates.call(a1, inThreeYears)).to.be.equal(address(0));
	// 		const tx = await staking.delegateBySig(delegatee, inThreeYears, nonce, expiry, v, r, s);
	// 		expect(tx.gasUsed < 80000);
	// 		expect(await staking.delegates.call(a1, inThreeYears)).to.be.equal(root);
	// 	});
	// });

	describe("setVestingStakes", () => {
		it("should fail if unauthorized", async () => {
			await expectRevert(staking.setVestingStakes([], [], { from: a1 }), "unauthorized");
		});

		it("should fail if arrays have different length", async () => {
			let lockedDates = [kickoffTS.add(new BN(TWO_WEEKS))];
			let values = [];
			await expectRevert(staking.setVestingStakes(lockedDates, values), "arrays mismatch");
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
				"Staking::delegateBySig: invalid signature"
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
				// pA1.privateKey
				// unlockedAccount(a1).secretKey
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
				"Staking::delegateBySig: invalid nonce"
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
				"Staking::delegateBySig: signature expired"
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
				// unlockedAccount(a1).secretKey
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
			await token.transfer(guy, "1000"); // give an account a few tokens for readability
			await expect((await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()).to.be.equal("0");

			await token.approve(staking.address, "1000", { from: guy });
			await staking.stake("100", inThreeYears, a1, a1, { from: guy });
			await expect((await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()).to.be.equal("1");

			await staking.stake("50", inThreeYears, a1, a1, { from: guy });
			await expect((await staking.numUserStakingCheckpoints.call(a1, inThreeYears)).toString()).to.be.equal("2");
		});

		it("does not add more than one checkpoint in a block", async () => {
			let guy = accounts[1];
			await token.transfer(guy, "1000"); // give an account a few tokens for readability
			await expect((await staking.numUserStakingCheckpoints.call(a3, inThreeYears)).toString()).to.be.equal("0");

			await token.approve(staking.address, "1000", { from: guy });

			// await minerStop();
			let t1 = staking.stake("80", inThreeYears, a3, a3, { from: guy });

			let t2 = staking.delegate(a3, inThreeYears, { from: guy });
			let t3 = token.transfer(a2, 10, { from: guy });
			let t4 = token.transfer(a2, 10, { from: guy });

			// await minerStart();
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
				"not determined yet"
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

	describe("addAdmin", () => {
		it("adds admin", async () => {
			let tx = await staking.addAdmin(a1);

			expectEvent(tx, "AdminAdded", {
				admin: a1,
			});

			let isAdmin = await staking.admins(a1);
			expect(isAdmin).equal(true);
		});

		it("fails sender isn't an owner", async () => {
			await expectRevert(staking.addAdmin(a1, { from: a1 }), "unauthorized");
		});
	});

	describe("removeAdmin", () => {
		it("removes admin", async () => {
			await staking.addAdmin(a1);
			let tx = await staking.removeAdmin(a1);

			expectEvent(tx, "AdminRemoved", {
				admin: a1,
			});

			let isAdmin = await staking.admins(a1);
			expect(isAdmin).equal(false);
		});

		it("fails sender isn't an owner", async () => {
			await expectRevert(staking.removeAdmin(a1, { from: a1 }), "unauthorized");
		});
	});

	describe("vesting stakes", () => {
		it("should set vesting stakes", async () => {
			let lockedDates = [
				kickoffTS.add(new BN(TWO_WEEKS)),
				kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2))),
				kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(4))),
			];
			let values = [new BN(1000), new BN(30000000000), new BN(500000000000000)];

			let tx = await staking.setVestingStakes(lockedDates, values);

			for (let i = 0; i < lockedDates.length; i++) {
				let numCheckpoints = await staking.numVestingCheckpoints.call(lockedDates[i]);
				expect(numCheckpoints).to.be.bignumber.equal(new BN(1));
				let value = await staking.vestingCheckpoints.call(lockedDates[i], 0);
				expect(value.stake).to.be.bignumber.equal(values[i]);
				expect(value.fromBlock).to.be.bignumber.equal(new BN(0));

				expectEvent(tx, "VestingStakeSet", {
					lockedTS: lockedDates[i],
					value: values[i],
				});
			}
		});
	});

	function getAmountWithWeight(amount) {
		return new BN(MAX_VOTING_WEIGHT.toNumber() + 1).mul(new BN(amount));
	}
});
