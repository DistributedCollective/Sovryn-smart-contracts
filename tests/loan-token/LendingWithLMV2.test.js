const { expect, assert } = require("chai");
const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const { increaseTime, etherMantissa, mineBlock, advanceBlocks } = require("../Utils/Ethereum");

const TestToken = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");
const LiquidityMiningConfigToken = artifacts.require("LiquidityMiningConfigToken");

const sovrynProtocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const ISovryn = artifacts.require("ISovryn");

const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const LoanTokenLogicLM = artifacts.require("LoanTokenLogicLM");
const LoanTokenLogicWRBTC = artifacts.require("LoanTokenLogicWrbtc");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");
const SwapsExternal = artifacts.require("SwapsExternal");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplLocal = artifacts.require("SwapsImplLocal");

const LiquidityMiningLogic = artifacts.require("LiquidityMiningMockup");
const LiquidityMiningLogicV1 = artifacts.require("LiquidityMiningV1Mockup");
const LiquidityMiningProxy = artifacts.require("LiquidityMiningProxy");
const LiquidityMiningLogicV2 = artifacts.require("LiquidityMiningMockupV2");
const LiquidityMiningProxyV2 = artifacts.require("LiquidityMiningProxyV2");
const TestLockedSOV = artifacts.require("LockedSOVMockup");
const Wrapper = artifacts.require("RBTCWrapperProxyMockupV2");

const LockedSOVRewardTransferLogic = artifacts.require("LockedSOVRewardTransferLogic");
const Migrator = artifacts.require("LMV1toLMV2Migrator");

const TOTAL_SUPPLY = web3.utils.toWei("1000", "ether");

//const { lend_to_the_pool, cash_out_from_the_pool, cash_out_from_the_pool_more_of_lender_balance_should_not_fail } = require("./helpers");
const {
    lend_to_the_pool,
    cash_out_from_the_pool,
    cash_out_from_the_pool_uint256_max_should_withdraw_total_balance,
} = require("./helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const wei = web3.utils.toWei;

const { getLoanTokenLogic, getLoanTokenLogicWrbtc } = require("../Utils/initializer.js");

contract("LoanTokenLogicLM", (accounts) => {
    const name = "Test token";
    const symbol = "TST";
    const depositAmount = new BN(wei("400", "ether"));

    const rewardTokensPerBlock = new BN(3);
    const startDelayBlocks = new BN(1);
    const numberOfBonusBlocks = new BN(50);

    // The % which determines how much will be unlocked immediately.
    /// @dev 10000 is 100%
    const unlockedImmediatelyPercent = new BN(1000); //10%

    let lender, account1, account2, account3, account4;
    let underlyingToken, testWrbtc;
    let SOVToken, token1, token2, token3, liquidityMiningConfigToken;
    let sovryn, loanToken, loanTokenWRBTC;
    let liquidityMiningV1, liquidityMining, migrator, wrapper;
    let rewardTransferLogic, lockedSOVAdmins, lockedSOV;

    before(async () => {
        [lender, account1, account2, account3, account4, ...accounts] = accounts;
        await deployProtocol();
        await deployLoanTokens();

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

        await liquidityMiningV1.setLiquidityMiningV2Address(liquidityMining.address);

        migrator = await Migrator.new();
        await migrator.initialize(
            SOVToken.address,
            liquidityMiningV1.address,
            liquidityMining.address
        );

        await liquidityMining.initialize(wrapper.address, migrator.address);

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

        await loanToken.setLiquidityMiningAddress(liquidityMining.address);
        await loanTokenWRBTC.setLiquidityMiningAddress(liquidityMining.address);

        await liquidityMining.add(loanToken.address, [SOVToken.address], [new BN(10)], false);
        await liquidityMining.add(loanTokenWRBTC.address, [SOVToken.address], [new BN(10)], true);
    });

    describe("Test lending with liquidity mining", () => {
        it("Should lend to the pool and deposit the pool tokens at the liquidity mining contract", async () => {
            //await lend_to_the_pool(loanToken, lender, underlyingToken, testWrbtc, sovryn);
            await underlyingToken.approve(loanToken.address, depositAmount);
            const tx = await loanToken.mint(lender, depositAmount, true);
            const userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
            //expected: user pool token balance is 0, but balance of LM contract increased
            expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
            expect(userInfo.amount).bignumber.equal(depositAmount);
            expect(await loanToken.totalSupply()).bignumber.equal(depositAmount);
            //expect the Mint event to mention the lender
            expectEvent(tx, "Mint", {
                minter: lender,
                tokenAmount: depositAmount,
                assetAmount: depositAmount,
            });
        });

        it("Should lend to the pool without depositing the pool tokens at the liquidity mining contract", async () => {
            await underlyingToken.approve(loanToken.address, depositAmount);
            const tx = await loanToken.mint(lender, depositAmount, false);
            const userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
            //expected: user pool token balance increased by the deposited amount, LM balance stays unchanged
            expect(await loanToken.balanceOf(lender)).bignumber.equal(depositAmount);
            expect(userInfo.amount).bignumber.equal(depositAmount);
            expect(await loanToken.totalSupply()).bignumber.equal(depositAmount.mul(new BN("2")));
        });

        it("Should remove the pool tokens from the liquidity mining pool and burn them", async () => {
            let userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
            const tx = await loanToken.burn(lender, userInfo.amount, true);
            userInfo = await liquidityMining.getUserInfo(loanToken.address, lender);
            //expected: user pool token balance stayed the same but LM balance is 0
            expect(await loanToken.balanceOf(lender)).bignumber.equal(depositAmount);
            expect(userInfo.amount).bignumber.equal("0");
            expect(await loanToken.totalSupply()).bignumber.equal(depositAmount);
            //expect the Burn event to mention the lender
            expectEvent(tx, "Burn", {
                burner: lender,
                tokenAmount: depositAmount,
                assetAmount: depositAmount,
            });
        });

        it("Should burn pool tokens without removing them from the LM pool", async () => {
            await loanToken.burn(lender, depositAmount, false);
            expect(await loanToken.balanceOf(lender)).bignumber.equal("0");
            expect(await loanToken.totalSupply()).bignumber.equal("0");
        });
    });

    describe("Test WRBTC lending with liquidity mining", () => {
        it("Should lend to the pool and deposit the pool tokens at the liquidity mining contract", async () => {
            //await lend_to_the_pool(loanToken, lender, underlyingToken, testWrbtc, sovryn);
            const tx = await loanTokenWRBTC.mintWithBTC(lender, true, { value: depositAmount });
            const userInfo = await liquidityMining.getUserInfo(loanTokenWRBTC.address, lender);
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

        it("Should lend to the pool without depositing the pool tokens at the liquidity mining contract", async () => {
            await loanTokenWRBTC.mintWithBTC(lender, false, { value: depositAmount });
            const userInfo = await liquidityMining.getUserInfo(loanTokenWRBTC.address, lender);
            //expected: user pool token balance increased by the deposited amount, LM balance stays unchanged
            expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal(depositAmount);
            expect(userInfo.amount).bignumber.equal(depositAmount);
            expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(
                depositAmount.mul(new BN("2"))
            );
        });

        it("Should remove the pool tokens from the liquidity mining pool and burn them", async () => {
            let userInfo = await liquidityMining.getUserInfo(loanTokenWRBTC.address, lender);
            const tx = await loanTokenWRBTC.burnToBTC(lender, userInfo.amount, true);
            userInfo = await liquidityMining.getUserInfo(loanTokenWRBTC.address, lender);
            //expected: user pool token balance stayed the same but LM balance is 0
            expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal(depositAmount);
            expect(userInfo.amount).bignumber.equal("0");
            expect(await loanTokenWRBTC.totalSupply()).bignumber.equal(depositAmount);
            //expect the Burn event to mention the lender
            expectEvent(tx, "Burn", {
                burner: lender,
                tokenAmount: depositAmount,
                assetAmount: depositAmount,
            });
        });

        it("Should burn pool tokens without removing them from the LM pool", async () => {
            await loanTokenWRBTC.burnToBTC(lender, depositAmount, false);
            expect(await loanTokenWRBTC.balanceOf(lender)).bignumber.equal("0");
            expect(await loanTokenWRBTC.totalSupply()).bignumber.equal("0");
        });
    });

    describe("Test setting the liquidity mining address", () => {
        it("Should be able to set the liquidity mining address", async () => {
            await loanToken.setLiquidityMiningAddress(account2);
            expect(await loanToken.getLiquidityMiningAddress()).to.be.equal(account2);
        });

        it("Should fail to set the liquidity mining address with an unauthorized wallet", async () => {
            await expectRevert(
                loanToken.setLiquidityMiningAddress(account2, { from: account1 }),
                "unauthorized"
            );
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

    async function deployProtocol() {
        //Token
        underlyingToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        testWrbtc = await TestWrbtc.new();

        const sovrynproxy = await sovrynProtocol.new();
        sovryn = await ISovryn.at(sovrynproxy.address);

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
        await sovryn.setSupportedTokens(
            [underlyingToken.address, testWrbtc.address],
            [true, true]
        );
        await sovryn.setPriceFeedContract(
            feeds.address //priceFeeds
        );
        await sovryn.setSwapsImplContract(
            swaps.address // swapsImpl
        );
        await sovryn.setFeesController(lender);
    }

    async function deployLoanTokens() {
        const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
        loanTokenLogicLM = initLoanTokenLogic[0];
        loanTokenLogicBeaconLM = initLoanTokenLogic[1];
        loanToken = await LoanToken.new(
            lender,
            loanTokenLogicLM.address,
            sovryn.address,
            testWrbtc.address
        );
        await loanToken.initialize(underlyingToken.address, name, symbol); //iToken
        /** Initialize the loan token logic proxy */
        loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
        await loanToken.setBeaconAddress(loanTokenLogicBeaconLM.address);

        /** Use interface of LoanTokenModules */
        loanToken = await ILoanTokenModules.at(loanToken.address);

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
        if (lender == (await sovryn.owner()))
            await sovryn.setLoanPool([loanToken.address], [loanTokenAddress]);

        // --------------- WRBTC -----------------------//

        const initLoanTokenLogicWrbtc = await getLoanTokenLogicWrbtc(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
        loanTokenLogicWrbtc = initLoanTokenLogicWrbtc[0];
        loanTokenLogicBeaconWrbtc = initLoanTokenLogicWrbtc[1];
        loanTokenWRBTC = await LoanToken.new(
            lender,
            loanTokenLogicWrbtc.address,
            sovryn.address,
            testWrbtc.address
        );
        await loanTokenWRBTC.initialize(testWrbtc.address, "iRBTC", "iRBTC");
        /** Initialize the loan token logic proxy */
        loanTokenWRBTC = await ILoanTokenLogicProxy.at(loanTokenWRBTC.address);
        await loanTokenWRBTC.setBeaconAddress(loanTokenLogicBeaconWrbtc.address);
        /** Use interface of LoanTokenModules */
        loanTokenWRBTC = await ILoanTokenModules.at(loanTokenWRBTC.address);

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