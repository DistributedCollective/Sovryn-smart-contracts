const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { etherMantissa, mineBlock, advanceBlocks } = require("../Utils/Ethereum");

const { ZERO_ADDRESS } = constants;
const TOTAL_SUPPLY = etherMantissa(1000000000);

const TestToken = artifacts.require("TestToken");
const LiquidityMiningLogic = artifacts.require("LiquidityMiningMockup");
const LiquidityMiningProxy = artifacts.require("LiquidityMiningProxy");

describe("LiquidityMining", () => {
	const name = "Test SVR Token";
	const symbol = "TST";

	const rewardTokensPerBlock = new BN(3);
	const startDelayBlocks = new BN(1);
	const numberOfBonusBlocks = new BN(50);

	let accounts
	let root, account1, account2, account3, account4;
	let SVRToken, token1, token2, token3;
	let liquidityMining, wrapper;

	before(async () => {
		accounts = await web3.eth.getAccounts();
		[root, account1, account2, account3, account4, ...accounts] = accounts;
	});

	beforeEach(async () => {
		SVRToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
		token1 = await TestToken.new("Test token 1", "TST-1", 18, TOTAL_SUPPLY);
		token2 = await TestToken.new("Test token 2", "TST-2", 18, TOTAL_SUPPLY);
		token3 = await TestToken.new("Test token 3", "TST-3", 18, TOTAL_SUPPLY);
		wrapper = account1;

		await deployLiquidityMining();
		await liquidityMining.initialize(SVRToken.address, rewardTokensPerBlock, startDelayBlocks, numberOfBonusBlocks, wrapper);
	});

	describe("initialize", () => {
		it("sets the expected values", async () => {
			await deployLiquidityMining();
			let tx = await liquidityMining.initialize(SVRToken.address, rewardTokensPerBlock, startDelayBlocks, numberOfBonusBlocks, wrapper);

			let _SVR = await liquidityMining.SVR();
			let _rewardTokensPerBlock = await liquidityMining.rewardTokensPerBlock();
			let _startBlock = await liquidityMining.startBlock();
			let _bonusEndBlock = await liquidityMining.bonusEndBlock();
			let _wrapper = await liquidityMining.wrapper();

			let blockNumber = new BN(tx.receipt.blockNumber);

			expect(_SVR).equal(SVRToken.address);
			expect(_rewardTokensPerBlock).bignumber.equal(rewardTokensPerBlock);
			expect(_startBlock).bignumber.equal(startDelayBlocks.add(blockNumber));
			expect(_bonusEndBlock).bignumber.equal(startDelayBlocks.add(blockNumber).add(numberOfBonusBlocks));
			expect(_wrapper).equal(wrapper);
		});

		it("fails if not an owner", async () => {
			await deployLiquidityMining();
			await expectRevert(
				liquidityMining.initialize(SVRToken.address, rewardTokensPerBlock, startDelayBlocks, numberOfBonusBlocks, wrapper, {from: account1}),
				"unauthorized"
			);
		});

		it("fails if _startBlock = 0", async () => {
			await deployLiquidityMining();
			await expectRevert(
				liquidityMining.initialize(SVRToken.address, rewardTokensPerBlock, 0, numberOfBonusBlocks, wrapper),
				"Invalid start block"
			);
		});

		it("fails if already initialized", async () => {
			await expectRevert(
				liquidityMining.initialize(SVRToken.address, rewardTokensPerBlock, startDelayBlocks, numberOfBonusBlocks, wrapper),
				"Already initialized"
			);
		});

		it("fails if the 0 address is passed as token address", async () => {
			await deployLiquidityMining();
			await expectRevert(
				liquidityMining.initialize(ZERO_ADDRESS, rewardTokensPerBlock, startDelayBlocks, numberOfBonusBlocks, wrapper),
				"Invalid token address"
			);
		});
	});

	describe("setWrapper", () => {
		it("sets the expected values", async () => {
			let newWrapper = account2;
			await liquidityMining.setWrapper(newWrapper);

			let _wrapper = await liquidityMining.wrapper();
			expect(_wrapper).equal(newWrapper);
		});

		it("fails if not an owner", async () => {
			await expectRevert(
				liquidityMining.setWrapper(account2, {from: account1}),
				"unauthorized"
			);
		});
	});

	describe("stopMining", () => {
		it("should set end block", async () => {
			let tx = await liquidityMining.stopMining();

			let blockNumber = new BN(tx.receipt.blockNumber);
			let _endBlock = await liquidityMining.endBlock();
			expect(_endBlock).bignumber.equal(blockNumber);
		});

		it("fails if not an owner", async () => {
			await expectRevert(
				liquidityMining.stopMining({from: account1}),
				"unauthorized"
			);
		});

		it("fails if already stopped", async () => {
			await liquidityMining.stopMining();
			await expectRevert(
				liquidityMining.stopMining(),
				"Already stopped"
			);
		});
	});

	describe("transferSVR", () => {
		it("should be able to transfer SVR", async () => {
			let amount = new BN(1000);
			await SVRToken.transfer(liquidityMining.address, amount);

			let balanceBefore = await SVRToken.balanceOf(account1);
			await liquidityMining.transferSVR(account1, amount);
			let balanceAfter = await SVRToken.balanceOf(account1);

			expect(amount).bignumber.equal(balanceAfter.sub(balanceBefore));
		});

		it("only owner should be able to transfer", async () => {
			await expectRevert(liquidityMining.transferSVR(account1, 1000, { from: account1 }), "unauthorized");
		});

		it("fails if the 0 address is passed as receiver address", async () => {
			await expectRevert(liquidityMining.transferSVR(ZERO_ADDRESS, 1000), "receiver address invalid");
		});

		it("fails if the 0 is passed as an amount", async () => {
			await expectRevert(liquidityMining.transferSVR(account1, 0), "amount invalid");
		});
	});

	//TODO getMissedBalance

	describe("add", () => {
		it("should be able to add pool token", async () => {
			let allocationPoint = new BN(1);
			let tx = await liquidityMining.add(token1.address, allocationPoint, false);

			expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(allocationPoint);

			let poolInfo = await liquidityMining.poolInfoList(0);
			expect(poolInfo.poolToken).equal(token1.address);
			expect(poolInfo.allocationPoint).bignumber.equal(allocationPoint);
			let blockNumber = new BN(tx.receipt.blockNumber);
			expect(poolInfo.lastRewardBlock).bignumber.equal(blockNumber);
			expect(poolInfo.accumulatedRewardPerShare).bignumber.equal(new BN(0));

			expect(await liquidityMining.getPoolLength()).bignumber.equal(new BN(1));

			expectEvent(tx, "PoolTokenAdded", {
				user: root,
				poolToken: token1.address,
				allocationPoint: allocationPoint,
			});
		});

		it("should be able to add 2 pool tokens and update pools", async () => {
			let allocationPoint1 = new BN(1);
			let tx1 = await liquidityMining.add(token1.address, allocationPoint1, false);

			expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(allocationPoint1);

			expectEvent(tx1, "PoolTokenAdded", {
				user: root,
				poolToken: token1.address,
				allocationPoint: allocationPoint1,
			});

			let allocationPoint2 = new BN(2);
			let tx2 = await liquidityMining.add(token2.address, allocationPoint2, true);

			expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(allocationPoint1.add(allocationPoint2));

			expectEvent(tx2, "PoolTokenAdded", {
				user: root,
				poolToken: token2.address,
				allocationPoint: allocationPoint2,
			});

			let poolInfo1 = await liquidityMining.getPoolInfo(token1.address);
			let poolInfo2 = await liquidityMining.getPoolInfo(token2.address);
			expect(poolInfo1.lastRewardBlock).bignumber.equal(poolInfo2.lastRewardBlock);
		});

		it("fails if the 0 allocation point is passed", async () => {
			await expectRevert(liquidityMining.add(token1.address, new BN(0), false), "Invalid allocation point");
		});

		it("fails if the 0 address is passed as token address", async () => {
			await expectRevert(liquidityMining.add(ZERO_ADDRESS, new BN(1), false), "Invalid token address");
		});

		it("fails if token already added", async () => {
			await liquidityMining.add(token1.address, new BN(1), false);
			await expectRevert(liquidityMining.add(token1.address, new BN(1), false), "Token already added");
		});
	});

	describe("update", () => {
		it("should be able to update pool token", async () => {
			let oldAllocationPoint = new BN(1);
			await liquidityMining.add(token1.address, oldAllocationPoint, false);

			let newAllocationPoint = new BN(2);
			let tx = await liquidityMining.update(token1.address, newAllocationPoint, false);

			expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(newAllocationPoint);

			let poolInfo = await liquidityMining.getPoolInfo(token1.address);
			let blockNumber = new BN(tx.receipt.blockNumber);
			checkPoolInfo(poolInfo, token1.address, newAllocationPoint, blockNumber, new BN(0));

			expect(await liquidityMining.getPoolLength()).bignumber.equal(new BN(1));

			expectEvent(tx, "PoolTokenUpdated", {
				user: root,
				poolToken: token1.address,
				newAllocationPoint: newAllocationPoint,
				oldAllocationPoint: oldAllocationPoint,
			});
		});

		it("should be able to update pool token and update pools", async () => {
			//TODO implement
		});

		it("fails if token wasn't added", async () => {
			await expectRevert(liquidityMining.update(token1.address, new BN(1), false), "Pool token not found");
		});
	});

	describe("deposit", () => {
		let allocationPoint = new BN(1);
		let amount = new BN(1000);

		beforeEach(async () => {
			await liquidityMining.add(token1.address, allocationPoint, false);
			await mineBlocks(1);

			await token1.mint(account1, amount);
			await token1.approve(liquidityMining.address, amount, {from: account1});
		});

		it("should be able to deposit", async () => {
			let tx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {from: account1});

			let poolInfo = await liquidityMining.getPoolInfo(token1.address);
			let blockNumber = new BN(tx.receipt.blockNumber);
			checkPoolInfo(poolInfo, token1.address, allocationPoint, blockNumber, new BN(0));

			await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));

			expectEvent(tx, "Deposit", {
				user: account1,
				poolToken: token1.address,
				amount: amount,
			});
		});

		it("should be able to deposit using wrapper", async () => {
			//TODO implement
		});

		it("fails if token pool token not found", async () => {
			await expectRevert(
				liquidityMining.deposit(account1, amount, ZERO_ADDRESS, {from: account1}),
				"Pool token not found"
			);
		});

	});

	describe("claimReward", () => {
		let allocationPoint = new BN(1);
		let amount = new BN(1000);

		beforeEach(async () => {
			await liquidityMining.add(token1.address, allocationPoint, false);
			await mineBlocks(1);

			await token1.mint(account1, amount);
			await token1.approve(liquidityMining.address, amount, {from: account1});
		});

		it("should be able to claim reward (will not be claimed without SVR tokens)", async () => {
			await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {from: account1});

			let tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, {from: account1});

			let poolInfo = await liquidityMining.getPoolInfo(token1.address);
			let blockNumber = new BN(tx.receipt.blockNumber);
			checkPoolInfo(poolInfo, token1.address, allocationPoint, blockNumber, new BN(-1));

			await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));

			//user's balance of reward token
			let userRewardBalance = await SVRToken.balanceOf(account1);
			expect(userRewardBalance).bignumber.equal(new BN(0));
		});

		it("should be able to claim reward (will be claimed with SVR tokens)", async () => {
			let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {from: account1});
			let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
			await SVRToken.transfer(liquidityMining.address, new BN(1000));

			let tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, {from: account1});

			let poolInfo = await liquidityMining.getPoolInfo(token1.address);
			let latestBlockNumber = new BN(tx.receipt.blockNumber);
			checkPoolInfo(poolInfo, token1.address, allocationPoint, latestBlockNumber, new BN(-1));

			await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));
			let userReward = await checkUserReward(account1, token1, depositBlockNumber, latestBlockNumber);

			expectEvent(tx, "RewardClaimed", {
				user: account1,
				amount: userReward,
			});
		});

		it("should be able to claim reward using wrapper", async () => {
			//TODO implement
		});

		it("fails if token pool token not found", async () => {
			await expectRevert(liquidityMining.claimReward(account1, ZERO_ADDRESS, {from: account1}), "Pool token not found");
		});

	});

	describe("withdraw", () => {
		let allocationPoint = new BN(1);
		let amount = new BN(1000);

		beforeEach(async () => {
			await liquidityMining.add(token1.address, allocationPoint, false);
			await mineBlocks(1);

			await token1.mint(account1, amount);
			await token1.approve(liquidityMining.address, amount, {from: account1});
		});

		it("should be able to withdraw (without claiming reward)", async () => {
			await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {from: account1});

			let tx = await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {from: account1});

			let poolInfo = await liquidityMining.getPoolInfo(token1.address);
			let blockNumber = new BN(tx.receipt.blockNumber);
			checkPoolInfo(poolInfo, token1.address, allocationPoint, blockNumber, new BN(-1));

			await checkUserPoolTokens(account1, token1, new BN(0), new BN(0), amount);

			//user's balance of reward token
			let userRewardBalance = await SVRToken.balanceOf(account1);
			expect(userRewardBalance).bignumber.equal(new BN(0));

			expectEvent(tx, "Withdraw", {
				user: account1,
				poolToken: token1.address,
				amount: amount,
			});
		});

		it("should be able to withdraw (with claiming reward)", async () => {
			let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {from: account1});
			let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
			await SVRToken.transfer(liquidityMining.address, new BN(1000));

			let tx = await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {from: account1});

			let poolInfo = await liquidityMining.getPoolInfo(token1.address);
			let latestBlockNumber = new BN(tx.receipt.blockNumber);
			checkPoolInfo(poolInfo, token1.address, allocationPoint, latestBlockNumber, new BN(-1));

			await checkUserPoolTokens(account1, token1, new BN(0), new BN(0), amount);
			let userReward = await checkUserReward(account1, token1, depositBlockNumber, latestBlockNumber);

			expectEvent(tx, "Withdraw", {
				user: account1,
				poolToken: token1.address,
				amount: amount,
			});

			expectEvent(tx, "RewardClaimed", {
				user: account1,
				amount: userReward,
			});
		});

		it("should be able to withdraw using wrapper", async () => {
			//TODO implement
		});

		it("fails if token pool token not found", async () => {
			await expectRevert(liquidityMining.withdraw(account1, amount, ZERO_ADDRESS, {from: account1}), "Pool token not found");
		});

		it("fails if token pool token not found", async () => {
			await expectRevert(liquidityMining.withdraw(token1.address, amount.mul(new BN(2)), ZERO_ADDRESS, {from: account1}), "Not enough balance");
		});

	});

	describe("emergencyWithdraw", () => {
		let allocationPoint = new BN(1);
		let amount = new BN(1000);

		beforeEach(async () => {
			await liquidityMining.add(token1.address, allocationPoint, false);
			await mineBlocks(1);

			await token1.mint(account1, amount);
			await token1.approve(liquidityMining.address, amount, {from: account1});
		});

		it("should be able to withdraw", async () => {
			await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {from: account1});

			let tx = await liquidityMining.emergencyWithdraw(token1.address, {from: account1});

			await checkUserPoolTokens(account1, token1, new BN(0), new BN(0), amount);

			let userInfo = await liquidityMining.getUserInfo(token1.address, account1);
			expect(userInfo.rewardDebt).bignumber.equal(new BN(0));
			expect(userInfo.accumulatedReward).bignumber.equal(new BN(0));

			expectEvent(tx, "EmergencyWithdraw", {
				user: account1,
				poolToken: token1.address,
				amount: amount,
			});
		});

		it("fails if token pool token not found", async () => {
			await expectRevert(liquidityMining.emergencyWithdraw(account1, {from: account1}), "Pool token not found");
		});

	});

	describe("getPassedBlocksWithBonusMultiplier", () => {

		it("check calculation", async () => {
			let bonusBlockMultiplier = await liquidityMining.BONUS_BLOCK_MULTIPLIER();
			let startBlock = await liquidityMining.startBlock();
			let bonusEndBlock = await liquidityMining.bonusEndBlock();
			let blocks;

			//[startBlock, bonusEndBlock]
			blocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(startBlock, bonusEndBlock);
			expect(blocks).bignumber.equal(numberOfBonusBlocks.mul(bonusBlockMultiplier));

			//[startBlock - 100, bonusEndBlock]
			blocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(startBlock.sub(new BN(100)), bonusEndBlock);
			expect(blocks).bignumber.equal(numberOfBonusBlocks.mul(bonusBlockMultiplier));

			//[startBlock, bonusEndBlock + 100]
			let blocksAfterBonusPeriod = new BN(100);
			blocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(startBlock, bonusEndBlock.add(new BN(blocksAfterBonusPeriod)));
			expect(blocks).bignumber.equal(numberOfBonusBlocks.mul(bonusBlockMultiplier).add(blocksAfterBonusPeriod));

			//[startBlock, stopMining, ... bonusEndBlock]
			await mineBlocks(5);
			await liquidityMining.stopMining();
			let endBlock = await liquidityMining.endBlock();
			blocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(startBlock, bonusEndBlock);
			expect(blocks).bignumber.equal(endBlock.sub(startBlock).mul(bonusBlockMultiplier));
		});

	});

	describe("getUserAccumulatedReward", () => {

		const amount1 = new BN(1000);
		const amount2 = new BN(2000);
		const allocationPoint1 = new BN(1);
		const allocationPoint2 = new BN(2);
		const totalAllocationPoint = allocationPoint1.add(allocationPoint2);
		let bonusBlockMultiplier;
		let bonusEndBlock;

		beforeEach(async () => {
			await liquidityMining.add(token1.address, allocationPoint1, false);
			await liquidityMining.add(token2.address, allocationPoint2, false);

			await token1.mint(account1, amount1);
			await token2.mint(account2, amount2);

			await token1.approve(liquidityMining.address, amount1, {from: account1});
			await token2.approve(liquidityMining.address, amount2, {from: account2});

			bonusBlockMultiplier = await liquidityMining.BONUS_BLOCK_MULTIPLIER();
			bonusEndBlock = await liquidityMining.bonusEndBlock();
		});

		it("check calculation for no deposits", async () => {
			const reward1 = await liquidityMining.getUserAccumulatedReward(token1.address, account1);
			const reward2 = await liquidityMining.getUserAccumulatedReward(token2.address, account2);
			expect(reward1).bignumber.equal('0');
			expect(reward2).bignumber.equal('0');
		});

		it("check calculation for single user, token 1, bonus period off", async () => {
			await advanceBlocks(bonusEndBlock);
			await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {from: account1});
			await mineBlock();
			let reward = await liquidityMining.getUserAccumulatedReward(token1.address, account1);

			// 1 block has passed, bonus period is off
			// users are given 3 tokens per share per block. user1 owns 100% of the shares
			// token 1 counts as 1/3 of the pool
			// reward = 10 * 3 * 1/3 = 1
			const expectedReward = rewardTokensPerBlock.mul(allocationPoint1).div(totalAllocationPoint);
			expect(expectedReward).bignumber.equal('1'); // sanity check
			expect(reward).bignumber.equal(expectedReward);

			await mineBlock();
			reward = await liquidityMining.getUserAccumulatedReward(token1.address, account1);
			expect(reward).bignumber.equal('2');
		});

		it("check calculation for single user, token 2, bonus period off", async () => {
			await advanceBlocks(bonusEndBlock);
			await liquidityMining.deposit(token2.address, amount2, ZERO_ADDRESS, {from: account2});
			await mineBlock();
			let reward = await liquidityMining.getUserAccumulatedReward(token2.address, account2);

			// 1 block has passed, bonus period is off
			// users are given 3 tokens per share per block. user2 owns 100% of the shares
			// token 2 counts as 2/3 of the pool
			// reward = 10 * 3 * 2/3 = 2
			const expectedReward = rewardTokensPerBlock.mul(allocationPoint2).div(totalAllocationPoint);
			expect(expectedReward).bignumber.equal('2'); // sanity check
			expect(reward).bignumber.equal(expectedReward);

			await mineBlock();
			reward = await liquidityMining.getUserAccumulatedReward(token2.address, account2);
			expect(reward).bignumber.equal('4');
		});

		it("check calculation for single user, token 1, bonus period on", async () => {
			await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {from: account1});
			await mineBlock();
			const reward = await liquidityMining.getUserAccumulatedReward(token1.address, account1);

			// 1 block has passed, bonus period is on so it counts as 10 blocks,
			// users are given 3 tokens per share per block. user1 owns 100% of the shares
			// token 1 counts as 1/3 of the pool
			// reward = 10 * 3 * 1/3 = 10
			const expectedReward = rewardTokensPerBlock.mul(bonusBlockMultiplier).mul(allocationPoint1).div(totalAllocationPoint);
			expect(expectedReward).bignumber.equal('10'); // sanity check
			expect(reward).bignumber.equal(expectedReward);
		});

		it("check calculation for single user, token 1, bonus period on, smaller amount", async () => {
			await liquidityMining.deposit(token1.address, new BN(1), ZERO_ADDRESS, {from: account1});
			await mineBlock();
			const reward = await liquidityMining.getUserAccumulatedReward(token1.address, account1);

			// 1 block has passed, bonus period is on so it counts as 10 blocks,
			// users are given 3 tokens per share per block. user1 owns 100% of the shares
			// token 1 counts as 1/3 of the pool
			// reward = 10 * 3 * 1/3 = 10
			// Note that the actual amount deposited plays no role here
			expect(reward).bignumber.equal('10');
		});

		it("check calculation for single user, token 2, bonus period on", async () => {
			await liquidityMining.deposit(token2.address, amount2, ZERO_ADDRESS, {from: account2});
			await mineBlock();
			const reward = await liquidityMining.getUserAccumulatedReward(token2.address, account2);

			// 1 block has passed, bonus period is on so it counts as 10 blocks,
			// users are given 3 tokens per share per block. user2 owns 100% of the shares
			// token 2 counts as 2/3 of the pool
			// reward = 10 * 3 * 2/3 = 20
			const expectedReward = rewardTokensPerBlock.mul(bonusBlockMultiplier).mul(allocationPoint2).div(totalAllocationPoint);
			expect(expectedReward).bignumber.equal('20'); // sanity check
			expect(reward).bignumber.equal(expectedReward);
		});

		it("check calculation for two users and tokens", async () => {
			await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {from: account1});
			// because automining is on, the following will advance a block
			await liquidityMining.deposit(token2.address, amount2, ZERO_ADDRESS, {from: account2});
			// sanity checks
			expect(await liquidityMining.getUserAccumulatedReward(token1.address, account1)).bignumber.equal('10');
			expect(await liquidityMining.getUserAccumulatedReward(token2.address, account2)).bignumber.equal('0');
			await mineBlock();

			const reward1 = await liquidityMining.getUserAccumulatedReward(token1.address, account1);
			const reward2 = await liquidityMining.getUserAccumulatedReward(token2.address, account2);

			// for the first block, user 1 will receive the reward of 10
			// for the second block:
			// - user 1 still owns 100% of the shares for token1, so same reward (total 10 + 10 = 20)
			// - user 2 owns 100% of the shares for token2, so same reward as in the other cases
			expect(reward1).bignumber.equal('20');
			expect(reward2).bignumber.equal('20');
		});

		it("check calculation for two users, same token (shares taken into account)", async () => {
			const token = token1;
			const amount = amount1;
			await token.mint(account2, amount);
			await token.approve(liquidityMining.address, amount, {from: account2});

			await liquidityMining.deposit(token.address, amount, ZERO_ADDRESS, {from: account1});
			// because automining is on, the following will advance a block
			await liquidityMining.deposit(token.address, amount, ZERO_ADDRESS, {from: account2});
			// sanity checks
			expect(await liquidityMining.getUserAccumulatedReward(token.address, account1)).bignumber.equal('10');
			expect(await liquidityMining.getUserAccumulatedReward(token.address, account2)).bignumber.equal('0');
			await mineBlock();

			const reward1 = await liquidityMining.getUserAccumulatedReward(token.address, account1);
			const reward2 = await liquidityMining.getUserAccumulatedReward(token.address, account2);

			// for the first block, user 1 will receive the reward of 10 (reward given per block for 100% of shares)
			// for the second block:
			// - user 1 owns 1/2 of the shares => expected reward = 5 (total 10 + 5 = 15)
			// - user 2 owns 1/2 of the shares => expected reward = 5
			expect(reward1).bignumber.equal('15');
			expect(reward2).bignumber.equal('5');
		});
	});

	//TODO add tricky cases
	//1. add(pool1), deposit(user1, pool1), update(pool1), withdraw(user1, pool1)
	//2. add(pool1), deposit(user1, pool1), deposit(user2, pool1), withdraw(user1, pool1), withdraw(user2, pool1)
	//3. add(pool1), deposit(user1, pool1), add(pool2), withdraw(user1, pool1)
	//4. add(pool1), deposit(user1, pool1), add(pool2), deposit(user2, pool2), withdraw(user1, pool1), withdraw(user2, pool2)

	describe("deposit/withdraw", () => {
		let allocationPoint = new BN(1);
		let amount = new BN(1000);

		beforeEach(async () => {
			await token1.mint(account1, amount);
			await token1.approve(liquidityMining.address, amount, {from: account1});

			await token2.mint(account1, amount);
			await token2.approve(liquidityMining.address, amount, {from: account1});
		});

		it("add, add, deposit", async () => {
			await liquidityMining.add(token1.address, allocationPoint, false); //weight 1/1
			await liquidityMining.add(token2.address, allocationPoint, false); //weight 1/2

			await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {from: account1});
			await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {from: account1}); // 1 block passed

			// await liquidityMining.update(token1.address, allocationPoint.mul(new BN(2)), true); //weight 2/3
			await liquidityMining.updateAllPools(); // 2 blocks passed from first deposit

			const currentBlockNumber = await web3.eth.getBlockNumber();

			// 3 tokens per share per block, times bonus multiplier (10), times precision (1e12), times weight (1/2), divided by total shares
			const expectedAccumulatedRewardPerBlock = rewardTokensPerBlock.mul(new BN(10)).mul(new BN(1e12)).div(new BN(2)).div(amount);

			const poolInfo1 = await liquidityMining.getPoolInfo(token1.address);
			expect(poolInfo1.poolToken).equal(token1.address);
			expect(poolInfo1.allocationPoint).equal('1');
			expect(poolInfo1.lastRewardBlock).equal(currentBlockNumber.toString());
			// token1 deposit has been there for 2 blocks because of automining
			expect(poolInfo1.accumulatedRewardPerShare).equal(expectedAccumulatedRewardPerBlock.mul(new BN(2)).toString());

			const poolInfo2 = await liquidityMining.getPoolInfo(token2.address);
			expect(poolInfo2.poolToken).equal(token2.address);
			expect(poolInfo2.allocationPoint).equal('1');
			expect(poolInfo1.lastRewardBlock).equal(currentBlockNumber.toString());
			// token2 deposit has been there for only 1 block
			expect(poolInfo2.accumulatedRewardPerShare).equal(expectedAccumulatedRewardPerBlock.toString());
		});
	});

	//TODO add tests for public/external getters

	async function deployLiquidityMining() {
		let liquidityMiningLogic = await LiquidityMiningLogic.new();
		let liquidityMiningProxy = await LiquidityMiningProxy.new();
		await liquidityMiningProxy.setImplementation(liquidityMiningLogic.address);
		liquidityMining = await LiquidityMiningLogic.at(liquidityMiningProxy.address);
	}

	async function mineBlocks(blocks) {
		for (let i = 0; i < blocks; i++) {
			await mineBlock();
		}
	}

	function checkPoolInfo(poolInfo, token, allocationPoint, lastRewardBlock, accumulatedRewardPerShare) {
		expect(poolInfo.poolToken).equal(token);
		expect(poolInfo.allocationPoint).bignumber.equal(allocationPoint);
		expect(poolInfo.lastRewardBlock).bignumber.equal(lastRewardBlock);
		if (accumulatedRewardPerShare.toNumber() !== -1) {
			expect(poolInfo.accumulatedRewardPerShare).bignumber.equal(accumulatedRewardPerShare);
		}
	}

	async function checkUserPoolTokens(user, poolToken, _userAmount, _liquidityMiningBalance, _userBalance) {
		//user balance in pool
		let userInfo = await liquidityMining.getUserInfo(poolToken.address, user);
		expect(userInfo.amount).bignumber.equal(_userAmount);
		//LM balance of pool tokens
		let liquidityMiningBalance = await poolToken.balanceOf(liquidityMining.address);
		expect(liquidityMiningBalance).bignumber.equal(_liquidityMiningBalance);
		//user's balance of pool tokens
		let userBalance = await poolToken.balanceOf(user);
		expect(userBalance).bignumber.equal(_userBalance);
	}

	//user's balance of reward token
	async function checkUserReward(user, poolToken, depositBlockNumber, latestBlockNumber) {
		let passedBlocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(depositBlockNumber, latestBlockNumber);
		let userReward = passedBlocks.mul(rewardTokensPerBlock);
		let userRewardBalance = await SVRToken.balanceOf(user);
		expect(userRewardBalance).bignumber.equal(userReward);
		let userInfo = await liquidityMining.getUserInfo(poolToken.address, user);
		expect(userInfo.accumulatedReward).bignumber.equal(new BN(0));
		return userReward;
	}

});
