const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { etherMantissa, mineBlock } = require("../Utils/Ethereum");
var ethers = require("ethers");
var crypto = require("crypto");

const { ZERO_ADDRESS } = constants;
const TOTAL_SUPPLY = etherMantissa(1000000000);

const TestToken = artifacts.require("TestToken");
const LiquidityMiningConfigToken = artifacts.require("LiquidityMiningConfigToken");
const LiquidityMiningLogic = artifacts.require("LiquidityMiningMockup");
const LiquidityMiningLogicV1 = artifacts.require("LiquidityMiningV1Mockup");
const LiquidityMiningProxy = artifacts.require("LiquidityMiningProxy");
const LiquidityMiningLogicV2 = artifacts.require("LiquidityMiningMockupV2");
const LiquidityMiningProxyV2 = artifacts.require("LiquidityMiningProxyV2");
const TestLockedSOV = artifacts.require("LockedSOVMockup");
const Wrapper = artifacts.require("RBTCWrapperProxyMockupV2");
const LockedSOVRewardTransferLogic = artifacts.require("LockedSOVRewardTransferLogic");
const ERC20TransferLogic = artifacts.require("ERC20TransferLogic");
const TestPoolToken = artifacts.require("TestPoolToken");
const Migrator = artifacts.require("LMV1toLMV2Migrator");

const TestWrbtc = artifacts.require("TestWrbtc");
const sovrynProtocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const ISovryn = artifacts.require("ISovryn");

const LoanToken = artifacts.require("LoanToken");
const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const LoanTokenLogicWRBTC = artifacts.require("LoanTokenLogicWrbtc");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const LoanClosingsBase = artifacts.require("LoanClosingsBase");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");
const SwapsExternal = artifacts.require("SwapsExternal");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplLocal = artifacts.require("SwapsImplLocal");

const wei = web3.utils.toWei;

describe("LiquidityMiningMigration", () => {
	const name = "Test SOV Token";
	const symbol = "TST";

	const PRECISION = 1e12;

	const rewardTokensPerBlock = new BN(3);
	const startDelayBlocks = new BN(1);
	const numberOfBonusBlocks = new BN(50);

	// The % which determines how much will be unlocked immediately.
	/// @dev 10000 is 100%
	const unlockedImmediatelyPercent = new BN(1000); //10%

	let accounts;
	let sovryn, loanToken, loanTokenWRBTC;
	let lender, account1, account2, account3, account4, account5, account6, account7, account8, account9;
	let SOVToken, token1, token2, token3, token4, token5, token6, token7, token8, liquidityMiningConfigToken;
	let liquidityMiningProxy, liquidityMining, liquidityMiningV2, migrator, wrapper;
	let rewardTransferLogic, lockedSOVAdmins, lockedSOV;
	let erc20RewardTransferLogic;
	let allocationPoint = new BN(10);

	const MigrationStates = {
		MigratingPools: 0,
		MigratingUsers: 1,
		MigratingFunds: 2,
		MigrationFinished: 3,
	};

	before(async () => {
		accounts = await web3.eth.getAccounts();
		[lender, account1, account2, account3, ...accounts] = accounts;
	});

	beforeEach(async () => {
		SOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
		token1 = await TestToken.new("Test token 1", "TST-1", 18, TOTAL_SUPPLY);
		token2 = await TestToken.new("Test token 2", "TST-2", 18, TOTAL_SUPPLY);
		token3 = await TestToken.new("Test token 3", "TST-3", 18, TOTAL_SUPPLY);
		token4 = await TestToken.new("Test token 4", "TST-4", 18, TOTAL_SUPPLY);
		token5 = await TestToken.new("Test token 5", "TST-5", 18, TOTAL_SUPPLY);
		token6 = await TestToken.new("Test token 6", "TST-6", 18, TOTAL_SUPPLY);
		token7 = await TestToken.new("Test token 7", "TST-7", 18, TOTAL_SUPPLY);
		token8 = await TestToken.new("Test token 8", "TST-8", 18, TOTAL_SUPPLY);

		tokens = [token1, token2, token3, token4, token5, token6, token7, token8];

		liquidityMiningConfigToken = await LiquidityMiningConfigToken.new();
		lockedSOVAdmins = [account1, account2];

		lockedSOV = await TestLockedSOV.new(SOVToken.address, lockedSOVAdmins);

		await deployProtocol();
		await deployLoanTokens();

		await deployLiquidityMining();
		await liquidityMining.initialize(
			SOVToken.address,
			rewardTokensPerBlock,
			startDelayBlocks,
			numberOfBonusBlocks,
			wrapper.address,
			lockedSOV.address,
			unlockedImmediatelyPercent
		);

		//set accounts deposits pools in liquidity mining V1
		setAccountsDepositsConstants();
		//mint some tokens to all the accounts
		await initializaAccountsTokensBalance();
		//add all poolTokens to liquidityMining
		await initializeLiquidityMiningPools();
		//make deposits from accounts to some pools
		await initializeLiquidityMiningDeposits();

		await upgradeLiquidityMining();

		await deployLiquidityMiningV2();

		await liquidityMining.initialize(liquidityMiningV2.address);

		migrator = await Migrator.new();
		await migrator.initialize(SOVToken.address, liquidityMining.address, liquidityMiningV2.address);

		await liquidityMiningV2.initialize(wrapper.address, migrator.address, SOVToken.address);

		erc20RewardTransferLogic = await ERC20TransferLogic.new();

		rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
		await rewardTransferLogic.initialize(lockedSOV.address, unlockedImmediatelyPercent);

		await liquidityMiningV2.addRewardToken(SOVToken.address, rewardTokensPerBlock, startDelayBlocks, rewardTransferLogic.address);
	});

	describe("initializeLiquidityMining", () => {
		it("should check all user deposits", async () => {
			for (let i = 0; i < accountDeposits.length; i++) {
				for (let j = 0; j < accountDeposits[i].deposit.length; j++) {
					let poolToken = accountDeposits[i].deposit[j].token;
					let poolId = await liquidityMining.getPoolId(poolToken);
					let { amount } = await liquidityMining.userInfoMap(poolId, accountDeposits[i].account);
					expect(amount).bignumber.equal(accountDeposits[i].deposit[j].amount);
				}
			}
		});
		it("should check all pool have been added", async () => {
			const { _poolToken } = await liquidityMining.getPoolInfoListArray();
			for (let i = 0; i < tokens.length; i++) {
				expect(_poolToken[i]).equal(tokens[i].address);
			}
		});
		it("should fail if liquidity mining V2 address is invalid", async () => {
			await deployLiquidityMining();
			await liquidityMining.initialize(
				SOVToken.address,
				rewardTokensPerBlock,
				startDelayBlocks,
				numberOfBonusBlocks,
				wrapper.address,
				lockedSOV.address,
				unlockedImmediatelyPercent
			);
			await upgradeLiquidityMining();

			await expectRevert(liquidityMining.initialize(ZERO_ADDRESS), "Invalid address");
		});
		it("should fail if SOV address is invalid in migrator contract", async () => {
			migrator = await Migrator.new();
			await expectRevert(
				migrator.initialize(ZERO_ADDRESS, liquidityMining.address, liquidityMiningV2.address),
				"invalid token address"
			);
		});
		it("should fail if liquidity mining V1 address is invalid in migrator contract", async () => {
			migrator = await Migrator.new();
			await expectRevert(migrator.initialize(SOVToken.address, ZERO_ADDRESS, liquidityMiningV2.address), "invalid contract address");
		});
		it("should fail if liquidity mining V2 address is invalid in migrator contract", async () => {
			migrator = await Migrator.new();
			await expectRevert(migrator.initialize(SOVToken.address, liquidityMining.address, ZERO_ADDRESS), "invalid contract address");
		});
	});

	describe("migratePools", () => {
		it("should only allow to migrate pools by the admin", async () => {
			await expectRevert(migrator.migratePools({ from: account1 }), "unauthorized");
		});
		it("should fail if migrator contract was not added as admin in liquidity mining V1", async () => {
			await expectRevert(migrator.migratePools(), "unauthorized");
		});
		it("should fail if migrator contract was not added as admin in liquidity mining V2", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await expectRevert(migrator.migratePools(), "unauthorized");
		});
		it("should only allow to migrate pools by migrator contract", async () => {
			await liquidityMiningV2.initialize(wrapper.address, SOVToken.address, SOVToken.address);
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await expectRevert(migrator.migratePools(), "only allowed to migrator contract");
		});
		it("should only allow to migrate pools if the migrate grace period started", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await expectRevert(migrator.migratePools(), "Migration hasn't started yet");
		});
		it("should only allow to migrate pools once", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await expectRevert(migrator.migratePools(), "Wrong state: should be MigratingPools");
		});
		it("should add pools from liquidityMininigV1", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			for (let i = 0; i < tokens.length; i++) {
				let poolToken = await liquidityMiningV2.poolInfoList(i);
				expect(poolToken).equal(tokens[i].address);

				let {
					allocationPoint: allocationPointV2,
					lastRewardBlock: lastRewardBlockV2,
					accumulatedRewardPerShare: accumulatedRewardPerShareV2,
				} = await liquidityMiningV2.poolInfoRewardTokensMap(i, SOVToken.address);
				let {
					allocationPoint: allocationPointV1,
					lastRewardBlock: lastRewardBlockV1,
					accumulatedRewardPerShare: accumulatedRewardPerShareV1,
				} = await liquidityMining.poolInfoList(i);
				expect(allocationPointV2).bignumber.equal(allocationPointV1);
				expect(lastRewardBlockV2).bignumber.equal(lastRewardBlockV1);
				expect(accumulatedRewardPerShareV2).bignumber.equal(accumulatedRewardPerShareV1);

				let { startBlock: startBlockV2, totalUsersBalance: totalUsersBalanceV2 } = await liquidityMiningV2.rewardTokensMap(
					SOVToken.address
				);
				let startBlockV1 = await liquidityMining.startBlock();
				let totalUsersBalanceV1 = await liquidityMining.totalUsersBalance();

				expect(startBlockV2).bignumber.equal(startBlockV1);
				expect(totalUsersBalanceV2).bignumber.equal(totalUsersBalanceV1);
				const migrationState = await migrator.migrationState();
				expect(migrationState.toNumber()).to.equal(MigrationStates.MigratingUsers);
			}
		});
	});

	describe("migrateUsers", () => {
		it("should only allow to migrate users by the admin", async () => {
			await expectRevert(migrator.migrateUsers(accounts, { from: account1 }), "unauthorized");
		});
		it("should fail migrating users if pools were not migrated", async () => {
			await expectRevert(migrator.migrateUsers(accounts), "Wrong state: should be MigratingUsers");
		});
		it("should fail finishing users migration if pools were not migrated", async () => {
			await expectRevert(migrator.finishUsersMigration(), "Wrong state: should be MigratingUsers");
		});
		it("should only allow to migrate users by migrator contract", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await liquidityMiningV2.initialize(wrapper.address, SOVToken.address, SOVToken.address);
			await expectRevert(migrator.migrateUsers(accounts), "only allowed to migrator contract");
		});
		it("should only allow to finish users migration by the admin", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await expectRevert(migrator.finishUsersMigration({ from: account1 }), "unauthorized");
		});
		it("should only allow to migrate users before finish user migration", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.finishUsersMigration();
			await expectRevert(migrator.migrateUsers(accounts), "Wrong state: should be MigratingUsers");
		});
		it("should save migrated users", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers(accounts);
			accounts.forEach(async (account) => {
				expect(await migrator.userMigrated(account));
			});

			await migrator.finishUsersMigration();
			const migrationState = await migrator.migrationState();
			expect(migrationState.toNumber()).to.equal(MigrationStates.MigratingFunds);
		});
		it("should emit user migrated event", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			tx = await migrator.migrateUsers([accounts[0]]);
			expectEvent(tx, "UserMigrated", {
				user: accounts[0],
			});
		});
		it("should be able to migrate users in differents tx", async () => {
			let userInfoV1 = [];
			for (let i = 0; i < tokens.length; i++) {
				userInfoV1[i] = [];
				for (let j = 0; j < accountDeposits.length; j++) {
					let userInfo = await liquidityMining.getUserInfo(tokens[i].address, accountDeposits[j].account);
					userInfoV1[i][j] = userInfo;
				}
			}

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			let halfLength = accounts.length / 2;
			await migrator.migrateUsers(accounts.slice(0, halfLength));

			let migrationState = await migrator.migrationState();
			expect(migrationState.toNumber()).to.equal(MigrationStates.MigratingUsers);

			await migrator.migrateUsers(accounts.slice(-halfLength));

			await migrator.finishUsersMigration();
			migrationState = await migrator.migrationState();
			expect(migrationState.toNumber()).to.equal(MigrationStates.MigratingFunds);

			for (let i = 0; i < tokens.length; i++) {
				for (let j = 0; j < accountDeposits.length; j++) {
					let userInfoV2 = await liquidityMiningV2.getUserInfo(tokens[i].address, accountDeposits[j].account);

					expect(userInfoV2.amount).bignumber.equal(userInfoV1[i][j].amount);
					expect(userInfoV2.rewards[0].rewardDebt).bignumber.equal(userInfoV1[i][j].rewardDebt);
					expect(userInfoV2.rewards[0].accumulatedReward).bignumber.equal(userInfoV1[i][j].accumulatedReward);
				}
			}
		});
		it("should migrate all accounts with deposits from liquidityMininigV1", async () => {
			let userInfoV1 = [];
			for (let i = 0; i < tokens.length; i++) {
				userInfoV1[i] = [];
				for (let j = 0; j < accountDeposits.length; j++) {
					let userInfo = await liquidityMining.getUserInfo(tokens[i].address, accountDeposits[j].account);
					userInfoV1[i][j] = userInfo;
				}
			}

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers(accounts);

			await migrator.finishUsersMigration();
			const migrationState = await migrator.migrationState();
			expect(migrationState.toNumber()).to.equal(MigrationStates.MigratingFunds);

			for (let i = 0; i < tokens.length; i++) {
				for (let j = 0; j < accountDeposits.length; j++) {
					let userInfoV2 = await liquidityMiningV2.getUserInfo(tokens[i].address, accountDeposits[j].account);

					expect(userInfoV2.amount).bignumber.equal(userInfoV1[i][j].amount);
					expect(userInfoV2.rewards[0].rewardDebt).bignumber.equal(userInfoV1[i][j].rewardDebt);
					expect(userInfoV2.rewards[0].accumulatedReward).bignumber.equal(userInfoV1[i][j].accumulatedReward);
				}
			}
		});
		it("should migrate 65 random accounts from liquidityMininigV1", async () => {
			let randomAccounts = createRandomAccounts(65);
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers(randomAccounts);
		});
	});

	describe("migrateFunds", () => {
		it("should only allow to migrate funds by the admin", async () => {
			await expectRevert(migrator.migrateFunds({ from: account1 }), "unauthorized");
		});
		it("should fail migrating funds if users were not migrated", async () => {
			await expectRevert(migrator.migrateFunds(), "Wrong state: should be MigratingFunds");
		});
		it("should only allow to migrate funds by migrator contract", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.finishUsersMigration();
			await liquidityMiningV2.initialize(wrapper.address, SOVToken.address, SOVToken.address);
			await expectRevert(migrator.migrateFunds(), "only allowed to migrator contract");
		});
		it("should fail trying to migrate funds without SOV tokens in liquidityMiningV1", async () => {
			const balanceSOV = await SOVToken.balanceOf(liquidityMining.address);
			await liquidityMining.transferSOV(liquidityMiningV2.address, balanceSOV);
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.finishUsersMigration();
			await expectRevert(migrator.migrateFunds(), "Amount invalid");
		});
		it("should fail trying to migrate funds twice", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();
			await expectRevert(migrator.migrateFunds(), "Wrong state: should be MigratingFunds");
		});
		it("should fail if liquidity mining V2 is not initialized in liquidity mining V1", async () => {
			await deployLiquidityMining();
			await liquidityMining.initialize(
				SOVToken.address,
				rewardTokensPerBlock,
				startDelayBlocks,
				numberOfBonusBlocks,
				wrapper.address,
				lockedSOV.address,
				unlockedImmediatelyPercent
			);
			await upgradeLiquidityMining();
			await deployLiquidityMiningV2();

			migrator = await Migrator.new();
			await migrator.initialize(SOVToken.address, liquidityMining.address, liquidityMiningV2.address);

			await liquidityMiningV2.initialize(wrapper.address, migrator.address, SOVToken.address);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.finishUsersMigration();
			await expectRevert(migrator.migrateFunds(), "Address not initialized");
		});
		it("should migrate funds from liquidityMining", async () => {
			let SOVBalanceV1Before = await SOVToken.balanceOf(liquidityMining.address);
			let SOVBalanceV2Before = await SOVToken.balanceOf(liquidityMiningV2.address);
			let tokenBalancesV1Before = [];
			let tokenBalancesV2Before = [];
			for (let i = 0; i < tokens.length; i++) {
				tokenBalancesV1Before.push(await tokens[i].balanceOf(liquidityMining.address));
				tokenBalancesV2Before.push(await tokens[i].balanceOf(liquidityMiningV2.address));
				expect(tokenBalancesV2Before[i]).bignumber.equal(new BN(0));
			}
			expect(SOVBalanceV2Before).bignumber.equal(new BN(0));
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			const migrationState = await migrator.migrationState();
			expect(migrationState.toNumber()).to.equal(MigrationStates.MigrationFinished);

			let SOVBalanceV1After = await SOVToken.balanceOf(liquidityMining.address);
			let SOVBalanceV2After = await SOVToken.balanceOf(liquidityMiningV2.address);
			let tokenBalancesV1After = [];
			let tokenBalancesV2After = [];
			for (let i = 0; i < tokens.length; i++) {
				tokenBalancesV1After.push(await tokens[i].balanceOf(liquidityMining.address));
				tokenBalancesV2After.push(await tokens[i].balanceOf(liquidityMiningV2.address));
				expect(tokenBalancesV1After[i]).bignumber.equal(new BN(0));
				expect(tokenBalancesV2After[i]).bignumber.equal(tokenBalancesV1Before[i]);
			}
			expect(SOVBalanceV1After).bignumber.equal(new BN(0));
			expect(SOVBalanceV2After).bignumber.equal(SOVBalanceV1Before);
		});
	});

	describe("withdraws", () => {
		it("should withdraw all before migration and revert trying to withdraw after", async () => {
			await liquidityMining.withdraw(accountDeposits[0].deposit[0].token, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers(accounts);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await expectRevert(
				liquidityMiningV2.withdraw(accountDeposits[0].deposit[0].token, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
					from: accountDeposits[0].account,
				}),
				"Not enough balance"
			);
		});
		it("should withdraw half before migration and withdraw the other half after", async () => {
			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			tokenBalanceBefore = await token1.balanceOf(accountDeposits[0].account);
			await liquidityMining.withdraw(
				accountDeposits[0].deposit[0].token,
				accountDeposits[0].deposit[0].amount.div(new BN(2)),
				ZERO_ADDRESS,
				{ from: accountDeposits[0].account }
			);

			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([accountDeposits[0].account]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();
			await liquidityMiningV2.withdraw(
				accountDeposits[0].deposit[0].token,
				accountDeposits[0].deposit[0].amount.div(new BN(2)),
				ZERO_ADDRESS,
				{ from: accountDeposits[0].account }
			);

			tokenBalanceAfter = await token1.balanceOf(accountDeposits[0].account);

			expect(tokenBalanceAfter.sub(tokenBalanceBefore)).bignumber.equal(accountDeposits[0].deposit[0].amount);
		});
		it("should withdraw all before migration, migrate, deposit and withdraw all again", async () => {
			//Re-initialization of liquidity mining contracts
			await deployLiquidityMining();
			await liquidityMining.initialize(
				SOVToken.address,
				rewardTokensPerBlock,
				startDelayBlocks,
				new BN(0),
				wrapper.address,
				lockedSOV.address,
				new BN(0)
			);
			await upgradeLiquidityMining();
			await deployLiquidityMiningV2();
			await liquidityMining.initialize(liquidityMiningV2.address);

			migrator = await Migrator.new();
			await migrator.initialize(SOVToken.address, liquidityMining.address, liquidityMiningV2.address);

			await liquidityMiningV2.initialize(wrapper.address, migrator.address, SOVToken.address);

			rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
			await rewardTransferLogic.initialize(lockedSOV.address, new BN(0));

			await liquidityMiningV2.addRewardToken(SOVToken.address, rewardTokensPerBlock, startDelayBlocks, rewardTransferLogic.address);

			await liquidityMining.add(accountDeposits[0].deposit[0].token, allocationPoint, false);

			await SOVToken.mint(liquidityMining.address, new BN(1000));

			await token1.approve(liquidityMining.address, accountDeposits[0].deposit[0].amount, { from: accountDeposits[0].account });
			await liquidityMining.deposit(token1.address, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			await mineBlocks(20);

			await liquidityMining.withdraw(token1.address, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			let balanceLockedBefore = await lockedSOV.getLockedBalance(accountDeposits[0].account);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([accountDeposits[0].account]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await token1.approve(liquidityMiningV2.address, accountDeposits[0].deposit[0].amount, { from: accountDeposits[0].account });
			await liquidityMiningV2.deposit(token1.address, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			await mineBlocks(20);

			await liquidityMiningV2.withdraw(token1.address, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			let balanceLockedAfter = await lockedSOV.getLockedBalance(accountDeposits[0].account);

			expect(balanceLockedAfter).bignumber.equal(balanceLockedBefore.mul(new BN(2)));
		});
		it("should get rewards in liquidity mining V2 after migration", async () => {
			//Re-initialization of liquidity mining contracts
			await deployLiquidityMining();
			await liquidityMining.initialize(
				SOVToken.address,
				rewardTokensPerBlock,
				startDelayBlocks,
				new BN(0),
				wrapper.address,
				lockedSOV.address,
				new BN(0)
			);
			await upgradeLiquidityMining();
			await deployLiquidityMiningV2();
			await liquidityMining.initialize(liquidityMiningV2.address);

			migrator = await Migrator.new();
			await migrator.initialize(SOVToken.address, liquidityMining.address, liquidityMiningV2.address);

			await liquidityMiningV2.initialize(wrapper.address, migrator.address, SOVToken.address);

			rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
			await rewardTransferLogic.initialize(lockedSOV.address, new BN(0));

			await liquidityMiningV2.addRewardToken(SOVToken.address, rewardTokensPerBlock, startDelayBlocks, rewardTransferLogic.address);

			await liquidityMining.add(accountDeposits[0].deposit[0].token, allocationPoint, false);

			await SOVToken.mint(liquidityMining.address, new BN(1000));

			await token1.approve(liquidityMining.address, accountDeposits[0].deposit[0].amount, { from: accountDeposits[0].account });
			await liquidityMining.deposit(token1.address, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			await mineBlocks(1);

			tx = await liquidityMining.withdraw(token1.address, accountDeposits[0].deposit[0].amount.div(new BN(2)), ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			let blockStart = tx.receipt.blockNumber;
			let balanceLockedBefore = await lockedSOV.getLockedBalance(accountDeposits[0].account);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();

			await mineBlocks(10);

			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([accountDeposits[0].account]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			tx = await liquidityMiningV2.withdraw(token1.address, accountDeposits[0].deposit[0].amount.div(new BN(2)), ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			let blockEnd = tx.receipt.blockNumber;
			let passedBlocks = new BN(blockEnd - blockStart);
			let reward = passedBlocks.mul(rewardTokensPerBlock);
			let balanceLockedAfter = await lockedSOV.getLockedBalance(accountDeposits[0].account);

			expect(balanceLockedAfter).bignumber.equal(balanceLockedBefore.add(reward));
		});
		it("should migrate rewards", async () => {
			//Re-initialization of liquidity mining contracts
			await deployLiquidityMining();
			await liquidityMining.initialize(
				SOVToken.address,
				rewardTokensPerBlock,
				startDelayBlocks,
				new BN(0),
				wrapper.address,
				lockedSOV.address,
				new BN(0)
			);
			await upgradeLiquidityMining();
			await deployLiquidityMiningV2();
			await liquidityMining.initialize(liquidityMiningV2.address);

			migrator = await Migrator.new();
			await migrator.initialize(SOVToken.address, liquidityMining.address, liquidityMiningV2.address);

			await liquidityMiningV2.initialize(wrapper.address, migrator.address, SOVToken.address);

			rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
			await rewardTransferLogic.initialize(lockedSOV.address, new BN(0));

			await liquidityMiningV2.addRewardToken(SOVToken.address, rewardTokensPerBlock, startDelayBlocks, rewardTransferLogic.address);

			await liquidityMining.add(accountDeposits[0].deposit[0].token, allocationPoint, false);

			await SOVToken.mint(liquidityMining.address, new BN(1000));

			await token1.approve(liquidityMining.address, accountDeposits[0].deposit[0].amount, { from: accountDeposits[0].account });
			await liquidityMining.deposit(token1.address, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			await mineBlocks(10);

			await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, { from: accountDeposits[0].account });
			let { rewardDebt: rewardDebtBefore } = await liquidityMining.userInfoMap(0, accountDeposits[0].account);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([accountDeposits[0].account]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			let userInfoV2 = await liquidityMiningV2.getUserInfo(token1.address, accountDeposits[0].account);
			let rewardDebtAfter = userInfoV2.rewards[0].rewardDebt;

			expect(rewardDebtAfter).bignumber.equal(rewardDebtBefore);
		});
		it("should be able to claim rewards after migration", async () => {
			//Re-initialization of liquidity mining contracts
			await deployLiquidityMining();
			await liquidityMining.initialize(
				SOVToken.address,
				rewardTokensPerBlock,
				startDelayBlocks,
				new BN(0),
				wrapper.address,
				lockedSOV.address,
				new BN(0)
			);
			await upgradeLiquidityMining();
			await deployLiquidityMiningV2();
			await liquidityMining.initialize(liquidityMiningV2.address);

			migrator = await Migrator.new();
			await migrator.initialize(SOVToken.address, liquidityMining.address, liquidityMiningV2.address);

			await liquidityMiningV2.initialize(wrapper.address, migrator.address, SOVToken.address);

			rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
			await rewardTransferLogic.initialize(lockedSOV.address, new BN(0));

			await liquidityMiningV2.addRewardToken(SOVToken.address, rewardTokensPerBlock, startDelayBlocks, rewardTransferLogic.address);

			await liquidityMining.add(accountDeposits[0].deposit[0].token, allocationPoint, false);

			await SOVToken.mint(liquidityMining.address, new BN(1000));

			await token1.approve(liquidityMining.address, accountDeposits[0].deposit[0].amount, { from: accountDeposits[0].account });
			await liquidityMining.deposit(token1.address, accountDeposits[0].deposit[0].amount, ZERO_ADDRESS, {
				from: accountDeposits[0].account,
			});
			await mineBlocks(10);

			tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, { from: accountDeposits[0].account });
			let blockStart = tx.receipt.blockNumber;
			let { rewardDebt: rewardDebtBefore } = await liquidityMining.userInfoMap(0, accountDeposits[0].account);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();

			await mineBlocks(10);

			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([accountDeposits[0].account]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			tx = await liquidityMiningV2.claimRewards(token1.address, ZERO_ADDRESS, { from: accountDeposits[0].account });
			let blockEnd = tx.receipt.blockNumber;
			let passedBlocks = new BN(blockEnd - blockStart);
			let rewardDebt = passedBlocks.mul(rewardTokensPerBlock);
			let userInfoV2 = await liquidityMiningV2.getUserInfo(token1.address, accountDeposits[0].account);
			let rewardDebtAfter = userInfoV2.rewards[0].rewardDebt;

			expect(rewardDebtAfter).bignumber.equal(rewardDebtBefore.add(rewardDebt));
		});
	});

	describe("Test lending with liquidity mining V2", async () => {
		it("Should lend to the pool at the liquidity mining V1 and migrate it", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanToken.address, new BN(10), false);
			await loanToken.setLiquidityMiningAddress(liquidityMining.address);
			await underlyingToken.approve(loanToken.address, depositAmount);
			const tx = await loanToken.mint(lender, depositAmount, true);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);

			await loanToken.setLiquidityMiningAddress(liquidityMiningV2.address);
			let userInfo = await liquidityMiningV2.getUserInfo(loanToken.address, lender);

			expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount);

			expectEvent(tx, "Mint", {
				minter: lender,
				tokenAmount: depositAmount,
				assetAmount: depositAmount,
			});
		});

		it("Should lend to the pool at the liquidity mining V1, migrate it and lend to liquidity mining V2", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanToken.address, new BN(10), false);
			await loanToken.setLiquidityMiningAddress(liquidityMining.address);
			await underlyingToken.approve(loanToken.address, depositAmount);
			await loanToken.mint(lender, depositAmount, true);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);

			await loanToken.setLiquidityMiningAddress(liquidityMiningV2.address);
			await underlyingToken.approve(loanToken.address, depositAmount);
			await loanToken.mint(lender, depositAmount, true);

			const userInfo = await liquidityMiningV2.getUserInfo(loanToken.address, lender);

			expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal(depositAmount.mul(new BN(2)));
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount.mul(new BN(2)));
		});

		it("Should lend to the pool without depositing the pool tokens at the liquidity mining contract", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanToken.address, new BN(10), false);
			await loanToken.setLiquidityMiningAddress(liquidityMining.address);
			await underlyingToken.approve(loanToken.address, depositAmount);
			await loanToken.mint(lender, depositAmount, false);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);

			await loanToken.setLiquidityMiningAddress(liquidityMiningV2.address);
			const userInfo = await liquidityMiningV2.getUserInfo(loanToken.address, lender);
			//expected: user pool token balance increased by the deposited amount, LM balance stays unchanged
			expect(await loanToken.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal("0");
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount);
		});

		it("Should only allow to burn tokens if migration finished", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanToken.address, new BN(10), false);
			await loanToken.setLiquidityMiningAddress(liquidityMining.address);
			await underlyingToken.approve(loanToken.address, depositAmount);
			await loanToken.mint(lender, depositAmount, true);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();

			await loanToken.setLiquidityMiningAddress(liquidityMiningV2.address);
			let userInfo = await liquidityMiningV2.getUserInfo(loanToken.address, lender);
			await expectRevert(loanToken.burn(lender, userInfo.amount, true), "Migration is not over yet");
		});

		it("Should remove the pool tokens from the liquidity mining V2 pool and burn them after migration", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanToken.address, new BN(10), false);
			await loanToken.setLiquidityMiningAddress(liquidityMining.address);
			await underlyingToken.approve(loanToken.address, depositAmount);
			await loanToken.mint(lender, depositAmount, true);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await loanToken.setLiquidityMiningAddress(liquidityMiningV2.address);

			let userInfo = await liquidityMiningV2.getUserInfo(loanToken.address, lender);
			expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount);

			const tx = await loanToken.burn(lender, userInfo.amount, true);
			userInfo = await liquidityMiningV2.getUserInfo(loanToken.address, lender);
			//expected: user pool token balance stayed the same but LM balance is 0
			expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal("0");
			expect(await loanToken.totalSupply()).bignumber.equal("0");
			//expect the Burn event to mention the lender
			expectEvent(tx, "Burn", {
				burner: lender,
				tokenAmount: depositAmount,
				assetAmount: depositAmount,
			});
		});

		it("Should burn pool tokens without removing them from the LM pool", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanToken.address, new BN(10), false);
			await loanToken.setLiquidityMiningAddress(liquidityMining.address);
			await underlyingToken.approve(loanToken.address, depositAmount.mul(new BN(2)));
			await loanToken.mint(lender, depositAmount, true);
			await loanToken.mint(lender, depositAmount, false);

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await loanToken.setLiquidityMiningAddress(liquidityMiningV2.address);

			let userInfo = await liquidityMiningV2.getUserInfo(loanToken.address, lender);
			expect(await loanToken.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount.mul(new BN(2)));

			await loanToken.burn(lender, depositAmount, false);

			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
			expect(await loanToken.totalSupply()).bignumber.equal(depositAmount);
		});
	});

	describe("Test WRBTC lending with liquidity mining", () => {
		it("Should lend to the pool at the liquidity mining V1, migrate it and lend to liquidity mining V2", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanTokenWRBTC.address, new BN(10), true);
			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMining.address);

			const tx = await loanTokenWRBTC.mintWithBTC(lender, true, { value: depositAmount });

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMiningV2.address);
			const userInfo = await liquidityMiningV2.getUserInfo(loanTokenWRBTC.address, lender);
			//expected: user pool token balance is 0, but balance of LM contract increased
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount);
			//expect the Mint event to mention the lender
			expectEvent(tx, "Mint", {
				minter: lender,
				tokenAmount: depositAmount,
				assetAmount: depositAmount,
			});
		});

		it("Should lend to the pool at the liquidity mining V1, migrate it and lend to liquidity mining V2", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanTokenWRBTC.address, new BN(10), true);
			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMining.address);

			await loanTokenWRBTC.mintWithBTC(lender, true, { value: depositAmount });

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMiningV2.address);
			await loanTokenWRBTC.mintWithBTC(lender, true, { value: depositAmount });
			const userInfo = await liquidityMiningV2.getUserInfo(loanTokenWRBTC.address, lender);
			//expected: user pool token balance is 0, but balance of LM contract increased
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal(depositAmount.mul(new BN(2)));
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount.mul(new BN(2)));
		});

		it("Should lend to the pool without depositing the pool tokens at the liquidity mining contract", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanTokenWRBTC.address, new BN(10), true);
			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMining.address);

			await loanTokenWRBTC.mintWithBTC(lender, false, { value: depositAmount });

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMiningV2.address);
			const userInfo = await liquidityMiningV2.getUserInfo(loanTokenWRBTC.address, lender);
			//expected: user pool token balance increased by the deposited amount, LM balance stays unchanged
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal("0");
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount);
		});

		it("Should only allow to burn tokens if migration finished", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanTokenWRBTC.address, new BN(10), false);
			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMining.address);

			await loanTokenWRBTC.mintWithBTC(lender, true, { value: depositAmount });

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();

			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMiningV2.address);
			let userInfo = await liquidityMiningV2.getUserInfo(loanTokenWRBTC.address, lender);
			await expectRevert(loanTokenWRBTC.burnToBTC(lender, userInfo.amount, true), "Migration is not over yet");
		});

		it("Should remove the pool tokens from the liquidity mining pool and burn them", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanTokenWRBTC.address, new BN(10), false);
			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMining.address);

			await loanTokenWRBTC.mintWithBTC(lender, true, { value: depositAmount });

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMiningV2.address);
			let userInfo = await liquidityMiningV2.getUserInfo(loanTokenWRBTC.address, lender);
			const tx = await loanTokenWRBTC.burnToBTC(lender, userInfo.amount, true);
			userInfo = await liquidityMiningV2.getUserInfo(loanTokenWRBTC.address, lender);
			//expected: user pool token balance stayed the same but LM balance is 0
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal("0");
			expect(userInfo.amount).bignumber.equal("0");
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal("0");
			//expect the Burn event to mention the lender
			expectEvent(tx, "Burn", {
				burner: lender,
				tokenAmount: depositAmount,
				assetAmount: depositAmount,
			});
		});

		it("Should burn pool tokens without removing them from the LM pool", async () => {
			const depositAmount = new BN(wei("400", "ether"));
			await liquidityMining.add(loanTokenWRBTC.address, new BN(10), false);
			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMining.address);

			await loanTokenWRBTC.mintWithBTC(lender, true, { value: depositAmount });
			await loanTokenWRBTC.mintWithBTC(lender, false, { value: depositAmount });

			await liquidityMining.addAdmin(migrator.address);
			await liquidityMining.startMigrationGracePeriod();
			await liquidityMiningV2.addAdmin(migrator.address);
			await migrator.migratePools();
			await migrator.migrateUsers([lender]);
			await migrator.finishUsersMigration();
			await migrator.migrateFunds();

			await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMiningV2.address);

			let userInfo = await liquidityMiningV2.getUserInfo(loanTokenWRBTC.address, lender);
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal(depositAmount);
			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount.mul(new BN(2)));

			const tx = await loanTokenWRBTC.burnToBTC(lender, userInfo.amount, false);

			expect(userInfo.amount).bignumber.equal(depositAmount);
			expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal("0");
			expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount);
		});
	});

	async function deployLiquidityMining() {
		let liquidityMiningLogic = await LiquidityMiningLogic.new();
		liquidityMiningProxy = await LiquidityMiningProxy.new();
		await liquidityMiningProxy.setImplementation(liquidityMiningLogic.address);
		liquidityMining = await LiquidityMiningLogic.at(liquidityMiningProxy.address);

		wrapper = await Wrapper.new(liquidityMining.address);
	}

	async function upgradeLiquidityMining() {
		let liquidityMiningLogicV1 = await LiquidityMiningLogicV1.new();
		await liquidityMiningProxy.setImplementation(liquidityMiningLogicV1.address);
		liquidityMining = await LiquidityMiningLogicV1.at(liquidityMiningProxy.address);
	}

	async function deployLiquidityMiningV2() {
		let liquidityMiningLogicV2 = await LiquidityMiningLogicV2.new();
		let liquidityMiningProxyV2 = await LiquidityMiningProxyV2.new();
		await liquidityMiningProxyV2.setImplementation(liquidityMiningLogicV2.address);
		liquidityMiningV2 = await LiquidityMiningLogicV2.at(liquidityMiningProxyV2.address);

		wrapper = await Wrapper.new(liquidityMiningV2.address);
	}

	async function initializeLiquidityMiningPools() {
		for (let i = 0; i < tokens.length; i++) {
			await liquidityMining.add(tokens[i].address, allocationPoint, false);
		}
	}

	async function initializaAccountsTokensBalance() {
		let amount = new BN(1000);
		await SOVToken.mint(liquidityMining.address, amount);
		tokens.forEach((token) => {
			accounts.forEach(async (account) => {
				await token.mint(account, amount);
				await token.approve(liquidityMining.address, amount, { from: account });
			});
		});
	}

	async function initializeLiquidityMiningDeposits() {
		accountDeposits.forEach((account) => {
			account.deposit.forEach(async (deposit) => {
				await liquidityMining.deposit(deposit.token, deposit.amount, ZERO_ADDRESS, { from: account.account });
			});
		});
	}

	function createRandomAccounts(length) {
		const randomAccounts = [];
		for (let i = 0; i < length; i++) {
			let id = crypto.randomBytes(32).toString("hex");
			let privateKey = "0x" + id;
			let wallet = new ethers.Wallet(privateKey);
			randomAccounts.push(wallet.address);
		}
		return randomAccounts;
	}

	function setAccountsDepositsConstants() {
		accountDeposits = [
			{
				account: accounts[0],

				deposit: [
					{
						token: token1.address,
						amount: new BN(100),
					},
					{
						token: token2.address,
						amount: new BN(10),
					},
					{
						token: token3.address,
						amount: new BN(10),
					},
					{
						token: token4.address,
						amount: new BN(10),
					},
					{
						token: token5.address,
						amount: new BN(10),
					},
					{
						token: token6.address,
						amount: new BN(10),
					},
					{
						token: token7.address,
						amount: new BN(10),
					},
					{
						token: token8.address,
						amount: new BN(10),
					},
				],
			},
			{
				account: accounts[1],

				deposit: [
					{
						token: token1.address,
						amount: new BN(5),
					},
					{
						token: token2.address,
						amount: new BN(5),
					},
					{
						token: token3.address,
						amount: new BN(5),
					},
					{
						token: token4.address,
						amount: new BN(5),
					},
				],
			},
			{
				account: accounts[2],

				deposit: [
					{
						token: token1.address,
						amount: new BN(55),
					},
				],
			},
			{
				account: accounts[3],

				deposit: [
					{
						token: token8.address,
						amount: new BN(1000),
					},
				],
			},
			{
				account: accounts[4],

				deposit: [
					{
						token: token6.address,
						amount: new BN(25),
					},
					{
						token: token7.address,
						amount: new BN(100),
					},
					{
						token: token8.address,
						amount: new BN(100),
					},
				],
			},
			{
				account: accounts[5],

				deposit: [
					{
						token: token1.address,
						amount: new BN(25),
					},
					{
						token: token3.address,
						amount: new BN(100),
					},
					{
						token: token8.address,
						amount: new BN(100),
					},
				],
			},
			{
				account: accounts[6],

				deposit: [
					{
						token: token2.address,
						amount: new BN(25),
					},
					{
						token: token4.address,
						amount: new BN(100),
					},
					{
						token: token6.address,
						amount: new BN(100),
					},
				],
			},
			{
				account: accounts[7],

				deposit: [
					{
						token: token3.address,
						amount: new BN(25),
					},
					{
						token: token5.address,
						amount: new BN(100),
					},
					{
						token: token7.address,
						amount: new BN(100),
					},
				],
			},
			{
				account: accounts[8],

				deposit: [
					{
						token: token4.address,
						amount: new BN(25),
					},
					{
						token: token5.address,
						amount: new BN(100),
					},
					{
						token: token6.address,
						amount: new BN(100),
					},
				],
			},
		];
	}

	async function mineBlocks(blocks) {
		for (let i = 0; i < blocks; i++) {
			await mineBlock();
		}
	}

	async function deployProtocol() {
		//Token
		underlyingToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
		testWrbtc = await TestWrbtc.new();

		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);

		await sovryn.replaceContract((await LoanClosingsBase.new()).address);
		await sovryn.replaceContract((await LoanClosingsWith.new()).address);
		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.replaceContract((await LoanSettings.new()).address);
		await sovryn.replaceContract((await LoanMaintenance.new()).address);
		await sovryn.replaceContract((await SwapsExternal.new()).address);
		await sovryn.replaceContract((await LoanOpenings.new()).address);

		await sovryn.setWrbtcToken(testWrbtc.address);

		feeds = await PriceFeedsLocal.new(testWrbtc.address, sovryn.address);
		await feeds.setRates(underlyingToken.address, testWrbtc.address, wei("0.01", "ether"));
		const swaps = await SwapsImplLocal.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
		await sovryn.setSupportedTokens([underlyingToken.address, testWrbtc.address], [true, true]);
		await sovryn.setPriceFeedContract(
			feeds.address //priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swaps.address // swapsImpl
		);
		await sovryn.setFeesController(lender);
	}

	async function deployLoanTokens() {
		loanTokenLogicLM = await LoanTokenLogicLM.new();
		loanToken = await LoanToken.new(lender, loanTokenLogicLM.address, sovryn.address, testWrbtc.address);
		await loanToken.initialize(underlyingToken.address, name, symbol); //iToken
		loanToken = await LoanTokenLogicLM.at(loanToken.address);

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			lender, // address owner; // owner of this object
			underlyingToken.address, // address loanToken; // the token being loaned
			testWrbtc.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		await loanToken.setupLoanParams([params], false);

		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (lender == (await sovryn.owner())) await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

		// --------------- WRBTC -----------------------//

		loanTokenLogicWRBTC = await LoanTokenLogicWRBTC.new();
		loanTokenWRBTC = await LoanToken.new(lender, loanTokenLogicWRBTC.address, sovryn.address, testWrbtc.address);
		await loanTokenWRBTC.initialize(testWrbtc.address, "iRBTC", "iRBTC");
		loanTokenWRBTC = await LoanTokenLogicWRBTC.at(loanTokenWRBTC.address);

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			lender, // address owner; // owner of this object
			testWrbtc.address, // address loanToken; // the token being loaned
			underlyingToken.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		await loanTokenWRBTC.setupLoanParams([params], false);
		await sovryn.setLoanPool([loanTokenWRBTC.address], [testWrbtc.address]);

		// ---------------- SUPPLY FUNDS TO PROTOCOL ---------------------//
		await testWrbtc.mint(sovryn.address, wei("500", "ether"));
		await underlyingToken.mint(sovryn.address, wei("50000", "ether"));
	}
});
