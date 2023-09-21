/** Speed optimized on branch hardhatTestRefactor, 2021-09-21
 * Bottleneck found is related to initialization on every tests.
 *  There are many tests and each one is performing an init process.
 *  Maybe in some cases it can be spared.
 *
 * Total time elapsed: 33s
 * After optimization: 20.3s
 *
 * Other minor optimizations:
 * - fixed some comments
 * - removed unneeded variables
 *
 * Notes: Instead of a general deployment for all tests in the beforeEach hook,
 *  it has been restricted exclusively to those tests that required it. Besides,
 *  the oz test-helpers fixture is used only on tests that can start from the initial snapshot.
 *
 *   + Added test of dummy liquidityMiningConfigToken methods for coverage.
 */

const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { etherMantissa, mineBlock, advanceBlocks } = require("../Utils/Ethereum");

const { ZERO_ADDRESS } = constants;
const TOTAL_SUPPLY = etherMantissa(1000000000);

const TestToken = artifacts.require("TestToken");
const LiquidityMiningConfigToken = artifacts.require("LiquidityMiningConfigToken");
const LiquidityMiningLogic = artifacts.require("LiquidityMiningMockup");
const LiquidityMiningProxy = artifacts.require("LiquidityMiningProxy");
const TestLockedSOV = artifacts.require("LockedSOVMockup");
const Wrapper = artifacts.require("RBTCWrapperProxyMockup");

contract("LiquidityMining", (accounts) => {
    const name = "Test SOV Token";
    const symbol = "TST";

    const PRECISION = 1e12;

    const rewardTokensPerBlock = new BN(3);
    const startDelayBlocks = new BN(1);
    const numberOfBonusBlocks = new BN(50);
    const HUNDRED_PERCENT = new BN(10000);

    // The % which determines how much will be unlocked immediately.
    /// @dev 10000 is 100%
    const unlockedImmediatelyPercent = new BN(1000); // 10%

    let root, account1, account2, account3, account4, lmAdmin;
    let SOVToken, token1, token2, token3, liquidityMiningConfigToken;
    let liquidityMining, wrapper;
    let lockedSOVAdmins, lockedSOV;

    async function deploymentAndInit() {
        SOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        token1 = await TestToken.new("Test token 1", "TST-1", 18, TOTAL_SUPPLY);
        token2 = await TestToken.new("Test token 2", "TST-2", 18, TOTAL_SUPPLY);
        token3 = await TestToken.new("Test token 3", "TST-3", 18, TOTAL_SUPPLY);
        liquidityMiningConfigToken = await LiquidityMiningConfigToken.new();
        lockedSOVAdmins = [account1, account2];

        lockedSOV = await TestLockedSOV.new(SOVToken.address, lockedSOVAdmins);

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
    }

    async function deploymentAndInitFixture(_wallets, _provider) {
        await deploymentAndInit();
    }

    before(async () => {
        accounts = await web3.eth.getAccounts();
        [root, account1, account2, account3, account4, lmAdmin, ...accounts] = accounts;
    });

    /// @dev Test dummy liquidityMiningConfigToken methods for coverage
    describe("liquidityMiningConfigToken", () => {
        it("Test liquidityMiningConfigToken methods", async () => {
            await loadFixture(deploymentAndInitFixture);
            let totalSupply = await liquidityMiningConfigToken.totalSupply();
            // console.log("totalSupply = ", totalSupply.toString());
            expect(totalSupply).to.be.bignumber.equal(new BN(0));

            let transferReturn = await liquidityMiningConfigToken.transfer.call(account1, 0);
            // console.log("transferReturn = ", transferReturn);
            expect(transferReturn).equal(false);

            let allowance = await liquidityMiningConfigToken.allowance(account1, account2);
            // console.log("allowance = ", allowance.toString());
            expect(allowance).to.be.bignumber.equal(new BN(0));

            let approveReturn = await liquidityMiningConfigToken.approve.call(account1, 0);
            // console.log("approveReturn = ", approveReturn);
            expect(approveReturn).equal(false);

            let transferFromReturn = await liquidityMiningConfigToken.transferFrom.call(
                account1,
                account2,
                0
            );
            // console.log("transferFromReturn = ", transferFromReturn);
            expect(transferFromReturn).equal(false);
        });
    });

    describe("initialize", () => {
        it("sets the expected values", async () => {
            await loadFixture(deploymentAndInitFixture);
            await deployLiquidityMining();
            let tx = await liquidityMining.initialize(
                SOVToken.address,
                rewardTokensPerBlock,
                startDelayBlocks,
                numberOfBonusBlocks,
                wrapper.address,
                lockedSOV.address,
                unlockedImmediatelyPercent
            );

            let _SOV = await liquidityMining.SOV();
            let _rewardTokensPerBlock = await liquidityMining.rewardTokensPerBlock();
            let _startBlock = await liquidityMining.startBlock();
            let _bonusEndBlock = await liquidityMining.bonusEndBlock();
            let _wrapper = await liquidityMining.wrapper();

            let blockNumber = new BN(tx.receipt.blockNumber);

            expect(_SOV).equal(SOVToken.address);
            expect(_rewardTokensPerBlock).bignumber.equal(rewardTokensPerBlock);
            expect(_startBlock).bignumber.equal(startDelayBlocks.add(blockNumber));
            expect(_bonusEndBlock).bignumber.equal(
                startDelayBlocks.add(blockNumber).add(numberOfBonusBlocks)
            );
            expect(_wrapper).equal(wrapper.address);
        });

        it("fails if not an owner or an admin", async () => {
            await deployLiquidityMining();
            await expectRevert(
                liquidityMining.initialize(
                    SOVToken.address,
                    rewardTokensPerBlock,
                    startDelayBlocks,
                    numberOfBonusBlocks,
                    wrapper.address,
                    lockedSOV.address,
                    unlockedImmediatelyPercent,
                    { from: account1 }
                ),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.initialize(
                SOVToken.address,
                rewardTokensPerBlock,
                startDelayBlocks,
                numberOfBonusBlocks,
                wrapper.address,
                lockedSOV.address,
                unlockedImmediatelyPercent,
                { from: account1 }
            );
        });

        it("fails if _startBlock = 0", async () => {
            await deployLiquidityMining();
            await expectRevert(
                liquidityMining.initialize(
                    SOVToken.address,
                    rewardTokensPerBlock,
                    0,
                    numberOfBonusBlocks,
                    wrapper.address,
                    lockedSOV.address,
                    unlockedImmediatelyPercent
                ),
                "Invalid start block"
            );
        });

        it("fails if already initialized", async () => {
            await deploymentAndInit();
            await expectRevert(
                liquidityMining.initialize(
                    SOVToken.address,
                    rewardTokensPerBlock,
                    startDelayBlocks,
                    numberOfBonusBlocks,
                    wrapper.address,
                    lockedSOV.address,
                    unlockedImmediatelyPercent
                ),
                "Already initialized"
            );
        });

        it("fails if the 0 address is passed as token address", async () => {
            await deployLiquidityMining();
            await expectRevert(
                liquidityMining.initialize(
                    ZERO_ADDRESS,
                    rewardTokensPerBlock,
                    startDelayBlocks,
                    numberOfBonusBlocks,
                    wrapper.address,
                    lockedSOV.address,
                    unlockedImmediatelyPercent
                ),
                "Invalid token address"
            );
        });

        it("fails if unlockedImmediatelyPercent >= 10000", async () => {
            await deployLiquidityMining();
            await expectRevert(
                liquidityMining.initialize(
                    SOVToken.address,
                    rewardTokensPerBlock,
                    startDelayBlocks,
                    numberOfBonusBlocks,
                    wrapper.address,
                    lockedSOV.address,
                    12345
                ),
                "Unlocked immediately percent has to be less than 10000."
            );
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

    describe("setLockedSOV", () => {
        it("sets the expected values", async () => {
            let newLockedSOV = account2;
            await liquidityMining.setLockedSOV(newLockedSOV);

            let _lockedSOV = await liquidityMining.lockedSOV();
            expect(_lockedSOV).equal(newLockedSOV);
        });

        it("fails if not an owner and an admin", async () => {
            await expectRevert(
                liquidityMining.setLockedSOV(account2, { from: account1 }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.setLockedSOV(account2, { from: account1 });
        });

        it("fails if zero address passed", async () => {
            await expectRevert(
                liquidityMining.setLockedSOV(ZERO_ADDRESS),
                "Invalid lockedSOV Address."
            );
        });
    });

    describe("setUnlockedImmediatelyPercent", () => {
        it("sets the expected values", async () => {
            let newUnlockedImmediatelyPercent = new BN(2000);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            let _unlockedImmediatelyPercent = await liquidityMining.unlockedImmediatelyPercent();
            expect(_unlockedImmediatelyPercent).bignumber.equal(newUnlockedImmediatelyPercent);
        });

        // it should be possible for an admin to set unlockedImmediatelyPercent to 0%
        it("successfully set to 0 (0%)", async () => {
            await liquidityMining.addAdmin(lmAdmin);
            let newUnlockedImmediatelyPercent = new BN(0);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent, {
                from: lmAdmin,
            });

            let _unlockedImmediatelyPercent = await liquidityMining.unlockedImmediatelyPercent();
            expect(_unlockedImmediatelyPercent).bignumber.equal(newUnlockedImmediatelyPercent);
        });

        // it should be possible for an admin to set unlockedImmediatelyPercent to 100%
        it("successfully set to 10000 (100%)", async () => {
            await liquidityMining.addAdmin(lmAdmin);
            let newUnlockedImmediatelyPercent = new BN(10000);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent, {
                from: lmAdmin,
            });

            let _unlockedImmediatelyPercent = await liquidityMining.unlockedImmediatelyPercent();
            expect(_unlockedImmediatelyPercent).bignumber.equal(newUnlockedImmediatelyPercent);
        });

        // it should not be possible for any other address than owner / admin to set the unlockedImmediatelyPercent
        it("fails if not an owner or an admin", async () => {
            await deploymentAndInit();
            await expectRevert(
                liquidityMining.setUnlockedImmediatelyPercent(1000, { from: account1 }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.setUnlockedImmediatelyPercent(1000, { from: account1 });
        });

        it("fails if unlockedImmediatelyPercent > 10000", async () => {
            await expectRevert(
                liquidityMining.setUnlockedImmediatelyPercent(10001),
                "Unlocked immediately percent has to be less than equal to 10000."
            );
        });
    });

    describe("setPoolTokenUnlockedImmediatelyPercent", () => {
        it("should use the poolTokensUnlockedImmediatelyPercent by default", async () => {
            // should use unlockedImmediatelyPercent by default
            const unlockedImmediatelyPercent = await liquidityMining.unlockedImmediatelyPercent();
            let previousPoolTokenUnlockedImmediatelyPercent =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(previousPoolTokenUnlockedImmediatelyPercent).bignumber.equal(
                unlockedImmediatelyPercent
            );

            // set the poolTokensUnlockedImmediatelyPercent
            let newpoolTokensUnlockedImmediatelyPercent = new BN(3000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token1.address,
                newpoolTokensUnlockedImmediatelyPercent
            );

            let _poolTokensUnlockedImmediatelyPercent =
                await liquidityMining.poolTokensUnlockedImmediatelyPercent(token1.address);
            expect(_poolTokensUnlockedImmediatelyPercent).bignumber.equal(
                newpoolTokensUnlockedImmediatelyPercent
            );

            let latestPoolTokenUnlockedImmediatelyPercent =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(latestPoolTokenUnlockedImmediatelyPercent).bignumber.equal(
                newpoolTokensUnlockedImmediatelyPercent
            );
        });

        it("should use the unlockedImmediatelyPercent if poolTokensUnlockedImmediatelyPercent is updated to 0", async () => {
            // calcUnlockedImmediatelyPercent should use the poolTokensUnlockedImmediatelyPercent since it was set from the previous test
            const poolTokensUnlockedImmediatelyPercent =
                await liquidityMining.poolTokensUnlockedImmediatelyPercent(token1.address);
            const previousPoolTokenUnlockedImmediatelyPercent =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(previousPoolTokenUnlockedImmediatelyPercent).bignumber.equal(
                poolTokensUnlockedImmediatelyPercent
            );

            // set the poolTokensUnlockedImmediatelyPercent to 0
            newpoolTokensUnlockedImmediatelyPercent = new BN(0);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token1.address,
                newpoolTokensUnlockedImmediatelyPercent
            );

            // calcUnlockedImmediatelyPercent should use the unlockedImmediatelyPercent
            const unlockedImmediatelyPercent = await liquidityMining.unlockedImmediatelyPercent();
            const latestPoolTokenUnlockedImmediatelyPercent =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(latestPoolTokenUnlockedImmediatelyPercent).bignumber.equal(
                unlockedImmediatelyPercent
            );
        });

        it("sets the expected values", async () => {
            let newpoolTokensUnlockedImmediatelyPercent = new BN(2000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token1.address,
                newpoolTokensUnlockedImmediatelyPercent
            );

            let _poolTokensUnlockedImmediatelyPercent =
                await liquidityMining.poolTokensUnlockedImmediatelyPercent(token1.address);
            expect(_poolTokensUnlockedImmediatelyPercent).bignumber.equal(
                newpoolTokensUnlockedImmediatelyPercent
            );

            let latestPoolTokenUnlockedImmediatelyPercent =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(latestPoolTokenUnlockedImmediatelyPercent).bignumber.equal(
                newpoolTokensUnlockedImmediatelyPercent
            );
        });

        // it should be possible for an admin to set poolTokensUnlockedImmediatelyPercent to 0%
        it("successfully set to 0 (0%)", async () => {
            await liquidityMining.addAdmin(lmAdmin);
            let newpoolTokensUnlockedImmediatelyPercent = new BN(0);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token1.address,
                newpoolTokensUnlockedImmediatelyPercent,
                { from: lmAdmin }
            );

            let _poolTokensUnlockedImmediatelyPercent =
                await liquidityMining.poolTokensUnlockedImmediatelyPercent(token1.address);
            expect(_poolTokensUnlockedImmediatelyPercent).bignumber.equal(
                newpoolTokensUnlockedImmediatelyPercent
            );
        });

        // it should be possible for an admin to set poolTokensUnlockedImmediatelyPercent to 100%
        it("successfully set to 10000 (100%)", async () => {
            await liquidityMining.addAdmin(lmAdmin);
            let newpoolTokensUnlockedImmediatelyPercent = new BN(10000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token1.address,
                newpoolTokensUnlockedImmediatelyPercent,
                { from: lmAdmin }
            );

            let _poolTokensUnlockedImmediatelyPercent =
                await liquidityMining.poolTokensUnlockedImmediatelyPercent(token1.address);
            expect(_poolTokensUnlockedImmediatelyPercent).bignumber.equal(
                newpoolTokensUnlockedImmediatelyPercent
            );

            let latestPoolTokenUnlockedImmediatelyPercent =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(latestPoolTokenUnlockedImmediatelyPercent).bignumber.equal(
                newpoolTokensUnlockedImmediatelyPercent
            );
        });

        // it should not be possible for any other address than owner / admin to set the poolTokensUnlockedImmediatelyPercent
        it("fails if not an owner or an admin", async () => {
            await deploymentAndInit();
            await expectRevert(
                liquidityMining.setPoolTokenUnlockedImmediatelyPercent(token1.address, 1000, {
                    from: account1,
                }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(token1.address, 1000, {
                from: account1,
            });
        });

        it("fails if unlockedImmediatelyPercent > 10000", async () => {
            await expectRevert(
                liquidityMining.setPoolTokenUnlockedImmediatelyPercent(token1.address, 10001),
                "Unlocked immediately percent has to be less than equal to 10000."
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
            await deploymentAndInit();
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
            let tx = await liquidityMining.stopMining();

            let blockNumber = new BN(tx.receipt.blockNumber);
            let _endBlock = await liquidityMining.endBlock();
            expect(_endBlock).bignumber.equal(blockNumber);
        });

        it("fails if not an owner or an admin", async () => {
            await deploymentAndInit();
            await expectRevert(liquidityMining.stopMining({ from: account1 }), "unauthorized");

            await liquidityMining.addAdmin(account1);
            await liquidityMining.stopMining({ from: account1 });
        });

        it("fails if already stopped", async () => {
            await deploymentAndInit();
            await liquidityMining.stopMining();
            await expectRevert(liquidityMining.stopMining(), "Already stopped");
        });
    });

    describe("transferSOV", () => {
        it("should be able to transfer SOV", async () => {
            let amount = new BN(1000);
            await SOVToken.transfer(liquidityMining.address, amount);

            let balanceBefore = await SOVToken.balanceOf(account1);
            await liquidityMining.transferSOV(account1, amount);
            let balanceAfter = await SOVToken.balanceOf(account1);

            expect(amount).bignumber.equal(balanceAfter.sub(balanceBefore));
        });

        it("only owner or admin should be able to transfer", async () => {
            await expectRevert(
                liquidityMining.transferSOV(account1, 1000, { from: account1 }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.transferSOV(account1, 1000, { from: account1 });
        });

        it("fails if the 0 address is passed as receiver address", async () => {
            await expectRevert(
                liquidityMining.transferSOV(ZERO_ADDRESS, 1000),
                "Receiver address invalid"
            );
        });

        it("fails if the 0 is passed as an amount", async () => {
            await expectRevert(liquidityMining.transferSOV(account1, 0), "Amount invalid");
        });
    });

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
            await deploymentAndInit();
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

            expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(
                allocationPoint1.add(allocationPoint2)
            );

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
            await expectRevert(
                liquidityMining.add(token1.address, new BN(0), false),
                "Invalid allocation point"
            );
        });

        it("fails if the 0 address is passed as token address", async () => {
            await expectRevert(
                liquidityMining.add(ZERO_ADDRESS, new BN(1), false),
                "Invalid token address"
            );
        });

        it("fails if token already added", async () => {
            await deploymentAndInit();
            await liquidityMining.add(token1.address, new BN(1), false);
            await expectRevert(
                liquidityMining.add(token1.address, new BN(1), false),
                "Token already added"
            );
        });

        it("only owner or admin should be able to add pool token", async () => {
            await deploymentAndInit();
            await expectRevert(
                liquidityMining.add(token2.address, new BN(1), false, { from: account1 }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.add(token2.address, new BN(1), false, { from: account1 });
        });
    });

    describe("update", () => {
        it("should be able to update pool token", async () => {
            await deploymentAndInit();
            let oldAllocationPoint = new BN(1);
            await liquidityMining.add(token1.address, oldAllocationPoint, false);

            let newAllocationPoint = new BN(2);
            let tx = await liquidityMining.update(token1.address, newAllocationPoint, false);

            expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(
                newAllocationPoint
            );

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
            await deploymentAndInit();
            let oldAllocationPoint = new BN(1);
            await liquidityMining.add(token1.address, oldAllocationPoint, false);

            await liquidityMining.add(token2.address, oldAllocationPoint, false);

            let newAllocationPoint = new BN(2);
            let tx = await liquidityMining.update(token1.address, newAllocationPoint, true);

            expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(
                oldAllocationPoint.add(newAllocationPoint)
            );

            let poolInfo = await liquidityMining.getPoolInfo(token2.address);
            expect(poolInfo.lastRewardBlock).bignumber.equal(new BN(tx.receipt.blockNumber));
        });

        it("fails if token wasn't added", async () => {
            await deploymentAndInit();
            await expectRevert(
                liquidityMining.update(token1.address, new BN(1), false),
                "Pool token not found"
            );
        });

        it("only owner or admin should be able to update pool token", async () => {
            await liquidityMining.add(token2.address, new BN(1), false);
            await expectRevert(
                liquidityMining.update(token2.address, new BN(1), false, { from: account1 }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.update(token2.address, new BN(1), false, { from: account1 });
        });
    });

    describe("updateTokens", () => {
        it("should be able to update 2 pool tokens", async () => {
            await deploymentAndInit();
            let poolTokens = [token1.address, token2.address, token3.address];
            let oldAllocationPoints = [new BN(1), new BN(2), new BN(3)];

            for (let i = 0; i < poolTokens.length; i++) {
                await liquidityMining.add(poolTokens[i], oldAllocationPoints[i], false);
            }

            let newAllocationPoints = [new BN(101), new BN(102), new BN(3)];
            let tx = await liquidityMining.updateTokens(poolTokens, newAllocationPoints, true);

            let totalAllocationPoint = new BN(0);
            for (let i = 0; i < newAllocationPoints.length; i++) {
                totalAllocationPoint = totalAllocationPoint.add(newAllocationPoints[i]);
            }
            expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(
                totalAllocationPoint
            );

            let blockNumber = new BN(tx.receipt.blockNumber);
            for (let i = 0; i < poolTokens.length - 1; i++) {
                let poolInfo = await liquidityMining.getPoolInfo(poolTokens[i]);
                checkPoolInfo(
                    poolInfo,
                    poolTokens[i],
                    newAllocationPoints[i],
                    blockNumber,
                    new BN(0)
                );

                expectEvent(tx, "PoolTokenUpdated", {
                    user: root,
                    poolToken: poolTokens[i],
                    newAllocationPoint: newAllocationPoints[i],
                    oldAllocationPoint: oldAllocationPoints[i],
                });
            }

            expect(await liquidityMining.getPoolLength()).bignumber.equal(new BN(3));

            let poolInfo = await liquidityMining.getPoolInfo(poolTokens[poolTokens.length - 1]);
            expect(poolInfo.lastRewardBlock).bignumber.equal(blockNumber);
        });

        it("fails if token wasn't added", async () => {
            await deploymentAndInit();
            await expectRevert(
                liquidityMining.updateTokens([token1.address], [new BN(1)], false),
                "Pool token not found"
            );
        });

        it("fails if arrays have different length", async () => {
            await liquidityMining.add(token2.address, new BN(1), false);
            await expectRevert(
                liquidityMining.updateTokens([token1.address, token2.address], [new BN(1)], false),
                "Arrays mismatch"
            );
        });

        it("only owner or admin should be able to update pool token", async () => {
            await deploymentAndInit();
            await liquidityMining.add(token2.address, new BN(1), false);
            await expectRevert(
                liquidityMining.updateTokens([token2.address], [new BN(1)], false, {
                    from: account1,
                }),
                "unauthorized"
            );

            await liquidityMining.addAdmin(account1);
            await liquidityMining.updateTokens([token2.address], [new BN(1)], false, {
                from: account1,
            });
        });
    });

    describe("deposit", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await deploymentAndInit();
            await liquidityMining.add(token1.address, allocationPoint, false);
            await mineBlocks(1);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
        });

        it("should be able to deposit", async () => {
            let tx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

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
            let tx = await liquidityMining.deposit(token1.address, amount, account2, {
                from: account1,
            });

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let blockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(poolInfo, token1.address, allocationPoint, blockNumber, new BN(0));

            await checkUserPoolTokens(account2, token1, amount, amount, new BN(0));

            expectEvent(tx, "Deposit", {
                user: account2,
                poolToken: token1.address,
                amount: amount,
            });
        });

        it("fails if token pool token not found", async () => {
            await expectRevert(
                liquidityMining.deposit(account1, amount, ZERO_ADDRESS, { from: account1 }),
                "Pool token not found"
            );
        });
    });

    describe("claimReward", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await deploymentAndInit();
            await liquidityMining.add(token1.address, allocationPoint, false);
            await mineBlocks(1);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
        });

        it("shouldn't be able to claim reward (will not be claimed without SOV tokens)", async () => {
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await expectRevert(
                liquidityMining.claimReward(token1.address, ZERO_ADDRESS, { from: account1 }),
                "Claiming reward failed"
            );
        });

        // if claiming rewards for single pool and 0% <unlockedImmediatelyPercent<100% and poolTokensUnlockedImmediatelyPercent is 0, unlockedImmediatelyPercent of the reward amount gets transferred to the user directly (through the lockedSOV contract) and 100% - unlockedImmediatelyPercent are vested
        it("should be able to claim reward (will be claimed with SOV tokens) with 10% of unlockedImmediatelyPercent", async () => {
            /**
             * unlockedImmediatelyPercent was set to 10%
             * After user claim reward:
             *      - 10% of token1 reward will be transferred directly to the user.
             *      - 90% of token1 reward will be vested.
             */
            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            let tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);

            /** user should only receive 10% SOV since the unlockedImmediatelyPercent is 10% */
            const unlockImmediatelyPercent = await liquidityMining.calcUnlockedImmediatelyPercent(
                token1.address
            );
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance.add(
                    userReward.mul(unlockImmediatelyPercent).div(HUNDRED_PERCENT)
                )
            );

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward,
            });

            // the other 90% of reward claimed will be staked
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                lockedSOV,
                "TokensStaked",
                {
                    _initiator: account1,
                    _vesting: ZERO_ADDRESS,
                    _amount: userReward
                        .mul(HUNDRED_PERCENT.sub(unlockImmediatelyPercent))
                        .div(HUNDRED_PERCENT),
                }
            );
        });

        // if claiming rewards for single pool and unlockedImmediatelyPercent is 100% and poolTokensUnlockedImmediatelyPercent is 0, the user receives 100% of the tokens directly to his wallet
        it("user should receive the entire SOV rewards with 100% unlockedImmediatelyPercent", async () => {
            /**
             * set unlockedImmediatelyPercent to 100%
             * After user claim reward:
             *      - 100% of token1 reward will be transferred directly to the user.
             */
            const newUnlockedImmediatelyPercent = new BN(10000);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            let tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);

            /** user should receive the entire SOV reward since the unlockedImmediatelyPercent is 100% */
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance.add(userReward)
            );

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward,
            });
        });

        it("getUserAccumulatedReward() should return correct value with the reward being claimed for 100% unlockedImmediatelyPercent", async () => {
            /**
             * set unlockedImmediatelyPercent to 100%
             * After user claim reward:
             *      - 100% of token1 reward will be transferred directly to the user.
             */
            const newUnlockedImmediatelyPercent = new BN(10000);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            /** First Deposit */
            let depositTx = await liquidityMining.deposit(
                token1.address,
                amount.div(new BN(2)),
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            /** Second Deposit */
            await liquidityMining.deposit(token1.address, amount.div(new BN(2)), ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            const totalLiquidReward = await liquidityMining.getUserAccumulatedRewardToBePaidLiquid(
                account1
            );
            const totalVestedReward = await liquidityMining.getUserAccumulatedRewardToBeVested(
                account1
            );
            const totalUserAccumulatedReward = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                account1
            );

            let blockNumberBeforeClaim = await ethers.provider.getBlock("latest");

            /** Claim Reward */
            let tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);

            /** user should receive the entire SOV reward since the unlockedImmediatelyPercent is 100% */
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance.add(userReward)
            );

            /**
             * There is a block number different when we check the get user accumulated reward and when we do the actual claim
             * This causes the disceprancies of how much reward being claimed because the totalAccumulatedRewardPerShare is calculated based on block number.
             * So we need to find how much the discrepancies.
             */
            const bonusBlockMultiplier = await liquidityMining.BONUS_BLOCK_MULTIPLIER();
            const blockDifference = new BN(latestBlockNumber).sub(
                new BN(blockNumberBeforeClaim.number)
            );
            const additionalAccumulatedRewardPerShare = rewardTokensPerBlock
                .mul(bonusBlockMultiplier)
                .mul(blockDifference);
            expect(userReward.sub(additionalAccumulatedRewardPerShare).toString()).to.be.equal(
                totalUserAccumulatedReward.toString()
            );

            /** The total liquid reward should be the same as we got from getUserAccumulated reward since the calc immediate percent is 100% liquid */
            expect(userReward.sub(additionalAccumulatedRewardPerShare).toString()).to.be.equal(
                totalLiquidReward.toString()
            );

            // total vested should be 0 since the calc immediate percent is 100% liquid
            expect(totalVestedReward.toString()).to.be.equal("0");

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward,
            });
        });

        it("getUserAccumulatedReward() should return correct value with the reward being claimed for 70% unlockedImmediatelyPercent", async () => {
            /**
             * set unlockedImmediatelyPercent to 70%
             * After user claim reward:
             *      - 70% of token1 reward will be transferred directly to the user.
             */
            const newUnlockedImmediatelyPercent = new BN(7000);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            /** First Deposit */
            let depositTx = await liquidityMining.deposit(
                token1.address,
                amount.div(new BN(2)),
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            /** Second Deposit */
            await liquidityMining.deposit(token1.address, amount.div(new BN(2)), ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            const totalLiquidReward = await liquidityMining.getUserAccumulatedRewardToBePaidLiquid(
                account1
            );
            const totalVestedReward = await liquidityMining.getUserAccumulatedRewardToBeVested(
                account1
            );
            const totalUserAccumulatedReward = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                account1
            );

            let blockNumberBeforeClaim = await ethers.provider.getBlock("latest");

            /** Claim Reward */
            let tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);

            /** user should receive the entire SOV reward since the unlockedImmediatelyPercent is 100% */
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance
                    .add(userReward.mul(newUnlockedImmediatelyPercent).div(HUNDRED_PERCENT))
                    .toString()
            );

            /**
             * There is a block number different when we check the get user accumulated reward and when we do the actual claim
             * This causes the disceprancies of how much reward being claimed because the totalAccumulatedRewardPerShare is calculated based on block number.
             * So we need to find how much the discrepancies.
             */
            const bonusBlockMultiplier = await liquidityMining.BONUS_BLOCK_MULTIPLIER();
            const blockDifference = new BN(latestBlockNumber).sub(
                new BN(blockNumberBeforeClaim.number)
            );
            const additionalAccumulatedRewardPerShare = rewardTokensPerBlock
                .mul(bonusBlockMultiplier)
                .mul(blockDifference);
            expect(userReward.sub(additionalAccumulatedRewardPerShare).toString()).to.be.equal(
                totalUserAccumulatedReward.toString()
            );

            /** The total liquid reward should be 70% of the reward since the calc immediate percent is 70% liquid */
            expect(
                userReward
                    .sub(additionalAccumulatedRewardPerShare)
                    .mul(newUnlockedImmediatelyPercent)
                    .div(HUNDRED_PERCENT)
                    .toString()
            ).to.be.equal(totalLiquidReward.toString());

            // total vested should be 30% of the reward since the calc immediate percent is 70% liquid
            expect(
                userReward
                    .sub(additionalAccumulatedRewardPerShare)
                    .mul(new BN(HUNDRED_PERCENT).sub(newUnlockedImmediatelyPercent))
                    .div(HUNDRED_PERCENT)
                    .toString()
            ).to.be.equal(totalVestedReward.toString());

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward,
            });
        });

        it("user should receive the entire SOV rewards if poolTokensUnlockedImmediatelyPercent is set to 100%", async () => {
            /**
             * set poolTokensUnlockedImmediatelyPercent to 100%
             * After user claim reward:
             *      - 100% of token1 reward will be transferred directly to the user.
             */
            const newpoolTokensUnlockedImmediatelyPercent = new BN(10000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token1.address,
                newpoolTokensUnlockedImmediatelyPercent
            );

            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            let tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);

            /** user should receive the entire SOV reward since the unlockedImmediatelyPercent is 100% */
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance.add(userReward)
            );

            const unlockImmediatelyPercent = await liquidityMining.calcUnlockedImmediatelyPercent(
                token1.address
            );
            expect(unlockImmediatelyPercent.toString()).to.equal(
                newpoolTokensUnlockedImmediatelyPercent.toString()
            );

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward,
            });
        });

        // if claiming rewards for a single pool and poolTokensUnlockedImmediatelyPercent > 0 and poolTokensUnlockedImmediatelyPercent != unlockedImmediatelyPercent, poolTokensUnlockedImmediatelyPercent of the reward amount gets transferred immediately to the user
        it("user should receive the part of SOV rewards if poolTokensUnlockedImmediatelyPercent is set to less than 100%", async () => {
            /**
             * set poolTokensUnlockedImmediatelyPercent to 30%
             * After user claim reward:
             *      - 30% of token1 reward will be transferred directly to the user.
             *      - 70% of token1 reward will be vested.
             */
            // set the poolTokensUnlockedImmediatelyPercent to 30%
            const newpoolTokensUnlockedImmediatelyPercent = new BN(3000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token1.address,
                newpoolTokensUnlockedImmediatelyPercent
            );

            let depositTx = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber = new BN(depositTx.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, new BN(1000));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            let tx = await liquidityMining.claimReward(token1.address, ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);

            /** user should only receive 10% SOV since the unlockedImmediatelyPercent is 30% */
            const unlockImmediatelyPercent = await liquidityMining.calcUnlockedImmediatelyPercent(
                token1.address
            );
            expect(unlockImmediatelyPercent.toString()).to.equal(
                newpoolTokensUnlockedImmediatelyPercent.toString()
            );
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance.add(
                    userReward.mul(unlockImmediatelyPercent).div(HUNDRED_PERCENT)
                )
            );

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward,
            });

            // the other 70% of reward claimed will be staked
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                lockedSOV,
                "TokensStaked",
                {
                    _initiator: account1,
                    _vesting: ZERO_ADDRESS,
                    _amount: userReward
                        .mul(HUNDRED_PERCENT.sub(unlockImmediatelyPercent))
                        .div(HUNDRED_PERCENT),
                }
            );
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
            checkPoolInfo(
                poolInfo,
                token1.address,
                allocationPoint,
                latestBlockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));
            await checkUserReward(account1, token1, depositBlockNumber, latestBlockNumber);

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));
        });

        it("fails if token pool token not found", async () => {
            await expectRevert(
                liquidityMining.claimReward(account1, ZERO_ADDRESS, { from: account1 }),
                "Pool token not found"
            );
        });
    });

    describe("claimRewardFromAllPools", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await deploymentAndInit();
            await liquidityMining.add(token1.address, allocationPoint, false);
            await liquidityMining.add(token2.address, allocationPoint, false);
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

        it("should be able to claim all rewards (will be claimed with SOV tokens) with 10% of unlockedImmediatelyPercent", async () => {
            /**
             * unlockedImmediatelyPercent was to 10%
             * After user claim all rewards:
             *      - 10% of token1 reward will be transferred directly to the user.
             *      - 90% of token1 reward will be vested.
             *      - 10% of token2 reward will be transferred directly to the user.
             *      - 90% of token2 reward will be vested.
             */
            let depositTx1 = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber1 = new BN(depositTx1.receipt.blockNumber);
            let depositTx2 = await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber2 = new BN(depositTx2.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, amount.mul(new BN(2)));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            let tx = await liquidityMining.claimRewardFromAllPools(ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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
            // we have 2 pools with the same allocation points
            userReward1 = userReward1.div(new BN(2));

            await checkUserPoolTokens(account1, token2, amount, amount, new BN(0));
            let userReward2 = await checkUserReward(
                account1,
                token2,
                depositBlockNumber2,
                latestBlockNumber
            );
            // we have 2 pools with the same allocation points
            userReward2 = userReward2.div(new BN(2));

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);
            const totalRewards = userReward1.add(userReward2);

            /** user should only receive 10% SOV since the unlockedImmediatelyPercent is 10% */
            const unlockImmediatelyPercent = await liquidityMining.calcUnlockedImmediatelyPercent(
                token1.address
            );
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance.add(
                    totalRewards.mul(unlockImmediatelyPercent).div(HUNDRED_PERCENT)
                )
            );

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward1,
            });

            // the other 90% of reward claimed will be staked
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                lockedSOV,
                "TokensStaked",
                {
                    _initiator: account1,
                    _vesting: ZERO_ADDRESS,
                    _amount: totalRewards
                        .mul(HUNDRED_PERCENT.sub(unlockImmediatelyPercent))
                        .divRound(HUNDRED_PERCENT),
                }
            );

            expect(userReward1, tx.logs[0].args.amount);
            expect(token1.address, tx.logs[0].args.poolToken);
            expect(userReward2, tx.logs[1].args.amount);
            expect(token2.address, tx.logs[1].args.poolToken);
        });

        // if the user only deposited into pool with 100% liquid rewards and claims rewards for all pools, the reward gets transferred immediately to the user and no vesting contract is created
        it("should be able to claim all rewards (will be claimed with SOV tokens) with 100% of unlockedImmediatelyPercent", async () => {
            /**
             * Set unlockedImmediatelyPercent to 100%
             * After user claim all rewards:
             *      - 100% of token1 reward will be transferred directly to the user.
             *      - 100% of token2 reward will be transferred directly to the user.
             */
            // set unlockedImmediatelyPercent to 100%
            const newUnlockedImmediatelyPercent = new BN(10000);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            let depositTx1 = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber1 = new BN(depositTx1.receipt.blockNumber);
            let depositTx2 = await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber2 = new BN(depositTx2.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, amount.mul(new BN(2)));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            let tx = await liquidityMining.claimRewardFromAllPools(ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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
            // we have 2 pools with the same allocation points
            userReward1 = userReward1.div(new BN(2));

            await checkUserPoolTokens(account1, token2, amount, amount, new BN(0));
            let userReward2 = await checkUserReward(
                account1,
                token2,
                depositBlockNumber2,
                latestBlockNumber
            );
            // we have 2 pools with the same allocation points
            userReward2 = userReward2.div(new BN(2));

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);
            const totalRewards = userReward1.add(userReward2);

            /** user should only receive 10% SOV since the unlockedImmediatelyPercent is 10% */
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance.add(totalRewards)
            );

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward1,
            });

            expect(userReward1, tx.logs[0].args.amount);
            expect(token1.address, tx.logs[0].args.poolToken);
            expect(userReward2, tx.logs[1].args.amount);
            expect(token2.address, tx.logs[1].args.poolToken);
        });

        // if the user has deposited at least 2 pool tokens and is claiming rewards for all pools and <unlockedImmediatelyPercent = 0 and one of the pools has poolTokensUnlockedImmediatelyPercent = 100%, the user should receive the rewards for that one pool liquid and the other one vested
        it("should be able to claim all rewards with combination of unlockedImmediatelyPercent (0% & 100%) among the pools", async () => {
            /**
             * Set unlockedImmediatelyPercent to 0% and poolTokensUnlockedImmediatelyPercent for token2 to 100%
             * After user claim all rewards:
             *      - 100% of token1 reward will be vested.
             *      - 100% of token2 reward will be transferred directly to the user.
             */
            // set unlockedImmediatelyPercent to 0%
            const newUnlockedImmediatelyPercent = new BN(0);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            // set poolTokensUnlockedImmediatelyPercent for pool token 2 to 100%
            const newpoolTokensUnlockedImmediatelyPercent = new BN(10000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token2.address,
                newpoolTokensUnlockedImmediatelyPercent
            );

            const unlockImmediatelyPercentToken1 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(unlockImmediatelyPercentToken1.toString()).to.equal(
                newUnlockedImmediatelyPercent.toString()
            );

            const unlockImmediatelyPercentToken2 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token2.address);
            expect(unlockImmediatelyPercentToken2.toString()).to.equal(
                newpoolTokensUnlockedImmediatelyPercent.toString()
            );

            let depositTx1 = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber1 = new BN(depositTx1.receipt.blockNumber);
            let depositTx2 = await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber2 = new BN(depositTx2.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, amount.mul(new BN(2)));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            let tx = await liquidityMining.claimRewardFromAllPools(ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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
            // we have 2 pools with the same allocation points
            userReward1 = userReward1.div(new BN(2));

            await checkUserPoolTokens(account1, token2, amount, amount, new BN(0));
            let userReward2 = await checkUserReward(
                account1,
                token2,
                depositBlockNumber2,
                latestBlockNumber
            );
            // we have 2 pools with the same allocation points
            userReward2 = userReward2.div(new BN(2));

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);

            /** user should only receive reward2 since only pool token 2 unlock immediate percentage that was set to 100%*/
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance.add(userReward2)
            );

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward1,
            });

            // entire reward1 will be staked since we set the unlockedImmediatelyPercent to 0%
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                lockedSOV,
                "TokensStaked",
                {
                    _initiator: account1,
                    _vesting: ZERO_ADDRESS,
                    _amount: userReward1,
                }
            );

            expect(userReward1, tx.logs[0].args.amount);
            expect(token1.address, tx.logs[0].args.poolToken);
            expect(userReward2, tx.logs[1].args.amount);
            expect(token2.address, tx.logs[1].args.poolToken);
        });

        it("should be able to claim all rewards with combination of unlockedImmediatelyPercent (30% & 100%) among the pools", async () => {
            /**
             * Set unlockedImmediatelyPercent to 30% and poolTokensUnlockedImmediatelyPercent for token2 to 100%
             * After user claim all rewards:
             *      - 70% of token1 reward will be vested.
             *      - 30% of token1 reward will be transferred directly to the user.
             *      - 100% of token2 reward will be transferred directly to the user.
             */
            // set unlockedImmediatelyPercent to 0%
            const newUnlockedImmediatelyPercent = new BN(3000);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            // set poolTokensUnlockedImmediatelyPercent for pool token 2 to 100%
            const newpoolTokensUnlockedImmediatelyPercent = new BN(10000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token2.address,
                newpoolTokensUnlockedImmediatelyPercent
            );

            const unlockImmediatelyPercentToken1 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(unlockImmediatelyPercentToken1.toString()).to.equal(
                newUnlockedImmediatelyPercent.toString()
            );

            const unlockImmediatelyPercentToken2 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token2.address);
            expect(unlockImmediatelyPercentToken2.toString()).to.equal(
                newpoolTokensUnlockedImmediatelyPercent.toString()
            );

            let depositTx1 = await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber1 = new BN(depositTx1.receipt.blockNumber);
            let depositTx2 = await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            let depositBlockNumber2 = new BN(depositTx2.receipt.blockNumber);
            await SOVToken.transfer(liquidityMining.address, amount.mul(new BN(2)));

            const previousUserSOVBalance = await SOVToken.balanceOf(account1);

            let tx = await liquidityMining.claimRewardFromAllPools(ZERO_ADDRESS, {
                from: account1,
            });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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
            // we have 2 pools with the same allocation points
            userReward1 = userReward1.div(new BN(2));

            await checkUserPoolTokens(account1, token2, amount, amount, new BN(0));
            let userReward2 = await checkUserReward(
                account1,
                token2,
                depositBlockNumber2,
                latestBlockNumber
            );
            // we have 2 pools with the same allocation points
            userReward2 = userReward2.div(new BN(2));

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));

            const latestUserSOVBalance = await SOVToken.balanceOf(account1);

            /** user should only receive (100% of reward2 + 30% of reward 1)*/
            expect(latestUserSOVBalance.toString()).to.equal(
                previousUserSOVBalance
                    .add(userReward2)
                    .add(userReward1.mul(unlockImmediatelyPercentToken1).div(HUNDRED_PERCENT))
            );

            expectEvent(tx, "RewardClaimed", {
                user: account1,
                poolToken: token1.address,
                amount: userReward1,
            });

            // 70% reward1 will be staked since we set the unlockedImmediatelyPercent to 30%
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                lockedSOV,
                "TokensStaked",
                {
                    _initiator: account1,
                    _vesting: ZERO_ADDRESS,
                    _amount: userReward1
                        .mul(HUNDRED_PERCENT.sub(unlockImmediatelyPercentToken1))
                        .divRound(HUNDRED_PERCENT),
                }
            );

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
            checkPoolInfo(
                poolInfo,
                token1.address,
                allocationPoint,
                latestBlockNumber,
                new BN(-1)
            );

            await checkUserPoolTokens(account1, token1, amount, amount, new BN(0));
            await checkUserReward(account1, token1, depositBlockNumber, latestBlockNumber);

            // withdrawAndStakeTokensFrom was invoked
            let unlockedBalance = await lockedSOV.getUnlockedBalance(account1);
            let lockedBalance = await lockedSOV.getLockedBalance(account1);
            expect(unlockedBalance).bignumber.equal(new BN(0));
            expect(lockedBalance).bignumber.equal(new BN(0));
        });

        // getUserAccumulatedRewardToBePaidLiquid return the expected values if there are 3 pools of which 1 has poolTokensUnlockedImmediatelyPercent = 0, one has poolTokensUnlockedImmediatelyPercent = 30% and one has poolTokensUnlockedImmediatelyPercent = 100%. unlockedImmediatelyPercent is 0
        it("getUserAccumulatedRewardToBePaidLiquid should return correct value", async () => {
            /**
             * 1. Register 3 tokens to LM
             * 2. Set the immediate percent
             *      - Token 1: 0%
             *      - Token 2: 100%
             *      - Token 3: 30%
             * 3. Deposit into LM for those 3 tokens
             * 4. getUserAccumulatedRewardToBePaidLiquid should return SUM of these 3 rewards:
             *      - Token 1: 0% amount reward of token 1
             *      - Token 2: 100% amount reward of token 2
             *      - Token 3: 30% amount reward of token 3
             * 5. claim all rewards
             * 6. getUserAccumulatedRewardToBePaidLiquid should return 0 value.
             */
            await liquidityMining.add(token3.address, allocationPoint, false);
            await token3.mint(account1, amount);
            await token3.approve(liquidityMining.address, amount, { from: account1 });

            // set unlockedImmediatelyPercent to 0%
            const newUnlockedImmediatelyPercent = new BN(0);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            // set poolTokensUnlockedImmediatelyPercent for pool token 2 to 100%
            const newpoolTokensUnlockedImmediatelyPercent2 = new BN(10000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token2.address,
                newpoolTokensUnlockedImmediatelyPercent2
            );

            const newpoolTokensUnlockedImmediatelyPercent3 = new BN(3000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token3.address,
                newpoolTokensUnlockedImmediatelyPercent3
            );

            const unlockImmediatelyPercentToken1 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(unlockImmediatelyPercentToken1.toString()).to.equal(
                newUnlockedImmediatelyPercent.toString()
            );

            const unlockImmediatelyPercentToken2 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token2.address);
            expect(unlockImmediatelyPercentToken2.toString()).to.equal(
                newpoolTokensUnlockedImmediatelyPercent2.toString()
            );

            const unlockImmediatelyPercentToken3 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token3.address);
            expect(unlockImmediatelyPercentToken3.toString()).to.equal(
                newpoolTokensUnlockedImmediatelyPercent3.toString()
            );

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await liquidityMining.deposit(token3.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await SOVToken.transfer(liquidityMining.address, amount.mul(new BN(2)));

            const peviousAccumulatedRewardList =
                await liquidityMining.getUserAccumulatedRewardList(account1);
            const previousAccumulatedLiquidReward =
                await liquidityMining.getUserAccumulatedRewardToBePaidLiquid(account1);

            const liquidRewardToken1 = unlockImmediatelyPercentToken1
                .mul(peviousAccumulatedRewardList[0])
                .div(HUNDRED_PERCENT);
            const liquidRewardToken2 = unlockImmediatelyPercentToken2
                .mul(peviousAccumulatedRewardList[1])
                .div(HUNDRED_PERCENT);
            const liquidRewardToken3 = unlockImmediatelyPercentToken3
                .mul(peviousAccumulatedRewardList[2])
                .div(HUNDRED_PERCENT);
            expect(previousAccumulatedLiquidReward).to.equal(
                liquidRewardToken1.add(liquidRewardToken2).add(liquidRewardToken3)
            );

            await liquidityMining.claimRewardFromAllPools(ZERO_ADDRESS, {
                from: account1,
            });

            const latestAccumulatedRewardList = await liquidityMining.getUserAccumulatedRewardList(
                account1
            );
            expect(latestAccumulatedRewardList[0]).to.equal("0");
            expect(latestAccumulatedRewardList[1]).to.equal("0");
            expect(latestAccumulatedRewardList[2]).to.equal("0");

            const latestAccumulatedLiquidReward =
                await liquidityMining.getUserAccumulatedRewardToBePaidLiquid(account1);
            expect(latestAccumulatedLiquidReward).to.equal("0");
        });

        // getUserAccumulatedRewardToBeVested return the expected values if there are 3 pools of which 1 has poolTokensUnlockedImmediatelyPercent = 0, one has poolTokensUnlockedImmediatelyPercent = 30% and one has poolTokensUnlockedImmediatelyPercent = 100%. unlockedImmediatelyPercent is 0
        it("getUserAccumulatedRewardToBeVested should return correct value", async () => {
            /**
             * 1. Register 3 tokens to LM
             * 2. Set the immediate percent
             *      - Token 1: 0%
             *      - Token 2: 100%
             *      - Token 3: 30%
             * 3. Deposit into LM for those 3 tokens
             * 4. getUserAccumulatedRewardToBeVested should return SUM of these 3 rewards:
             *      - Token 1: 100% amount reward of token 1
             *      - Token 2: 0% amount reward of token 2
             *      - Token 3: 70% amount reward of token 3
             * 5. claim all rewards
             * 6. getUserAccumulatedRewardToBeVested should return 0 value.
             */
            await liquidityMining.add(token3.address, allocationPoint, false);
            await token3.mint(account1, amount);
            await token3.approve(liquidityMining.address, amount, { from: account1 });

            // set unlockedImmediatelyPercent to 0%
            const newUnlockedImmediatelyPercent = new BN(0);
            await liquidityMining.setUnlockedImmediatelyPercent(newUnlockedImmediatelyPercent);

            // set poolTokensUnlockedImmediatelyPercent for pool token 2 to 100%
            const newpoolTokensUnlockedImmediatelyPercent2 = new BN(10000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token2.address,
                newpoolTokensUnlockedImmediatelyPercent2
            );

            const newpoolTokensUnlockedImmediatelyPercent3 = new BN(3000);
            await liquidityMining.setPoolTokenUnlockedImmediatelyPercent(
                token3.address,
                newpoolTokensUnlockedImmediatelyPercent3
            );

            const unlockImmediatelyPercentToken1 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token1.address);
            expect(unlockImmediatelyPercentToken1.toString()).to.equal(
                newUnlockedImmediatelyPercent.toString()
            );

            const unlockImmediatelyPercentToken2 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token2.address);
            expect(unlockImmediatelyPercentToken2.toString()).to.equal(
                newpoolTokensUnlockedImmediatelyPercent2.toString()
            );

            const unlockImmediatelyPercentToken3 =
                await liquidityMining.calcUnlockedImmediatelyPercent(token3.address);
            expect(unlockImmediatelyPercentToken3.toString()).to.equal(
                newpoolTokensUnlockedImmediatelyPercent3.toString()
            );

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await liquidityMining.deposit(token3.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await SOVToken.transfer(liquidityMining.address, amount.mul(new BN(2)));

            const peviousAccumulatedRewardList =
                await liquidityMining.getUserAccumulatedRewardList(account1);
            const previousAccumulatedVestedReward =
                await liquidityMining.getUserAccumulatedRewardToBeVested(account1);

            const vestedRewardToken1 = HUNDRED_PERCENT.sub(unlockImmediatelyPercentToken1)
                .mul(peviousAccumulatedRewardList[0])
                .div(HUNDRED_PERCENT);
            const vestedRewardToken2 = HUNDRED_PERCENT.sub(unlockImmediatelyPercentToken2)
                .mul(peviousAccumulatedRewardList[1])
                .div(HUNDRED_PERCENT);
            const vestedRewardToken3 = HUNDRED_PERCENT.sub(unlockImmediatelyPercentToken3)
                .mul(peviousAccumulatedRewardList[2])
                .div(HUNDRED_PERCENT);
            expect(previousAccumulatedVestedReward).to.equal(
                vestedRewardToken1.add(vestedRewardToken2).add(vestedRewardToken3)
            );

            await liquidityMining.claimRewardFromAllPools(ZERO_ADDRESS, {
                from: account1,
            });

            const latestAccumulatedRewardList = await liquidityMining.getUserAccumulatedRewardList(
                account1
            );
            expect(latestAccumulatedRewardList[0]).to.equal("0");
            expect(latestAccumulatedRewardList[1]).to.equal("0");
            expect(latestAccumulatedRewardList[2]).to.equal("0");

            const latestAccumulatedVestedReward =
                await liquidityMining.getUserAccumulatedRewardToBeVested(account1);
            expect(latestAccumulatedVestedReward).to.equal("0");
        });
    });

    describe("withdraw", () => {
        let allocationPoint = new BN(1);
        let amount = new BN(1000);

        beforeEach(async () => {
            await deploymentAndInit();
            await liquidityMining.add(token1.address, allocationPoint, false);
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
            checkPoolInfo(poolInfo, token1.address, allocationPoint, blockNumber, new BN(-1));

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

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            let poolInfo = await liquidityMining.getPoolInfo(token1.address);
            let latestBlockNumber = new BN(tx.receipt.blockNumber);
            checkPoolInfo(
                poolInfo,
                token1.address,
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

            // withdrawAndStakeTokensFrom was not invoked
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
                poolToken: token1.address,
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
            checkPoolInfo(
                poolInfo,
                token1.address,
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
            await checkUserReward(account1, token1, depositBlockNumber, latestBlockNumber);
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
            await deploymentAndInit();
            await liquidityMining.add(token1.address, allocationPoint, false);
            await mineBlocks(1);

            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
        });

        it("should be able to withdraw", async () => {
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            let tx = await liquidityMining.emergencyWithdraw(token1.address, { from: account1 });

            let totalUsersBalance = await liquidityMining.totalUsersBalance();
            expect(totalUsersBalance).bignumber.equal(new BN(0));

            await checkUserPoolTokens(account1, token1, new BN(0), new BN(0), amount);

            let userInfo = await liquidityMining.getUserInfo(token1.address, account1);
            expect(userInfo.rewardDebt).bignumber.equal(new BN(0));
            expect(userInfo.accumulatedReward).bignumber.equal(new BN(0));

            let bonusBlockMultiplier = await liquidityMining.BONUS_BLOCK_MULTIPLIER();
            let expectedAccumulatedReward = rewardTokensPerBlock.mul(bonusBlockMultiplier);
            expectEvent(tx, "EmergencyWithdraw", {
                user: account1,
                poolToken: token1.address,
                amount: amount,
                accumulatedReward: expectedAccumulatedReward,
            });
        });

        it("fails if token pool token not found", async () => {
            await expectRevert(
                liquidityMining.emergencyWithdraw(account1, { from: account1 }),
                "Pool token not found"
            );
        });
    });

    describe("getPassedBlocksWithBonusMultiplier", () => {
        it("check calculation", async () => {
            let bonusBlockMultiplier = await liquidityMining.BONUS_BLOCK_MULTIPLIER();
            let startBlock = await liquidityMining.startBlock();
            let bonusEndBlock = await liquidityMining.bonusEndBlock();
            let blocks;

            // [startBlock, bonusEndBlock]
            blocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(
                startBlock,
                bonusEndBlock
            );
            expect(blocks).bignumber.equal(numberOfBonusBlocks.mul(bonusBlockMultiplier));

            // [startBlock - 100, bonusEndBlock]
            blocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(
                startBlock.sub(new BN(100)),
                bonusEndBlock
            );
            expect(blocks).bignumber.equal(numberOfBonusBlocks.mul(bonusBlockMultiplier));

            // [startBlock, bonusEndBlock + 100]
            let blocksAfterBonusPeriod = new BN(100);
            blocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(
                startBlock,
                bonusEndBlock.add(new BN(blocksAfterBonusPeriod))
            );
            expect(blocks).bignumber.equal(
                numberOfBonusBlocks.mul(bonusBlockMultiplier).add(blocksAfterBonusPeriod)
            );

            // [startBlock, stopMining, ... bonusEndBlock]
            await mineBlocks(5);
            await liquidityMining.stopMining();
            let endBlock = await liquidityMining.endBlock();
            blocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(
                startBlock,
                bonusEndBlock
            );
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
            await deploymentAndInit();
            await liquidityMining.add(token1.address, allocationPoint1, false);
            await liquidityMining.add(token2.address, allocationPoint2, false);

            await token1.mint(account1, amount1);
            await token2.mint(account2, amount2);

            await token1.approve(liquidityMining.address, amount1, { from: account1 });
            await token2.approve(liquidityMining.address, amount2, { from: account2 });

            bonusBlockMultiplier = await liquidityMining.BONUS_BLOCK_MULTIPLIER();
            bonusEndBlock = await liquidityMining.bonusEndBlock();
        });

        it("check calculation for no deposits", async () => {
            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                account1
            );
            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token2.address,
                account2
            );
            expect(reward1).bignumber.equal("0");
            expect(reward2).bignumber.equal("0");
        });

        it("check calculation for single user, token 1, bonus period off", async () => {
            await advanceBlocks(bonusEndBlock);
            await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {
                from: account1,
            });
            await mineBlock();
            let reward = await liquidityMining.getUserAccumulatedReward(token1.address, account1);

            // 1 block has passed, bonus period is off
            // users are given 3 tokens per share per block. user1 owns 100% of the shares
            // token 1 counts as 1/3 of the pool
            // reward = 1 * 3 * 1/3 = 1
            const expectedReward = rewardTokensPerBlock
                .mul(allocationPoint1)
                .div(totalAllocationPoint);
            expect(expectedReward).bignumber.equal("1"); // sanity check
            expect(reward).bignumber.equal(expectedReward);

            await mineBlock();
            reward = await liquidityMining.getUserAccumulatedReward(token1.address, account1);
            expect(reward).bignumber.equal("2");
        });

        it("check calculation for single user, token 2, bonus period off", async () => {
            await advanceBlocks(bonusEndBlock);
            await liquidityMining.deposit(token2.address, amount2, ZERO_ADDRESS, {
                from: account2,
            });
            await mineBlock();
            let reward = await liquidityMining.getUserAccumulatedReward(token2.address, account2);

            // 1 block has passed, bonus period is off
            // users are given 3 tokens per share per block. user2 owns 100% of the shares
            // token 2 counts as 2/3 of the pool
            // reward = 1 * 3 * 2/3 = 2
            const expectedReward = rewardTokensPerBlock
                .mul(allocationPoint2)
                .div(totalAllocationPoint);
            expect(expectedReward).bignumber.equal("2"); // sanity check
            expect(reward).bignumber.equal(expectedReward);

            await mineBlock();
            reward = await liquidityMining.getUserAccumulatedReward(token2.address, account2);
            expect(reward).bignumber.equal("4");
        });

        it("check calculation for single user, token 1, bonus period on", async () => {
            await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {
                from: account1,
            });
            await mineBlock();
            const reward = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                account1
            );

            // 1 block has passed, bonus period is on so it counts as 10 blocks,
            // users are given 3 tokens per share per block. user1 owns 100% of the shares
            // token 1 counts as 1/3 of the pool
            // reward = 10 * 3 * 1/3 = 10
            const expectedReward = rewardTokensPerBlock
                .mul(bonusBlockMultiplier)
                .mul(allocationPoint1)
                .div(totalAllocationPoint);
            expect(expectedReward).bignumber.equal("10"); // sanity check
            expect(reward).bignumber.equal(expectedReward);
        });

        it("check calculation for single user, token 1, bonus period on, smaller amount", async () => {
            await liquidityMining.deposit(token1.address, new BN(1), ZERO_ADDRESS, {
                from: account1,
            });
            await mineBlock();
            const reward = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                account1
            );

            // 1 block has passed, bonus period is on so it counts as 10 blocks,
            // users are given 3 tokens per share per block. user1 owns 100% of the shares
            // token 1 counts as 1/3 of the pool
            // reward = 10 * 3 * 1/3 = 10
            // Note that the actual amount deposited plays no role here
            expect(reward).bignumber.equal("10");
        });

        it("check calculation for single user, token 2, bonus period on", async () => {
            await liquidityMining.deposit(token2.address, amount2, ZERO_ADDRESS, {
                from: account2,
            });
            await mineBlock();
            const reward = await liquidityMining.getUserAccumulatedReward(
                token2.address,
                account2
            );

            // 1 block has passed, bonus period is on so it counts as 10 blocks,
            // users are given 3 tokens per share per block. user2 owns 100% of the shares
            // token 2 counts as 2/3 of the pool
            // reward = 10 * 3 * 2/3 = 20
            const expectedReward = rewardTokensPerBlock
                .mul(bonusBlockMultiplier)
                .mul(allocationPoint2)
                .div(totalAllocationPoint);
            expect(expectedReward).bignumber.equal("20"); // sanity check
            expect(reward).bignumber.equal(expectedReward);
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
                await liquidityMining.getUserAccumulatedReward(token1.address, account1)
            ).bignumber.equal("10");
            expect(
                await liquidityMining.getUserAccumulatedReward(token2.address, account2)
            ).bignumber.equal("0");
            await mineBlock();

            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                account1
            );
            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token2.address,
                account2
            );

            // for the first block, user 1 will receive the reward of 10
            // for the second block:
            // - user 1 still owns 100% of the shares for token1, so same reward (total 10 + 10 = 20)
            // - user 2 owns 100% of the shares for token2, so same reward as in the other cases
            expect(reward1).bignumber.equal("20");
            expect(reward2).bignumber.equal("20");
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
                await liquidityMining.getUserAccumulatedReward(token.address, account1)
            ).bignumber.equal("10");
            expect(
                await liquidityMining.getUserAccumulatedReward(token.address, account2)
            ).bignumber.equal("0");
            await mineBlock();

            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token.address,
                account1
            );
            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token.address,
                account2
            );

            // for the first block, user 1 will receive the reward of 10 (reward given per block for 100% of shares)
            // for the second block:
            // - user 1 owns 1/2 of the shares => expected reward = 5 (total 10 + 5 = 15)
            // - user 2 owns 1/2 of the shares => expected reward = 5
            expect(reward1).bignumber.equal("15");
            expect(reward2).bignumber.equal("5");
        });
    });

    describe("getEstimatedReward", () => {
        const amount1 = new BN(1000);
        const amount2 = new BN(2000);
        const amount3 = new BN(4000);
        const allocationPoint1 = new BN(1);
        const allocationPoint2 = new BN(2);

        const totalAllocationPoint = allocationPoint1.add(allocationPoint2);
        let bonusBlockMultiplier;
        let bonusEndBlock;
        let secondsPerBlock;

        beforeEach(async () => {
            await deploymentAndInit();
            await liquidityMining.add(token1.address, allocationPoint1, false);

            await token1.mint(account1, amount1);
            await token1.mint(account2, amount2);
            await token1.mint(account3, amount3);

            await token1.approve(liquidityMining.address, amount1, { from: account1 });
            await token1.approve(liquidityMining.address, amount2, { from: account2 });

            bonusBlockMultiplier = await liquidityMining.BONUS_BLOCK_MULTIPLIER();
            bonusEndBlock = await liquidityMining.bonusEndBlock();

            secondsPerBlock = await liquidityMining.SECONDS_PER_BLOCK();
        });

        it("check calculation for 1 user, period less than 1 block", async () => {
            let duration = secondsPerBlock.sub(new BN(1));

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token1.address,
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
                amount3,
                duration
            );
            let expectedReward = rewardTokensPerBlock.mul(bonusBlockMultiplier);
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 1 user, period is 40 blocks", async () => {
            let blocks = new BN(40);
            let duration = secondsPerBlock.mul(blocks);

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token1.address,
                amount3,
                duration
            );
            let expectedReward = rewardTokensPerBlock.mul(blocks).mul(bonusBlockMultiplier);
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 2 users, period is 100 blocks", async () => {
            // turn off bonus period
            await advanceBlocks(bonusEndBlock);

            let blocks = new BN(100);
            let duration = secondsPerBlock.mul(blocks);

            await token1.approve(liquidityMining.address, amount1, { from: account1 });
            await liquidityMining.deposit(token1.address, amount1, ZERO_ADDRESS, {
                from: account1,
            });

            let estimatedReward = await liquidityMining.getEstimatedReward(
                token1.address,
                amount3,
                duration
            );
            let expectedReward = rewardTokensPerBlock.mul(blocks);
            let totalAmount = amount1.add(amount3);
            expectedReward = expectedReward.mul(amount3).div(totalAmount);
            expect(estimatedReward).bignumber.equal(expectedReward);
        });

        it("check calculation for 3 users and 2 tokens, period is 1000 blocks", async () => {
            await liquidityMining.add(token2.address, allocationPoint2, false);
            // turn off bonus period
            await advanceBlocks(bonusEndBlock);

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
            await deploymentAndInit();
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
            await liquidityMining.add(token1.address, allocationPoint, false); // weight 1/1
            await liquidityMining.add(token2.address, allocationPoint, false); // weight 1/2

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await liquidityMining.deposit(token2.address, amount, ZERO_ADDRESS, {
                from: account1,
            }); // 1 block passed

            // await liquidityMining.update(token1.address, allocationPoint.mul(new BN(2)), true); // weight 2/3
            await liquidityMining.updateAllPools(); // 2 blocks passed from first deposit

            const currentBlockNumber = await web3.eth.getBlockNumber();

            // 3 tokens per share per block, times bonus multiplier (10), times precision (1e12), times weight (1/2), divided by total shares
            const expectedAccumulatedRewardPerBlock = rewardTokensPerBlock
                .mul(new BN(10))
                .mul(new BN(1e12))
                .div(new BN(2))
                .div(amount);

            const poolInfo1 = await liquidityMining.getPoolInfo(token1.address);
            expect(poolInfo1.poolToken).equal(token1.address);
            expect(poolInfo1.allocationPoint).equal("1");
            expect(poolInfo1.lastRewardBlock).equal(currentBlockNumber.toString());
            // token1 deposit has been there for 2 blocks because of automining
            expect(poolInfo1.accumulatedRewardPerShare).equal(
                expectedAccumulatedRewardPerBlock.mul(new BN(2)).toString()
            );

            const poolInfo2 = await liquidityMining.getPoolInfo(token2.address);
            expect(poolInfo2.poolToken).equal(token2.address);
            expect(poolInfo2.allocationPoint).equal("1");
            expect(poolInfo1.lastRewardBlock).equal(currentBlockNumber.toString());
            // token2 deposit has been there for only 1 block
            expect(poolInfo2.accumulatedRewardPerShare).equal(
                expectedAccumulatedRewardPerBlock.toString()
            );
        });

        // tricky case 1
        it("add(pool1), add(pool2), deposit(user1, pool1), update(pool1), withdraw(user1, pool1)", async () => {
            await liquidityMining.add(token1.address, allocationPoint, false); // weight 1/1
            await liquidityMining.add(token2.address, allocationPoint, false); // weight 1/2

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await liquidityMining.update(token1.address, new BN("2"), false); // 1 block passed, new weight 2/3
            const tx = await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            }); // 2 blocks passed

            await checkBonusPeriodHasNotEnded(); // sanity check, it's included in calculations

            const lockedAmount = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount = await lockedSOV.getUnlockedBalance(account1);
            const rewardAmount = lockedAmount.add(unlockedAmount);

            // reward per block 30 (because of bonus period), 1 block with weight 1/2 = 15, 1 block with weight 2/3 = 20
            const expectedRewardAmount = new BN("35");
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
                poolToken: token1.address,
                amount: rewardAmount,
            });
        });

        // tricky case 2
        it("add(pool1), deposit(user1, pool1), deposit(user2, pool1), withdraw(user1, pool1), withdraw(user2, pool1)", async () => {
            await liquidityMining.add(token1.address, allocationPoint, false); // weight 1/1

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

            await checkBonusPeriodHasNotEnded(); // sanity check, it's included in calculations

            const lockedAmount1 = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount1 = await lockedSOV.getUnlockedBalance(account1);
            const reward1 = lockedAmount1.add(unlockedAmount1);

            const lockedAmount2 = await lockedSOV.getLockedBalance(account2);
            const unlockedAmount2 = await lockedSOV.getUnlockedBalance(account2);
            const reward2 = lockedAmount2.add(unlockedAmount2);

            // reward per block 30 (because of bonus period), 2 block with 100% shares = 60, 1 block with 50% shares = 15
            const expectedReward1 = new BN("75");

            // reward per block 30 (because of bonus period), 1 block with 50% shares = 15, 1 block with 100% shares = 30
            const expectedReward2 = new BN("45");

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
                poolToken: token1.address,
                amount: reward1,
            });
            expectEvent(withdrawTx2, "Withdraw", {
                user: account2,
                poolToken: token1.address,
                amount: amount,
            });
            expectEvent(withdrawTx2, "RewardClaimed", {
                user: account2,
                poolToken: token1.address,
                amount: reward2,
            });
        });

        // tricky case 3a
        it("add(pool1), deposit(user1, pool1), add(pool2, no update), withdraw(user1, pool1)", async () => {
            await liquidityMining.add(token1.address, allocationPoint, false); // weight 1/1

            // deposit: 0 blocks
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            // deposit: 1 blocks, note: pool1 is NOT updated
            await liquidityMining.add(token2.address, new BN(2), false); // new weight: 1/3

            // deposit: 2 blocks
            await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await checkBonusPeriodHasNotEnded(); // sanity check, it's included in calculations

            const lockedAmount = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount = await lockedSOV.getUnlockedBalance(account1);
            const rewardAmount = lockedAmount.add(unlockedAmount);

            // reward per block 30 (because of bonus period),
            // because add was called without updating the pool, the new weight is used for all blocks
            // so 2 blocks with weight 1/3 = 20
            const expectedRewardAmount = new BN("20");
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
            await liquidityMining.add(token1.address, allocationPoint, false); // weight 1/1

            // deposit: 0 blocks
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            // deposit: 1 blocks, note: pool1 IS updated
            await liquidityMining.add(token2.address, new BN(2), true); // new weight: 1/3

            // deposit: 2 blocks
            await liquidityMining.withdraw(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            await checkBonusPeriodHasNotEnded(); // sanity check, it's included in calculations

            const lockedAmount = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount = await lockedSOV.getUnlockedBalance(account1);
            const rewardAmount = lockedAmount.add(unlockedAmount);

            // reward per block 30 (because of bonus period),
            // because add was called WITH updating the pools, old weight is for 1 block and new weight is for 1 block
            // so 1 block with weight 1/1 = 30 and 1 block with weight 1/3 = 10
            const expectedRewardAmount = new BN("40");
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
            await liquidityMining.add(token1.address, allocationPoint, false); // weight 1/1

            // deposit 1: 0 blocks, deposit 2: 0 blocks
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });

            // deposit 1: 1 blocks (weight 1/1), deposit 2: 0 blocks. pool is updated
            await liquidityMining.add(token2.address, allocationPoint, true); // weight 1/2

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

            await checkBonusPeriodHasNotEnded(); // sanity check, it's included in calculations

            const lockedAmount1 = await lockedSOV.getLockedBalance(account1);
            const unlockedAmount1 = await lockedSOV.getUnlockedBalance(account1);
            const reward1 = lockedAmount1.add(unlockedAmount1);

            const lockedAmount2 = await lockedSOV.getLockedBalance(account2);
            const unlockedAmount2 = await lockedSOV.getUnlockedBalance(account2);
            const reward2 = lockedAmount2.add(unlockedAmount2);

            // reward per block 30 (because of bonus period)
            // deposit 1 has 1 block with weight 1/1 (30) and 2 blocks with weight 1/2 (15*2 = 30)
            const expectedReward1 = new BN("60");

            // deposit 2 has 2 blocks with weight 1/2 (15 * 2 = 30)
            const expectedReward2 = new BN("30");

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
                poolToken: token1.address,
                amount: reward1,
            });
            expectEvent(withdrawTx2, "Withdraw", {
                user: account2,
                poolToken: token2.address,
                amount: amount,
            });
            expectEvent(withdrawTx2, "RewardClaimed", {
                user: account2,
                poolToken: token2.address,
                amount: reward2,
            });
        });
    });

    describe("LM configuration", () => {
        // Maximum reward per week: 100K SOV (or 100M SOV)
        // Maximum reward per block: 4.9604 SOV (4.9604 * 2880 * 7 = 100001.664)

        const REWARD_TOKENS_PER_BLOCK = new BN(49604).mul(new BN(10 ** 14)).mul(new BN(1000));
        // const REWARD_TOKENS_PER_BLOCK = new BN(49604).mul(new BN(10**14));

        // SOV/BTC pool 40K per week
        // ETH/BTC pool 37.5K per week (from second week)
        // Dummy pool 100K - SOV/BTC pool (- ETH/BTC pool)

        const MAX_ALLOCATION_POINT = new BN(100000).mul(new BN(1000));
        // const MAX_ALLOCATION_POINT = 		new BN(100000);
        const ALLOCATION_POINT_SOV_BTC = new BN(40000);
        const ALLOCATION_POINT_ETH_BTC = new BN(37500);

        const ALLOCATION_POINT_SOV_BTC_2 = new BN(30000);

        const amount = new BN(1000);

        beforeEach(async () => {
            await deployLiquidityMining();
            await liquidityMining.initialize(
                SOVToken.address,
                REWARD_TOKENS_PER_BLOCK,
                startDelayBlocks,
                numberOfBonusBlocks,
                wrapper.address,
                lockedSOV.address,
                0
            );

            for (let token of [token1, token2]) {
                for (let account of [account1, account2]) {
                    await token.mint(account, amount);
                    await token.approve(liquidityMining.address, amount, { from: account });
                }
            }

            // turn off bonus period
            let bonusEndBlock = await liquidityMining.bonusEndBlock();
            await advanceBlocks(bonusEndBlock);
        });

        it("dummy pool + 1 pool", async () => {
            let dummyPool = liquidityMiningConfigToken.address;

            let SOVBTCpool = token1.address;

            await liquidityMining.add(SOVBTCpool, ALLOCATION_POINT_SOV_BTC, false); // weight 40000 / 100000
            await liquidityMining.add(
                dummyPool,
                MAX_ALLOCATION_POINT.sub(ALLOCATION_POINT_SOV_BTC),
                false
            ); // weight (100000 - 40000) / 100000

            await liquidityMining.deposit(SOVBTCpool, amount, ZERO_ADDRESS, { from: account1 });

            // reward won't be claimed because liquidityMining doesn't have enough SOV balance
            // user reward will be updated
            // 10 blocks passed since last deposit
            await mineBlocks(9);
            await liquidityMining.withdraw(SOVBTCpool, amount, ZERO_ADDRESS, { from: account1 });

            const userInfo = await liquidityMining.getUserInfo(SOVBTCpool, account1);
            // 10 blocks passed
            let passedBlocks = 10;
            let expectedUserReward = REWARD_TOKENS_PER_BLOCK.mul(new BN(passedBlocks))
                .mul(ALLOCATION_POINT_SOV_BTC)
                .div(MAX_ALLOCATION_POINT);
            expect(userInfo.accumulatedReward).bignumber.equal(expectedUserReward);
            console.log(expectedUserReward.toString());
        });

        it("dummy pool + 2 pools", async () => {
            let dummyPool = liquidityMiningConfigToken.address;

            let SOVBTCpool = token1.address;
            let ETHBTCpoll = token2.address;

            await liquidityMining.add(SOVBTCpool, ALLOCATION_POINT_SOV_BTC, false); // weight 40000 / 100000
            const DUMMY_ALLOCATION_POINT = MAX_ALLOCATION_POINT.sub(ALLOCATION_POINT_SOV_BTC);
            await liquidityMining.add(dummyPool, DUMMY_ALLOCATION_POINT, false); // weight (100000 - 40000) / 100000

            await liquidityMining.deposit(SOVBTCpool, amount, ZERO_ADDRESS, { from: account1 });

            await mineBlocks(9);
            await liquidityMining.updateAllPools(); // 10 blocks passed from first deposit

            // update config
            // this method will also update pool reward using previous allocation point,
            // so this block should be add to calculation with old values
            await liquidityMining.update(SOVBTCpool, ALLOCATION_POINT_SOV_BTC_2, false); // weight 30000 / 100000

            await liquidityMining.add(ETHBTCpoll, ALLOCATION_POINT_ETH_BTC, false); // weight 37500 / 100000
            const DUMMY_ALLOCATION_POINT_2 = MAX_ALLOCATION_POINT.sub(
                ALLOCATION_POINT_SOV_BTC_2
            ).sub(ALLOCATION_POINT_ETH_BTC);
            await liquidityMining.update(dummyPool, DUMMY_ALLOCATION_POINT_2, false); // weight (100000 - 30000 - 37500) / 100000
            await liquidityMining.updateAllPools();

            // reward won't be claimed because liquidityMining doesn't have enough SOV balance
            // user reward will be updated
            // 10 blocks + 5 blocks passed
            await liquidityMining.withdraw(SOVBTCpool, amount, ZERO_ADDRESS, { from: account1 });

            const userInfo = await liquidityMining.getUserInfo(SOVBTCpool, account1);
            // 10 blocks + 5 blocks passed
            let passedBlocks = 10 + 1; // block should be add to calculation with old values
            let expectedUserReward = REWARD_TOKENS_PER_BLOCK.mul(new BN(passedBlocks))
                .mul(ALLOCATION_POINT_SOV_BTC)
                .div(MAX_ALLOCATION_POINT);
            passedBlocks = 5 - 1; // block should be removed from calculation with new values
            expectedUserReward = expectedUserReward.add(
                REWARD_TOKENS_PER_BLOCK.mul(new BN(passedBlocks))
                    .mul(ALLOCATION_POINT_SOV_BTC_2)
                    .div(MAX_ALLOCATION_POINT)
            );
            expect(userInfo.accumulatedReward).bignumber.equal(expectedUserReward);
            console.log(expectedUserReward.toString());
        });
    });

    describe("onTokensDeposited", () => {
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
            await deploymentAndInit();
            await token1.mint(account1, amount);
            await token1.approve(liquidityMining.address, amount, { from: account1 });
            await liquidityMining.add(token1.address, allocationPoint, false);
        });

        it("PRECISION", async () => {
            expect(await liquidityMining.PRECISION()).bignumber.equal(new BN(1e12));
        });

        it("BONUS_BLOCK_MULTIPLIER", async () => {
            expect(await liquidityMining.BONUS_BLOCK_MULTIPLIER()).bignumber.equal("10");
        });

        it("SOV token address set correctly", async () => {
            expect(await liquidityMining.SOV()).equal(SOVToken.address);
        });

        it("rewardTokensPerBlock", async () => {
            expect(await liquidityMining.rewardTokensPerBlock()).bignumber.equal(
                rewardTokensPerBlock
            );
        });

        it("startBlock", async () => {
            expect(await liquidityMining.startBlock()).bignumber.gt("0");
        });

        it("bonusEndBlock", async () => {
            const startBlock = await liquidityMining.startBlock();
            expect(await liquidityMining.bonusEndBlock()).bignumber.equal(
                startBlock.add(numberOfBonusBlocks)
            );
        });

        it("endBlock", async () => {
            expect(await liquidityMining.endBlock()).bignumber.equal("0");
        });

        it("wrapper", async () => {
            expect(await liquidityMining.wrapper()).equal(wrapper.address);
        });

        it("totalAllocationPoint", async () => {
            expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(allocationPoint);
            await liquidityMining.add(token2.address, allocationPoint, false);
            expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(
                allocationPoint.mul(new BN(2))
            );
        });

        it("totalUsersBalance", async () => {
            expect(await liquidityMining.totalUsersBalance()).bignumber.equal("0");

            await liquidityMining.updateAllPools();
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            expect(await liquidityMining.totalUsersBalance()).bignumber.equal("0");

            await liquidityMining.updateAllPools();
            expect(await liquidityMining.totalUsersBalance()).bignumber.equal("30");
        });

        // could still test these, but I don't see much point:
        // PoolInfo[] public poolInfoList;
        // mapping(address => uint256) poolIdList;
        // mapping(uint256 => mapping(address => UserInfo)) public userInfoMap;

        it("getMissedBalance", async () => {
            let missedBalance = await liquidityMining.getMissedBalance();
            expect(missedBalance).bignumber.equal("0");

            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await liquidityMining.updatePool(token1.address);

            missedBalance = await liquidityMining.getMissedBalance();
            expect(missedBalance).bignumber.equal("30");
        });

        it("getUserAccumulatedReward", async () => {
            // real tests are elsewhere in this file
            await liquidityMining.deposit(token1.address, amount, ZERO_ADDRESS, {
                from: account1,
            });
            await mineBlock();
            const reward1 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                account1
            );
            const reward2 = await liquidityMining.getUserAccumulatedReward(
                token1.address,
                account2
            );
            expect(reward1).bignumber.equal("30");
            expect(reward2).bignumber.equal("0");
        });

        it("getPoolId", async () => {
            const poolId = await liquidityMining.getPoolId(token1.address);
            expect(poolId).bignumber.equal("0");
            await expectRevert(liquidityMining.getPoolId(token2.address), "Pool token not found");
            await liquidityMining.add(token2.address, allocationPoint, false);
            const poolId2 = await liquidityMining.getPoolId(token2.address);
            expect(poolId2).bignumber.equal("1");
        });

        it("getPoolLength", async () => {
            let length = await liquidityMining.getPoolLength();
            expect(length).bignumber.equal("1");

            await liquidityMining.add(token2.address, allocationPoint, false);
            length = await liquidityMining.getPoolLength();
            expect(length).bignumber.equal("2");
        });

        it("getPoolInfoList", async () => {
            const infoList = await liquidityMining.getPoolInfoList();
            expect(infoList).to.be.an("array");
            expect(infoList.length).equal(1);
            const info = infoList[0];
            expect(info.poolToken).equal(token1.address);
            expect(info.allocationPoint).equal(allocationPoint.toString());
            expect(info.accumulatedRewardPerShare).equal("0");
            expect(info.lastRewardBlock).equal((await web3.eth.getBlockNumber()).toString());
        });

        it("getPoolInfo", async () => {
            const info = await liquidityMining.getPoolInfo(token1.address);
            expect(info.poolToken).equal(token1.address);
            expect(info.allocationPoint).equal(allocationPoint.toString());
            expect(info.accumulatedRewardPerShare).equal("0");
            expect(info.lastRewardBlock).equal((await web3.eth.getBlockNumber()).toString());

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
            expect(balanceData[0]).bignumber.equal(amount);
            expect(balanceData[1]).bignumber.equal("30");
        });

        it("getUserInfo", async () => {
            await liquidityMining.deposit(token1.address, new BN(500), ZERO_ADDRESS, {
                from: account1,
            });

            let userInfo = await liquidityMining.getUserInfo(token1.address, account1);
            expect(userInfo.amount).bignumber.equal("500");
            expect(userInfo.accumulatedReward).bignumber.equal("0"); // XXX: not yet updated -- funny?
            expect(userInfo.rewardDebt).bignumber.equal("0"); // not yet updated either

            // deposit updates it.
            await liquidityMining.deposit(token1.address, new BN(1), ZERO_ADDRESS, {
                from: account1,
            });
            userInfo = await liquidityMining.getUserInfo(token1.address, account1);
            expect(userInfo.amount).bignumber.equal("501");
            expect(userInfo.accumulatedReward).bignumber.equal("30");
            expect(userInfo.rewardDebt).bignumber.equal("30");
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
            expect(userInfo.accumulatedReward).bignumber.equal("0");
            expect(userInfo.rewardDebt).bignumber.equal("0");
        });

        it("getUserAccumulatedRewardList", async () => {
            await liquidityMining.deposit(token1.address, new BN(500), ZERO_ADDRESS, {
                from: account1,
            });

            let rewardList = await liquidityMining.getUserAccumulatedRewardList(account1);
            expect(rewardList).to.be.an("array");
            expect(rewardList.length).equal(1);
            expect(rewardList[0]).bignumber.equal("0");
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
        let liquidityMiningLogic = await LiquidityMiningLogic.new();
        let liquidityMiningProxy = await LiquidityMiningProxy.new();
        await liquidityMiningProxy.setImplementation(liquidityMiningLogic.address);
        liquidityMining = await LiquidityMiningLogic.at(liquidityMiningProxy.address);

        wrapper = await Wrapper.new(liquidityMining.address);
    }

    async function mineBlocks(blocks) {
        for (let i = 0; i < blocks; i++) {
            await mineBlock();
        }
    }

    function checkPoolInfo(
        poolInfo,
        token,
        allocationPoint,
        lastRewardBlock,
        accumulatedRewardPerShare
    ) {
        expect(poolInfo.poolToken).equal(token);
        expect(poolInfo.allocationPoint).bignumber.equal(allocationPoint);
        expect(poolInfo.lastRewardBlock).bignumber.equal(lastRewardBlock);
        if (accumulatedRewardPerShare.toNumber() !== -1) {
            expect(poolInfo.accumulatedRewardPerShare).bignumber.equal(accumulatedRewardPerShare);
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
        // user balance in pool
        let userInfo = await liquidityMining.getUserInfo(poolToken.address, user);
        expect(userInfo.amount).bignumber.equal(_userAmount);
        // LM balance of pool tokens
        let liquidityMiningBalance = await poolToken.balanceOf(liquidityMining.address);
        expect(liquidityMiningBalance).bignumber.equal(_liquidityMiningBalance);
        // user's balance of pool tokens
        let userBalance = await poolToken.balanceOf(user);
        if (wrapper !== undefined) {
            userBalance = await poolToken.balanceOf(wrapper);
        }
        expect(userBalance).bignumber.equal(_userBalance);
    }

    // user's balance of reward token
    async function checkUserReward(user, poolToken, depositBlockNumber, latestBlockNumber) {
        let passedBlocks = await liquidityMining.getPassedBlocksWithBonusMultiplier(
            depositBlockNumber,
            latestBlockNumber
        );

        let userReward = passedBlocks.mul(rewardTokensPerBlock);
        let userInfo = await liquidityMining.getUserInfo(poolToken.address, user);
        expect(userInfo.accumulatedReward).bignumber.equal(new BN(0));
        return userReward;
    }

    async function checkBonusPeriodHasNotEnded() {
        expect(await liquidityMining.bonusEndBlock()).bignumber.gt(
            (await web3.eth.getBlockNumber()).toString()
        );
    }
});
