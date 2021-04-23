const { expect } = require("chai");
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");
const { encodeParameters, etherMantissa, mineBlock, increaseTime, blockNumber } = require("../Utils/Ethereum");

const { ZERO_ADDRESS } = constants;
const TOTAL_SUPPLY = etherMantissa(1000000000);

const TestToken = artifacts.require("TestToken");
const LiquidityMining = artifacts.require("LiquidityMining");

contract("LiquidityMining:", (accounts) => {
    const name = "Test RSOV Token";
    const symbol = "TST";

    const RSOVPerBlock = new BN(3);
    const startBlock = new BN(100);
    const bonusEndBlock = new BN(1000);

    let root, account1, account2, account3, account4;
    let RSOVToken, token1, token2, token3;
    let liquidityMining;

    before(async () => {
        [root, account1, account2, account3, account4, ...accounts] = accounts;
    });

    beforeEach(async () => {
        RSOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        token1 = await TestToken.new("Test token 1", "TST-1", 18, TOTAL_SUPPLY);
        token2 = await TestToken.new("Test token 2", "TST-2", 18, TOTAL_SUPPLY);
        token3 = await TestToken.new("Test token 3", "TST-3", 18, TOTAL_SUPPLY);

        liquidityMining = await LiquidityMining.new();
        await liquidityMining.initialize(RSOVToken.address, RSOVPerBlock, startBlock, bonusEndBlock);
    });

    describe("initialize", () => {
        it("sets the expected values", async () => {
            let _RSOV = await liquidityMining.RSOV();
            let _RSOVPerBlock = await liquidityMining.RSOVPerBlock();
            let _startBlock = await liquidityMining.startBlock();
            let _bonusEndBlock = await liquidityMining.bonusEndBlock();

            expect(_RSOV).equal(RSOVToken.address);
            expect(_RSOVPerBlock).bignumber.equal(RSOVPerBlock);
            expect(_startBlock).bignumber.equal(startBlock);
            expect(_bonusEndBlock).bignumber.equal(bonusEndBlock);
        });

        it("fails if already initialized", async () => {
            await expectRevert(
                liquidityMining.initialize(RSOVToken.address, RSOVPerBlock, startBlock, bonusEndBlock),
                "Already initialized"
            );
        });

        it("fails if the 0 address is passed as token address", async () => {
            liquidityMining = await LiquidityMining.new();
            await expectRevert(
                liquidityMining.initialize(ZERO_ADDRESS, RSOVPerBlock, startBlock, bonusEndBlock),
                "Invalid token address"
            );
        });
    });

    describe("add", () => {
        it("should be able to add pool token", async () => {
            let allocationPoint = new BN(1);
            let tx = await liquidityMining.add(token1.address, allocationPoint, false);

            expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(allocationPoint);

            let poolInfo = await liquidityMining.poolInfo(0);
            expect(poolInfo.poolToken).equal(token1.address);
            expect(poolInfo.allocationPoint).bignumber.equal(allocationPoint);
            //TODO update
            // expect(poolInfo.lastRewardBlock).bignumber.equal(startBlock);
            expect(poolInfo.accumulatedRSOVPerShare).bignumber.equal(new BN(0));

            expect(await liquidityMining.getPoolLength()).bignumber.equal(new BN(1));

            expectEvent(tx, "PoolTokenAdded", {
                user: root,
                poolToken: token1.address,
                allocationPoint: allocationPoint
            });
        });

        it("should be able to add pool token and update pools", async () => {
            //TODO implement
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
            await liquidityMining.add(token1.address, new BN(1), false);
            await expectRevert(
                liquidityMining.add(token1.address, new BN(1), false),
                "Token already added"
            );
        });

    });

    describe("update", () => {
        it("should be able to update pool token", async () => {
            let oldAllocationPoint = new BN(1);
            await liquidityMining.add(token1.address, oldAllocationPoint, false);

            let newAllocationPoint = new BN(2);
            let tx = await liquidityMining.update(token1.address, newAllocationPoint, false);

            expect(await liquidityMining.totalAllocationPoint()).bignumber.equal(newAllocationPoint);

            let poolInfo = await liquidityMining.poolInfo(0);
            expect(poolInfo.poolToken).equal(token1.address);
            expect(poolInfo.allocationPoint).bignumber.equal(newAllocationPoint);
            //TODO update
            // expect(poolInfo.lastRewardBlock).bignumber.equal(startBlock);
            expect(poolInfo.accumulatedRSOVPerShare).bignumber.equal(new BN(0));

            expect(await liquidityMining.getPoolLength()).bignumber.equal(new BN(1));

            expectEvent(tx, "PoolTokenUpdated", {
                user: root,
                poolToken: token1.address,
                newAllocationPoint: newAllocationPoint,
                oldAllocationPoint: oldAllocationPoint
            });
        });

        it("should be able to update pool token and update pools", async () => {
            //TODO implement
        });

        it("fails if token wasn't added", async () => {
            await expectRevert(
                liquidityMining.update(token1.address, new BN(1), false),
                "Pool token not found"
            );
        });

    });

});
