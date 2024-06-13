/** Speed optimized on branch hardhatTestRefactor, 2021-09-15
 * Greatest bottlenecks found at:
 * 	- Recurrent deployments on beforeEach
 * Total time elapsed: 20s
 * After optimization: 12s
 *
 * Other minor optimizations:
 *  - removed unused lines of code
 *  - reformatted code comments
 *
 * Notes:
 *   Deployment on beforeEach has been sensibly improved by using a Waffle mixture
 *   that snapshots the repeating scenarios.
 *   Tried to:
 *     Update to use the initializer.js functions for sovryn deployment.
 *       It didn't work.
 *     Update to use initializer.js SUSD.
 *       It works Ok.
 *     Update to use wrappedNativeToken as collateral token, instead of custom testWrappedNativeToken.
 *       It works Ok.
 *     Update to use initializer.js SOV.
 *       It didn't work.
 */

// const { expect } = require("chai");
const { loadFixture, takeSnapshot, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");
const { smock } = require("@defi-wonderland/smock");

const { ZERO_ADDRESS } = constants;

const { etherMantissa, mineBlock, increaseTime, etherGasCost } = require("./Utils/Ethereum");

const {
    deployAndGetIStaking,
    replaceStakingModule,
    getStakingModulesObject,
    getStakingModulesAddressList,
} = require("./Utils/initializer");

const TestToken = artifacts.require("TestToken");

const StakingProxy = artifacts.require("StakingProxy");
const VestingLogic = artifacts.require("VestingLogicMockup");
const Vesting = artifacts.require("TeamVesting");

const ISovryn = artifacts.require("ISovryn");
const Affiliates = artifacts.require("Affiliates");

const Protocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettingsMockup");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanSettings = artifacts.require("LoanSettings");
const LoanClosingsLiquidation = artifacts.require("LoanClosingsLiquidation");
const LoanClosingsRollover = artifacts.require("LoanClosingsRollover");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");

const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const LoanTokenLogicWrbtc = artifacts.require("LoanTokenLogicWrbtc");
const LoanToken = artifacts.require("LoanToken");
const LockedSOV = artifacts.require("LockedSOV");

const FeeSharingCollector = artifacts.require("FeeSharingCollector");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const FeeSharingCollectorMockup = artifacts.require("FeeSharingCollectorMockup");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");

const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry3");

const LiquidityPoolV1Converter = artifacts.require("LiquidityPoolV1ConverterMockup");

const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwapModule");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsExternal = artifacts.require("SwapsExternal");

const WeightedStakingModuleMockup = artifacts.require("WeightedStakingModuleMockup");
const IWeightedStakingModuleMockup = artifacts.require("IWeightedStakingModuleMockup");

const TOTAL_SUPPLY = etherMantissa(1000000000);

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const TWO_WEEKS = 1209600;

const MAX_VOTING_WEIGHT = 10;

const FEE_WITHDRAWAL_INTERVAL = 172800;

const MOCK_PRIOR_WEIGHTED_STAKE = false;

const wei = web3.utils.toWei;

const { lend_btc_before_cashout } = require("./loan-token/helpers");
const mutexUtils = require("../deployment/helpers/reentrancy/utils");

let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.

const MAX_NEXT_POSITIVE_CHECKPOINT = 75;

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanTokenLogic,
    getLoanToken,
    getLoanTokenLogicWrbtc,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    getPriceFeeds,
    getSovryn,
    decodeLogs,
    getSOV,
} = require("./Utils/initializer.js");

contract("FeeSharingCollector:", (accounts) => {
    const name = "Test SOVToken";
    const symbol = "TST";

    let NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT;
    let root, account1, account2, account3, account4;
    let SOVToken, SUSD, WrappedNativeToken, sovryn, staking;
    let loanTokenSettings, loanTokenLogic, loanToken;
    let feeSharingCollectorProxyObj;
    let feeSharingCollector;
    let feeSharingCollectorLogic;
    let loanWrappedNativeToken;
    let tradingFeePercent;
    let mockPrice;
    let liquidityPoolV1Converter;
    let iWeightedStakingModuleMockup;

    before(async () => {
        [root, account1, account2, account3, account4, ...accounts] = accounts;

        try {
            /** Deploy SwapsImplSovrynSwapLib */
            const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
            await LoanMaintenance.link(swapsImplSovrynSwapLib);
            await SwapsExternal.link(swapsImplSovrynSwapLib);
            await LoanClosingsWith.link(swapsImplSovrynSwapLib);
            await LoanClosingsRollover.link(swapsImplSovrynSwapLib);
            await SwapsImplSovrynSwap.link(swapsImplSovrynSwapLib);
        } catch (err) {}
    });

    async function protocolDeploymentFixture(_wallets, _provider) {
        // Need to deploy the mutex in the initialization. Otherwise, the global reentrancy prevention will not be working & throw an error.
        await mutexUtils.getOrDeployMutex();

        // Token
        SOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        // Staking

        // Creating the Staking Instance (Staking Modules Interface).
        const stakingProxy = await StakingProxy.new(SOVToken.address);
        const modulesObject = await getStakingModulesObject();

        staking = await deployAndGetIStaking(stakingProxy.address, modulesObject);

        const weightedStakingModuleMockup = await WeightedStakingModuleMockup.new();
        const modulesAddressList = getStakingModulesAddressList(modulesObject);
        //console.log(modulesAddressList);
        await replaceStakingModule(
            stakingProxy.address,
            modulesAddressList["WeightedStakingModule"],
            weightedStakingModuleMockup.address
        );

        iWeightedStakingModuleMockup = await IWeightedStakingModuleMockup.at(staking.address);

        SUSD = await getSUSD();
        NativeToken = await getRBTC();
        WrappedNativeToken = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WrappedNativeToken, SUSD, NativeToken, BZRX);

        // Deploying sovrynProtocol w/ generic function from initializer.js
        /// @dev Tried but no success so far. When using the getSovryn function
        ///   , contracts revert w/ "target not active" error.
        ///   The weird thing is that deployment code below is exactly the same as
        ///   the code from getSovryn function at initializer.js.
        ///   Inline code works ok, but when calling the function it does not.
        // sovryn = await getSovryn(WrappedNativeToken, SUSD, NativeToken, priceFeeds);
        // await sovryn.setSovrynProtocolAddress(sovryn.address);

        const sovrynproxy = await Protocol.new();
        sovryn = await ISovryn.at(sovrynproxy.address);

        await sovryn.replaceContract((await ProtocolSettings.new()).address);
        await sovryn.replaceContract((await LoanSettings.new()).address);
        await sovryn.replaceContract((await LoanMaintenance.new()).address);
        await sovryn.replaceContract((await SwapsExternal.new()).address);

        await sovryn.setWrbtcToken(WrappedNativeToken.address);

        await sovryn.replaceContract((await LoanClosingsWith.new()).address);
        await sovryn.replaceContract((await LoanClosingsLiquidation.new()).address);
        await sovryn.replaceContract((await LoanClosingsRollover.new()).address);

        await sovryn.replaceContract((await Affiliates.new()).address);

        sovryn = await ProtocolSettings.at(sovryn.address);

        // Loan token
        const initLoanTokenLogic = await getLoanTokenLogic(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
        loanTokenLogic = initLoanTokenLogic[0];
        loanTokenLogicBeacon = initLoanTokenLogic[1];

        loanToken = await LoanToken.new(
            root,
            loanTokenLogic.address,
            sovryn.address,
            WrappedNativeToken.address
        );
        await loanToken.initialize(SUSD.address, "iSUSD", "iSUSD");

        /** Initialize the loan token logic proxy */
        loanToken = await ILoanTokenLogicProxy.at(loanToken.address);
        await loanToken.setBeaconAddress(loanTokenLogicBeacon.address);

        /** Use interface of LoanTokenModules */
        loanToken = await ILoanTokenModules.at(loanToken.address);

        await loanToken.setAdmin(root);
        await sovryn.setLoanPool([loanToken.address], [SUSD.address]);

        feeSharingCollectorLogic = await FeeSharingCollector.new();
        feeSharingCollectorProxyObj = await FeeSharingCollectorProxy.new(
            sovryn.address,
            staking.address
        );
        await feeSharingCollectorProxyObj.setImplementation(feeSharingCollectorLogic.address);
        feeSharingCollector = await FeeSharingCollector.at(feeSharingCollectorProxyObj.address);

        await sovryn.setFeesController(feeSharingCollector.address);

        // Set loan pool for wrappedNativeToken -- because our fee sharing proxy required the loanPool of wrappedNativeToken
        // Loan token
        const initLoanTokenLogicWrbtc = await getLoanTokenLogicWrbtc(); // function will return [LoanTokenLogicProxy, LoanTokenLogicBeacon]
        loanTokenLogicWrbtc = initLoanTokenLogicWrbtc[0];
        loanTokenLogicBeaconWrbtc = initLoanTokenLogicWrbtc[1];

        loanWrappedNativeToken = await LoanToken.new(
            root,
            loanTokenLogicWrbtc.address,
            sovryn.address,
            WrappedNativeToken.address
        );
        await loanWrappedNativeToken.initialize(
            WrappedNativeToken.address,
            "iWrappedNativeToken",
            "iWrappedNativeToken"
        );

        /** Initialize the loan token logic proxy */
        loanWrappedNativeToken = await ILoanTokenLogicProxy.at(loanWrappedNativeToken.address);
        await loanWrappedNativeToken.setBeaconAddress(loanTokenLogicBeaconWrbtc.address);

        /** Use interface of LoanTokenModules */
        loanWrappedNativeToken = await ILoanTokenModules.at(loanWrappedNativeToken.address);

        const loanTokenAddressWrappedNativeToken = await loanWrappedNativeToken.loanTokenAddress();
        await sovryn.setLoanPool(
            [loanWrappedNativeToken.address],
            [loanTokenAddressWrappedNativeToken]
        );

        await WrappedNativeToken.mint(sovryn.address, wei("500", "ether"));

        await sovryn.setWrbtcToken(WrappedNativeToken.address);
        await sovryn.setSOVTokenAddress(SOVToken.address);
        await sovryn.setSovrynProtocolAddress(sovryn.address);

        // Creating the Vesting Instance.
        vestingLogic = await VestingLogic.new();
        vestingFactory = await VestingFactory.new(vestingLogic.address);
        vestingRegistry = await VestingRegistry.new(
            vestingFactory.address,
            SOVToken.address,
            staking.address,
            feeSharingCollector.address,
            root // This should be Governance Timelock Contract.
        );
        vestingFactory.transferOwnership(vestingRegistry.address);

        await sovryn.setLockedSOVAddress(
            (
                await LockedSOV.new(SOVToken.address, vestingRegistry.address, cliff, duration, [
                    root,
                ])
            ).address
        );

        // Set PriceFeeds
        feeds = await PriceFeedsLocal.new(WrappedNativeToken.address, sovryn.address);
        mockPrice = "1";
        await feeds.setRates(SUSD.address, WrappedNativeToken.address, wei(mockPrice, "ether"));
        const swaps = await SwapsImplSovrynSwap.new();
        const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
        await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
        await sovryn.setSupportedTokens([SUSD.address, WrappedNativeToken.address], [true, true]);
        await sovryn.setPriceFeedContract(
            feeds.address // priceFeeds
        );
        await sovryn.setSwapsImplContract(
            swaps.address // swapsImpl
        );

        tradingFeePercent = await sovryn.tradingFeePercent();

        await lend_btc_before_cashout(loanWrappedNativeToken, new BN(wei("10", "ether")), root);

        const maxDisagreement = new BN(wei("5", "ether"));
        await sovryn.setMaxDisagreement(maxDisagreement);

        NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT =
            await feeSharingCollector.NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT();

        await feeSharingCollector.initialize(
            WrappedNativeToken.address,
            loanWrappedNativeToken.address
        );

        return sovryn;
    }

    beforeEach(async () => {
        await loadFixture(protocolDeploymentFixture);
    });

    describe("initialization", async () => {
        it("initialize should revert if wrappedNativeToken has been set", async () => {
            const feeSharingCollectorMock = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await feeSharingCollectorMock.setWrappedNativeToken(WrappedNativeToken.address);
            expect(await feeSharingCollectorMock.wrappedNativeTokenAddress()).to.equal(
                WrappedNativeToken.address
            );

            await expectRevert(
                feeSharingCollectorMock.initialize(
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address
                ),
                "wrappedNativeToken or loanWrappedNativeToken has been initialized"
            );
        });

        it("initialize should revert if iWrappedNativeToken has been set", async () => {
            const feeSharingCollectorMock = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await feeSharingCollectorMock.setWrappedNativeToken(WrappedNativeToken.address);
            expect(await feeSharingCollectorMock.wrappedNativeTokenAddress()).to.equal(
                WrappedNativeToken.address
            );

            await expectRevert(
                feeSharingCollectorMock.initialize(
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address
                ),
                "wrappedNativeToken or loanWrappedNativeToken has been initialized"
            );
        });

        it("revert if initialize called by non-owner account", async () => {
            await expectRevert(
                feeSharingCollector.initialize(
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                    {
                        from: account3,
                    }
                ),
                "unauthorized"
            );
        });

        it("revert if setWrappedNativeToken called by non-owner account", async () => {
            await expectRevert(
                feeSharingCollector.setWrappedNativeToken(WrappedNativeToken.address, {
                    from: account3,
                }),
                "unauthorized"
            );
        });

        it("revert if setLoanWrappedNativeToken called by non-owner account", async () => {
            await expectRevert(
                feeSharingCollector.setLoanWrappedNativeToken(loanWrappedNativeToken.address, {
                    from: account3,
                }),
                "unauthorized"
            );
        });

        it("should revert if initialized more than once", async () => {
            const wrappedNativeTokenAddress = (
                await TestToken.new("WrappedNativeToken", "WNT", 18, 100)
            ).address;
            const loanWrappedNativeTokenAddress = (
                await TestToken.new("IWrappedNativeToken", "IWNT", 18, 100)
            ).address;
            await expectRevert(
                feeSharingCollector.initialize(
                    wrappedNativeTokenAddress,
                    loanWrappedNativeTokenAddress
                ),
                "function can only be called once"
            );
        });

        it("setWrappedNativeToken should revert if try to set non-contract address", async () => {
            expect(await feeSharingCollector.wrappedNativeTokenAddress()).to.equal(
                WrappedNativeToken.address
            );
            let newInvalidWrappedNativeTokenAddress = accounts[0];
            await expectRevert(
                feeSharingCollector.setWrappedNativeToken(newInvalidWrappedNativeTokenAddress),
                "newWrappedNativeTokenAddress not a contract"
            );

            newInvalidWrappedNativeTokenAddress = ZERO_ADDRESS;
            await expectRevert(
                feeSharingCollector.setWrappedNativeToken(newInvalidWrappedNativeTokenAddress),
                "newWrappedNativeTokenAddress not a contract"
            );
            expect(await feeSharingCollector.wrappedNativeTokenAddress()).to.equal(
                WrappedNativeToken.address
            );
        });

        it("setWrappedNativeToken should set the wrappedNativeToken token address properly", async () => {
            expect(await feeSharingCollector.wrappedNativeTokenAddress()).to.equal(
                WrappedNativeToken.address
            );
            const newWrappedNativeTokenAddress = (
                await TestToken.new("WrappedNativeToken", "WNT", 18, 100)
            ).address;
            await feeSharingCollector.setWrappedNativeToken(newWrappedNativeTokenAddress);
            expect(await feeSharingCollector.wrappedNativeTokenAddress()).to.equal(
                newWrappedNativeTokenAddress
            );
        });

        it("setLoanWrappedNativeToken should revert if try to set non-contract addrerss", async () => {
            expect(await feeSharingCollector.loanWrappedNativeTokenAddress()).to.equal(
                loanWrappedNativeToken.address
            );

            let newInvalidLoanWrappedNativeTokenAddress = accounts[0];
            await expectRevert(
                feeSharingCollector.setLoanWrappedNativeToken(
                    newInvalidLoanWrappedNativeTokenAddress
                ),
                "newLoanWrappedNativeTokenAddress not a contract"
            );

            newInvalidLoanWrappedNativeTokenAddress = ZERO_ADDRESS;
            await expectRevert(
                feeSharingCollector.setLoanWrappedNativeToken(
                    newInvalidLoanWrappedNativeTokenAddress
                ),
                "newLoanWrappedNativeTokenAddress not a contract"
            );

            expect(await feeSharingCollector.loanWrappedNativeTokenAddress()).to.equal(
                loanWrappedNativeToken.address
            );
        });

        it("setLoanWrappedNativeToken should set the wrappedNativeToken token address properly", async () => {
            expect(await feeSharingCollector.loanWrappedNativeTokenAddress()).to.equal(
                loanWrappedNativeToken.address
            );
            const newLoanWrappedNativeTokenAddress = (
                await TestToken.new("IWrappedNativeToken", "IWNT", 18, 100)
            ).address;
            await feeSharingCollector.setLoanWrappedNativeToken(newLoanWrappedNativeTokenAddress);
            expect(await feeSharingCollector.loanWrappedNativeTokenAddress()).to.equal(
                newLoanWrappedNativeTokenAddress
            );
        });
    });

    describe("withdrawStartingFromCheckpoint, withdrawNativeTokenStartingFromCheckpoint, withdrawNativeTokenStartingFromCheckpoint using claimAllCollectedFees(), and getNextPositiveUserCheckpoint", () => {
        let snapshot;
        before(async () => {
            await loadFixture(protocolDeploymentFixture);
        });
        beforeEach(async () => {
            snapshot = await takeSnapshot();
        });
        afterEach(async () => {
            await snapshot.restore();
        });

        // If calling withdrawStartingFromCheckpoint or withdrawNativeTokenStartingFromCheckpoint  with _fromCheckpoint > processedCheckpoints[user][_loanPoolToken] it starts calculating the fees from _fromCheckpoint
        it("withdrawStartingFromCheckpoint using claimAllCollectedFees() calculates fees correctly", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpointsSOV(9);
            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())
            await stake(userStake, account1);
            await createCheckpointsSOV(1);

            const tokenBalanceBefore = await SOVToken.balanceOf(account1);
            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            const { checkpointNum } = nextPositive;
            expect(checkpointNum.toNumber()).eql(10);

            const expectedReward = await feeSharingCollector.getAccumulatedFees(
                account1,
                SOVToken.address
            );

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [],
                [
                    {
                        tokenAddress: SOVToken.address,
                        fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                    },
                ],
                3,
                ZERO_ADDRESS,
                { from: account1 }
            );

            const tokenBalanceAfter = await SOVToken.balanceOf(account1);

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                token: SOVToken.address,
                amount: new BN(60),
            });

            expect(tokenBalanceAfter.sub(tokenBalanceBefore).toNumber())
                .eql(expectedReward.toNumber())
                .eql(60);

            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpoints.toNumber()).to.equal(10);
        });

        it("withdrawStartingFromCheckpoint using claimAllCollectedFees() calculates fees correctly for nativeToken & non-nativeToken based tokens", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);
            await createCheckpointsSOV(9);
            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())

            await stake(userStake, account1);
            await createCheckpoints(1);
            await createCheckpointsSOV(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            let nextPositiveSOV = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            const { checkpointNum } = nextPositiveSOV;
            expect(checkpointNum.toNumber()).eql(10);

            const tokenBalanceSOVBefore = await SOVToken.balanceOf(account1);
            const expectedRewardSOV = await feeSharingCollector.getAccumulatedFees(
                account1,
                SOVToken.address
            );

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [],
                [
                    {
                        tokenAddress: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                        fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                    },
                    {
                        tokenAddress: SOVToken.address,
                        fromCheckpoint: nextPositiveSOV.checkpointNum.toNumber(),
                    },
                ],
                3, // 3 max checkpoint is enough to withdraw both NativeToken * SOV Token completely
                ZERO_ADDRESS,
                { from: account1 }
            );

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                amount: new BN(60),
            });

            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.equal(10);

            const tokenBalanceAfter = await SOVToken.balanceOf(account1);
            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                token: SOVToken.address,
                amount: new BN(60),
            });

            expect(tokenBalanceAfter.sub(tokenBalanceSOVBefore).toNumber())
                .eql(expectedRewardSOV.toNumber())
                .eql(60);

            let processedCheckpointsSOV = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpointsSOV.toNumber()).to.equal(10);
        });

        it("withdrawStartingFromCheckpoint using claimAllCollectedFees() calculates fees correctly for nativeToken & non-nativeToken based tokens (withdraw partially)", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);
            await createCheckpointsSOV(9);
            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())

            await stake(userStake, account1);
            await createCheckpoints(1);
            await createCheckpointsSOV(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            let nextPositiveSOV = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            const { checkpointNum } = nextPositiveSOV;
            expect(checkpointNum.toNumber()).eql(10);

            const tokenBalanceSOVBefore = await SOVToken.balanceOf(account1);

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [],
                [
                    {
                        tokenAddress: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                        fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                    },
                    {
                        tokenAddress: SOVToken.address,
                        fromCheckpoint: nextPositiveSOV.checkpointNum.toNumber(),
                    },
                ],
                1, // 1 max checkpoint is only enough to withdraw NativeToken
                ZERO_ADDRESS,
                { from: account1 }
            );

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                amount: new BN(60),
            });

            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.equal(10);

            const tokenBalanceAfter = await SOVToken.balanceOf(account1);

            // SOV Token won't be withdrawn here
            expect(tokenBalanceAfter.toNumber()).eql(tokenBalanceSOVBefore.toNumber());

            let processedCheckpointsSOV = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpointsSOV.toNumber()).to.equal(0);
        });

        it("withdrawStartingFromCheckpoint using claimAllCollectedFees() works with large number of unprocessed token checkpoints", async () => {
            // To test this, create 250 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpointsSOV(9);

            await stake(userStake, account1);
            await createCheckpointsSOV(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [],
                [
                    {
                        tokenAddress: SOVToken.address,
                        fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                    },
                ],
                3,
                ZERO_ADDRESS,
                { from: account1 }
            );

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                token: SOVToken.address,
                amount: new BN(60),
            });

            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpoints.toNumber()).to.equal(10);
        });

        it("should be able to withdraw nativeToken that has skipped checkpoints using claimAllCollectedFees calculates fees correctly (using zero addreses as reciever)", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawNativeTokenStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);

            await stake(userStake, account1);
            await createCheckpoints(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [],
                [
                    {
                        tokenAddress: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                        fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                    },
                ],
                3,
                ZERO_ADDRESS,
                { from: account1 }
            );

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                amount: new BN(60),
            });

            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.equal(10);
        });

        it("withraw nativeToken token that has skipped checkpoints using claimAllCollectedFees() should calculates fees correctly (using actual address as receiver)", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawNativeTokenStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);

            await stake(userStake, account1);
            await createCheckpoints(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [],
                [
                    {
                        tokenAddress: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                        fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                    },
                ],
                3,
                account1,
                { from: account1 }
            );

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                amount: new BN(60),
            });

            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.equal(10);
        });

        it("withdraw nativeToken tokens that has skipped checkpoints using claimAllCollectedFees() won't be processed if passed maxCheckpoints is 0", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawNativeTokenStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);

            await stake(userStake, account1);
            await createCheckpoints(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            await feeSharingCollector.claimAllCollectedFees(
                [],
                [],
                [
                    {
                        tokenAddress: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                        fromCheckpoint: nextPositive.checkpointNum.toNumber(),
                    },
                ],
                0,
                account1,
                { from: account1 }
            );

            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            /** Checkpoints won't be processed, stays at 0 */
            expect(processedCheckpoints.toNumber()).to.equal(0);
        });

        it("withdraw nativeToken tokens that has skipped checkpoints using claimAllCollectedFees() should revert if non-nativeToken token is passed", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawNativeTokenStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpointsSOV(9);

            await stake(userStake, account1);
            await createCheckpointsSOV(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [SOVToken.address],
                    [],
                    3,
                    ZERO_ADDRESS,
                    { from: account1 }
                ),
                "only nativeToken-based tokens are allowed"
            );
        });

        it("should not be able to pass non-nativeToken based token as _nativeTokensRegularWithdraw using claimAllCollectedFees() function", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawNativeTokenStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// NativeToken
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpointsSOV(9);

            await stake(userStake, account1);
            await createCheckpointsSOV(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [SOVToken.address],
                    [],
                    3,
                    ZERO_ADDRESS,
                    { from: account1 }
                ),
                "only nativeToken-based tokens are allowed"
            );
        });

        it("getNextPositiveUserCheckpoint for NativeToken returns the first checkpoint on which the user has a stake > 0", async () => {
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);

            await stake(userStake, account1);
            await createCheckpoints(1);

            const nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(10);
        });

        it("getNextPositiveUserCheckpoint reverts on _maxCheckpoints == 0", async () => {
            await expectRevert(
                feeSharingCollector.getNextPositiveUserCheckpoint(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    0,
                    0
                ),
                "_maxCheckpoints must be > 0"
            );
        });

        it("getNextPositiveUserCheckpoint for SOV returns the first checkpoint on which the user has a stake > 0", async () => {
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpointsSOV(9);

            await stake(userStake, account1);
            await createCheckpointsSOV(1);

            const nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(10);
        });

        it("getNextPositiveUserCheckpoint processing for SOV when user's unprocessed checkpoints > MAX_NEXT_POSITIVE_CHECKPOINT", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);

            // SOV
            // @todo this loop takes a long time. see if can be optimized.
            for (let i = 0; i < 200; i++) {
                await feeSharingCollector.addCheckPoint(SOVToken.address, userStake);
                await increaseTime(FEE_WITHDRAWAL_INTERVAL);
                await mineBlock();
            }

            // await feeSharingCollector.setTotalTokenCheckpoints(SOVToken.address, 250);
            // await feeSharingCollector.addCheckPoint(SOVToken.address, userStake);
            // await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 1);
            // await createCheckpointsSOV(250);

            const userProcessedCheckpoints = (
                await feeSharingCollector.processedCheckpoints(account1, SOVToken.address)
            ).toNumber(); // 0
            const totalTokenCheckpoints = (
                await feeSharingCollector.totalTokenCheckpoints(SOVToken.address)
            ).toNumber();

            const modChunks =
                (totalTokenCheckpoints - userProcessedCheckpoints) % MAX_NEXT_POSITIVE_CHECKPOINT;
            const addChunks = modChunks > 0 ? 1 : 0;
            const chunks =
                parseInt(
                    (totalTokenCheckpoints - userProcessedCheckpoints) /
                        MAX_NEXT_POSITIVE_CHECKPOINT
                ) + addChunks;
            expect(chunks).equal(3);

            let nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(MAX_NEXT_POSITIVE_CHECKPOINT);
            expect(!nextCheckpoint.hasFees);
            expect(!nextCheckpoint.hasSkippedCheckpoints);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                MAX_NEXT_POSITIVE_CHECKPOINT + 1,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(
                MAX_NEXT_POSITIVE_CHECKPOINT * 2 + 1
            );
            expect(!nextCheckpoint.hasFees);
            expect(!nextCheckpoint.hasSkippedCheckpoints);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                MAX_NEXT_POSITIVE_CHECKPOINT * 2 + 1,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(200);
            expect(!nextCheckpoint.hasFees);
            expect(!nextCheckpoint.hasSkippedCheckpoints);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                199,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(200);
            expect(!nextCheckpoint.hasFees);
            expect(!nextCheckpoint.hasSkippedCheckpoints);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                200,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(200);
            expect(!nextCheckpoint.hasFees);
            expect(!nextCheckpoint.hasSkippedCheckpoints);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                250,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(200);
            expect(!nextCheckpoint.hasFees);
            expect(!nextCheckpoint.hasSkippedCheckpoints);

            await stake(userStake, account1);
            await createCheckpointsSOV(1);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                200,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(201);
            expect(nextCheckpoint.hasFees);
            expect(nextCheckpoint.hasSkippedCheckpoints);
        });

        it("claimAllCollectedFees revert if _fromCheckpoint == 0", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);
            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: SOVToken.address,
                            fromCheckpoint: 0,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > 1"
            );

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                            fromCheckpoint: 0,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > 1"
            );
        });

        it("claimAllCollectedFees() revert if _fromCheckpoint < processedCheckpoints[user][_token]", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);
            let rootStake = 900;
            await stake(rootStake, root);
            const userStake = 100;
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);
            await feeSharingCollector.addCheckPoint(SOVToken.address, 100);
            await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 3);
            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: SOVToken.address,
                            fromCheckpoint: 3,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > userProcessedCheckpoints"
            );

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: SOVToken.address,
                            fromCheckpoint: 2,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > userProcessedCheckpoints"
            );

            await feeSharingCollector.setUserProcessedCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                2
            );

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                            fromCheckpoint: 2,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > userProcessedCheckpoints"
            );

            await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 2);

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: SOVToken.address,
                            fromCheckpoint: 2,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > userProcessedCheckpoints"
            );
        });

        it("claimAllCollectedFees() revert if the user had a stake > 0 at _fromCheckpoint - 1", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            let rootStake = 800;
            await stake(rootStake, root);
            const userStake = 100;
            await SOVToken.transfer(account1, userStake * 2);
            await stake(userStake, account1);

            // SOV
            for (let i = 0; i < 2; i++) {
                await feeSharingCollector.addCheckPoint(SOVToken.address, userStake);
                await increaseTime(FEE_WITHDRAWAL_INTERVAL);
                await mineBlock();
            }
            await feeSharingCollector.addCheckPoint(SOVToken.address, userStake);

            await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 1);
            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: SOVToken.address,
                            fromCheckpoint: 2,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "User weighted stake should be zero at previous checkpoint"
            );

            // NativeToken
            for (let i = 0; i < 2; i++) {
                await feeSharingCollector.addCheckPoint(
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    userStake
                );
                await increaseTime(FEE_WITHDRAWAL_INTERVAL);
                await mineBlock();
            }
            await feeSharingCollector.addCheckPoint(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                userStake
            );
            await feeSharingCollector.setUserProcessedCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                1
            );
            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                            fromCheckpoint: 2,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "User weighted stake should be zero at previous checkpoint"
            );
        });

        it("withdrawStartingFromCheckpoint using claimAllCollectedFees() revert if _fromCheckpoint <= totalTokenCheckpoints[_token]", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);
            let rootStake = 900;
            await stake(rootStake, root);
            const userStake = 100;
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);
            await feeSharingCollector.addCheckPoint(SOVToken.address, 100);
            await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 3);
            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [],
                    [
                        {
                            tokenAddress: SOVToken.address,
                            fromCheckpoint: 100,
                        },
                    ],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint should be <= totalTokenCheckpoints"
            );
        });
    });

    describe("getNextPositiveUserCheckpoint", () => {
        before(async () => {
            await loadFixture(protocolDeploymentFixture);
        });
        beforeEach(async () => {
            snapshot = await takeSnapshot();
        });
        afterEach(async () => {
            // after doing some changes, you can restore to the state of the snapshot
            await snapshot.restore();
        });
        it("getNextPositiveUserCheckpoint for SOV returns correct [checkpointNum, hasSkippedCheckpoints, hasFees]", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            let nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([0, false, false]);

            await stake(900, root);
            const userStake = 100;

            await createCheckpointsSOV(9);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([9, true, false]);

            await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 9);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([9, false, false]);

            // undo mock user processed checkpoints
            await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 0);

            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);
            await createCheckpointsSOV(1);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([10, true, true]);
        });

        it("getNextPositiveUserCheckpoint for NativeToken returns correct [checkpointNum, hasSkippedCheckpoints, hasFees]", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await feeSharingCollector.initialize(
                WrappedNativeToken.address,
                loanWrappedNativeToken.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            let nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([0, false, false]);

            await stake(900, root);
            const userStake = 100;
            await createCheckpoints(9);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([9, true, false]);

            await feeSharingCollector.setUserProcessedCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                9
            );

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([9, false, false]);

            // undo mock user processed checkpoints
            await feeSharingCollector.setUserProcessedCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );

            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);
            await createCheckpoints(1);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([10, true, true]);
        });
    });

    describe("feeSharingCollector functions", () => {
        let snapshot;
        before(async () => {
            await loadFixture(protocolDeploymentFixture);
        });
        beforeEach(async () => {
            snapshot = await takeSnapshot();
        });
        afterEach(async () => {
            await snapshot.restore();
        });
        it("numTokenCheckpoints returns value of totalTokenCheckpoints", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await feeSharingCollector.setTotalTokenCheckpoints(SOVToken.address, 3);
            expect((await feeSharingCollector.totalTokenCheckpoints(SOVToken.address)).toNumber())
                .equal(
                    (await feeSharingCollector.numTokenCheckpoints(SOVToken.address)).toNumber()
                )
                .equal(3);

            await feeSharingCollector.setTotalTokenCheckpoints(SOVToken.address, 0);
            expect((await feeSharingCollector.totalTokenCheckpoints(SOVToken.address)).toNumber())
                .equal(
                    (await feeSharingCollector.numTokenCheckpoints(SOVToken.address)).toNumber()
                )
                .equal(0);

            await feeSharingCollector.setTotalTokenCheckpoints(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                5
            );
            expect(
                (
                    await feeSharingCollector.totalTokenCheckpoints(
                        NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                    )
                ).toNumber()
            )
                .equal(
                    (
                        await feeSharingCollector.numTokenCheckpoints(
                            NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                        )
                    ).toNumber()
                )
                .equal(5);
        });
    });

    describe("FeeSharingCollectorProxy", () => {
        before(async () => {
            await loadFixture(protocolDeploymentFixture);
        });
        beforeEach(async () => {
            snapshot = await takeSnapshot();
        });
        afterEach(async () => {
            await snapshot.restore();
        });
        it("Check owner & implementation", async () => {
            const proxyOwner = await feeSharingCollectorProxyObj.getProxyOwner();
            const implementation = await feeSharingCollectorProxyObj.getImplementation();

            expect(implementation).to.be.equal(feeSharingCollectorLogic.address);
            expect(proxyOwner).to.be.equal(root);
        });

        it("Set new implementation", async () => {
            const newFeeSharingCollector = await FeeSharingCollector.new();
            await feeSharingCollectorProxyObj.setImplementation(newFeeSharingCollector.address);
            const newImplementation = await feeSharingCollectorProxyObj.getImplementation();

            expect(newImplementation).to.be.equal(newFeeSharingCollector.address);
        });

        it("fallback function should success", async () => {
            const newFeeSharingCollector = await FeeSharingCollector.new();
            const amount = wei("2", "ether");
            await feeSharingCollectorProxyObj.setImplementation(newFeeSharingCollector.address);
            await feeSharingCollectorProxyObj.send(amount);

            expect(
                (await web3.eth.getBalance(feeSharingCollectorProxyObj.address)).toString()
            ).to.equal(amount);
        });
    });

    describe("withdrawFees", () => {
        it("Shouldn't be able to use zero token address", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.withdrawFees([ZERO_ADDRESS]),
                "FeeSharingCollector::withdrawFees: token is not a contract"
            );
        });

        it("Withdraw zero amount will success with the proper emitted event", async () => {
            await protocolDeploymentFixture();
            const tx = await feeSharingCollector.withdrawFees([SUSD.address]);
            expectEvent(tx, "FeeWithdrawnInNativeToken", {
                sender: root,
                amount: new BN(0),
            });
        });

        it("ProtocolSettings.withdrawFees", async () => {
            /// @dev This test requires redeploying the protocol
            const protocol = await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);

            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );
            let previousProtocolWrappedNativeTokenBalance = await WrappedNativeToken.balanceOf(
                protocol.address
            );
            // let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            await protocol.setFeesController(root);
            let tx = await protocol.withdrawFees([SUSD.address], root);
            let latestProtocolWrappedNativeTokenBalance = await WrappedNativeToken.balanceOf(
                protocol.address
            );

            await checkWithdrawFee();

            //check wrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let userBalance = await WrappedNativeToken.balanceOf.call(root);
            expect(userBalance.toString()).to.be.equal(feeAmount.toString());

            // wrappedNativeToken balance should remain the same
            expect(previousProtocolWrappedNativeTokenBalance.toString()).to.equal(
                latestProtocolWrappedNativeTokenBalance.toString()
            );

            expectEvent(tx, "WithdrawFees", {
                sender: root,
                token: SUSD.address,
                receiver: root,
                lendingAmount: lendingFeeTokensHeld,
                tradingAmount: tradingFeeTokensHeld,
                borrowingAmount: borrowingFeeTokensHeld,
                // amountConvertedToWrappedNativeToken
            });
        });

        it("ProtocolSettings.withdrawFees (WrappedNativeToken token)", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            //mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);

            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld,
                true
            );
            // let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            await sovryn.setFeesController(root);
            let tx = await sovryn.withdrawFees([WrappedNativeToken.address], account1);

            await checkWithdrawFee(true, true, false);

            //check WrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let userBalance = await WrappedNativeToken.balanceOf.call(account1);
            expect(userBalance.toString()).to.be.equal(feeAmount.toString());

            expectEvent(tx, "WithdrawFees", {
                sender: root,
                token: WrappedNativeToken.address,
                receiver: account1,
                lendingAmount: lendingFeeTokensHeld,
                tradingAmount: tradingFeeTokensHeld,
                borrowingAmount: borrowingFeeTokensHeld,
                wrappedNativeTokenConverted: new BN(feeAmount),
            });
        });

        /// @dev Test coverage
        it("ProtocolSettings.withdrawFees: Revert withdrawing by no feesController", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            // mock data
            let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));

            await sovryn.setFeesController(root);

            await expectRevert(
                sovryn.withdrawFees([SUSD.address], account1, { from: account1 }),
                "unauthorized"
            );
        });

        it("Should be able to withdraw fees", async () => {
            /// @dev This test requires redeploying the protocol
            const protocol = await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );
            let previousProtocolWrappedNativeTokenBalance = await WrappedNativeToken.balanceOf(
                protocol.address
            );
            let previousFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );

            tx = await feeSharingCollector.withdrawFees([SUSD.address]);

            await checkWithdrawFee();

            //check iNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            // feeSharingCollector no longer provides the liquidity to lending pool.
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingCollectorProxyWrappedNativeTokenBalance =
                await WrappedNativeToken.balanceOf.call(feeSharingCollector.address);
            expect(feeSharingCollectorProxyWrappedNativeTokenBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            // wrappedNativeToken balance should remain the same
            let latestProtocolWrappedNativeTokenBalance = await WrappedNativeToken.balanceOf(
                protocol.address
            );
            expect(previousProtocolWrappedNativeTokenBalance.toString()).to.equal(
                latestProtocolWrappedNativeTokenBalance.toString()
            );

            // nativeToken balance of feeSharingCollector should be increased
            let latestFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(
                previousFeeSharingCollectorProxyNativeTokenBalance
                    .add(new BN(feeAmount))
                    .toString()
            ).to.equal(latestFeeSharingCollectorProxyNativeTokenBalance.toString());

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());
            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "FeeWithdrawnInNativeToken", {
                sender: root,
                amount: feeAmount,
            });
        });

        it("Should be able to withdraw fees (WrappedNativeToken token)", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            //mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld,
                true
            );

            let previousFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );

            tx = await feeSharingCollector.withdrawFees([WrappedNativeToken.address]);

            await checkWithdrawFee();

            //check iNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingCollectorProxyWrappedNativeTokenBalance =
                await WrappedNativeToken.balanceOf.call(feeSharingCollector.address);
            expect(feeSharingCollectorProxyWrappedNativeTokenBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            // nativeToken balance of feeSharingCollector should be increased
            let latestFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(
                previousFeeSharingCollectorProxyNativeTokenBalance
                    .add(new BN(feeAmount))
                    .toString()
            ).to.equal(latestFeeSharingCollectorProxyNativeTokenBalance.toString());

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "FeeWithdrawnInNativeToken", {
                sender: root,
                amount: feeAmount,
            });
        });

        it("Should be able to withdraw fees (sov token)", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            //mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld,
                false,
                true
            );

            let previousFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );

            tx = await feeSharingCollector.withdrawFees([SOVToken.address]);

            await checkWithdrawFee(false, false, true);

            //check WrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal(feeAmount.toString());

            // special for SOV token, it won't be converted into nativeToken, instead it will directly transfer SOV to feeSharingCollector.
            // so the nativeToken balance should remain the same.
            let latestFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(previousFeeSharingCollectorProxyNativeTokenBalance.toString()).to.equal(
                latestFeeSharingCollectorProxyNativeTokenBalance.toString()
            );

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingCollectorProxyWrappedNativeTokenBalance =
                await WrappedNativeToken.balanceOf.call(feeSharingCollector.address);
            expect(feeSharingCollectorProxyWrappedNativeTokenBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                SOVToken.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(SOVToken.address, 0);
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                SOVToken.address
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "TokensTransferred", {
                sender: sovryn.address,
                token: SOVToken.address,
                amount: feeAmount,
            });
        });

        it("Should be able to withdraw fees 3 times", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(1000, root);

            // [FIRST]
            // mock data
            let mockAmountLendingFeeTokensHeld = 0;
            let mockAmountTradingFeeTokensHeld = 1;
            let mockAmountBorrowingFeeTokensHeld = 2;
            let totalMockAmount1 =
                mockAmountLendingFeeTokensHeld +
                mockAmountTradingFeeTokensHeld +
                mockAmountBorrowingFeeTokensHeld;
            let lendingFeeTokensHeld = new BN(mockAmountLendingFeeTokensHeld);
            let tradingFeeTokensHeld = new BN(
                wei(mockAmountTradingFeeTokensHeld.toString(), "ether")
            );
            let borrowingFeeTokensHeld = new BN(
                wei(mockAmountBorrowingFeeTokensHeld.toString(), "ether")
            );
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );
            let totalFeeAmount = feeAmount;

            let tx = await feeSharingCollector.withdrawFees([SUSD.address]);

            await checkWithdrawFee();

            // check WrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            // [SECOND]
            // mock data
            let mockAmountLendingFeeTokensHeld2 = 1;
            let mockAmountTradingFeeTokensHeld2 = 0;
            let mockAmountBorrowingFeeTokensHeld2 = 0;
            let totalMockAmount2 =
                mockAmountTradingFeeTokensHeld2 +
                mockAmountBorrowingFeeTokensHeld2 +
                mockAmountLendingFeeTokensHeld2;
            lendingFeeTokensHeld = new BN(
                wei(mockAmountLendingFeeTokensHeld2.toString(), "ether")
            );
            tradingFeeTokensHeld = new BN(mockAmountTradingFeeTokensHeld2);
            borrowingFeeTokensHeld = new BN(mockAmountBorrowingFeeTokensHeld2);
            totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );
            let unprocessedAmount = feeAmount;
            totalFeeAmount = totalFeeAmount.add(feeAmount);

            tx = await feeSharingCollector.withdrawFees([SUSD.address]);

            // Need to checkwithdrawfee manually
            await checkWithdrawFee();

            // check WrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // [THIRD]
            // mock data
            let mockAmountLendingFeeTokensHeld3 = 0;
            let mockAmountTradingFeeTokensHeld3 = 0.5;
            let mockAmountBorrowingFeeTokensHeld3 = 0.5;
            let totalMockAmount3 =
                mockAmountTradingFeeTokensHeld3 +
                mockAmountBorrowingFeeTokensHeld3 +
                mockAmountLendingFeeTokensHeld3;
            lendingFeeTokensHeld = new BN(mockAmountLendingFeeTokensHeld3);
            tradingFeeTokensHeld = new BN(
                wei(mockAmountTradingFeeTokensHeld3.toString(), "ether")
            );
            borrowingFeeTokensHeld = new BN(
                wei(mockAmountBorrowingFeeTokensHeld3.toString(), "ether")
            );
            totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );
            totalFeeAmount = totalFeeAmount.add(feeAmount);

            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            tx = await feeSharingCollector.withdrawFees([SUSD.address]);
            // In this state the price of SUSD/WrappedNativeToken already adjusted because of previous swap, so we need to consider this in the next swapFee calculation
            await checkWithdrawFee();

            // check WrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // checkpoints
            totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                1
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(
                feeAmount.add(unprocessedAmount).toString()
            );

            // check lastFeeWithdrawalTime
            lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingCollectorProxyWrappedNativeTokenBalance =
                await WrappedNativeToken.balanceOf.call(feeSharingCollector.address);
            expect(feeSharingCollectorProxyWrappedNativeTokenBalance.toString()).to.be.equal(
                new BN(0).toString()
            );
        });
    });

    describe("transferTokens", () => {
        it("Shouldn't be able to use zero token address", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.transferTokens(ZERO_ADDRESS, 1000),
                "FeeSharingCollector::transferTokens: invalid address"
            );
        });

        it("Shouldn't be able to transfer zero amount", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.transferTokens(SOVToken.address, 0),
                "FeeSharingCollector::transferTokens: invalid amount"
            );
        });

        it("Shouldn't be able to withdraw zero amount", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.transferTokens(SOVToken.address, 1000),
                "invalid transfer"
            );
        });

        it("Should be able to transfer tokens", async () => {
            await protocolDeploymentFixture();
            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            let amount = 1000;
            await SOVToken.approve(feeSharingCollector.address, amount * 7);

            let tx = await feeSharingCollector.transferTokens(SOVToken.address, amount);

            expect(
                await feeSharingCollector.unprocessedAmount.call(SOVToken.address)
            ).to.be.bignumber.equal(new BN(0));

            expectEvent(tx, "TokensTransferred", {
                sender: root,
                token: SOVToken.address,
                amount: new BN(amount),
            });

            // checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                SOVToken.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(SOVToken.address, 0);
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(amount.toString());

            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                SOVToken.address
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "CheckpointAdded", {
                sender: root,
                token: SOVToken.address,
                amount: new BN(amount),
            });

            // second time
            tx = await feeSharingCollector.transferTokens(SOVToken.address, amount * 2);

            expect(
                await feeSharingCollector.unprocessedAmount.call(SOVToken.address)
            ).to.be.bignumber.equal(new BN(amount * 2));

            expectEvent(tx, "TokensTransferred", {
                sender: root,
                token: SOVToken.address,
                amount: new BN(amount * 2),
            });

            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            // third time
            tx = await feeSharingCollector.transferTokens(SOVToken.address, amount * 4);

            expect(
                await feeSharingCollector.unprocessedAmount.call(SOVToken.address)
            ).to.be.bignumber.equal(new BN(0));

            // checkpoints
            totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                SOVToken.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await feeSharingCollector.tokenCheckpoints.call(SOVToken.address, 1);
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toNumber()).to.be.equal(amount * 6);

            // check lastFeeWithdrawalTime
            lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                SOVToken.address
            );
            block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());
        });
    });

    describe("withdraw", () => {
        it("Shouldn't be able to withdraw without checkpoints (for token pool)", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.withdraw(loanToken.address, 0, account2, {
                    from: account1,
                }),
                "FeeSharingCollector::withdraw: _maxCheckpoints should be positive"
            );
        });

        it("Shouldn't be able to withdraw without checkpoints (for wrappedNativeToken pool)", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.withdraw(loanWrappedNativeToken.address, 0, account2, {
                    from: account1,
                }),
                "FeeSharingCollector::withdraw: _maxCheckpoints should be positive"
            );
        });

        it("getAllUserFees should revert if maxCheckpoint is 0", async () => {
            await protocolDeploymentFixture();
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);

            await stake(userStake, account1);
            await createCheckpoints(1);

            let nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(10);

            await expectRevert(
                feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    10,
                    0
                ),
                "_maxCheckpoints must be > 0"
            );
        });

        it("getAllUserFees should return empty fees if no checkpoint can be processed", async () => {
            await protocolDeploymentFixture();
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            let nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect([
                nextCheckpoint.checkpointNum.toNumber(),
                nextCheckpoint.hasSkippedCheckpoints,
                nextCheckpoint.hasFees,
            ]).to.eql([0, false, false]);

            const allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            expect(allUserFees.length).to.eq(1);
            expect(allUserFees[0]).to.eq(0);
        });

        it("getAllUserFees should return correct fees after withdrawal", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            //mock data
            let lendingFeeTokensHeld = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld = new BN(wei("3", "gwei"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld,
                false,
                true
            );

            await feeSharingCollector.withdrawFees([SOVToken.address]);

            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())

            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            let allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                SOVToken.address,
                0,
                100
            );

            expect(allUserFees.length).to.equal(1);
            expect(allUserFees[0]).to.equal(fees.toString());

            let userInitialISOVBalance = await SOVToken.balanceOf(account1);
            let tx = await feeSharingCollector.withdraw(SOVToken.address, 10, ZERO_ADDRESS, {
                from: account1,
            });

            //processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            //check balances
            let feeSharingCollectorProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
            let userBalance = await SOVToken.balanceOf.call(account1);
            expect(userBalance.sub(userInitialISOVBalance).toNumber()).to.be.equal(
                (feeAmount * 3) / 10
            );

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account1,
                token: SOVToken.address,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });

            allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                SOVToken.address,
                0,
                100
            );

            expect(allUserFees.length).to.equal(1);
            expect(allUserFees[0]).to.equal(0);
        });

        it("getAllUserFees should return correct fees after withdrawal (Native Tokens) - with 1 iteration", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            await stake(900, root);
            let userStake = 100;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            await createCheckpoints(10);

            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );

            let allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                10000000
            );

            expect(allUserFees.length).to.equal(1);
            expect(allUserFees[0].toString()).to.equal(fees.toString());

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [],
                1000,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            console.log("\nwithdraw(checkpoints = 10).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(10);

            allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                10,
                1000
            );

            expect(allUserFees.length).to.equal(0);
        });

        it("getAllUserFees should return correct fees after withdrawal (Native Tokens) - with multiple iterations (1 maxCheckpoint)", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            const checkpoints = 10;
            const maxCheckpoint = 1;

            // stake - getPriorTotalVotingPower
            await stake(900, root);
            let userStake = 100;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            await createCheckpoints(checkpoints);

            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())

            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let iteration = 0;

            for (let i = 0; i < totalCheckpoints; i += maxCheckpoint) {
                iteration += 1;
            }

            let allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                maxCheckpoint
            );

            expect(allUserFees.length).to.equal(iteration);

            let feesIndex = 0;
            for (let i = 0; i < totalCheckpoints; i += maxCheckpoint) {
                const fees = await feeSharingCollector.getAccumulatedFeesForCheckpointsRange(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    i,
                    maxCheckpoint
                );
                expect(allUserFees[feesIndex].toString()).to.equal(fees.toString());
                feesIndex++;
            }

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [],
                1000,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            console.log("\nwithdraw(checkpoints = 10).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(10);

            allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                10,
                1
            );

            expect(allUserFees.length).to.equal(0);
        });

        it("getAllUserFees should return correct fees after withdrawal (Native Tokens) - with multiple iterations (2 maxCheckpoint)", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            const checkpoints = 10;
            const maxCheckpoint = 2;

            // stake - getPriorTotalVotingPower
            await stake(900, root);
            let userStake = 100;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            await createCheckpoints(checkpoints);

            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())

            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let iteration = 0;

            for (let i = 0; i < totalCheckpoints; i += maxCheckpoint) {
                iteration += 1;
            }

            let allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                maxCheckpoint
            );

            expect(allUserFees.length).to.equal(iteration);

            let feesIndex = 0;
            for (let i = 0; i < totalCheckpoints; i += maxCheckpoint) {
                const fees = await feeSharingCollector.getAccumulatedFeesForCheckpointsRange(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    i,
                    maxCheckpoint
                );
                expect(allUserFees[feesIndex].toString()).to.equal(fees.toString());
                feesIndex++;
            }

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [],
                1000,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            console.log("\nwithdraw(checkpoints = 10).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(10);

            allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                10,
                1
            );

            expect(allUserFees.length).to.equal(0);
        });

        it("getAllUserFees should return correct fees after withdrawal (Native Tokens) - with multiple iterations (3 maxCheckpoint)", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            const checkpoints = 10;
            const maxCheckpoint = 3;

            // stake - getPriorTotalVotingPower
            await stake(900, root);
            let userStake = 100;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            await createCheckpoints(checkpoints);

            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())

            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let iteration = 0;

            for (let i = 0; i < totalCheckpoints; i += maxCheckpoint) {
                iteration += 1;
            }

            let allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                maxCheckpoint
            );

            expect(allUserFees.length).to.equal(iteration);

            let feesIndex = 0;
            for (let i = 0; i < totalCheckpoints; i += maxCheckpoint) {
                const fees = await feeSharingCollector.getAccumulatedFeesForCheckpointsRange(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    i,
                    maxCheckpoint
                );
                expect(allUserFees[feesIndex].toString()).to.equal(fees.toString());
                feesIndex++;
            }

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [],
                1000,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            console.log("\nwithdraw(checkpoints = 10).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(10);

            allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                10,
                1
            );

            expect(allUserFees.length).to.equal(0);
        });

        it("getAllUserFees should return correct fees after withdrawal (Native Tokens) - starting from > 0 checkpoints", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            const checkpoints = 10;
            const maxCheckpoint = 3;

            // stake - getPriorTotalVotingPower
            await stake(900, root);
            let userStake = 100;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            await createCheckpoints(checkpoints);

            await mine(2880 * 15, { interval: 30 }); // 86400 (1day) / 30 == 2800 * 15 (2 weeks + 1 day - for weighted stake to be updated in cache of FeeSharingCollector._getAccumulatedFees())

            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let iteration = 0;

            for (let i = 0; i < totalCheckpoints; i += maxCheckpoint) {
                iteration += 1;
            }

            let allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                maxCheckpoint
            );

            expect(allUserFees.length).to.equal(iteration);

            let feesIndex = 0;
            for (let i = 0; i < totalCheckpoints; i += maxCheckpoint) {
                const fees = await feeSharingCollector.getAccumulatedFeesForCheckpointsRange(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    i,
                    maxCheckpoint
                );
                expect(allUserFees[feesIndex].toString()).to.equal(fees.toString());
                feesIndex++;
            }

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [],
                2,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            console.log("\nwithdraw(checkpoints = 10).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(2);

            allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                2,
                100
            );

            expect(allUserFees.length).to.equal(1);

            let tempMaxCheckpoint = 100;
            let expectedIteration = 0;
            for (let i = 2; i < totalCheckpoints; i += tempMaxCheckpoint) {
                expectedIteration++;
            }
            allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                2,
                tempMaxCheckpoint
            );

            expect(allUserFees.length).to.equal(expectedIteration);

            tempMaxCheckpoint = 2;
            expectedIteration = 0;
            for (let i = 2; i < totalCheckpoints; i += tempMaxCheckpoint) {
                expectedIteration++;
            }
            allUserFees = await feeSharingCollector.getAllUserFeesPerMaxCheckpoints(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                2,
                tempMaxCheckpoint
            );

            expect(allUserFees.length).to.equal(expectedIteration);
        });

        it("Shifts user's processed checkpoints to max checkpoints if no fees due within max checkpoints and no previous checkpoints", async () => {
            await protocolDeploymentFixture();
            await stake(900, root);
            await createCheckpointsSOV(10);
            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            let feesByCheckpointsRange =
                await feeSharingCollector.getAccumulatedFeesForCheckpointsRange(
                    account1,
                    SOVToken.address,
                    0,
                    0
                );
            expect(fees).to.be.bignumber.equal("0");
            expect(feesByCheckpointsRange).to.be.bignumber.equal("0");

            const tx = await feeSharingCollector.withdraw(SOVToken.address, 9, ZERO_ADDRESS, {
                from: account1,
            });
            expectEvent(tx, "UserFeeProcessedNoWithdraw", {
                sender: account1,
                token: SOVToken.address,
                prevProcessedCheckpoints: new BN(0),
                newProcessedCheckpoints: new BN(9),
            });
        });

        it("Shifts user's processed checkpoints to max checkpoints if no fees due within max checkpoints and no previous checkpoints - using claimAllCollectedFees()", async () => {
            await protocolDeploymentFixture();
            await stake(900, root);
            await createCheckpointsSOV(10);
            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            let feesByCheckpointsRange =
                await feeSharingCollector.getAccumulatedFeesForCheckpointsRange(
                    account1,
                    SOVToken.address,
                    0,
                    0
                );
            expect(fees).to.be.bignumber.equal("0");
            expect(feesByCheckpointsRange).to.be.bignumber.equal("0");

            const tx = await feeSharingCollector.claimAllCollectedFees(
                [SOVToken.address],
                [],
                [],
                9,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            expectEvent(tx, "UserFeeProcessedNoWithdraw", {
                sender: account1,
                token: SOVToken.address,
                prevProcessedCheckpoints: new BN(0),
                newProcessedCheckpoints: new BN(9),
            });
        });

        it("Shifts user's processed checkpoints to max if no fees due within max checkpoints and exist user's  previous checkpoints", async () => {
            await protocolDeploymentFixture();
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            await stake(900, root);
            await createCheckpointsSOV(10);

            await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 2);

            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            expect(fees).to.be.bignumber.equal("0");

            // const { amount, end } = await feeSharingCollector.getFullAccumulatedFees(
            //     account1,
            //     SOVToken.address,
            //     11
            // );
            // console.log(" amount, end:", amount.toNumber(), end.toNumber());

            // maxCheckpoints (20) + processedUserCheckpoints(0) > totalTokenCheckpoints (10)
            let tx = await feeSharingCollector.trueWithdraw(SOVToken.address, 20, ZERO_ADDRESS, {
                from: account1,
            });
            expectEvent(tx, "UserFeeProcessedNoWithdraw", {
                sender: account1,
                token: SOVToken.address,
                prevProcessedCheckpoints: new BN(2),
                newProcessedCheckpoints: new BN(10),
            });

            // maxCheckpoints (8) + processedUserCheckpoints(10) < totalTokenCheckpoints (25)
            await createCheckpointsSOV(15);
            tx = await feeSharingCollector.trueWithdraw(SOVToken.address, 8, ZERO_ADDRESS, {
                from: account1,
            });

            expectEvent(tx, "UserFeeProcessedNoWithdraw", {
                sender: account1,
                token: SOVToken.address,
                prevProcessedCheckpoints: new BN(10),
                newProcessedCheckpoints: new BN(18),
            });

            // maxCheckpoints (7) + processedUserCheckpoints(18) ===  totalTokenCheckpoints (25)
            tx = await feeSharingCollector.trueWithdraw(SOVToken.address, 7, ZERO_ADDRESS, {
                from: account1,
            });

            expectEvent(tx, "UserFeeProcessedNoWithdraw", {
                sender: account1,
                token: SOVToken.address,
                prevProcessedCheckpoints: new BN(18),
                newProcessedCheckpoints: new BN(25),
            });
        });

        it("Shouldn't be able to withdraw zero amount (for token pool)", async () => {
            await protocolDeploymentFixture();
            let fees = await feeSharingCollector.getAccumulatedFees(account1, loanToken.address);
            expect(fees).to.be.bignumber.equal("0");

            await expectRevert(
                feeSharingCollector.withdraw(loanToken.address, 10, ZERO_ADDRESS, {
                    from: account1,
                }),
                "FeeSharingCollector::withdrawFees: no tokens for withdrawal"
            );
        });

        it("Shouldn't be able to withdraw zero amount (for token pool) - using claimAllCollectedFees()", async () => {
            await protocolDeploymentFixture();
            let fees = await feeSharingCollector.getAccumulatedFees(account1, loanToken.address);
            expect(fees).to.be.bignumber.equal("0");

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [loanToken.address],
                    [],
                    [],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "FeeSharingCollector::withdrawFees: no tokens for withdrawal"
            );
        });

        it("Shouldn't be able to withdraw zero amount (for wrappedNativeToken pool)", async () => {
            await protocolDeploymentFixture();
            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                loanWrappedNativeToken.address
            );
            expect(fees).to.be.bignumber.equal("0");

            await expectRevert(
                feeSharingCollector.withdraw(loanWrappedNativeToken.address, 10, ZERO_ADDRESS, {
                    from: account1,
                }),
                "FeeSharingCollector::withdrawFees: no tokens for withdrawal"
            );
        });

        it("Shouldn't be able to withdraw zero amount (for wrappedNativeToken pool) - using claimAllCollectedFees()", async () => {
            await protocolDeploymentFixture();
            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                loanWrappedNativeToken.address
            );
            expect(fees).to.be.bignumber.equal("0");

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [loanWrappedNativeToken.address],
                    [],
                    [],
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "FeeSharingCollector::withdrawFees: no tokens for withdrawal"
            );
        });

        it("Should not be able to pass non-nativeToken based token as _nativeTokensRegularWithdraw in claimAllCollectedFees() function", async () => {
            await protocolDeploymentFixture();
            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );

            await feeSharingCollector.withdrawFees([SUSD.address]);

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(new BN(feeAmount).mul(new BN(3)).div(new BN(10)));

            await expectRevert(
                feeSharingCollector.claimAllCollectedFees(
                    [],
                    [SOVToken.address],
                    [],
                    1000,
                    account2,
                    {
                        from: account1,
                    }
                ),
                "only nativeToken-based tokens are allowed"
            );
        });

        it("Should be able to withdraw to another account using claimAllCollectedFees()", async () => {
            await protocolDeploymentFixture();
            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );

            await feeSharingCollector.withdrawFees([SUSD.address]);

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(new BN(feeAmount).mul(new BN(3)).div(new BN(10)));

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [],
                1000,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let [
                processedCheckpointsNativeToken,
                processedCheckpointsWrappedNativeToken,
                processedCheckpointsIWrappedNativeToken,
            ] = await Promise.all([
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    WrappedNativeToken.address
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    loanWrappedNativeToken.address
                ),
            ]);

            expect(processedCheckpointsNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWrappedNativeToken.toNumber()).to.be.equal(0);
            expect(processedCheckpointsIWrappedNativeToken.toNumber()).to.be.equal(0);

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw (token pool)", async () => {
            await protocolDeploymentFixture();
            // FeeSharingCollectorProxy
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // Mock (transfer loanToken to FeeSharingCollectorProxy contract)
            const loanPoolTokenAddress = await sovryn.underlyingToLoanPool(SUSD.address);
            const amountLend = new BN(wei("500", "ether"));
            await SUSD.approve(loanPoolTokenAddress, amountLend);
            await loanToken.mint(feeSharingCollector.address, amountLend);

            // Check ISUSD Balance for feeSharingCollector
            const feeSharingCollectorProxyLoanBalanceToken = await loanToken.balanceOf(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyLoanBalanceToken.toString()).to.be.equal(
                amountLend.toString()
            );

            // Withdraw ISUSD from feeSharingCollector
            // const initial
            await feeSharingCollector.addCheckPoint(loanPoolTokenAddress, amountLend.toString());
            let tx = await feeSharingCollector.trueWithdraw(loanToken.address, 10, ZERO_ADDRESS, {
                from: account1,
            });
            const updatedfeeSharingCollectorProxyLoanBalanceToken = await loanToken.balanceOf(
                feeSharingCollector.address
            );
            const updatedAccount1LoanBalanceToken = await loanToken.balanceOf(account1);
            console.log("\nwithdraw(checkpoints = 1).gasUsed: " + tx.receipt.gasUsed);

            expect(updatedfeeSharingCollectorProxyLoanBalanceToken.toString()).to.be.equal(
                ((amountLend * 7) / 10).toString()
            );
            expect(updatedAccount1LoanBalanceToken.toString()).to.be.equal(
                ((amountLend * 3) / 10).toString()
            );

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account1,
                token: loanToken.address,
                amount: amountLend.mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw reegular nativeToken token to another account using claimAllCollectedFees()", async () => {
            await protocolDeploymentFixture();
            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );

            await feeSharingCollector.withdrawFees([SUSD.address]);

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(new BN(feeAmount).mul(new BN(3)).div(new BN(10)));

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [],
                1000,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let [
                processedCheckpointsNativeToken,
                processedCheckpointsWrappedNativeToken,
                processedCheckpointsIWrappedNativeToken,
            ] = await Promise.all([
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    WrappedNativeToken.address
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    loanWrappedNativeToken.address
                ),
            ]);

            expect(processedCheckpointsNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWrappedNativeToken.toNumber()).to.be.equal(0);
            expect(processedCheckpointsIWrappedNativeToken.toNumber()).to.be.equal(0);

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw to another account (WrappedNativeToken) - using claimAllCollectedFees()", async () => {
            await protocolDeploymentFixture();

            // FeeSharingCollectorProxy
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await feeSharingCollector.initialize(
                WrappedNativeToken.address,
                loanWrappedNativeToken.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            await WrappedNativeToken.mint(feeSharingCollector.address, wei("2", "ether"));

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            let userStakePercentage = (userStake / (userStake + rootStake)) * 10;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );

            /** Add checkpoint for WrappedNativeToken */
            await feeSharingCollector.addCheckPoint(
                WrappedNativeToken.address,
                totalFeeTokensHeld.toString()
            );

            /** Add checkpoint for iWNT */
            await feeSharingCollector.addCheckPoint(
                loanWrappedNativeToken.address,
                totalFeeTokensHeld.toString()
            );

            await loanWrappedNativeToken.mintWithBTC(feeSharingCollector.address, false, {
                value: totalFeeTokensHeld,
            });

            await feeSharingCollector.withdrawFees([SUSD.address]);

            const accumulatedFeesNativeToken = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            const accumulatedFeesWrappedNativeToken =
                await feeSharingCollector.getAccumulatedFees.call(
                    account1,
                    WrappedNativeToken.address
                );
            const accumulatedFeesINativeToken = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                loanWrappedNativeToken.address
            );

            expect(accumulatedFeesNativeToken.toString()).to.equal(
                accumulatedFeesWrappedNativeToken.toString()
            );
            expect(accumulatedFeesNativeToken.toString()).to.equal(
                accumulatedFeesINativeToken.toString()
            );

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(
                new BN(feeAmount).mul(new BN(userStakePercentage)).div(new BN(10))
            );

            /** Withdraw NativeToken */
            let tx1 = await feeSharingCollector.claimAllCollectedFees(
                [],
                [NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [],
                1000,
                account2,
                {
                    from: account1,
                }
            );
            /** Withdraw WrappedNativeToken */
            let tx2 = await feeSharingCollector.claimAllCollectedFees(
                [],
                [WrappedNativeToken.address],
                [],
                1000,
                account2,
                {
                    from: account1,
                }
            );

            /** Withdraw INativeToken */
            let tx3 = await feeSharingCollector.claimAllCollectedFees(
                [],
                [loanWrappedNativeToken.address],
                [],
                1000,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let [
                processedCheckpointsNativeToken,
                processedCheckpointsWrappedNativeToken,
                processedCheckpointsIWrappedNativeToken,
            ] = await Promise.all([
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    WrappedNativeToken.address
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    loanWrappedNativeToken.address
                ),
            ]);

            expect(processedCheckpointsNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWrappedNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsIWrappedNativeToken.toNumber()).to.be.equal(1);

            expectEvent(tx1, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)), // need multiple by 1 only since we only withdraw NativeToken in tx1
            });

            expectEvent(tx2, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)), // need multiple by 1 only since we only withdraw WrappedNativeToken in tx2
            });

            expectEvent(tx3, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)), // need multiple by 1 only since we only withdraw INativeToken in tx3
            });
        });

        it("Should be able to withdraw to another account (WrappedNativeToken) - using claimAllCollectedFees() - Within 1 transaction", async () => {
            await protocolDeploymentFixture();

            // FeeSharingCollectorProxy
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await feeSharingCollector.initialize(
                WrappedNativeToken.address,
                loanWrappedNativeToken.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            await WrappedNativeToken.mint(feeSharingCollector.address, wei("2", "ether"));

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            let userStakePercentage = (userStake / (userStake + rootStake)) * 10;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );

            /** Add checkpoint for WrappedNativeToken */
            await feeSharingCollector.addCheckPoint(
                WrappedNativeToken.address,
                totalFeeTokensHeld.toString()
            );

            /** Add checkpoint for iWNT */
            await feeSharingCollector.addCheckPoint(
                loanWrappedNativeToken.address,
                totalFeeTokensHeld.toString()
            );

            await loanWrappedNativeToken.mintWithBTC(feeSharingCollector.address, false, {
                value: totalFeeTokensHeld,
            });

            await feeSharingCollector.withdrawFees([SUSD.address]);

            const accumulatedFeesNativeToken = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            const accumulatedFeesWrappedNativeToken =
                await feeSharingCollector.getAccumulatedFees.call(
                    account1,
                    WrappedNativeToken.address
                );
            const accumulatedFeesINativeToken = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                loanWrappedNativeToken.address
            );

            expect(accumulatedFeesNativeToken.toString()).to.equal(
                accumulatedFeesWrappedNativeToken.toString()
            );
            expect(accumulatedFeesNativeToken.toString()).to.equal(
                accumulatedFeesINativeToken.toString()
            );

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(
                new BN(feeAmount).mul(new BN(userStakePercentage)).div(new BN(10))
            );

            /** Withdraw NativeToken WrappedNativeToken & INativeToken */
            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                1000,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let [
                processedCheckpointsNativeToken,
                processedCheckpointsWrappedNativeToken,
                processedCheckpointsIWrappedNativeToken,
            ] = await Promise.all([
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    WrappedNativeToken.address
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    loanWrappedNativeToken.address
                ),
            ]);

            expect(processedCheckpointsNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWrappedNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsIWrappedNativeToken.toNumber()).to.be.equal(1);

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(3)))
                    .div(new BN(10)),
            });
        });

        it("Should be able to withdraw nativeToken token related - using withdraw() function", async () => {
            await protocolDeploymentFixture();

            // FeeSharingCollectorProxy
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await feeSharingCollector.initialize(
                WrappedNativeToken.address,
                loanWrappedNativeToken.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            await WrappedNativeToken.mint(feeSharingCollector.address, wei("2", "ether"));

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            let userStakePercentage = (userStake / (userStake + rootStake)) * 10;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );

            /** Add checkpoint for WrappedNativeToken */
            await feeSharingCollector.addCheckPoint(
                WrappedNativeToken.address,
                totalFeeTokensHeld.toString()
            );

            /** Add checkpoint for iWNT */
            await feeSharingCollector.addCheckPoint(
                loanWrappedNativeToken.address,
                totalFeeTokensHeld.toString()
            );

            await loanWrappedNativeToken.mintWithBTC(feeSharingCollector.address, false, {
                value: totalFeeTokensHeld,
            });

            await feeSharingCollector.withdrawFees([SUSD.address]);

            const accumulatedFeesNativeToken = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            const accumulatedFeesWrappedNativeToken =
                await feeSharingCollector.getAccumulatedFees.call(
                    account1,
                    WrappedNativeToken.address
                );
            const accumulatedFeesINativeToken = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                loanWrappedNativeToken.address
            );

            expect(accumulatedFeesNativeToken.toString()).to.equal(
                accumulatedFeesWrappedNativeToken.toString()
            );
            expect(accumulatedFeesNativeToken.toString()).to.equal(
                accumulatedFeesINativeToken.toString()
            );

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(
                new BN(feeAmount).mul(new BN(userStakePercentage)).div(new BN(10))
            );

            /** Withdraw WrappedNativeToken */
            let tx2 = await feeSharingCollector.trueWithdraw(
                WrappedNativeToken.address,
                1000,
                account2,
                {
                    from: account1,
                }
            );

            /** Withdraw INativeToken */
            let tx3 = await feeSharingCollector.trueWithdraw(
                loanWrappedNativeToken.address,
                1000,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let [processedCheckpointsWrappedNativeToken, processedCheckpointsIWrappedNativeToken] =
                await Promise.all([
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        WrappedNativeToken.address
                    ),
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        loanWrappedNativeToken.address
                    ),
                ]);

            expect(processedCheckpointsWrappedNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsIWrappedNativeToken.toNumber()).to.be.equal(1);

            expectEvent(tx2, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account2,
                token: WrappedNativeToken.address,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)),
            });

            expectEvent(tx3, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account2,
                token: loanWrappedNativeToken.address,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)),
            });
        });

        it("Should be able to withdraw to another account (WrappedNativeToken) - using withdrawNativeToken() - Within 1 transaction partially", async () => {
            await protocolDeploymentFixture();

            // FeeSharingCollectorProxy
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await feeSharingCollector.initialize(
                WrappedNativeToken.address,
                loanWrappedNativeToken.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            await WrappedNativeToken.mint(feeSharingCollector.address, wei("2", "ether"));

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            let userStakePercentage = (userStake / (userStake + rootStake)) * 10;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "ether"));
            let tradingFeeTokensHeld = new BN(wei("2", "ether"));
            let borrowingFeeTokensHeld = new BN(wei("3", "ether"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );

            /** Add checkpoint for WrappedNativeToken */
            await feeSharingCollector.addCheckPoint(
                WrappedNativeToken.address,
                totalFeeTokensHeld.toString()
            );

            /** Add checkpoint for iWNT */
            await feeSharingCollector.addCheckPoint(
                loanWrappedNativeToken.address,
                totalFeeTokensHeld.toString()
            );

            await loanWrappedNativeToken.mintWithBTC(feeSharingCollector.address, false, {
                value: totalFeeTokensHeld,
            });

            await feeSharingCollector.withdrawFees([SUSD.address]);

            const accumulatedFeesNativeToken = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            const accumulatedFeesWrappedNativeToken =
                await feeSharingCollector.getAccumulatedFees.call(
                    account1,
                    WrappedNativeToken.address
                );
            const accumulatedFeesINativeToken = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                loanWrappedNativeToken.address
            );

            expect(accumulatedFeesNativeToken.toString()).to.equal(
                accumulatedFeesWrappedNativeToken.toString()
            );
            expect(accumulatedFeesNativeToken.toString()).to.equal(
                accumulatedFeesINativeToken.toString()
            );

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(
                new BN(feeAmount).mul(new BN(userStakePercentage)).div(new BN(10))
            );

            /** Withdraw NativeToken WrappedNativeToken & INativeToken */
            /** @note  INativeToken won't be withdrawn here because we only pass 2 as max checkpoints */
            /** Only NativeToken * WrappedNativeToken will be withdrawn */
            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                2,
                account2,
                {
                    from: account1,
                }
            );

            /** In this tx, it will withdraw INativeToken only, since  NativeToken * WrappedNativeToken has no more checkpoints to be withdrawn */
            let tx2 = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                1,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let [
                processedCheckpointsNativeToken,
                processedCheckpointsWrappedNativeToken,
                processedCheckpointsIWrappedNativeToken,
            ] = await Promise.all([
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    WrappedNativeToken.address
                ),
                feeSharingCollector.processedCheckpoints.call(
                    account1,
                    loanWrappedNativeToken.address
                ),
            ]);

            expect(processedCheckpointsNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWrappedNativeToken.toNumber()).to.be.equal(1);
            expect(processedCheckpointsIWrappedNativeToken.toNumber()).to.be.equal(1);

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(2)))
                    .div(new BN(10)),
            });

            expectEvent(tx2, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)),
            });
        });

        it("Should be able to withdraw (WrappedNativeToken pool) using claimAllCollectedFees()", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld = new BN(wei("3", "gwei"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );

            await feeSharingCollector.withdrawFees([SUSD.address]);

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            let userInitialBtcBalance = new BN(await web3.eth.getBalance(account1));
            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                30,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            /// @dev To anticipate gas consumption it is required to split hardhat
            ///   behaviour into two different scenarios: coverage and regular testing.
            ///   On coverage gasPrice = 1, on regular tests gasPrice = 8000000000
            //
            // On coverage:
            // Fees:                 1800000000
            // Balance: 10000000000000000000000
            // Balance: 10000000000001799398877
            // withdraw().gasUsed:       601123
            // txFee:                    601123
            //
            // On regular test:
            // Fees:                 1800000000
            // Balance: 10000000000000000000000
            // Balance:  9999996433281800000000
            // withdraw().gasUsed:       445840
            // txFee:          3566720000000000
            let userLatestBTCBalance = new BN(await web3.eth.getBalance(account1));
            let gasPrice;
            /// @dev A balance decrease (negative difference) corresponds to regular test case
            if (userLatestBTCBalance.sub(userInitialBtcBalance).toString()[0] == "-") {
                gasPrice = new BN(parseInt(tx.receipt.effectiveGasPrice));
            } // regular test
            else {
                gasPrice = new BN(1);
            } // coverage

            console.log("\nwithdraw(checkpoints = 1).gasUsed: " + tx.receipt.gasUsed);
            let txFee = new BN(tx.receipt.gasUsed).mul(gasPrice);

            userInitialBtcBalance = userInitialBtcBalance.sub(new BN(txFee));
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            // check balances
            let feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );

            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal(0);
            let userLoanTokenBalance = await loanWrappedNativeToken.balanceOf.call(account1);
            expect(userLoanTokenBalance.toNumber()).to.be.equal(0);
            let userExpectedBtcBalance = userInitialBtcBalance.add(
                feeAmount.mul(new BN(3)).div(new BN(10))
            );
            expect(userLatestBTCBalance.toString()).to.be.equal(userExpectedBtcBalance.toString());

            expectEvent(tx, "NativeTokenWithdrawn", {
                sender: account1,
                receiver: account1,
                amount: feeAmount.mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw (sov pool)", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            //mock data
            let lendingFeeTokensHeld = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld = new BN(wei("3", "gwei"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld,
                false,
                true
            );

            await feeSharingCollector.withdrawFees([SOVToken.address]);

            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            console.log("FEES:", fees.toString());
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            let userInitialISOVBalance = await SOVToken.balanceOf(account1);
            let tx = await feeSharingCollector.withdraw(SOVToken.address, 10, ZERO_ADDRESS, {
                from: account1,
            });

            //processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            //check balances
            let feeSharingCollectorProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
            let userBalance = await SOVToken.balanceOf.call(account1);
            expect(userBalance.sub(userInitialISOVBalance).toNumber()).to.be.equal(
                (feeAmount * 3) / 10
            );

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account1,
                token: SOVToken.address,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw (sov pool) - using claimAllCollectedFees()", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            //mock data
            let lendingFeeTokensHeld = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld = new BN(wei("3", "gwei"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld,
                false,
                true
            );

            await feeSharingCollector.withdrawFees([SOVToken.address]);

            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            console.log("FEES:", fees.toString());
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            let userInitialISOVBalance = await SOVToken.balanceOf(account1);
            let tx = await feeSharingCollector.claimAllCollectedFees(
                [SOVToken.address],
                [],
                [],
                10,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            //processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            //check balances
            let feeSharingCollectorProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
            let userBalance = await SOVToken.balanceOf.call(account1);
            expect(userBalance.sub(userInitialISOVBalance).toNumber()).to.be.equal(
                (feeAmount * 3) / 10
            );

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account1,
                token: SOVToken.address,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw (sov pool) to another account", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            //mock data
            let lendingFeeTokensHeld = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld = new BN(wei("3", "gwei"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld,
                false,
                true
            );

            await feeSharingCollector.withdrawFees([SOVToken.address]);

            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            const receiverBalanceBefore = await SOVToken.balanceOf(account2);
            let tx = await feeSharingCollector.withdraw(SOVToken.address, 10, account2, {
                from: account1,
            });

            //processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            //check balances
            let feeSharingCollectorProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
            const receiverBalanceAfter = await SOVToken.balanceOf(account2);
            const amountWithdrawn = new BN(feeAmount).mul(new BN(3)).div(new BN(10));
            expect(receiverBalanceAfter.sub(receiverBalanceBefore).toString()).to.be.equal(
                amountWithdrawn.toString()
            );

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account2,
                token: SOVToken.address,
                amount: amountWithdrawn,
            });
        });

        it("Should be able to withdraw (sov pool) to another account - using claimAllCollectedFees()", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            //mock data
            let lendingFeeTokensHeld = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld = new BN(wei("3", "gwei"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld,
                false,
                true
            );

            await feeSharingCollector.withdrawFees([SOVToken.address]);

            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            const receiverBalanceBefore = await SOVToken.balanceOf(account2);
            let tx = await feeSharingCollector.claimAllCollectedFees(
                [SOVToken.address],
                [],
                [],
                10,
                account2,
                {
                    from: account1,
                }
            );

            //processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            //check balances
            let feeSharingCollectorProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
            const receiverBalanceAfter = await SOVToken.balanceOf(account2);
            const amountWithdrawn = new BN(feeAmount).mul(new BN(3)).div(new BN(10));
            expect(receiverBalanceAfter.sub(receiverBalanceBefore).toString()).to.be.equal(
                amountWithdrawn.toString()
            );

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account2,
                token: SOVToken.address,
                amount: amountWithdrawn,
            });
        });

        it("Should be able to withdraw using 3 checkpoints", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            let rootStake = 900;
            await stake(rootStake, root);

            let userStake = 100;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // [FIRST]
            // mock data
            let lendingFeeTokensHeld = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld = new BN(wei("3", "gwei"));
            let totalFeeTokensHeld = lendingFeeTokensHeld
                .add(tradingFeeTokensHeld)
                .add(borrowingFeeTokensHeld);
            let feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld,
                tradingFeeTokensHeld,
                borrowingFeeTokensHeld
            );
            let totalFeeAmount = feeAmount;
            await feeSharingCollector.withdrawFees([SUSD.address]);

            let userInitialBtcBalance = new BN(await web3.eth.getBalance(account1));
            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                1,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );

            /// @dev Same as above gas consumption is different on regular tests than on coverge
            let userLatestBTCBalance = new BN(await web3.eth.getBalance(account1));
            let gasPrice;
            /// @dev A balance decrease (negative difference) corresponds to regular test case
            if (userLatestBTCBalance.sub(userInitialBtcBalance).toString()[0] == "-") {
                gasPrice = new BN(parseInt(tx.receipt.effectiveGasPrice));
            } // regular test
            else {
                gasPrice = new BN(1);
            } // coverage

            console.log("\nwithdraw(checkpoints = 1).gasUsed: " + tx.receipt.gasUsed);
            let txFee = new BN(tx.receipt.gasUsed).mul(gasPrice);

            userInitialBtcBalance = userInitialBtcBalance.sub(new BN(txFee));
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            // check balances
            let feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal(0);
            let userBalance = await loanWrappedNativeToken.balanceOf.call(account1);
            expect(userBalance.toNumber()).to.be.equal(0);

            expect(userLatestBTCBalance.toString()).to.be.equal(
                userInitialBtcBalance.add(totalFeeAmount.mul(new BN(1)).div(new BN(10))).toString()
            );

            // [SECOND]
            // mock data
            let lendingFeeTokensHeld2 = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld2 = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld2 = new BN(wei("3", "gwei"));
            totalFeeTokensHeld = lendingFeeTokensHeld2
                .add(tradingFeeTokensHeld2)
                .add(borrowingFeeTokensHeld2);
            feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld2,
                tradingFeeTokensHeld2,
                borrowingFeeTokensHeld2
            );
            totalFeeAmount = totalFeeAmount.add(feeAmount);
            let totalLoanTokenWrappedNativeTokenBalanceShouldBeAccount1 = feeAmount;
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            await feeSharingCollector.withdrawFees([SUSD.address]);

            // [THIRD]
            // mock data
            let lendingFeeTokensHeld3 = new BN(wei("1", "gwei"));
            let tradingFeeTokensHeld3 = new BN(wei("2", "gwei"));
            let borrowingFeeTokensHeld3 = new BN(wei("3", "gwei"));
            totalFeeTokensHeld = lendingFeeTokensHeld3
                .add(tradingFeeTokensHeld3)
                .add(borrowingFeeTokensHeld3);
            feeAmount = await setFeeTokensHeld(
                lendingFeeTokensHeld3,
                tradingFeeTokensHeld3,
                borrowingFeeTokensHeld3
            );
            totalFeeAmount = totalFeeAmount.add(feeAmount);
            totalLoanTokenWrappedNativeTokenBalanceShouldBeAccount1 =
                totalLoanTokenWrappedNativeTokenBalanceShouldBeAccount1.add(feeAmount);
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            await feeSharingCollector.withdrawFees([SUSD.address]);

            // [SECOND] - [THIRD]
            userInitialBtcBalance = new BN(await web3.eth.getBalance(account1));
            tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                2,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            gasPrice = new BN(parseInt(tx.receipt.effectiveGasPrice));
            console.log("\nwithdraw(checkpoints = 2).gasUsed: " + tx.receipt.gasUsed);
            txFee = new BN(tx.receipt.gasUsed).mul(gasPrice);

            userInitialBtcBalance = userInitialBtcBalance.sub(new BN(txFee));

            // processedCheckpoints
            processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(3);

            // check balances
            feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal(0);
            userBalance = await loanWrappedNativeToken.balanceOf.call(account1);
            expect(userBalance.toNumber()).to.be.equal(0);

            userLatestBTCBalance = new BN(await web3.eth.getBalance(account1));

            expect(userLatestBTCBalance.toString()).to.be.equal(
                userInitialBtcBalance
                    .add(
                        totalLoanTokenWrappedNativeTokenBalanceShouldBeAccount1
                            .mul(new BN(1))
                            .div(new BN(10))
                    )
                    .toString()
            );
        });

        it("Should be able to process 10 checkpoints", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            await stake(900, root);
            let userStake = 100;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            await createCheckpoints(10);

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                1000,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 10).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(10);
        });

        it("Should be able to process 10 checkpoints and 3 withdrawals", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            await stake(900, root);
            let userStake = 100;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // mock data
            await createCheckpoints(10);

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                5,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 5).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(5);

            tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                3,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 3).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(8);

            tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                1000,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 2).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(10);
        });

        // // use for gas usage tests
        // it("Should be able to process 30 checkpoints", async () => {
        //     // stake - getPriorTotalVotingPower
        //     await stake(900, root);
        //     let userStake = 100;
        //     if (MOCK_PRIOR_WEIGHTED_STAKE) {
        //         await staking.MOCK_priorWeightedStake(userStake * 10);
        //     }
        //     await SOVToken.transfer(account1, userStake);
        //     await stake(userStake, account1);
        //
        //     // mock data
        //     await createCheckpoints(30);
        //
        //     let tx = await feeSharingCollector.withdraw(loanToken.address, 1000, ZERO_ADDRESS, {from: account1});
        //     console.log("\nwithdraw(checkpoints = 30).gasUsed: " + tx.receipt.gasUsed);
        //     // processedCheckpoints
        //     let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(account1, loanToken.address);
        //     expect(processedCheckpoints.toNumber()).to.be.equal(30);
        // });
        //
        // // use for gas usage tests
        // it("Should be able to process 100 checkpoints", async () => {
        //     // stake - getPriorTotalVotingPower
        //     await stake(900, root);
        //     let userStake = 100;
        //     if (MOCK_PRIOR_WEIGHTED_STAKE) {
        //         await staking.MOCK_priorWeightedStake(userStake * 10);
        //     }
        //     await SOVToken.transfer(account1, userStake);
        //     await stake(userStake, account1);
        //
        //     // mock data
        //     await createCheckpoints(100);
        //
        //     let tx = await feeSharingCollector.withdraw(loanToken.address, 1000, ZERO_ADDRESS, {from: account1});
        //     console.log("\nwithdraw(checkpoints = 500).gasUsed: " + tx.receipt.gasUsed);
        //     // processedCheckpoints
        //     let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(account1, loanToken.address);
        //     expect(processedCheckpoints.toNumber()).to.be.equal(100);
        // });
        //
        // // use for gas usage tests
        // it("Should be able to withdraw when staking contains a lot of checkpoints", async () => {
        //     let checkpointCount = 1000;
        //     await stake(1000, root, checkpointCount);
        //     let afterBlock = await blockNumber();
        //     console.log(afterBlock);
        //
        //     let kickoffTS = await staking.kickoffTS.call();
        //     let stakingDate = kickoffTS.add(new BN(MAX_DURATION));
        //
        //     let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints.call(root, stakingDate);
        //     let firstCheckpoint = await staking.userStakingCheckpoints.call(root, stakingDate, 0);
        //     let lastCheckpoint = await staking.userStakingCheckpoints.call(root, stakingDate, numUserStakingCheckpoints - 1);
        //     let block1 = firstCheckpoint.fromBlock.toNumber() + 1;
        //     let block2 = lastCheckpoint.fromBlock;
        //
        //     console.log("numUserStakingCheckpoints = " + numUserStakingCheckpoints.toString());
        //     console.log("first = " + firstCheckpoint.fromBlock.toString());
        //     console.log("last = " + lastCheckpoint.fromBlock.toString());
        //
        //     let tx = await staking.calculatePriorWeightedStake(root, block1, stakingDate);
        //     console.log("\ncalculatePriorWeightedStake(checkpoints = " + checkpointCount + ").gasUsed: " + tx.receipt.gasUsed);
        //     tx = await staking.calculatePriorWeightedStake(root, block2, stakingDate);
        //     console.log("\ncalculatePriorWeightedStake(checkpoints = " + checkpointCount + ").gasUsed: " + tx.receipt.gasUsed);
        // });

        it("Should be able to withdraw with staking for 78 dates", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            let kickoffTS = await staking.kickoffTS.call();
            await SOVToken.approve(staking.address, userStake * 1000);
            for (let i = 0; i < 77; i++) {
                let stakingDate = kickoffTS.add(new BN(TWO_WEEKS * (i + 1)));
                await staking.stake(userStake, stakingDate, account1, account1);
            }

            // mock data
            await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));

            await feeSharingCollector.withdrawFees([SUSD.address]);

            let tx = await feeSharingCollector.claimAllCollectedFees(
                [],
                [
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    WrappedNativeToken.address,
                    loanWrappedNativeToken.address,
                ],
                [],
                10,
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 1).gasUsed: " + tx.receipt.gasUsed);
        });

        it("should compute the weighted stake and show gas usage", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            await stake(100, root);
            let kickoffTS = await staking.kickoffTS.call();
            let stakingDate = kickoffTS.add(new BN(MAX_DURATION));
            await SOVToken.approve(staking.address, 100);
            let result = await staking.stake("100", stakingDate, root, root);
            await mineBlock();

            let tx = await iWeightedStakingModuleMockup.calculatePriorWeightedStake(
                root,
                result.receipt.blockNumber,
                stakingDate
            );
            console.log("\ngasUsed: " + tx.receipt.gasUsed);
        });
    });

    describe("withdraw with or considering vesting contracts", () => {
        it("getAccumulatedFees should return 0 for vesting contracts", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            let { vestingInstance } = await createVestingContractWithSingleDate(
                new BN(MAX_DURATION),
                1000,
                root
            );
            await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            let fees = await feeSharingCollector.getAccumulatedFees(
                vestingInstance.address,
                loanToken.address
            );
            expect(fees).to.be.bignumber.equal("0");
        });

        it("vesting contract should not be able to withdraw fees", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            let { vestingInstance } = await createVestingContractWithSingleDate(
                new BN(MAX_DURATION),
                1000,
                root
            );
            await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            await expectRevert(
                vestingInstance.collectDividends(loanToken.address, 5, root),
                "FeeSharingCollector::withdrawFees: no tokens for withdrawal"
            );
        });

        it("vested stakes should be deducted from total weighted stake on share distribution", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            // 50% vested 50% voluntary stakes
            await createVestingContractWithSingleDate(new BN(MAX_DURATION), 1000, root);
            let userStake = 1000;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            let tx = await feeSharingCollector.withdrawFees([SUSD.address]);
            let feesWithdrawn = tx.logs[1].args.amount;
            let userFees = await feeSharingCollector.getAccumulatedFees(
                account1,
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );

            // 100% of the fees should go to the user -> vesting contract not considered
            expect(feesWithdrawn).to.be.bignumber.equal(userFees);
        });
    });

    describe("withdraw AMM Fees", async () => {
        it("Whitelist converter", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            await expectRevert(
                feeSharingCollector.addWhitelistedConverterAddress(account1, { from: account2 }),
                "unauthorized"
            );

            await expectRevert(
                feeSharingCollector.addWhitelistedConverterAddress(account1),
                "Non contract address given"
            );
            await expectRevert(
                feeSharingCollector.addWhitelistedConverterAddress(ZERO_ADDRESS),
                "Non contract address given"
            );

            const liquidityPoolV1Converter = await LiquidityPoolV1Converter.new(
                SOVToken.address,
                SUSD.address
            );
            await feeSharingCollector.addWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            let whitelistedConverterList = await feeSharingCollector.getWhitelistedConverterList();
            expect(whitelistedConverterList.length).to.equal(1);
            expect(whitelistedConverterList[0]).to.equal(liquidityPoolV1Converter.address);
            await feeSharingCollector.addWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            whitelistedConverterList = await feeSharingCollector.getWhitelistedConverterList();
            expect(whitelistedConverterList.length).to.equal(1);
            expect(whitelistedConverterList[0]).to.equal(liquidityPoolV1Converter.address);
        });

        it("Remove converter from whitelist", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            const liquidityPoolV1Converter = await LiquidityPoolV1Converter.new(
                SOVToken.address,
                SUSD.address
            );
            let whitelistedConverterList = await feeSharingCollector.getWhitelistedConverterList();
            expect(whitelistedConverterList.length).to.equal(0);

            await expectRevert(
                feeSharingCollector.removeWhitelistedConverterAddress(
                    liquidityPoolV1Converter.address,
                    { from: account2 }
                ),
                "unauthorized"
            );

            await feeSharingCollector.removeWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            whitelistedConverterList = await feeSharingCollector.getWhitelistedConverterList();
            expect(whitelistedConverterList.length).to.equal(0);

            await feeSharingCollector.addWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            whitelistedConverterList = await feeSharingCollector.getWhitelistedConverterList();
            expect(whitelistedConverterList.length).to.equal(1);
            expect(whitelistedConverterList[0]).to.equal(liquidityPoolV1Converter.address);

            await feeSharingCollector.removeWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            whitelistedConverterList = await feeSharingCollector.getWhitelistedConverterList();
            expect(whitelistedConverterList.length).to.equal(0);
        });

        it("should not be able to withdraw fees if converters address is not a contract address", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            await expectRevert(
                feeSharingCollector.withdrawFeesAMM([accounts[0]]),
                "Invalid Converter"
            );
        });

        it("Should not be able to withdraw AMM Fees after whitelist removal", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            //mock data
            // AMM Converter
            liquidityPoolV1Converter = await LiquidityPoolV1Converter.new(
                SOVToken.address,
                SUSD.address
            );
            const feeAmount = new BN(wei("1", "ether"));
            await liquidityPoolV1Converter.setTotalFeeMockupValue(feeAmount.toString());

            await expectRevert(
                feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]),
                "Invalid Converter"
            );
            await feeSharingCollector.addWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            await feeSharingCollector.removeWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            await expectRevert(
                feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]),
                "Invalid Converter"
            );
            await feeSharingCollector.addWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );

            await expectRevert(
                feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]),
                "unauthorized"
            );
            await liquidityPoolV1Converter.setFeesController(feeSharingCollector.address);
            await liquidityPoolV1Converter.setWrbtcToken(WrappedNativeToken.address);
            await WrappedNativeToken.mint(liquidityPoolV1Converter.address, wei("2", "ether"));

            let previousFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            tx = await feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]);

            //check WrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // nativeToken balance of feeSharingCollector should be increased
            let latestFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(
                previousFeeSharingCollectorProxyNativeTokenBalance
                    .add(new BN(feeAmount))
                    .toString()
            ).to.equal(latestFeeSharingCollectorProxyNativeTokenBalance.toString());

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingCollectorProxyWrappedNativeTokenBalance =
                await WrappedNativeToken.balanceOf.call(feeSharingCollector.address);
            expect(feeSharingCollectorProxyWrappedNativeTokenBalance.toString()).to.be.equal("0");

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "FeeAMMWithdrawn", {
                sender: root,
                converter: liquidityPoolV1Converter.address,
                amount: feeAmount,
            });
        });

        it("Should be able to withdraw AMM Fees", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            //mock data
            // AMM Converter
            liquidityPoolV1Converter = await LiquidityPoolV1Converter.new(
                SOVToken.address,
                SUSD.address
            );
            const feeAmount = new BN(wei("1", "ether"));
            await liquidityPoolV1Converter.setTotalFeeMockupValue(feeAmount.toString());

            await expectRevert(
                feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]),
                "Invalid Converter"
            );
            await feeSharingCollector.addWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            await expectRevert(
                feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]),
                "unauthorized"
            );
            await liquidityPoolV1Converter.setFeesController(feeSharingCollector.address);
            await liquidityPoolV1Converter.setWrbtcToken(WrappedNativeToken.address);
            await WrappedNativeToken.mint(liquidityPoolV1Converter.address, wei("2", "ether"));

            let previousFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            tx = await feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]);

            //check WrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // nativeToken balance of feeSharingCollector should be increased
            let latestFeeSharingCollectorProxyNativeTokenBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(
                previousFeeSharingCollectorProxyNativeTokenBalance
                    .add(new BN(feeAmount))
                    .toString()
            ).to.equal(latestFeeSharingCollectorProxyNativeTokenBalance.toString());

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingCollectorProxyWrappedNativeTokenBalance =
                await WrappedNativeToken.balanceOf.call(feeSharingCollector.address);
            expect(feeSharingCollectorProxyWrappedNativeTokenBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "FeeAMMWithdrawn", {
                sender: root,
                converter: liquidityPoolV1Converter.address,
                amount: feeAmount,
            });
        });

        it("Should be able to withdraw with 0 AMM Fees", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            //mock data
            // AMM Converter
            liquidityPoolV1Converter = await LiquidityPoolV1Converter.new(
                SOVToken.address,
                SUSD.address
            );
            const feeAmount = new BN(wei("0", "ether"));
            await liquidityPoolV1Converter.setTotalFeeMockupValue(feeAmount.toString());
            await expectRevert(
                feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]),
                "Invalid Converter"
            );
            await feeSharingCollector.addWhitelistedConverterAddress(
                liquidityPoolV1Converter.address
            );
            await expectRevert(
                feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]),
                "unauthorized"
            );
            await liquidityPoolV1Converter.setFeesController(feeSharingCollector.address);
            await liquidityPoolV1Converter.setWrbtcToken(WrappedNativeToken.address);
            await WrappedNativeToken.mint(liquidityPoolV1Converter.address, wei("2", "ether"));

            tx = await feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]);

            //check WrappedNativeToken balance (wrappedNativeToken balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal(feeAmount.toString());

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingCollectorProxyWrappedNativeTokenBalance =
                await WrappedNativeToken.balanceOf.call(feeSharingCollector.address);
            expect(feeSharingCollectorProxyWrappedNativeTokenBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                loanWrappedNativeToken.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(0);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                loanWrappedNativeToken.address,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(0);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(0);
            expect(checkpoint.numTokens.toString()).to.be.equal("0");

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                loanWrappedNativeToken.address
            );
            expect(lastFeeWithdrawalTime.toString()).to.be.equal("0");
        });
    });

    describe("withdraw wrappedNativeToken", async () => {
        it("Withdraw wrappedNativeToken from non owner should revert", async () => {
            await protocolDeploymentFixture();
            const receiver = accounts[1];
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            await expectRevert(
                feeSharingCollector.withdrawWrappedNativeToken(receiver, 0, { from: accounts[1] }),
                "unauthorized"
            );
        });

        it("Withdraw 0 wrappedNativeToken", async () => {
            await protocolDeploymentFixture();
            const receiver = accounts[1];
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            await feeSharingCollector.withdrawWrappedNativeToken(receiver, 0);
            const latestBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const latestBalanceFeeSharingCollectorProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal("0");
            expect(latestBalanceFeeSharingCollectorProxy.toString()).to.equal("0");
        });

        it("Withdraw wrappedNativeToken more than the balance of feeSharingCollector should revert", async () => {
            await protocolDeploymentFixture();
            await WrappedNativeToken.mint(root, wei("500", "ether"));
            await WrappedNativeToken.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const feeSharingCollectorProxyBalance = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );
            const amount = feeSharingCollectorProxyBalance.add(new BN(100));
            const previousBalanceFeeSharingCollectorProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            await expectRevert(
                feeSharingCollector.withdrawWrappedNativeToken(receiver, amount.toString()),
                "Insufficient balance"
            );

            const latestBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const latestBalanceFeeSharingCollectorProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal("0");
            expect(latestBalanceFeeSharingCollectorProxy.toString()).to.equal(
                previousBalanceFeeSharingCollectorProxy.toString()
            );
        });

        it("Fully Withdraw wrappedNativeToken", async () => {
            await protocolDeploymentFixture();
            await WrappedNativeToken.mint(root, wei("500", "ether"));
            await WrappedNativeToken.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const feeSharingCollectorProxyBalance = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            const tx = await feeSharingCollector.withdrawWrappedNativeToken(
                receiver,
                feeSharingCollectorProxyBalance.toString()
            );
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                WrappedNativeToken,
                "Transfer",
                {
                    src: feeSharingCollector.address,
                    dst: receiver,
                    wad: feeSharingCollectorProxyBalance.toString(),
                }
            );

            const latestBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const latestBalanceFeeSharingCollectorProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal(feeSharingCollectorProxyBalance.toString());
            expect(latestBalanceFeeSharingCollectorProxy.toString()).to.equal("0");
        });

        it("Partially Withdraw wrappedNativeToken", async () => {
            await protocolDeploymentFixture();
            await WrappedNativeToken.mint(root, wei("500", "ether"));
            await WrappedNativeToken.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const restAmount = new BN("100"); // 100 wei
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const feeSharingCollectorProxyBalance = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );
            const amount = feeSharingCollectorProxyBalance.sub(restAmount);
            const previousBalanceFeeSharingCollectorProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );
            expect(previousBalanceFeeSharingCollectorProxy.toString()).to.equal(wei("1", "ether"));

            const tx = await feeSharingCollector.withdrawWrappedNativeToken(
                receiver,
                amount.toString()
            );
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                WrappedNativeToken,
                "Transfer",
                {
                    src: feeSharingCollector.address,
                    dst: receiver,
                    wad: amount,
                }
            );

            const latestBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const latestBalanceFeeSharingCollectorProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal(amount.toString());
            expect(latestBalanceFeeSharingCollectorProxy.toString()).to.equal(
                restAmount.toString()
            );

            // try to withdraw the rest
            const tx2 = await feeSharingCollector.withdrawWrappedNativeToken(
                receiver,
                latestBalanceFeeSharingCollectorProxy.toString()
            );
            const finalBalanceFeeSharingCollectorProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );
            const finalBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            expect(new BN(finalBalanceReceiver).toString()).to.equal(
                previousBalanceFeeSharingCollectorProxy.toString()
            );
            expect(finalBalanceFeeSharingCollectorProxy.toString()).to.equal("0");

            await expectEvent.inTransaction(
                tx2.receipt.rawLogs[0].transactionHash,
                WrappedNativeToken,
                "Transfer",
                {
                    src: feeSharingCollector.address,
                    dst: receiver,
                    wad: latestBalanceFeeSharingCollectorProxy.toString(),
                }
            );
        });
    });

    describe("get all nativeToken balance after transferNativeToken", async () => {
        it("deposit 0 NativeToken should revert", async () => {
            await protocolDeploymentFixture();
            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            let amount = 1000;

            await expectRevert(
                feeSharingCollector.transferNativeToken({ from: root, value: 0 }),
                "FeeSharingCollector::transferNativeToken: invalid value"
            );
            const totalAccumulatedNativeTokenFee =
                await feeSharingCollector.getAccumulatedNativeTokenFeeBalances(root);
            expect(totalAccumulatedNativeTokenFee.toNumber()).to.equal(0);
            expect(
                await feeSharingCollector.unprocessedAmount.call(
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                )
            ).to.be.bignumber.equal(new BN(0));
        });

        it("deposit NativeToken should add the checkpoints", async () => {
            await protocolDeploymentFixture();
            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            let amount = 1000;

            let tx = await feeSharingCollector.transferNativeToken({ from: root, value: amount });
            let totalAccumulatedNativeTokenFee =
                await feeSharingCollector.getAccumulatedNativeTokenFeeBalances(root);
            expect(totalAccumulatedNativeTokenFee.toString()).to.equal(new BN(amount).toString());

            expect(
                await feeSharingCollector.unprocessedAmount.call(
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                )
            ).to.be.bignumber.equal(new BN(0));

            expectEvent(tx, "TokensTransferred", {
                sender: root,
                token: ZERO_ADDRESS,
                amount: new BN(amount),
            });

            // checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(amount.toString());

            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "CheckpointAdded", {
                sender: root,
                token: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                amount: new BN(amount),
            });

            // second time
            tx = await feeSharingCollector.transferNativeToken({ from: root, value: amount * 2 });
            totalAccumulatedNativeTokenFee =
                await feeSharingCollector.getAccumulatedNativeTokenFeeBalances(root);

            // the deposit still in the window of withdraw interval, so the accumulatedFees won't be added at this point.
            expect(totalAccumulatedNativeTokenFee.toString()).to.equal(new BN(amount).toString());

            expect(
                await feeSharingCollector.unprocessedAmount.call(
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                )
            ).to.be.bignumber.equal(new BN(amount * 2));

            expectEvent(tx, "TokensTransferred", {
                sender: root,
                token: ZERO_ADDRESS,
                amount: new BN(amount * 2),
            });

            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            // third time
            tx = await feeSharingCollector.transferNativeToken({ from: root, value: amount * 4 });

            totalAccumulatedNativeTokenFee =
                await feeSharingCollector.getAccumulatedNativeTokenFeeBalances(root);

            // already passed the withdrawal interval
            expect(totalAccumulatedNativeTokenFee.toString()).to.equal(
                new BN(amount * 7).toString()
            );

            expect(
                await feeSharingCollector.unprocessedAmount.call(
                    NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
                )
            ).to.be.bignumber.equal(new BN(0));

            // checkpoints
            totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
                1
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toNumber()).to.be.equal(amount * 6);

            // check lastFeeWithdrawalTime
            lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());
        });
    });

    describe("recover incorrect allocated fees", async () => {
        let mockSOV, mockZUSD;
        let nativeTokenAmount = new BN(wei("878778886164898400", "wei"));

        beforeEach(async () => {
            mockSOV = await smock.fake("TestToken", {
                address: "0xEFc78fc7d48b64958315949279Ba181c2114ABBd",
            });

            mockZUSD = await smock.fake("TestToken", {
                address: "0xdB107FA69E33f05180a4C2cE9c2E7CB481645C2d",
            });

            mockSOV.transfer.returns(true);
            mockZUSD.transfer.returns(true);

            await web3.eth.sendTransaction({
                from: accounts[2].toString(),
                to: feeSharingCollector.address,
                value: nativeTokenAmount,
                gas: 50000,
            });
        });

        it("recoverIncorrectAllocatedFees() can only be called by the owner", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.recoverIncorrectAllocatedFees({ from: accounts[1] }),
                "unauthorized"
            );
        });

        it("recoverIncorrectAllocatedFees() can only be executed once", async () => {
            const owner = root;
            await protocolDeploymentFixture();
            await feeSharingCollector.recoverIncorrectAllocatedFees({ from: owner });
            await expectRevert(
                feeSharingCollector.recoverIncorrectAllocatedFees({ from: owner }),
                "FeeSharingCollector: function can only be called once"
            );
        });

        it("Should be able to withdraw the incorrect allocated fees properly", async () => {
            await protocolDeploymentFixture();
            const owner = await feeSharingCollector.owner();
            const previousBalanceOwner = new BN(await web3.eth.getBalance(owner));
            const tx = await feeSharingCollector.recoverIncorrectAllocatedFees();
            const latestBalanceOwner = new BN(await web3.eth.getBalance(owner));
            const txFee = new BN((await etherGasCost(tx.receipt)).toString());

            expect(previousBalanceOwner.add(nativeTokenAmount).sub(txFee).toString()).to.be.equal(
                latestBalanceOwner.toString()
            );
        });

        it("Should revert if sov or zusd transfer failed", async () => {
            await protocolDeploymentFixture();
            mockSOV.transfer.returns(false);
            await expectRevert(
                feeSharingCollector.recoverIncorrectAllocatedFees(),
                "SafeERC20: ERC20 operation did not succeed"
            );
            mockSOV.transfer.returns(true);
            mockZUSD.transfer.returns(false);
            await expectRevert(
                feeSharingCollector.recoverIncorrectAllocatedFees(),
                "SafeERC20: ERC20 operation did not succeed"
            );
        });

        it("Should revert if nativeToken transfer failed", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            /** Should revert because feeSharingCollector does not have enough balance of nativeToken */
            await expectRevert(
                feeSharingCollector.recoverIncorrectAllocatedFees(),
                "FeeSharingCollector::recoverIncorrectAllocatedFees: Withdrawal nativeToken failed"
            );
        });
    });

    describe("test coverage", async () => {
        it("Token transfer failed", async () => {
            await protocolDeploymentFixture();
            mockToken = await smock.fake("TestToken");

            mockToken.transferFrom.returns(false);
            await expectRevert(
                feeSharingCollector.transferTokens(mockToken.address, 1000),
                "Staking::transferTokens: token transfer failed"
            );
        });

        it("getAccumulatedNativeTokenFeeBalances should revert loan wrappedNativeToken is not set", async () => {
            await protocolDeploymentFixture();
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await expectRevert(
                feeSharingCollector.getAccumulatedNativeTokenFeeBalances(root),
                "Transaction reverted: function call to a non-contract account"
            );
        });

        it("transferTokens (wrappedNativeToken) will revert if invalid total weighted stake", async () => {
            await protocolDeploymentFixture();
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            const mockWrappedNativeToken = await smock.fake("TestWrappedNativeToken");
            mockWrappedNativeToken.withdraw.returns(true);
            await sovryn.setWrbtcToken(mockWrappedNativeToken.address);

            await WrappedNativeToken.mint(root, wei("500", "ether"));
            await WrappedNativeToken.transfer(feeSharingCollector.address, wei("1", "ether"));
            await WrappedNativeToken.approve(feeSharingCollector.address, wei("1", "ether"));

            await expectRevert(
                feeSharingCollector.transferTokens(WrappedNativeToken.address, 1000),
                "Invalid totalWeightedStake"
            );
        });

        it("transferTokens (wrappedNativeToken) wrappedNativeToken should success", async () => {
            await protocolDeploymentFixture();
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await WrappedNativeToken.mint(root, wei("500", "ether"));
            await WrappedNativeToken.transfer(feeSharingCollector.address, wei("1", "ether"));

            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            let amount = 1000;
            await WrappedNativeToken.approve(feeSharingCollector.address, amount * 7);

            await feeSharingCollector.transferTokens(WrappedNativeToken.address, amount);
        });

        it("endOfRange with 0 max checkpoint", async () => {
            await protocolDeploymentFixture();
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            const end = await feeSharingCollector.endOfRangeWithZeroMaxCheckpoint(
                WrappedNativeToken.address
            );
            expect(end).to.equal(0);
        });

        it("getNextPositiveUserCheckpoint should return empty value for vesting contract", async () => {
            await protocolDeploymentFixture();
            let { vestingInstance } = await createVestingContractWithSingleDate(
                new BN(MAX_DURATION),
                1000,
                root
            );
            await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                vestingInstance.address,
                SOVToken.address,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            const { checkpointNum, hasSkippedCheckpoints, hasFees } = nextPositive;
            expect(checkpointNum).to.equal(0);
            expect(hasSkippedCheckpoints).to.equal(false);
            expect(hasFees).to.equal(false);
        });

        it("getNativeTokenBalance should revert error if non-nativeToken token is passed", async () => {
            await protocolDeploymentFixture();
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await expectRevert(
                feeSharingCollector.getNativeTokenBalance(SOVToken.address, root, 0),
                "FeeSharingCollector::_getNativeTokenBalance: only nativeToken-based tokens are allowed"
            );
        });

        it("Withdraw function should revert if got reentrant", async () => {
            await protocolDeploymentFixture();
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await expectRevert(
                feeSharingCollector.testWithdrawReentrancy(loanToken.address, 0, account2),
                "nonReentrant"
            );
        });
    });

    async function stake(amount, user, checkpointCount) {
        await SOVToken.approve(staking.address, amount);
        let kickoffTS = await staking.kickoffTS.call();
        let stakingDate = kickoffTS.add(new BN(MAX_DURATION));
        let tx = await staking.stake(amount, stakingDate, user, user);
        await mineBlock();

        if (checkpointCount > 0) {
            await increaseStake(amount, user, stakingDate, checkpointCount - 1);
        }

        return tx;
    }

    async function increaseStake(amount, user, stakingDate, checkpointCount) {
        for (let i = 0; i < checkpointCount; i++) {
            await SOVToken.approve(staking.address, amount);
            await staking.increaseStake(amount, user, stakingDate);
        }
    }

    async function setFeeTokensHeld(
        lendingFee,
        tradingFee,
        borrowingFee,
        wrappedNativeTokenFee = false,
        sovTokenFee = false
    ) {
        let totalFeeAmount = lendingFee.add(tradingFee).add(borrowingFee);
        let tokenFee;
        if (wrappedNativeTokenFee) {
            tokenFee = WrappedNativeToken;
        } else {
            tokenFee = SUSD;
            await tokenFee.transfer(sovryn.address, totalFeeAmount);
        }
        await sovryn.setLendingFeeTokensHeld(tokenFee.address, lendingFee);
        await sovryn.setTradingFeeTokensHeld(tokenFee.address, tradingFee);
        await sovryn.setBorrowingFeeTokensHeld(tokenFee.address, borrowingFee);

        if (sovTokenFee) {
            await SOVToken.transfer(sovryn.address, totalFeeAmount);
            await sovryn.setLendingFeeTokensHeld(SOVToken.address, lendingFee);
            await sovryn.setTradingFeeTokensHeld(SOVToken.address, tradingFee);
            await sovryn.setBorrowingFeeTokensHeld(SOVToken.address, borrowingFee);
        }
        return totalFeeAmount;
    }

    async function checkWithdrawFee(
        checkSUSD = true,
        checkWrappedNativeToken = false,
        checkSOV = false
    ) {
        if (checkSUSD) {
            let protocolBalance = await SUSD.balanceOf(sovryn.address);
            expect(protocolBalance.toString()).to.be.equal(new BN(0).toString());
            let lendingFeeTokensHeld = await sovryn.lendingFeeTokensHeld.call(SUSD.address);
            expect(lendingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
            let tradingFeeTokensHeld = await sovryn.tradingFeeTokensHeld.call(SUSD.address);
            expect(tradingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
            let borrowingFeeTokensHeld = await sovryn.borrowingFeeTokensHeld.call(SUSD.address);
            expect(borrowingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
        }

        if (checkWrappedNativeToken) {
            lendingFeeTokensHeld = await sovryn.lendingFeeTokensHeld.call(
                WrappedNativeToken.address
            );
            expect(lendingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
            tradingFeeTokensHeld = await sovryn.tradingFeeTokensHeld.call(
                WrappedNativeToken.address
            );
            expect(tradingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
            borrowingFeeTokensHeld = await sovryn.borrowingFeeTokensHeld.call(
                WrappedNativeToken.address
            );
            expect(borrowingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
        }

        if (checkSOV) {
            protocolBalance = await SOVToken.balanceOf(sovryn.address);
            expect(protocolBalance.toString()).to.be.equal(new BN(0).toString());
            lendingFeeTokensHeld = await sovryn.lendingFeeTokensHeld.call(SOVToken.address);
            expect(lendingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
            tradingFeeTokensHeld = await sovryn.tradingFeeTokensHeld.call(SOVToken.address);
            expect(tradingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
            borrowingFeeTokensHeld = await sovryn.borrowingFeeTokensHeld.call(SOVToken.address);
            expect(borrowingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
        }
    }

    async function createCheckpoints(number) {
        for (let i = 0; i < number; i++) {
            await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            await feeSharingCollector.withdrawFees([SUSD.address]);
        }
    }

    async function createCheckpointsSOV(number) {
        for (let i = 0; i < number; i++) {
            await setFeeTokensHeld(new BN(100), new BN(200), new BN(300), false, true);
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            await feeSharingCollector.withdrawFees([SOVToken.address]);
        }
    }

    async function createVestingContractWithSingleDate(cliff, amount, tokenOwner) {
        vestingLogic = await VestingLogic.new();
        let vestingInstance = await Vesting.new(
            vestingLogic.address,
            SOVToken.address,
            staking.address,
            tokenOwner,
            cliff,
            cliff,
            feeSharingCollector.address
        );
        vestingInstance = await VestingLogic.at(vestingInstance.address);
        // important, so it's recognized as vesting contract
        await staking.addContractCodeHash(vestingInstance.address);

        await SOVToken.approve(vestingInstance.address, amount);
        let result = await vestingInstance.stakeTokens(amount);
        return { vestingInstance: vestingInstance, blockNumber: result.receipt.blockNumber };
    }
});
