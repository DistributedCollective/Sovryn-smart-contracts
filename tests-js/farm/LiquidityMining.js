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
                "Token address invalid"
            );
        });
    });

    describe("add", () => {
        it("should be able to add lp token", async () => {
            await liquidityMining.add(1, token1.address, false);

        });

    });

});
