const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { etherMantissa, mineBlock } = require("../Utils/Ethereum");

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

describe("LiquidityMiningV2", () => {
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
    let root, account1, account2, account3, account4;
    let SOVToken, token1, token2, token3, liquidityMiningConfigToken;
    let liquidityMiningV1, liquidityMining, migrator, wrapper;
    let rewardTransferLogic, lockedSOVAdmins, lockedSOV;
    let erc20RewardTransferLogic;

    before(async () => {
        accounts = await web3.eth.getAccounts();
        [root, account1, account2, account3, account4, ...accounts] = accounts;
    });

    beforeEach(async () => {
        SOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        token1 = await TestToken.new("Test token 1", "TST-1", 18, TOTAL_SUPPLY);
        token2 = await TestToken.new("Test token 2", "TST-2", 18, TOTAL_SUPPLY);
        token3 = await TestToken.new("Test token 3", "TST-3", 18, TOTAL_SUPPLY);
        liquidityMiningConfigToken = await LiquidityMiningConfigToken.new();
        lockedSOVAdmins = [account1, account2];

        lockedSOV = await TestLockedSOV.new(SOVToken.address, lockedSOVAdmins);

        await deployLiquidityMining();
        await liquidityMiningV1.initialize(
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

        await liquidityMiningV1.initialize(liquidityMining.address);

        migrator = await Migrator.new();
        await migrator.initialize(
            SOVToken.address,
            liquidityMiningV1.address,
            liquidityMining.address
        );

        await liquidityMining.initialize(wrapper.address, migrator.address);

        erc20RewardTransferLogic = await ERC20TransferLogic.new();

        rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
        await rewardTransferLogic.initialize(lockedSOV.address, unlockedImmediatelyPercent);

        await liquidityMining.setWrapper(wrapper.address);
        await liquidityMining.addRewardToken(
            SOVToken.address,
            rewardTokensPerBlock,
            startDelayBlocks,
            rewardTransferLogic.address
        );

        //mint SOVs to lvm1 for migrations
        await SOVToken.mint(liquidityMiningV1.address, new BN(10));
        await liquidityMiningV1.addAdmin(migrator.address);
        await liquidityMiningV1.startMigrationGracePeriod();
        await liquidityMining.addAdmin(migrator.address);
        await migrator.migratePools();
        await migrator.finishUsersMigration();
        await migrator.migrateFunds();
        //burn SOVs for testing
        const balanceSOV = await SOVToken.balanceOf(liquidityMining.address);
        await SOVToken.burn(liquidityMining.address, balanceSOV);
    });

    describe("initialize", () => {
        it("should fail if migrator address is invalid", async () => {
            await deployLiquidityMiningV2();
            await expectRevert(
                liquidityMining.initialize(wrapper.address, ZERO_ADDRESS),
                "invalid contract address"
            );
        });

        it("fails if already initialized", async () => {
            await deployLiquidityMiningV2();
            await liquidityMining.initialize(wrapper.address, liquidityMiningV1.address);
            await expectRevert(
                liquidityMining.initialize(wrapper.address, liquidityMiningV1.address),
                "Already initialized"
            );
        });

        it("sets the expected values", async () => {
            await deployLiquidityMiningV2();
            await liquidityMining.initialize(wrapper.address, liquidityMiningV1.address);

            let _wrapper = await liquidityMining.wrapper();

            expect(_wrapper).equal(wrapper.address);
        });
    });

    describe("addAdmin", () => {
        it("adds admin", async () => {
            let tx = await liquidityMining.addAdmin(account1);

            expectEvent(tx, "AdminAdded", {
                admin: account1,
            });

            let isAdmin = await liquidityMining.admins(account1);
            expect(isAdmin).equal(true);
        });

        it("fails sender isn't an owner", async () => {
            await expectRevert(
                liquidityMining.addAdmin(account1, { from: account1 }),
                "unauthorized"
            );
        });
    });

    describe("removeAdmin", () => {
        it("adds admin", async () => {
            await liquidityMining.addAdmin(account1);
            let tx = await liquidityMining.removeAdmin(account1);

            expectEvent(tx, "AdminRemoved", {
                admin: account1,
            });

            let isAdmin = await liquidityMining.admins(account1);
            expect(isAdmin).equal(false);
        });

        it("fails sender isn't an owner", async () => {
            await expectRevert(
                liquidityMining.removeAdmin(account1, { from: account1 }),
                "unauthorized"
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

        it("fails if not an owner or an admin", async () => {
            await expectRevert(
                liquidityMining.setWrapper(account2, { from: account1 }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.setWrapper(account2, { from: account1 });
        });
    });

    describe("stopMining", () => {
        it("should set end block", async () => {
            let tx = await liquidityMining.stopMining(SOVToken.address);

            let blockNumber = new BN(tx.receipt.blockNumber);

            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            let _endBlock = rewardToken.endBlock;
            expect(_endBlock).bignumber.equal(blockNumber);
        });

        it("fails if not an owner or an admin", async () => {
            await expectRevert(
                liquidityMining.stopMining(SOVToken.address, { from: account1 }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.stopMining(SOVToken.address, { from: account1 });
        });

        it("fails if already stopped", async () => {
            await liquidityMining.stopMining(SOVToken.address);
            await expectRevert(liquidityMining.stopMining(SOVToken.address), "Already stopped");
        });

        it("fails if reward token is not initialized", async () => {
            await liquidityMining.stopMining(SOVToken.address);
            await expectRevert(liquidityMining.stopMining(token3.address), "Not initialized");
        });
    });

    describe("transferRewardTokens", () => {
        it("should be able to transfer SOV", async () => {
            let amount = new BN(1000);
            await SOVToken.transfer(liquidityMining.address, amount);

            let balanceBefore = await SOVToken.balanceOf(account1);
            await liquidityMining.transferRewardTokens(SOVToken.address, account1, amount);
            let balanceAfter = await SOVToken.balanceOf(account1);

            expect(amount).bignumber.equal(balanceAfter.sub(balanceBefore));
        });

        it("only owner or admin should be able to transfer", async () => {
            await expectRevert(
                liquidityMining.transferRewardTokens(SOVToken.address, account1, 1000, {
                    from: account1,
                }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.transferRewardTokens(SOVToken.address, account1, 1000, {
                from: account1,
            });
        });

        it("fails if the 0 address is passed as receiver address", async () => {
            await expectRevert(
                liquidityMining.transferRewardTokens(SOVToken.address, ZERO_ADDRESS, 1000),
                "Receiver address invalid"
            );
        });

        it("fails if the 0 is passed as an amount", async () => {
            await expectRevert(
                liquidityMining.transferRewardTokens(SOVToken.address, account1, 0),
                "Amount invalid"
            );
        });

        it("fails if the zero address is passed as token", async () => {
            await expectRevert(
                liquidityMining.transferRewardTokens(ZERO_ADDRESS, account1, 0),
                "Reward address invalid"
            );
        });
    });

    describe("addRewardToken", () => {
        /*
		address _rewardToken,
		uint256 _rewardTokensPerBlock,
		uint256 _startDelayBlocks,
		address _rewardTransferLogic
		*/
        let otherRewardTokensPerBlock = 2;
        let otherStartDelayBlocks = 3;

        it("should be able to add a reward token", async () => {
            const transferLogic = await ERC20TransferLogic.new();
            await transferLogic.initialize(token1.address);
            await liquidityMining.addRewardToken(
                token1.address,
                otherRewardTokensPerBlock,
                otherStartDelayBlocks,
                transferLogic.address
            );
            const rewardToken = await liquidityMining.getRewardToken(token1.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(new BN(0));
            expect(rewardToken.totalUsersBalance).bignumber.equal(new BN(0));
            expect(rewardToken.rewardTokensPerBlock).bignumber.equal(new BN(2));
        });

        it("fails if start delay blocks is not greater than 0", async () => {
            const addInvalidAddress = liquidityMining.addRewardToken(
                token1.address,
                otherRewardTokensPerBlock,
                0,
                erc20RewardTransferLogic.address
            );
            await expectRevert(addInvalidAddress, "Invalid start block");
        });

        it("fails if reward token address is not valid", async () => {
            const addInvalidAddress = liquidityMining.addRewardToken(
                ZERO_ADDRESS,
                otherRewardTokensPerBlock,
                otherStartDelayBlocks,
                erc20RewardTransferLogic.address
            );
            await expectRevert(addInvalidAddress, "Invalid token address");
        });

        it("fails if token is already added as reward token", async () => {
            const transferLogic = await ERC20TransferLogic.new();
            await transferLogic.initialize(token1.address);
            await liquidityMining.addRewardToken(
                token1.address,
                otherRewardTokensPerBlock,
                otherStartDelayBlocks,
                transferLogic.address
            );
            const addReward = liquidityMining.addRewardToken(
                token1.address,
                otherRewardTokensPerBlock,
                otherStartDelayBlocks,
                transferLogic.address
            );
            await expectRevert(addReward, "Already added");
        });

        it("fails if reward transfer logic doesn't correspond to given reward token", async () => {
            const addInvalidAddress = liquidityMining.addRewardToken(
                token1.address,
                otherRewardTokensPerBlock,
                otherStartDelayBlocks,
                erc20RewardTransferLogic.address
            );
            await expectRevert(addInvalidAddress, "Reward token and transfer logic mismatch");
        });
    });

    describe("add", () => {
        it("should be able to add pool token", async () => {
            let allocationPoint = new BN(1);
            let tx = await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );

            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(allocationPoint);

            let poolInfo = await liquidityMining.poolInfoList(0);
            expect(poolInfo).equal(token1.address);

            let poolReward = await liquidityMining.getPoolReward(token1.address, SOVToken.address);
            expect(poolReward.allocationPoint).bignumber.equal(allocationPoint);
            let blockNumber = new BN(tx.receipt.blockNumber);
            expect(poolReward.lastRewardBlock).bignumber.equal(blockNumber);
            expect(poolReward.accumulatedRewardPerShare).bignumber.equal(new BN(0));

            expect(await liquidityMining.getPoolLength()).bignumber.equal(new BN(1));

            expectEvent(tx, "PoolTokenAdded", {
                user: root,
                poolToken: token1.address,
                rewardTokens: [SOVToken.address],
            });
            expect(tx.logs[1].args.allocationPoints[0]).bignumber.equal(allocationPoint);
        });

        it("should be able to add 2 pool tokens and update pools", async () => {
            let allocationPoint1 = new BN(1);
            let tx1 = await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint1],
                false
            );

            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(allocationPoint1);

            expectEvent(tx1, "PoolTokenAdded", {
                user: root,
                poolToken: token1.address,
                rewardTokens: [SOVToken.address],
            });
            expect(tx1.logs[1].args.allocationPoints[0]).bignumber.equal(allocationPoint1);

            let allocationPoint2 = new BN(2);
            let tx2 = await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint2],
                true
            );

            rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(
                allocationPoint1.add(allocationPoint2)
            );

            expectEvent(tx2, "PoolTokenAdded", {
                user: root,
                poolToken: token2.address,
                rewardTokens: [SOVToken.address],
            });
            expect(tx2.logs[1].args.allocationPoints[0]).bignumber.equal(allocationPoint2);

            let poolRewardInfo1 = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            let poolRewardInfo2 = await liquidityMining.getPoolReward(
                token2.address,
                SOVToken.address
            );
            expect(poolRewardInfo1.lastRewardBlock).bignumber.equal(
                poolRewardInfo2.lastRewardBlock
            );
        });

        it("fails if the reward token list is empty", async () => {
            await expectRevert(
                liquidityMining.add(token1.address, [], [new BN(0)], false),
                "Invalid reward tokens length"
            );
        });

        it("fails if the reward tokens length is different to allocation points", async () => {
            await expectRevert(
                liquidityMining.add(
                    token1.address,
                    [token2.address, token3.address],
                    [new BN(1)],
                    false
                ),
                "Invalid allocation points length"
            );
        });

        it("fails if the reward token is repeated", async () => {
            await expectRevert(
                liquidityMining.add(
                    token1.address,
                    [SOVToken.address, SOVToken.address],
                    [new BN(1), new BN(1)],
                    false
                ),
                "Already associated"
            );
        });

        it("fails if the reward token is not valid", async () => {
            await expectRevert(
                liquidityMining.add(token1.address, [token2.address], [new BN(1)], false),
                "Not initialized"
            );
        });

        it("fails if the 0 allocation point is passed", async () => {
            await expectRevert(
                liquidityMining.add(token1.address, [SOVToken.address], [new BN(0)], false),
                "Invalid allocation point"
            );
        });

        it("fails if the 0 address is passed as token address", async () => {
            await expectRevert(
                liquidityMining.add(ZERO_ADDRESS, [SOVToken.address], [new BN(0)], false),
                "Invalid token address"
            );
        });

        it("fails if token already added", async () => {
            await liquidityMining.add(token1.address, [SOVToken.address], [new BN(1)], false);
            await expectRevert(
                liquidityMining.add(token1.address, [SOVToken.address], [new BN(0)], false),
                "Token already added"
            );
        });

        it("only owner or admin should be able to add pool token", async () => {
            await expectRevert(
                liquidityMining.add(token2.address, [SOVToken.address], [new BN(0)], false, {
                    from: account1,
                }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.add(token2.address, [SOVToken.address], [new BN(1)], false, {
                from: account1,
            });
        });
    });

    describe("update", () => {
        it("should be able to update pool token", async () => {
            let oldAllocationPoint = new BN(1);
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [oldAllocationPoint],
                false
            );

            let newAllocationPoint = new BN(2);
            let tx = await liquidityMining.update(
                token1.address,
                [SOVToken.address],
                [newAllocationPoint],
                false
            );

            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(newAllocationPoint);

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let blockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                newAllocationPoint,
                blockNumber,
                new BN(0)
            );

            expect(await liquidityMining.getPoolLength()).bignumber.equal(new BN(1));

            expectEvent(tx, "PoolTokenUpdated", {
                user: root,
                poolToken: token1.address,
                rewardToken: SOVToken.address,
                newAllocationPoint: newAllocationPoint,
                oldAllocationPoint: oldAllocationPoint,
            });
        });

        it("should be able to update pool token and update pools", async () => {
            let oldAllocationPoint = new BN(1);
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [oldAllocationPoint],
                false
            );

            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [oldAllocationPoint],
                false
            );

            let newAllocationPoint = new BN(2);
            let tx = await liquidityMining.update(
                token1.address,
                [SOVToken.address],
                [newAllocationPoint],
                true
            );

            const rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(
                oldAllocationPoint.add(newAllocationPoint)
            );

            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            expect(poolRewardToken.lastRewardBlock).bignumber.equal(
                new BN(tx.receipt.blockNumber)
            );
        });

        it("fails if token wasn't added", async () => {
            await expectRevert(
                liquidityMining.update(token1.address, [SOVToken.address], [new BN(1)], false),
                "Pool token not found"
            );
        });

        it("only owner or admin should be able to update pool token", async () => {
            await liquidityMining.add(token2.address, [SOVToken.address], [new BN(1)], false);
            await expectRevert(
                liquidityMining.update(token2.address, [SOVToken.address], [new BN(1)], false, {
                    from: account1,
                }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.update(token2.address, [SOVToken.address], [new BN(1)], false, {
                from: account1,
            });
        });
    });

    describe("updateTokens", () => {
        it("should be able to update 2 pool tokens", async () => {
            let poolTokens = [token1.address, token2.address, token3.address];
            let oldAllocationPoints = [new BN(1), new BN(2), new BN(3)];

            for (let i = 0; i < poolTokens.length; i++) {
                await liquidityMining.add(
                    poolTokens[i],
                    [SOVToken.address],
                    [oldAllocationPoints[i]],
                    false
                );
            }

            let newAllocationPoints = [[new BN(101)], [new BN(102)], [new BN(3)]];
            let rewardTokens = new Array(3).fill([SOVToken.address]);
            let tx = await liquidityMining.updateTokens(
                poolTokens,
                rewardTokens,
                newAllocationPoints,
                true
            );

            let totalAllocationPoint = new BN(0);
            for (let i = 0; i < newAllocationPoints.length; i++) {
                totalAllocationPoint = totalAllocationPoint.add(newAllocationPoints[i][0]);
            }
            const rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(totalAllocationPoint);

            let blockNumber = new BN(tx.receipt.blockNumber);
            for (let i = 0; i < poolTokens.length - 1; i++) {
                let poolInfo = await liquidityMining.getPoolInfo(poolTokens[i]);
                const poolRewardToken = await liquidityMining.getPoolReward(
                    poolTokens[i],
                    SOVToken.address
                );
                checkPoolRewardInfo(
                    poolInfo,
                    poolTokens[i],
                    poolRewardToken,
                    newAllocationPoints[i][0],
                    blockNumber,
                    new BN(0)
                );

                expectEvent(tx, "PoolTokenUpdated", {
                    user: root,
                    poolToken: poolTokens[i],
                    rewardToken: SOVToken.address,
                    newAllocationPoint: newAllocationPoints[i][0],
                    oldAllocationPoint: oldAllocationPoints[i],
                });
            }

            expect(await liquidityMining.getPoolLength()).bignumber.equal(new BN(3));

            const poolRewardToken = await liquidityMining.getPoolReward(
                poolTokens[poolTokens.length - 1],
                SOVToken.address
            );
            expect(poolRewardToken.lastRewardBlock).bignumber.equal(blockNumber);
        });

        it("fails if token wasn't added", async () => {
            await expectRevert(
                liquidityMining.updateTokens(
                    [token1.address],
                    [[SOVToken.address]],
                    [[new BN(1)]],
                    false
                ),
                "Pool token not found"
            );
        });

        it("fails if arrays have different length", async () => {
            await liquidityMining.add(token2.address, [SOVToken.address], [new BN(1)], false);
            await expectRevert(
                liquidityMining.updateTokens(
                    [token1.address, token2.address],
                    [[SOVToken.address]],
                    [[new BN(1)]],
                    false
                ),
                "Arrays mismatch"
            );

            await expectRevert(
                liquidityMining.updateTokens(
                    [token1.address, token2.address],
                    [[SOVToken.address]],
                    [[new BN(1)], [new BN(1)]],
                    false
                ),
                "Arrays mismatch"
            );

            await expectRevert(
                liquidityMining.updateTokens(
                    [token1.address, token2.address],
                    [[SOVToken.address, token3.address], [SOVToken.address]],
                    [[new BN(1)], [new BN(1)]],
                    false
                ),
                "Arrays mismatch"
            );

            await expectRevert(
                liquidityMining.updateTokens(
                    [token1.address, token2.address],
                    [[SOVToken.address, token3.address]],
                    [[new BN(1)], [new BN(1)]],
                    false
                ),
                "Arrays mismatch"
            );
        });

        it("only owner or admin should be able to update pool token", async () => {
            await liquidityMining.add(token2.address, [SOVToken.address], [new BN(1)], false);
            await expectRevert(
                liquidityMining.updateTokens(
                    [token2.address],
                    [[SOVToken.address]],
                    [[new BN(1)]],
                    false,
                    { from: account1 }
                ),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.updateTokens(
                [token2.address],
                [[SOVToken.address]],
                [[new BN(1)]],
                false,
                { from: account1 }
            );
        });
    });

    describe("deposit", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            await mineBlocks(1);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
        });
        it("should only allow to deposit if migration is finished", async () => {
            await deployLiquidityMiningV2();
            await liquidityMining.initialize(wrapper.address, liquidityMiningV1.address);
            await liquidityMining.addRewardToken(
                SOVToken.address,
                rewardTokensPerBlock,
                startDelayBlocks,
                rewardTransferLogic.address
            );

            await expectRevert(
                liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, { from: account1 }),
                "Migration is not over yet"
            );
        });
        it("should be able to deposit", async () => {
            let tx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let blockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                blockNumber,
                new BN(0)
            );

            await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));

            expectEvent(tx, "Deposit", {
                user: account1,
                poolToken: token1.address,
                amount: amount,
            });
        });

        it("should be able to deposit using wrapper", async () => {
            let tx = await liquidityMining.deposit(token1.address, amount, account2, {
                from: account1,
            });

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let blockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                blockNumber,
                new BN(0)
            );

            await checkUserPoolTokens(account2, token1, amount, amount, new BN(0));

            expectEvent(tx, "Deposit", {
                user: account2,
                poolToken: token1.address,
                amount: amount,
            });
        });

        it("should be able to deposit 0 amount", async () => {
            let tx = await liquidityMining.deposit(token1.address, new BN(0), ZERO_ADDRESS, {
                from: account1,
            });

            expectEvent(tx, "Deposit", {
                user: account1,
                poolToken: token1.address,
                amount: new BN(0),
            });
        });

        it("fails if token pool token not found", async () => {
            await expectRevert(
                liquidityMining.deposit(account1, amount, ZERO_ADDRESS, { from: account1 }),
                "Pool token not found"
            );
        });
    });

    describe("claimRewards", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            await mineBlocks(1);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
        });

        it("shouldn't be able to claim reward (will not be claimed without SOV tokens)", async () => {
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await expectRevert(
                liquidityMining.claimRewards(token1.address, ZERO_ADDRESS, { from: account1 }),
                "Claiming reward failed"
            );
        });

        it("should be able to claim reward (will be claimed with SOV tokens)", async () => {
            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            let tx = await liquidityMining.claimRewards(token1.address, ZERO_ADDRESS, {
                from: account1,
            });
            let latestBlockNumber = new BN(tx.receipt.blockNumber);

            const rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                latestBlockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));
            let userReward = await checkUserReward(
                account1,
                token1,
                depositBlockNumber,
                latestBlockNumber
            );

            //withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                amount: userReward,
                rewardToken: SOVToken.address,
            });
        });

        it("should be able to claim reward using wrapper", async () => {
            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            let tx = await wrapper.claimReward(token1.address, { from: account1 });

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                latestBlockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));
            let userReward = await checkUserReward(
                account1,
                token1,
                depositBlockNumber,
                latestBlockNumber
            );

            //withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));
        });

        it("should not take into account blocks before start delay", async () => {
            await token2.mint(account1, amount);
            await token2.approve(liquidityMining.address, amount, { from: account1 });
            await token3.transfer(liquidityMining.address, new BN(1000));

            await erc20RewardTransferLogic.initialize(token3.address);
            await liquidityMining.addRewardToken(
                token3.address,
                new BN(3),
                new BN(5),
                erc20RewardTransferLogic.address
            );
            await liquidityMining.add(token2.address, [token3.address], [allocationPoint], true);
            await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await mineBlock();

            await liquidityMining.updateAllPools();
            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token2.address,
                token3.address,
                account1
            );
            expect(reward1).bignumber.equal(new BN(0));

            await mineBlock();

            let tx = await liquidityMining.claimRewards(token2.address, ZERO_ADDRESS, {
                from: account1,
            });
            // at this point there was 1 mined block after start block
            expectEvent(tx, "RewardClaimed", {
                user: account1,
                amount: new BN(3),
                rewardToken: token3.address,
            });
        });

        it("should not take into account blocks after stop mining", async () => {
            await token2.mint(account1, amount);
            await token2.approve(liquidityMining.address, amount, { from: account1 });
            await token3.transfer(liquidityMining.address, new BN(1000));

            await erc20RewardTransferLogic.initialize(token3.address);
            await liquidityMining.addRewardToken(
                token3.address,
                new BN(3),
                new BN(2),
                erc20RewardTransferLogic.address
            );

            await liquidityMining.add(token2.address, [token3.address], [allocationPoint], true);
            await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await mineBlocks(1);
            await liquidityMining.stopMining(token3.address);
            await mineBlocks(2);

            let tx = await liquidityMining.claimRewards(token2.address, ZERO_ADDRESS, {
                from: account1,
            });
            // last 2 blocks should not accumulate rewards
            expectEvent(tx, "RewardClaimed", {
                user: account1,
                amount: new BN(6),
                rewardToken: token3.address,
            });
        });

        it("fails if token pool token not found", async () => {
            await expectRevert(
                liquidityMining.claimRewards(account1, ZERO_ADDRESS, { from: account1 }),
                "Pool token not found"
            );
        });
    });

    describe("claimRewardFromAllPools", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            await mineBlocks(1);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
            await token2.mint(account1, amount);
            await token2.approve(liquidityMining.address, amount, { from: account1 });
        });

        it("shouldn't be able to claim reward (will not be claimed without SOV tokens)", async () => {
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await expectRevert(
                liquidityMining.claimRewardFromAllPools(ZERO_ADDRESS, { from: account1 }),
                "Claiming reward failed"
            );
        });

        it("should be able to claim reward (will be claimed with SOV tokens)", async () => {
            let depositTx1 = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber1 = new BN(depositTx1.receipt.blockNumber);
            let depositTx2 = await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber2 = new BN(depositTx2.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, amount.mul(new BN(2)));

            let tx = await liquidityMining.claimRewardFromAllPools(ZERO_ADDRESS, {
                from: account1,
            });

            const rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                latestBlockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));
            let userReward1 = await checkUserReward(
                account1,
                token1,
                depositBlockNumber1,
                latestBlockNumber
            );
            //we have 2 pools with the same allocation points
            userReward1 = userReward1.div(new BN(2));

            await checkUserPoolTokens(account1, token2, amount, amount, new BN(0));
            let userReward2 = await checkUserReward(
                account1,
                token2,
                depositBlockNumber2,
                latestBlockNumber
            );
            //we have 2 pools with the same allocation points
            userReward2 = userReward2.div(new BN(2));

            //withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                rewardToken: SOVToken.address,
                amount: userReward1,
            });

            expect(userReward1, tx.logs[0].args.amount);
            expect(token1.address, tx.logs[0].args.poolToken);
            expect(userReward2, tx.logs[1].args.amount);
            expect(token2.address, tx.logs[1].args.poolToken);
        });

        it("should be able to claim reward using wrapper", async () => {
            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            let tx = await wrapper.claimRewardFromAllPools({ from: account1 });

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                latestBlockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));
            await checkUserReward(account1, token1, depositBlockNumber, latestBlockNumber);

            //withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));
        });
    });

    describe("withdraw", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            await mineBlocks(1);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
        });

        it("should be able to withdraw (without claiming reward)", async () => {
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            let tx = await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let blockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                blockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(account1, token1, new BN(0), new BN(0), amount);

            // User's balance on lockedSOV vault
            let userRewardBalance = await lockedSOV.getLockedBalance(account1);
            expect(userRewardBalance).bignumber.equal(new BN(0));

            expectEvent(tx, "Withdraw", {
                user: account1,
                poolToken: token1.address,
                amount: amount,
            });
        });

        it("should be able to withdraw (with claiming reward)", async () => {
            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            let tx = await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            const rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                latestBlockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(account1, token1, new BN(0), new BN(0), amount);
            let userReward = await checkUserReward(
                account1,
                token1,
                depositBlockNumber,
                latestBlockNumber
            );

            //withdrawAndStakeTokensFrom was not invoked
            let expectedUnlockedBalance = userReward
                .mul(unlockedImmediatelyPercent)
                .div(new BN(10000));
            let expectedLockedBalance = userReward.sub(expectedUnlockedBalance);
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(expectedUnlockedBalance);
            expect(lockedBalance).bignumber.equal(expectedLockedBalance);

            expectEvent(tx, "Withdraw", {
                user: account1,
                poolToken: token1.address,
                amount: amount,
            });

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                rewardToken: SOVToken.address,
                amount: userReward,
            });
        });

        it("should be able to withdraw using wrapper", async () => {
            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            let tx = await wrapper.withdraw(token1.address, amount, { from: account1 });

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            const poolRewardToken = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            checkPoolRewardInfo(
                poolInfo,
                token1.address,
                poolRewardToken,
                allocationPoint,
                latestBlockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(
                account1,
                token1,
                new BN(0),
                new BN(0),
                amount,
                wrapper.address
            );
            let userReward = await checkUserReward(
                account1,
                token1,
                depositBlockNumber,
                latestBlockNumber
            );
        });

        it("fails if withdraw for a user without using wrapper or pool", async () => {
            await expectRevert(
                liquidityMining.withdraw(token1.address, amount, account1, { from: account3 }),
                "only wrapper or pools may withdraw for a user"
            );
        });

        it("fails if token pool token not found", async () => {
            await expectRevert(
                liquidityMining.withdraw(account1, amount, ZERO_ADDRESS, { from: account1 }),
                "Pool token not found"
            );
        });

        it("fails if token pool token not found", async () => {
            await expectRevert(
                liquidityMining.withdraw(token1.address, amount.mul(new BN(2)), ZERO_ADDRESS, {
                    from: account1,
                }),
                "Not enough balance"
            );
        });
    });

    describe("emergencyWithdraw", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            await mineBlocks(1);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
        });

        it("should be able to withdraw", async () => {
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            let tx = await liquidityMining.emergencyWithdraw(token1.address, { from: account1 });

            const rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalUsersBalance).bignumber.equal(new BN(0));

            await checkUserPoolTokens(account1, token1, new BN(0), new BN(0), amount);

            let userInfo = await liquidityMining.getUserInfo(token1.address, account1);
            expect(userInfo.rewards[0].rewardDebt).bignumber.equal(new BN(0));
            expect(userInfo.rewards[0].accumulatedReward).bignumber.equal(new BN(0));

            expectEvent(tx, "EmergencyWithdraw", {
                user: account1,
                poolToken: token1.address,
                rewardToken: SOVToken.address,
                amount: amount,
                accumulatedReward: rewardTokensPerBlock,
            });
        });

        it("fails if token pool token not found", async () => {
            await expectRevert(
                liquidityMining.emergencyWithdraw(account1, { from: account1 }),
                "Pool token not found"
            );
        });
    });

    describe("getUserAccumulatedReward", () => {
        const amount1 = new BN(1000);
        const amount2 = new BN(2000);
        const allocationPoint1 = new BN(1);
        const allocationPoint2 = new BN(2);
        const totalAllocationPoint = allocationPoint1.add(allocationPoint2);

        beforeEach(async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint1],
                false
            );
            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint2],
                false
            );

            await token1.mint(account1, amount1);
            await token2.mint(account2, amount2);

            await token1.approve(liquidityMining.address, amount1, { from: account1 });
            await token2.approve(liquidityMining.address, amount2, { from: account2 });
        });

        it("check calculation for no deposits", async () => {
            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                SOVToken.address,
                account1
            );
            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token2.address,
                SOVToken.address,
                account2
            );
            expect(reward1).bignumber.equal("0");
            expect(reward2).bignumber.equal("0");
        });

        it("check calculation for single user, token 1", async () => {
            await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {
                from: account1,
            });
            await mineBlock();
            let reward = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                SOVToken.address,
                account1
            );

            // 1 block has passed
            // users are given 3 tokens per share per block. user1 owns 100% of the shares
            // token 1 counts as 1/3 of the pool
            // reward = 1 * 3 * 1/3 = 1
            const expectedReward = rewardTokensPerBlock
                .mul(allocationPoint1)
                .div(totalAllocationPoint);
            expect(expectedReward).bignumber.equal("1"); // sanity check
            expect(reward).bignumber.equal(expectedReward);

            await mineBlock();
            reward = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                SOVToken.address,
                account1
            );
            expect(reward).bignumber.equal("2");
        });

        it("check calculation for single user, token 2", async () => {
            await liquidityMining.deposit(token2.address, amount2, ZERO_ADDRESS, {
                from: account2,
            });
            await mineBlock();
            let reward = await liquidityMining.getUserAccumulatedReward(
                token2.address,
                SOVToken.address,
                account2
            );

            // 1 block has passed
            // users are given 3 tokens per share per block. user2 owns 100% of the shares
            // token 2 counts as 2/3 of the pool
            // reward = 1 * 3 * 2/3 = 2
            const expectedReward = rewardTokensPerBlock
                .mul(allocationPoint2)
                .div(totalAllocationPoint);
            expect(expectedReward).bignumber.equal("2"); // sanity check
            expect(reward).bignumber.equal(expectedReward);

            await mineBlock();
            reward = await liquidityMining.getUserAccumulatedReward(
                token2.address,
                SOVToken.address,
                account2
            );
            expect(reward).bignumber.equal("4");
        });

        it("check calculation for two users and tokens", async () => {
            await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {
                from: account1,
            });
            // because automining is on, the following will advance a block
            await liquidityMining.deposit(token2.address, amount2, ZERO_ADDRESS, {
                from: account2,
            });
            // sanity checks
            expect(
                await liquidityMining.getUserAccumulatedReward(
                    token1.address,
                    SOVToken.address,
                    account1
                )
            ).bignumber.equal("1");
            expect(
                await liquidityMining.getUserAccumulatedReward(
                    token2.address,
                    SOVToken.address,
                    account2
                )
            ).bignumber.equal("0");
            await mineBlock();

            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                SOVToken.address,
                account1
            );
            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token2.address,
                SOVToken.address,
                account2
            );

            // for the first block, user 1 will receive the reward of 1
            // for the second block:
            // - user 1 still owns 100% of the shares for token1, so same reward (total 1 + 1 = 2)
            // - user 2 owns 100% of the shares for token2, so same reward as in the other cases
            expect(reward1).bignumber.equal("2");
            expect(reward2).bignumber.equal("2");
        });

        it("check calculation for two users, same token (shares taken into account)", async () => {
            const token = token1;
            const amount = amount1;
            await token.mint(account2, amount);
            await token.approve(liquidityMining.address, amount, { from: account2 });

            await liquidityMining.deposit(token.address, amount, ZERO_ADDRESS, { from: account1 });
            // because automining is on, the following will advance a block
            await liquidityMining.deposit(token.address, amount, ZERO_ADDRESS, { from: account2 });
            // sanity checks
            expect(
                await liquidityMining.getUserAccumulatedReward(
                    token.address,
                    SOVToken.address,
                    account1
                )
            ).bignumber.equal("1");
            expect(
                await liquidityMining.getUserAccumulatedReward(
                    token.address,
                    SOVToken.address,
                    account2
                )
            ).bignumber.equal("0");
            await mineBlock();
            await mineBlock();

            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token.address,
                SOVToken.address,
                account1
            );
            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token.address,
                SOVToken.address,
                account2
            );

            // for the first block, user 1 will receive the reward of 1 (reward given per block for 100% of shares)
            // after 2 blocks:
            // - user 1 owns 1/2 of the shares => expected reward = 1 (total 1 + 1 = 2)
            // - user 2 owns 1/2 of the shares => expected reward = 1
            expect(reward1).bignumber.equal("2");
            expect(reward2).bignumber.equal("1");
        });
    });

    describe("getEstimatedReward", () => {
        const amount1 = new BN(1000);
        const amount2 = new BN(2000);
        const amount3 = new BN(4000);
        const allocationPoint1 = new BN(1);
        const allocationPoint2 = new BN(2);

        const totalAllocationPoint = allocationPoint1.add(allocationPoint2);
        let secondsPerBlock;

        beforeEach(async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint1],
                false
            );

            await token1.mint(account1, amount1);
            await token1.mint(account2, amount2);
            await token1.mint(account3, amount3);

            await token1.approve(liquidityMining.address, amount1, { from: account1 });
            await token1.approve(liquidityMining.address, amount2, { from: account2 });

            secondsPerBlock = await liquidityMining.SECONDS_PER_BLOCK();
        });

        it("check calculation for 1 user 2 delayed block reward, period less than 2 blocks", async () => {
            await erc20RewardTransferLogic.initialize(token3.address);
            await liquidityMining.addRewardToken(
                token3.address,
                new BN(3),
                new BN(2),
                erc20RewardTransferLogic.address
            );
            await liquidityMining.add(token2.address, [token3.address], [allocationPoint1], false);
            let duration = secondsPerBlock.mul(new BN(2)).sub(new BN(1));

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token2.address,
                token3.address,
                amount3,
                duration
            );
            let expectedReward = "0";
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 1 user 2 delayed block reward, period less than 3 blocks", async () => {
            await erc20RewardTransferLogic.initialize(token3.address);
            await liquidityMining.addRewardToken(
                token3.address,
                new BN(3),
                new BN(2),
                erc20RewardTransferLogic.address
            );
            await liquidityMining.add(token2.address, [token3.address], [allocationPoint1], false);
            let duration = secondsPerBlock.mul(new BN(3)).sub(new BN(1));

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token2.address,
                token3.address,
                amount3,
                duration
            );
            let expectedReward = "3";
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 1 user, period less than 1 block", async () => {
            let duration = secondsPerBlock.sub(new BN(1));

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token1.address,
                SOVToken.address,
                amount3,
                duration
            );
            let expectedReward = "0";
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 1 user, period is 1 block", async () => {
            let duration = secondsPerBlock;

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token1.address,
                SOVToken.address,
                amount3,
                duration
            );
            let expectedReward = rewardTokensPerBlock;
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 1 user, period is 40 blocks", async () => {
            let blocks = new BN(40);
            let duration = secondsPerBlock.mul(blocks);

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token1.address,
                SOVToken.address,
                amount3,
                duration
            );
            let expectedReward = rewardTokensPerBlock.mul(blocks);
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 2 users, period is 100 blocks", async () => {
            let blocks = new BN(100);
            let duration = secondsPerBlock.mul(blocks);

            await token1.approve(liquidityMining.address, amount1, { from: account1 });
            await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {
                from: account1,
            });

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token1.address,
                SOVToken.address,
                amount3,
                duration
            );
            let expectedReward = rewardTokensPerBlock.mul(blocks);
            let totalAmount = amount1.add(amount3);
            expectedReward = expectedReward.mul(amount3).div(totalAmount);
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 3 users and 2 tokens, period is 1000 blocks", async () => {
            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint2],
                false
            );

            let blocks = new BN(1000);
            let duration = secondsPerBlock.mul(blocks);

            await token1.approve(liquidityMining.address, amount1, { from: account1 });
            await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {
                from: account1,
            });
            await token1.approve(liquidityMining.address, amount2, { from: account2 });
            await liquidityMining.deposit(token1.address, amount2, ZERO_ADDRESS, {
                from: account2,
            });

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token1.address,
                SOVToken.address,
                amount3,
                duration
            );
            let expectedReward = rewardTokensPerBlock.mul(blocks);
            expectedReward = expectedReward.mul(allocationPoint1).div(totalAllocationPoint);
            let totalAmount = amount1.add(amount2).add(amount3);
            expectedReward = expectedReward.mul(amount3).div(totalAmount);
            expect(estimatedReward).bignumber.equal(expectedReward);
        });
    });

    describe("deposit/withdraw", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            for (let token of [token1, token2]) {
                for (let account of [account1, account2]) {
                    await token.mint(account, amount);
                    await token.approve(liquidityMining.address, amount, { from: account });
                }
            }

            // make sure the pool has tokens to distribute
            await SOVToken.transfer(liquidityMining.address, new BN(1000));
        });

        it("add, add, deposit, deposit", async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            ); //weight 1/1
            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint],
                false
            ); //weight 1/2

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            }); // 1 block passed

            // await liquidityMining.update(token1.address, allocationPoint.mul(new BN(2)), true); //weight 2/3
            await liquidityMining.updateAllPools(); // 2 blocks passed from first deposit

            const currentBlockNumber = await web3.eth.getBlockNumber();

            // 3 tokens per share per block, times precision (1e12), times weight (1/2), divided by total shares
            const expectedAccumulatedRewardPerBlock = rewardTokensPerBlock
                .mul(new BN(1e12))
                .div(new BN(2))
                .div(amount);

            const poolInfo1 = await liquidityMining.getPoolInfo(token1.address);
            const poolReward = await liquidityMining.getPoolReward(
                token1.address,
                SOVToken.address
            );
            expect(poolInfo1.poolToken).equal(token1.address);
            expect(poolReward.allocationPoint).equal("1");
            expect(poolReward.lastRewardBlock).equal(currentBlockNumber.toString());
            // token1 deposit has been there for 2 blocks because of automining
            expect(poolReward.accumulatedRewardPerShare).equal(
                expectedAccumulatedRewardPerBlock.mul(new BN(2)).toString()
            );

            const poolInfo2 = await liquidityMining.getPoolInfo(token2.address);
            const poolReward2 = await liquidityMining.getPoolReward(
                token2.address,
                SOVToken.address
            );
            expect(poolInfo2.poolToken).equal(token2.address);
            expect(poolReward2.allocationPoint).equal("1");
            expect(poolReward2.lastRewardBlock).equal(currentBlockNumber.toString());
            // token2 deposit has been there for only 1 block
            expect(poolReward2.accumulatedRewardPerShare).equal(
                expectedAccumulatedRewardPerBlock.toString()
            );
        });

        // // tricky case 1
        it("add(pool1), add(pool2), deposit(user1, pool1), update(pool1), withdraw(user1, pool1)", async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            ); //weight 1/1
            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint],
                false
            ); //weight 1/2

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await liquidityMining.update(token1.address, [SOVToken.address], [new BN("2")], false); // 1 block passed, new weight 2/3
            const tx = await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            }); // 2 blocks passed

            const lockedAmount = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount = await lockedSOV.getUnlockedBalance(account1);
            const rewardAmount = lockedAmount.add(unlockedAmount);

            // reward per block 3 (because of bonus period), 1 block with weight 1/2 = 1, 1 block with weight 2/3 = 2
            const expectedRewardAmount = new BN("3");
            expect(rewardAmount).bignumber.equal(expectedRewardAmount);

            await checkUserPoolTokens(
                account1,
                token1,
                new BN(0), // user LM balance
                new BN(0), // LM contract token balance
                amount // user token balance
            );

            expectEvent(tx, "Withdraw", {
                user: account1,
                poolToken: token1.address,
                amount: amount,
            });

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                rewardToken: SOVToken.address,
                amount: rewardAmount,
            });
        });

        // // tricky case 2
        it("add(pool1), deposit(user1, pool1), deposit(user2, pool1), withdraw(user1, pool1), withdraw(user2, pool1)", async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            ); //weight 1/1

            // deposit 1: 0 blocks, deposit 2: 0 blocks
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            // deposit 1: 1 blocks (100% shares), deposit 2: 0 blocks
            await mineBlock();

            // deposit 1: 2 blocks (100% shares), deposit 2: 0 blocks
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account2,
            });

            // deposit 1: 3 blocks (50% shares), deposit 2: 1 blocks (50% shares)
            const withdrawTx1 = await liquidityMining.withdraw(
                token1.address,
                amount,
                ZERO_ADDRESS,
                { from: account1 }
            );

            // deposit 1: 3 blocks (withdrawn), deposit 2: 2 blocks (100% shares)
            const withdrawTx2 = await liquidityMining.withdraw(
                token1.address,
                amount,
                ZERO_ADDRESS,
                { from: account2 }
            );

            const lockedAmount1 = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount1 = await lockedSOV.getUnlockedBalance(account1);
            const reward1 = lockedAmount1.add(unlockedAmount1);

            const lockedAmount2 = await lockedSOV.getLockedBalance(account2);
            const unlockedAmount2 = await lockedSOV.getUnlockedBalance(account2);
            const reward2 = lockedAmount2.add(unlockedAmount2);

            // reward per block 3, 2 block with 100% shares = 6, 1 block with 50% shares = 1
            const expectedReward1 = new BN("7");

            // reward per block 3, 1 block with 50% shares = 1, 1 block with 100% shares = 3
            const expectedReward2 = new BN("4");

            expect(reward1).bignumber.equal(expectedReward1);
            expect(reward2).bignumber.equal(expectedReward2);

            await checkUserPoolTokens(
                account1,
                token1,
                new BN(0), // user LM balance
                new BN(0), // LM contract token balance
                amount // user token balance
            );
            await checkUserPoolTokens(
                account2,
                token1,
                new BN(0), // user LM balance
                new BN(0), // LM contract token balance
                amount // user token balance
            );

            expectEvent(withdrawTx1, "Withdraw", {
                user: account1,
                poolToken: token1.address,
                amount: amount,
            });
            expectEvent(withdrawTx1, "RewardClaimed", {
                user: account1,
                rewardToken: SOVToken.address,
                amount: reward1,
            });
            expectEvent(withdrawTx2, "Withdraw", {
                user: account2,
                poolToken: token1.address,
                amount: amount,
            });
            expectEvent(withdrawTx2, "RewardClaimed", {
                user: account2,
                rewardToken: SOVToken.address,
                amount: reward2,
            });
        });

        // tricky case 3a
        it("add(pool1), deposit(user1, pool1), add(pool2, no update), withdraw(user1, pool1)", async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            ); //weight 1/1

            // deposit: 0 blocks
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            // deposit: 1 blocks, note: pool1 is NOT updated
            await liquidityMining.add(token2.address, [SOVToken.address], [new BN(2)], false); //weight 1/3

            // deposit: 2 blocks
            await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            const lockedAmount = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount = await lockedSOV.getUnlockedBalance(account1);
            const rewardAmount = lockedAmount.add(unlockedAmount);

            // reward per block 3,
            // because add was called without updating the pool, the new weight is used for all blocks
            // so 2 blocks with weight 1/3 = 2
            const expectedRewardAmount = new BN("2");
            expect(rewardAmount).bignumber.equal(expectedRewardAmount);

            await checkUserPoolTokens(
                account1,
                token1,
                new BN(0), // user LM balance
                new BN(0), // LM contract token balance
                amount // user token balance
            );
        });

        // tricky case 3b
        it("add(pool1), deposit(user1, pool1), add(pool2, update), withdraw(user1, pool1)", async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            ); //weight 1/1

            // deposit: 0 blocks
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            // deposit: 1 blocks, note: pool1 IS updated
            await liquidityMining.add(token2.address, [SOVToken.address], [new BN(2)], true); //weight 1/3

            // deposit: 2 blocks
            await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            const lockedAmount = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount = await lockedSOV.getUnlockedBalance(account1);
            const rewardAmount = lockedAmount.add(unlockedAmount);

            // reward per block 3,
            // because add was called WITH updating the pools, old weight is for 1 block and new weight is for 1 block
            // so 1 block with weight 1/1 = 3 and 1 block with weight 1/3 = 1
            const expectedRewardAmount = new BN("4");
            expect(rewardAmount).bignumber.equal(expectedRewardAmount);

            await checkUserPoolTokens(
                account1,
                token1,
                new BN(0), // user LM balance
                new BN(0), // LM contract token balance
                amount // user token balance
            );
        });

        // tricky case 4
        it("add(pool1), deposit(user1, pool1), add(pool2), deposit(user2, pool2), withdraw(user1, pool1), withdraw(user2, pool2)", async () => {
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            ); //weight 1/1

            // deposit 1: 0 blocks, deposit 2: 0 blocks
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            // deposit 1: 1 blocks (weight 1/1), deposit 2: 0 blocks. pool is updated
            await liquidityMining.add(token2.address, [SOVToken.address], [allocationPoint], true); //weight 1/2

            // deposit 1: 2 blocks (weight 1/2), deposit 2: 0 blocks
            await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account2,
            });

            // deposit 1: 3 blocks (weight 1/2), deposit 2: 1 blocks (weight 1/2)
            const withdrawTx1 = await liquidityMining.withdraw(
                token1.address,
                amount,
                ZERO_ADDRESS,
                { from: account1 }
            );

            // deposit 1: 3 blocks (withdrawn), deposit 2: 2 blocks (weight 1/2)
            const withdrawTx2 = await liquidityMining.withdraw(
                token2.address,
                amount,
                ZERO_ADDRESS,
                { from: account2 }
            );

            const lockedAmount1 = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount1 = await lockedSOV.getUnlockedBalance(account1);
            const reward1 = lockedAmount1.add(unlockedAmount1);

            const lockedAmount2 = await lockedSOV.getLockedBalance(account2);
            const unlockedAmount2 = await lockedSOV.getUnlockedBalance(account2);
            const reward2 = lockedAmount2.add(unlockedAmount2);

            // reward per block 3
            // deposit 1 has 1 block with weight 1/1 (3) and 2 blocks with weight 1/2
            const expectedReward1 = new BN("6");

            // deposit 2 has 2 blocks with weight 1/2
            const expectedReward2 = new BN("3");

            expect(reward1).bignumber.equal(expectedReward1);
            expect(reward2).bignumber.equal(expectedReward2);

            for (let account of [account1, account2]) {
                for (let token of [token1, token2]) {
                    await checkUserPoolTokens(
                        account,
                        token,
                        new BN(0), // user LM balance
                        new BN(0), // LM contract token balance
                        amount // user token balance
                    );
                }
            }

            expectEvent(withdrawTx1, "Withdraw", {
                user: account1,
                poolToken: token1.address,
                amount: amount,
            });
            expectEvent(withdrawTx1, "RewardClaimed", {
                user: account1,
                rewardToken: SOVToken.address,
                amount: reward1,
            });
            expectEvent(withdrawTx2, "Withdraw", {
                user: account2,
                poolToken: token2.address,
                amount: amount,
            });
            expectEvent(withdrawTx2, "RewardClaimed", {
                user: account2,
                rewardToken: SOVToken.address,
                amount: reward2,
            });
        });
    });

    describe("LM configuration", () => {
        //Maximum reward per week: 100K SOV (or 100M SOV)
        //Maximum reward per block: 4.9604 SOV (4.9604 * 2880 * 7 = 100001.664)

        const REWARD_TOKENS_PER_BLOCK = new BN(49604).mul(new BN(10 ** 14)).mul(new BN(1000));
        // const REWARD_TOKENS_PER_BLOCK = new BN(49604).mul(new BN(10**14));

        //SOV/BTC pool 40K per week
        //ETH/BTC pool 37.5K per week (from second week)
        //Dummy pool 100K - SOV/BTC pool (- ETH/BTC pool)

        const MAX_ALLOCATION_POINT = new BN(100000).mul(new BN(1000));
        // const MAX_ALLOCATION_POINT = 		new BN(100000);
        const ALLOCATION_POINT_SOV_BTC = new BN(40000);
        const ALLOCATION_POINT_ETH_BTC = new BN(37500);

        const ALLOCATION_POINT_SOV_BTC_2 = new BN(30000);

        const amount = new BN(1000);

        beforeEach(async () => {
            await deployLiquidityMining();
            await liquidityMiningV1.initialize(
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

            await liquidityMiningV1.initialize(liquidityMining.address);

            migrator = await Migrator.new();
            await migrator.initialize(
                SOVToken.address,
                liquidityMiningV1.address,
                liquidityMining.address
            );

            await liquidityMining.initialize(wrapper.address, migrator.address);

            for (let token of [token1, token2]) {
                for (let account of [account1, account2]) {
                    await token.mint(account, amount);
                    await token.approve(liquidityMining.address, amount, { from: account });
                }
            }

            rewardTransferLogic = await LockedSOVRewardTransferLogic.new();
            await rewardTransferLogic.initialize(lockedSOV.address, unlockedImmediatelyPercent);

            await liquidityMining.addRewardToken(
                SOVToken.address,
                REWARD_TOKENS_PER_BLOCK,
                startDelayBlocks,
                rewardTransferLogic.address
            );

            //mint SOVs to lvm1 for migrations
            await SOVToken.mint(liquidityMiningV1.address, new BN(10));
            await liquidityMiningV1.addAdmin(migrator.address);
            await liquidityMiningV1.startMigrationGracePeriod();
            await liquidityMining.addAdmin(migrator.address);
            await migrator.migratePools();
            await migrator.finishUsersMigration();
            await migrator.migrateFunds();
            //burn SOVs for testing
            const balanceSOV = await SOVToken.balanceOf(liquidityMining.address);
            await SOVToken.burn(liquidityMining.address, balanceSOV);
        });

        it("dummy pool + 1 pool", async () => {
            let dummyPool = liquidityMiningConfigToken.address;

            let SOVBTCpool = token1.address;

            await liquidityMining.add(
                SOVBTCpool,
                [SOVToken.address],
                [ALLOCATION_POINT_SOV_BTC],
                false
            ); //weight 40000 / 100000
            await liquidityMining.add(
                dummyPool,
                [SOVToken.address],
                [MAX_ALLOCATION_POINT.sub(ALLOCATION_POINT_SOV_BTC)],
                false
            ); //weight (100000 - 40000) / 100000

            await liquidityMining.deposit(SOVBTCpool, amount, ZERO_ADDRESS, { from: account1 });

            //reward won't be claimed because liquidityMining doesn't have enough SOV balance
            //user reward will be updated
            //10 blocks passed since last deposit
            await mineBlocks(9);
            await liquidityMining.withdraw(SOVBTCpool, amount, ZERO_ADDRESS, { from: account1 });

            const userInfo = await liquidityMining.getUserInfo(SOVBTCpool, account1);
            //10 blocks passed
            let passedBlocks = 10;
            let expectedUserReward = REWARD_TOKENS_PER_BLOCK.mul(new BN(passedBlocks))
                .mul(ALLOCATION_POINT_SOV_BTC)
                .div(MAX_ALLOCATION_POINT);
            expect(userInfo.rewards[0].accumulatedReward).bignumber.equal(expectedUserReward);
        });

        it("dummy pool + 2 pools", async () => {
            let dummyPool = liquidityMiningConfigToken.address;

            let SOVBTCpool = token1.address;
            let ETHBTCpoll = token2.address;

            await liquidityMining.add(
                SOVBTCpool,
                [SOVToken.address],
                [ALLOCATION_POINT_SOV_BTC],
                false
            ); //weight 40000 / 100000
            const DUMMY_ALLOCATION_POINT = MAX_ALLOCATION_POINT.sub(ALLOCATION_POINT_SOV_BTC);
            await liquidityMining.add(
                dummyPool,
                [SOVToken.address],
                [DUMMY_ALLOCATION_POINT],
                false
            ); //weight (100000 - 40000) / 100000

            await liquidityMining.deposit(SOVBTCpool, amount, ZERO_ADDRESS, { from: account1 });

            await mineBlocks(9);
            await liquidityMining.updateAllPools(); // 10 blocks passed from first deposit

            //update config
            //this method will also update pool reward using previous allocation point,
            //so this block should be add to calculation with old values
            await liquidityMining.update(
                SOVBTCpool,
                [SOVToken.address],
                [ALLOCATION_POINT_SOV_BTC_2],
                false
            ); //weight 30000 / 100000

            await liquidityMining.add(
                ETHBTCpoll,
                [SOVToken.address],
                [ALLOCATION_POINT_ETH_BTC],
                false
            ); //weight 37500 / 100000
            const DUMMY_ALLOCATION_POINT_2 = MAX_ALLOCATION_POINT.sub(
                ALLOCATION_POINT_SOV_BTC_2
            ).sub(ALLOCATION_POINT_ETH_BTC);
            await liquidityMining.update(
                dummyPool,
                [SOVToken.address],
                [DUMMY_ALLOCATION_POINT_2],
                false
            ); //weight (100000 - 30000 - 37500) / 100000
            await liquidityMining.updateAllPools();

            //reward won't be claimed because liquidityMining doesn't have enough SOV balance
            //user reward will be updated
            //10 blocks + 5 blocks passed
            await liquidityMining.withdraw(SOVBTCpool, amount, ZERO_ADDRESS, { from: account1 });

            const userInfo = await liquidityMining.getUserInfo(SOVBTCpool, account1);
            //10 blocks + 5 blocks passed
            let passedBlocks = 10 + 1; //block should be add to calculation with old values
            let expectedUserReward = REWARD_TOKENS_PER_BLOCK.mul(new BN(passedBlocks))
                .mul(ALLOCATION_POINT_SOV_BTC)
                .div(MAX_ALLOCATION_POINT);
            passedBlocks = 5 - 1; //block should be removed from calculation with new values
            expectedUserReward = expectedUserReward.add(
                REWARD_TOKENS_PER_BLOCK.mul(new BN(passedBlocks))
                    .mul(ALLOCATION_POINT_SOV_BTC_2)
                    .div(MAX_ALLOCATION_POINT)
            );
            expect(userInfo.rewards[0].accumulatedReward).bignumber.equal(expectedUserReward);
        });
    });

    describe("multiple rewards tokens per pool", () => {
        let rewardToken1;
        let rewardToken2;
        let transferLogic1;
        let transferLogic2;
        const otherRewardTokensPerBlock = new BN(6);
        const allocationPoint = new BN(1);

        beforeEach(async () => {
            // add other reward token
            rewardToken1 = await TestToken.new("Reward token 1", "RWT-1", 18, TOTAL_SUPPLY);
            rewardToken2 = await TestToken.new("Reward token 2", "RWT-2", 18, TOTAL_SUPPLY);

            transferLogic1 = await ERC20TransferLogic.new();
            transferLogic2 = await ERC20TransferLogic.new();
            await transferLogic1.initialize(rewardToken1.address);
            await transferLogic2.initialize(rewardToken2.address);

            await liquidityMining.addRewardToken(
                rewardToken1.address,
                rewardTokensPerBlock,
                startDelayBlocks,
                transferLogic1.address
            );
            await liquidityMining.addRewardToken(
                rewardToken2.address,
                otherRewardTokensPerBlock,
                startDelayBlocks,
                transferLogic2.address
            );

            await rewardToken1.transfer(liquidityMining.address, new BN(1000));
            await rewardToken2.transfer(liquidityMining.address, new BN(1000));
        });

        it("add 2 reward tokens to one pool", async () => {
            await liquidityMining.add(
                token1.address,
                [rewardToken1.address, rewardToken2.address],
                [allocationPoint, allocationPoint],
                false
            );

            const poolRewards = await liquidityMining.getPoolRewards(token1.address);
            expect(poolRewards).to.be.an("array");
            expect(poolRewards).to.have.length(2);
            expect(poolRewards[0].allocationPoint).bignumber.equal(allocationPoint);
            expect(poolRewards[1].allocationPoint).bignumber.equal(allocationPoint);
        });

        it("update 2 reward tokens with new allocation points", async () => {
            await liquidityMining.add(
                token1.address,
                [rewardToken1.address, rewardToken2.address],
                [allocationPoint, allocationPoint],
                false
            );

            let poolRewards = await liquidityMining.getPoolRewards(token1.address);
            expect(poolRewards).to.be.an("array");
            expect(poolRewards).to.have.length(2);
            expect(poolRewards[0].allocationPoint).bignumber.equal(allocationPoint);
            expect(poolRewards[1].allocationPoint).bignumber.equal(allocationPoint);

            const newAllocationPoints = [new BN(3), new BN(4)];

            await liquidityMining.update(
                token1.address,
                [rewardToken1.address, rewardToken2.address],
                newAllocationPoints,
                false
            );

            poolRewards = await liquidityMining.getPoolRewards(token1.address);
            expect(poolRewards).to.be.an("array");
            expect(poolRewards).to.have.length(2);
            expect(poolRewards[0].allocationPoint).bignumber.equal(newAllocationPoints[0]);
            expect(poolRewards[1].allocationPoint).bignumber.equal(newAllocationPoints[1]);
        });

        it("check rewards for two reward tokens and one pool", async () => {
            const amount = new BN(1000);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
            await liquidityMining.add(
                token1.address,
                [rewardToken1.address, rewardToken2.address],
                [allocationPoint, allocationPoint],
                false
            );

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await mineBlock();

            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                rewardToken1.address,
                account1
            );
            expect(reward1).bignumber.equal(rewardTokensPerBlock);

            const claimRewardTx1 = await liquidityMining.claimReward(
                token1.address,
                rewardToken1.address,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            expectEvent(claimRewardTx1, "RewardClaimed", {
                user: account1,
                amount: new BN(6),
                rewardToken: rewardToken1.address,
            });

            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                rewardToken2.address,
                account1
            );
            expect(reward2).bignumber.equal(new BN(12));

            const claimRewardTx2 = await liquidityMining.claimReward(
                token1.address,
                rewardToken2.address,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            expectEvent(claimRewardTx2, "RewardClaimed", {
                user: account1,
                amount: new BN(18),
                rewardToken: rewardToken2.address,
            });
        });
    });

    describe("onTokensDeposited", () => {
        it("a pool should be able to deposit for a user", async () => {
            const poolToken = await TestPoolToken.new(
                "Test Pool Token",
                "TPT",
                18,
                TOTAL_SUPPLY,
                liquidityMining.address
            );

            await liquidityMining.add(poolToken.address, [SOVToken.address], [new BN(1)], false);
            const tx = await poolToken.depositFor(account1, new BN(1000));

            const userInfo = await liquidityMining.getUserInfo(poolToken.address, account1);
            expect(userInfo.amount).bignumber.equal(new BN(1000));
        });
        it("should revert if the sender is not a valid pool token", async () => {
            await expectRevert(
                liquidityMining.onTokensDeposited(ZERO_ADDRESS, new BN(1000)),
                "Pool token not found"
            );
        });
    });

    describe("external getters", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
            await liquidityMining.add(
                token1.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
        });

        it("PRECISION", async () => {
            expect(await liquidityMining.PRECISION()).bignumber.equal(new BN(1e12));
        });

        it("rewardTokensPerBlock", async () => {
            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.rewardTokensPerBlock).bignumber.equal(rewardTokensPerBlock);
        });

        it("startBlock", async () => {
            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.startBlock).bignumber.gt("0");
        });

        it("endBlock", async () => {
            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.endBlock).bignumber.equal("0");
        });

        it("wrapper", async () => {
            expect(await liquidityMining.wrapper()).equal(wrapper.address);
        });

        it("totalAllocationPoint", async () => {
            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(allocationPoint);
            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalAllocationPoint).bignumber.equal(
                allocationPoint.mul(new BN(2))
            );
        });

        it("totalUsersBalance", async () => {
            let rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalUsersBalance).bignumber.equal("0");

            await liquidityMining.updateAllPools();
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalUsersBalance).bignumber.equal("0");

            await liquidityMining.updateAllPools();
            rewardToken = await liquidityMining.getRewardToken(SOVToken.address);
            expect(rewardToken.totalUsersBalance).bignumber.equal("3");
        });

        // could still test these, but I don't see much point:
        // PoolInfo[] public poolInfoList;
        // mapping(address => uint256) poolIdList;
        // mapping(uint256 => mapping(address => UserInfo)) public userInfoMap;

        it("getMissedBalance", async () => {
            let missedBalance = await liquidityMining.getMissedBalance(SOVToken.address);
            expect(missedBalance).bignumber.equal("0");

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await liquidityMining.updatePool(token1.address);

            missedBalance = await liquidityMining.getMissedBalance(SOVToken.address);
            expect(missedBalance).bignumber.equal("3");
        });

        it("getUserAccumulatedReward", async () => {
            // real tests are elsewhere in this file
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await mineBlock();
            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                SOVToken.address,
                account1
            );
            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                SOVToken.address,
                account2
            );
            expect(reward1).bignumber.equal("3");
            expect(reward2).bignumber.equal("0");
        });

        it("getPoolId", async () => {
            const poolId = await liquidityMining.getPoolId(token1.address);
            expect(poolId).bignumber.equal("0");
            await expectRevert(liquidityMining.getPoolId(token2.address), "Pool token not found");
            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            const poolId2 = await liquidityMining.getPoolId(token2.address);
            expect(poolId2).bignumber.equal("1");
        });

        it("getPoolLength", async () => {
            let length = await liquidityMining.getPoolLength();
            expect(length).bignumber.equal("1");

            await liquidityMining.add(
                token2.address,
                [SOVToken.address],
                [allocationPoint],
                false
            );
            length = await liquidityMining.getPoolLength();
            expect(length).bignumber.equal("2");
        });

        it("getPoolInfoList", async () => {
            const infoList = await liquidityMining.getPoolInfoList();
            expect(infoList).to.be.an("array");
            expect(infoList.length).equal(1);
            const info = infoList[0];
            expect(info.poolToken).equal(token1.address);
            expect(info.rewardTokens[0]).equal(SOVToken.address);

            const poolRewardInfo = await liquidityMining.getPoolReward(
                token1.address,
                info.rewardTokens[0]
            );
            expect(poolRewardInfo.allocationPoint).equal(allocationPoint.toString());
            expect(poolRewardInfo.accumulatedRewardPerShare).equal("0");
            expect(poolRewardInfo.lastRewardBlock).equal(
                (await web3.eth.getBlockNumber()).toString()
            );
        });

        it("getPoolInfo", async () => {
            const info = await liquidityMining.getPoolInfo(token1.address);
            expect(info.poolToken).equal(token1.address);

            const poolRewardInfo = await liquidityMining.getPoolReward(
                token1.address,
                info.rewardTokens[0]
            );
            expect(poolRewardInfo.allocationPoint).equal(allocationPoint.toString());
            expect(poolRewardInfo.accumulatedRewardPerShare).equal("0");
            expect(poolRewardInfo.lastRewardBlock).equal(
                (await web3.eth.getBlockNumber()).toString()
            );

            await expectRevert(
                liquidityMining.getPoolInfo(token2.address),
                "Pool token not found"
            );
        });

        it("getUserBalanceList", async () => {
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await mineBlock();
            const balanceList = await liquidityMining.getUserBalanceList(account1);

            expect(balanceList).to.be.an("array");
            expect(balanceList.length).equal(1);
            const balanceData = balanceList[0];
            expect(balanceData).to.be.an("array");
            expect(balanceData[0].amount).bignumber.equal(amount);
            expect(balanceData[0].accumulatedReward).bignumber.equal("3");
        });

        it("getUserInfo", async () => {
            await liquidityMining.deposit(token1.address, new BN(500), ZERO_ADDRESS, {
                from: account1,
            });

            let userInfo = await liquidityMining.getUserInfo(token1.address, account1);
            expect(userInfo.amount).bignumber.equal("500");
            expect(userInfo.rewards[0].accumulatedReward).bignumber.equal("0"); // XXX: not yet updated -- funny?
            expect(userInfo.rewards[0].rewardDebt).bignumber.equal("0"); // not yet updated either

            // deposit updates it.
            await liquidityMining.deposit(token1.address, new BN(1), ZERO_ADDRESS, {
                from: account1,
            });
            userInfo = await liquidityMining.getUserInfo(token1.address, account1);
            expect(userInfo.amount).bignumber.equal("501");
            expect(userInfo.rewards[0].accumulatedReward).bignumber.equal("3");
            expect(userInfo.rewards[0].rewardDebt).bignumber.equal("3");
        });

        it("getUserInfoList", async () => {
            await liquidityMining.deposit(token1.address, new BN(500), ZERO_ADDRESS, {
                from: account1,
            });

            let userInfoList = await liquidityMining.getUserInfoList(account1);
            expect(userInfoList).to.be.an("array");
            expect(userInfoList.length).equal(1);
            const userInfo = userInfoList[0];
            expect(userInfo.amount).bignumber.equal("500");
            expect(userInfo.rewards[0].accumulatedReward).bignumber.equal("0");
            expect(userInfo.rewards[0].rewardDebt).bignumber.equal("0");
        });

        it("getUserAccumulatedRewardList", async () => {
            await liquidityMining.deposit(token1.address, new BN(500), ZERO_ADDRESS, {
                from: account1,
            });

            let rewardList = await liquidityMining.getUserAccumulatedRewardList(account1);
            expect(rewardList).to.be.an("array");
            expect(rewardList.length).equal(1);
            expect(rewardList[0]).to.be.an("array");
            expect(rewardList[0].length).equal(1);
            expect(rewardList[0][0].accumulatedReward).bignumber.equal("0");
        });

        it("getUserPoolTokenBalance", async () => {
            await liquidityMining.deposit(token1.address, new BN(500), ZERO_ADDRESS, {
                from: account1,
            });
            let poolTokenBalance = await liquidityMining.getUserPoolTokenBalance(
                token1.address,
                account1
            );
            expect(poolTokenBalance).bignumber.equal(new BN(500));
        });
    });

    async function deployLiquidityMining() {
        let liquidityMiningLogicV1 = await LiquidityMiningLogic.new();
        liquidityMiningProxy = await LiquidityMiningProxy.new();
        await liquidityMiningProxy.setImplementation(liquidityMiningLogicV1.address);
        liquidityMiningV1 = await LiquidityMiningLogic.at(liquidityMiningProxy.address);

        wrapper = await Wrapper.new(liquidityMiningV1.address);
    }

    async function upgradeLiquidityMining() {
        let liquidityMiningLogicV1 = await LiquidityMiningLogicV1.new();
        await liquidityMiningProxy.setImplementation(liquidityMiningLogicV1.address);
        liquidityMiningV1 = await LiquidityMiningLogicV1.at(liquidityMiningProxy.address);
    }

    async function deployLiquidityMiningV2() {
        let liquidityMiningLogicV2 = await LiquidityMiningLogicV2.new();
        let liquidityMiningProxyV2 = await LiquidityMiningProxyV2.new();
        await liquidityMiningProxyV2.setImplementation(liquidityMiningLogicV2.address);
        liquidityMining = await LiquidityMiningLogicV2.at(liquidityMiningProxyV2.address);

        wrapper = await Wrapper.new(liquidityMining.address);
    }

    async function mineBlocks(blocks) {
        for (let i = 0; i < blocks; i++) {
            await mineBlock();
        }
    }

    function checkPoolRewardInfo(
        poolInfo,
        token,
        rewardToken,
        allocationPoint,
        lastRewardBlock,
        accumulatedRewardPerShare
    ) {
        expect(poolInfo.poolToken).equal(token);
        expect(rewardToken.allocationPoint).bignumber.equal(allocationPoint);
        expect(rewardToken.lastRewardBlock).bignumber.equal(lastRewardBlock);
        if (accumulatedRewardPerShare.toNumber() !== -1) {
            expect(rewardToken.accumulatedRewardPerShare).bignumber.equal(
                accumulatedRewardPerShare
            );
        }
    }

    async function checkUserPoolTokens(
        user,
        poolToken,
        _userAmount,
        _liquidityMiningBalance,
        _userBalance,
        wrapper
    ) {
        //user balance in pool
        let userInfo = await liquidityMining.getUserInfo(poolToken.address, user);
        expect(userInfo.amount).bignumber.equal(_userAmount);
        //LM balance of pool tokens
        let liquidityMiningBalance = await poolToken.balanceOf(liquidityMining.address);
        expect(liquidityMiningBalance).bignumber.equal(_liquidityMiningBalance);
        //user's balance of pool tokens
        let userBalance = await poolToken.balanceOf(user);
        if (wrapper !== undefined) {
            userBalance = await poolToken.balanceOf(wrapper);
        }
        expect(userBalance).bignumber.equal(_userBalance);
    }

    //user's balance of reward token
    async function checkUserReward(user, poolToken, depositBlockNumber, latestBlockNumber) {
        let passedBlocks = latestBlockNumber.sub(depositBlockNumber);
        let userReward = passedBlocks.mul(rewardTokensPerBlock);
        let userInfo = await liquidityMining.getUserInfo(poolToken.address, user);
        expect(userInfo.rewards[0].accumulatedReward).bignumber.equal(new BN(0));
        return userReward;
    }
});
