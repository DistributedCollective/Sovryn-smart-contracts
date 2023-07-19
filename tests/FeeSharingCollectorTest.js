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
 *     Update to use WRBTC as collateral token, instead of custom testWrbtc.
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

const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwap");
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
const mutexUtils = require("./reentrancy/utils");

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

    let RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT;
    let root, account1, account2, account3, account4;
    let SOVToken, SUSD, WRBTC, sovryn, staking;
    let loanTokenSettings, loanTokenLogic, loanToken;
    let feeSharingCollectorProxyObj;
    let feeSharingCollector;
    let feeSharingCollectorLogic;
    let loanTokenWrbtc;
    let tradingFeePercent;
    let mockPrice;
    let liquidityPoolV1Converter;
    let iWeightedStakingModuleMockup;

    before(async () => {
        [root, account1, account2, account3, account4, ...accounts] = accounts;
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
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

        // Deploying sovrynProtocol w/ generic function from initializer.js
        /// @dev Tried but no success so far. When using the getSovryn function
        ///   , contracts revert w/ "target not active" error.
        ///   The weird thing is that deployment code below is exactly the same as
        ///   the code from getSovryn function at initializer.js.
        ///   Inline code works ok, but when calling the function it does not.
        // sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        // await sovryn.setSovrynProtocolAddress(sovryn.address);

        const sovrynproxy = await Protocol.new();
        sovryn = await ISovryn.at(sovrynproxy.address);

        await sovryn.replaceContract((await ProtocolSettings.new()).address);
        await sovryn.replaceContract((await LoanSettings.new()).address);
        await sovryn.replaceContract((await LoanMaintenance.new()).address);
        await sovryn.replaceContract((await SwapsExternal.new()).address);

        await sovryn.setWrbtcToken(WRBTC.address);

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
            WRBTC.address
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

        // Set loan pool for wRBTC -- because our fee sharing proxy required the loanPool of wRBTC
        loanTokenLogicWrbtc = await LoanTokenLogicWrbtc.new();
        loanTokenWrbtc = await LoanToken.new(
            root,
            loanTokenLogicWrbtc.address,
            sovryn.address,
            WRBTC.address
        );
        await loanTokenWrbtc.initialize(WRBTC.address, "iWRBTC", "iWRBTC");

        loanTokenWrbtc = await LoanTokenLogicWrbtc.at(loanTokenWrbtc.address);
        const loanTokenAddressWrbtc = await loanTokenWrbtc.loanTokenAddress();
        await sovryn.setLoanPool([loanTokenWrbtc.address], [loanTokenAddressWrbtc]);

        await WRBTC.mint(sovryn.address, wei("500", "ether"));

        await sovryn.setWrbtcToken(WRBTC.address);
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
        feeds = await PriceFeedsLocal.new(WRBTC.address, sovryn.address);
        mockPrice = "1";
        await feeds.setRates(SUSD.address, WRBTC.address, wei(mockPrice, "ether"));
        const swaps = await SwapsImplSovrynSwap.new();
        const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
        await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);
        await sovryn.setSupportedTokens([SUSD.address, WRBTC.address], [true, true]);
        await sovryn.setPriceFeedContract(
            feeds.address // priceFeeds
        );
        await sovryn.setSwapsImplContract(
            swaps.address // swapsImpl
        );

        tradingFeePercent = await sovryn.tradingFeePercent();
        await lend_btc_before_cashout(loanTokenWrbtc, new BN(wei("10", "ether")), root);

        const maxDisagreement = new BN(wei("5", "ether"));
        await sovryn.setMaxDisagreement(maxDisagreement);

        RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT =
            await feeSharingCollector.RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT();

        return sovryn;
    }

    beforeEach(async () => {
        await loadFixture(protocolDeploymentFixture);
    });

    describe("withdrawStartingFromCheckpoint, withdrawRBTCStartingFromCheckpoint, withdrawRbtcTokenStartingFromCheckpoint and getNextPositiveUserCheckpoint", () => {
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

        // If calling withdrawStartingFromCheckpoint or withdrawRBTCStartingFromCheckpoint  with _fromCheckpoint > processedCheckpoints[user][_loanPoolToken] it starts calculating the fees from _fromCheckpoint
        it("withdrawStartingFromCheckpoint calculates fees correctly", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// RBTC
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

            let tx = await feeSharingCollector.withdrawStartingFromCheckpoint(
                SOVToken.address,
                nextPositive.checkpointNum,
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

        it("withdrawStartingFromCheckpoint works with large number of unprocessed token checkpoints", async () => {
            // To test this, create 250 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// RBTC
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

            let tx = await feeSharingCollector.withdrawStartingFromCheckpoint(
                SOVToken.address,
                nextPositive.checkpointNum.toNumber(),
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

        it("withdrawRbtcTokenStartingFromCheckpoint calculates fees correctly", async () => {
            // To test this, create 9 checkpoints while the user has no stake, then stake with the user, create another checkpoint and call withdrawRbtcTokenStartingFromCheckpoint with _fromCheckpoint = 10  and _maxCheckpoints = 3

            /// RBTC
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);

            await stake(userStake, account1);
            await createCheckpoints(1);

            let nextPositive = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );

            let tx = await feeSharingCollector.withdrawRbtcTokenStartingFromCheckpoint(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT],
                [nextPositive.checkpointNum.toNumber()],
                3,
                ZERO_ADDRESS,
                { from: account1 }
            );

            expectEvent(tx, "RBTCWithdrawn", {
                sender: account1,
                amount: new BN(60),
            });

            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.equal(10);
        });

        it("getNextPositiveUserCheckpoint for RBTC returns the first checkpoint on which the user has a stake > 0", async () => {
            await stake(900, root);
            const userStake = 100;

            await SOVToken.transfer(account1, userStake);
            await createCheckpoints(9);

            await stake(userStake, account1);
            await createCheckpoints(1);

            const nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0,
                MAX_NEXT_POSITIVE_CHECKPOINT
            );
            expect(nextCheckpoint.checkpointNum.toNumber()).to.eql(10);
        });

        it("getNextPositiveUserCheckpoint reverts on _maxCheckpoints == 0", async () => {
            await expectRevert(
                feeSharingCollector.getNextPositiveUserCheckpoint(
                    account1,
                    RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
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

        it("withdrawStartingFromCheckpoint and withdrawRBTCStartingFromCheckpoint revert if _fromCheckpoint == 0", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);
            await expectRevert(
                feeSharingCollector.withdrawStartingFromCheckpoint(
                    SOVToken.address,
                    0,
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > 1"
            );

            await expectRevert(
                feeSharingCollector.withdrawRbtcTokenStartingFromCheckpoint(
                    [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT],
                    [0],
                    10,
                    ZERO_ADDRESS, {
                    from: account1,
                }),
                "_fromCheckpoint param must be > 1"
            );
        });

        it("withdrawStartingFromCheckpoint and withdrawRBTCStartingFromCheckpoint revert if _fromCheckpoint < processedCheckpoints[user][_token]", async () => {
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
                feeSharingCollector.withdrawStartingFromCheckpoint(
                    SOVToken.address,
                    3,
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > userProcessedCheckpoints"
            );

            await expectRevert(
                feeSharingCollector.withdrawStartingFromCheckpoint(
                    SOVToken.address,
                    2,
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                2
            );

            await expectRevert(
                feeSharingCollector.withdrawRbtcTokenStartingFromCheckpoint(
                    [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT],
                    [2],
                    10,
                    ZERO_ADDRESS, {
                    from: account1,
                }),
                "_fromCheckpoint param must be > userProcessedCheckpoints"
            );

            await feeSharingCollector.setUserProcessedCheckpoints(account1, SOVToken.address, 2);

            await expectRevert(
                feeSharingCollector.withdrawStartingFromCheckpoint(
                    SOVToken.address,
                    2,
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "_fromCheckpoint param must be > userProcessedCheckpoints"
            );
        });

        it("withdrawStartingFromCheckpoint and withdrawRBTCStartingFromCheckpoint revert if the user had a stake > 0 at _fromCheckpoint - 1", async () => {
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
                feeSharingCollector.withdrawStartingFromCheckpoint(
                    SOVToken.address,
                    2,
                    10,
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "User weighted stake should be zero at previous checkpoint"
            );

            // RBTC
            for (let i = 0; i < 2; i++) {
                await feeSharingCollector.addCheckPoint(
                    RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                    userStake
                );
                await increaseTime(FEE_WITHDRAWAL_INTERVAL);
                await mineBlock();
            }
            await feeSharingCollector.addCheckPoint(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, userStake);
            await feeSharingCollector.setUserProcessedCheckpoints(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                1
            );
            await expectRevert(
                feeSharingCollector.withdrawRbtcTokenStartingFromCheckpoint(
                    [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT],
                    [2],
                    10,
                    ZERO_ADDRESS, {
                    from: account1,
                }),
                "User weighted stake should be zero at previous checkpoint"
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
        it("getNextPositiveUserCheckpoint for RBTC returns correct [checkpointNum, hasSkippedCheckpoints, hasFees]", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            let nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                9
            );

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );

            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);
            await createCheckpoints(1);

            nextCheckpoint = await feeSharingCollector.getNextPositiveUserCheckpoint(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                5
            );
            expect(
                (
                    await feeSharingCollector.totalTokenCheckpoints(
                        RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
                    )
                ).toNumber()
            )
                .equal(
                    (
                        await feeSharingCollector.numTokenCheckpoints(
                            RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
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
            expectEvent(tx, "FeeWithdrawnInRBTC", {
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
            let previousProtocolWrbtcBalance = await WRBTC.balanceOf(protocol.address);
            // let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            await protocol.setFeesController(root);
            let tx = await protocol.withdrawFees([SUSD.address], root);
            let latestProtocolWrbtcBalance = await WRBTC.balanceOf(protocol.address);

            await checkWithdrawFee();

            //check wrbtc balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let userBalance = await WRBTC.balanceOf.call(root);
            expect(userBalance.toString()).to.be.equal(feeAmount.toString());

            // wrbtc balance should remain the same
            expect(previousProtocolWrbtcBalance.toString()).to.equal(
                latestProtocolWrbtcBalance.toString()
            );

            expectEvent(tx, "WithdrawFees", {
                sender: root,
                token: SUSD.address,
                receiver: root,
                lendingAmount: lendingFeeTokensHeld,
                tradingAmount: tradingFeeTokensHeld,
                borrowingAmount: borrowingFeeTokensHeld,
                // amountConvertedToWRBTC
            });
        });

        it("ProtocolSettings.withdrawFees (WRBTC token)", async () => {
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
            let tx = await sovryn.withdrawFees([WRBTC.address], account1);

            await checkWithdrawFee(true, true, false);

            //check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let userBalance = await WRBTC.balanceOf.call(account1);
            expect(userBalance.toString()).to.be.equal(feeAmount.toString());

            expectEvent(tx, "WithdrawFees", {
                sender: root,
                token: WRBTC.address,
                receiver: account1,
                lendingAmount: lendingFeeTokensHeld,
                tradingAmount: tradingFeeTokensHeld,
                borrowingAmount: borrowingFeeTokensHeld,
                wRBTCConverted: new BN(feeAmount),
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
            let previousProtocolWrbtcBalance = await WRBTC.balanceOf(protocol.address);
            let previousFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );

            tx = await feeSharingCollector.withdrawFees([SUSD.address]);

            await checkWithdrawFee();

            //check irbtc balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            // feeSharingCollector no longer provides the liquidity to lending pool.
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // make sure wrbtc balance is 0 after withdrawal
            let feeSharingCollectorProxyWRBTCBalance = await WRBTC.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyWRBTCBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            // wrbtc balance should remain the same
            let latestProtocolWrbtcBalance = await WRBTC.balanceOf(protocol.address);
            expect(previousProtocolWrbtcBalance.toString()).to.equal(
                latestProtocolWrbtcBalance.toString()
            );

            // rbtc balance of feeSharingCollector should be increased
            let latestFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(
                previousFeeSharingCollectorProxyRBTCBalance.add(new BN(feeAmount)).toString()
            ).to.equal(latestFeeSharingCollectorProxyRBTCBalance.toString());

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());
            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "FeeWithdrawnInRBTC", {
                sender: root,
                amount: feeAmount,
            });
        });

        it("Should be able to withdraw fees (WRBTC token)", async () => {
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

            let previousFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );

            tx = await feeSharingCollector.withdrawFees([WRBTC.address]);

            await checkWithdrawFee();

            //check irbtc balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // make sure wrbtc balance is 0 after withdrawal
            let feeSharingCollectorProxyWRBTCBalance = await WRBTC.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyWRBTCBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            // rbtc balance of feeSharingCollector should be increased
            let latestFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(
                previousFeeSharingCollectorProxyRBTCBalance.add(new BN(feeAmount)).toString()
            ).to.equal(latestFeeSharingCollectorProxyRBTCBalance.toString());

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "FeeWithdrawnInRBTC", {
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

            let previousFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );

            tx = await feeSharingCollector.withdrawFees([SOVToken.address]);

            await checkWithdrawFee(false, false, true);

            //check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal(feeAmount.toString());

            // special for SOV token, it won't be converted into rbtc, instead it will directly transfer SOV to feeSharingCollector.
            // so the rbtc balance should remain the same.
            let latestFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(previousFeeSharingCollectorProxyRBTCBalance.toString()).to.equal(
                latestFeeSharingCollectorProxyRBTCBalance.toString()
            );

            // make sure wrbtc balance is 0 after withdrawal
            let feeSharingCollectorProxyWRBTCBalance = await WRBTC.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyWRBTCBalance.toString()).to.be.equal(
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

            // check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
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

            // check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
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
            // In this state the price of SUSD/WRBTC already adjusted because of previous swap, so we need to consider this in the next swapFee calculation
            await checkWithdrawFee();

            // check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // checkpoints
            totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            // make sure wrbtc balance is 0 after withdrawal
            let feeSharingCollectorProxyWRBTCBalance = await WRBTC.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyWRBTCBalance.toString()).to.be.equal(
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

        it("Shouldn't be able to withdraw without checkpoints (for wRBTC pool)", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.withdraw(loanTokenWrbtc.address, 0, account2, {
                    from: account1,
                }),
                "FeeSharingCollector::withdraw: _maxCheckpoints should be positive"
            );
        });

        it("Shifts user's processed checkpoints to max checkpoints if no fees due within max checkpoints and no previous checkpoints", async () => {
            await protocolDeploymentFixture();
            await stake(900, root);
            await createCheckpointsSOV(10);
            let fees = await feeSharingCollector.getAccumulatedFees(account1, SOVToken.address);
            expect(fees).to.be.bignumber.equal("0");

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

        it("Shouldn't be able to withdraw zero amount (for wRBTC pool)", async () => {
            await protocolDeploymentFixture();
            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                loanTokenWrbtc.address
            );
            expect(fees).to.be.bignumber.equal("0");

            await expectRevert(
                feeSharingCollector.withdraw(loanTokenWrbtc.address, 10, ZERO_ADDRESS, {
                    from: account1,
                }),
                "FeeSharingCollector::withdrawFees: no tokens for withdrawal"
            );
        });

        it("Should be able to withdraw to another account", async () => {
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(new BN(feeAmount).mul(new BN(3)).div(new BN(10)));

            let tx = await feeSharingCollector.withdrawRbtcToken([RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT], 1000, account2, {
                from: account1,
            });

            // processedCheckpoints
            let [processedCheckpointsRBTC, processedCheckpointsWRBTC, processedCheckpointsIWRBTC] =
                await Promise.all([
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
                    ),
                    feeSharingCollector.processedCheckpoints.call(account1, WRBTC.address),
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        loanTokenWrbtc.address
                    ),
                ]);

            expect(processedCheckpointsRBTC.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWRBTC.toNumber()).to.be.equal(0);
            expect(processedCheckpointsIWRBTC.toNumber()).to.be.equal(0);

            expectEvent(tx, "RBTCWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw to another account (WRBTC)", async () => {
            await protocolDeploymentFixture();

            // FeeSharingCollectorProxy
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await sovryn.setFeesController(feeSharingCollector.address);

            await WRBTC.mint(feeSharingCollector.address, wei("2", "ether"));

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

            /** Add checkpoint for WRBTC */
            await feeSharingCollector.addCheckPoint(WRBTC.address, totalFeeTokensHeld.toString());

            /** Add checkpoint for iWRBTC */
            await feeSharingCollector.addCheckPoint(
                loanTokenWrbtc.address,
                totalFeeTokensHeld.toString()
            );

            await loanTokenWrbtc.mintWithBTC(feeSharingCollector.address, false, {
                value: totalFeeTokensHeld,
            });

            await feeSharingCollector.withdrawFees([SUSD.address]);

            const accumulatedFeesRBTC = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            const accumulatedFeesWRBTC = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                WRBTC.address
            );
            const accumulatedFeesIRBTC = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                loanTokenWrbtc.address
            );

            expect(accumulatedFeesRBTC.toString()).to.equal(accumulatedFeesWRBTC.toString());
            expect(accumulatedFeesRBTC.toString()).to.equal(accumulatedFeesIRBTC.toString());

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(
                new BN(feeAmount).mul(new BN(userStakePercentage)).div(new BN(10))
            );

            let tx = await feeSharingCollector.withdrawRbtcToken([RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address], 1000, account2, {
                from: account1,
            });

            // processedCheckpoints
            let [processedCheckpointsRBTC, processedCheckpointsWRBTC, processedCheckpointsIWRBTC] =
                await Promise.all([
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
                    ),
                    feeSharingCollector.processedCheckpoints.call(account1, WRBTC.address),
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        loanTokenWrbtc.address
                    ),
                ]);

            expect(processedCheckpointsRBTC.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWRBTC.toNumber()).to.be.equal(1);
            expect(processedCheckpointsIWRBTC.toNumber()).to.be.equal(1);

            expectEvent(tx, "RBTCWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)), // the event will be emitted separately here
            }, { times: 3 });
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

        it("Should be able to withdraw to another account using withdrawRbtcToken()", async () => {
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(new BN(feeAmount).mul(new BN(3)).div(new BN(10)));

            let tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT],
                1000,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let [processedCheckpointsRBTC, processedCheckpointsWRBTC, processedCheckpointsIWRBTC] =
                await Promise.all([
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
                    ),
                    feeSharingCollector.processedCheckpoints.call(account1, WRBTC.address),
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        loanTokenWrbtc.address
                    ),
                ]);

            expect(processedCheckpointsRBTC.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWRBTC.toNumber()).to.be.equal(0);
            expect(processedCheckpointsIWRBTC.toNumber()).to.be.equal(0);

            expectEvent(tx, "RBTCWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw to another account (WRBTC) - using withdrawRbtcToken()", async () => {
            await protocolDeploymentFixture();

            // FeeSharingCollectorProxy
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            await sovryn.setFeesController(feeSharingCollector.address);

            await WRBTC.mint(feeSharingCollector.address, wei("2", "ether"));

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

            /** Add checkpoint for WRBTC */
            await feeSharingCollector.addCheckPoint(WRBTC.address, totalFeeTokensHeld.toString());

            /** Add checkpoint for iWRBTC */
            await feeSharingCollector.addCheckPoint(
                loanTokenWrbtc.address,
                totalFeeTokensHeld.toString()
            );

            await loanTokenWrbtc.mintWithBTC(feeSharingCollector.address, false, {
                value: totalFeeTokensHeld,
            });

            await feeSharingCollector.withdrawFees([SUSD.address]);

            const accumulatedFeesRBTC = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            const accumulatedFeesWRBTC = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                WRBTC.address
            );
            const accumulatedFeesIRBTC = await feeSharingCollector.getAccumulatedFees.call(
                account1,
                loanTokenWrbtc.address
            );

            expect(accumulatedFeesRBTC.toString()).to.equal(accumulatedFeesWRBTC.toString());
            expect(accumulatedFeesRBTC.toString()).to.equal(accumulatedFeesIRBTC.toString());

            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(
                new BN(feeAmount).mul(new BN(userStakePercentage)).div(new BN(10))
            );

            /** Withdraw RBTC */
            let tx1 = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT],
                1000,
                account2,
                {
                    from: account1,
                }
            );
            /** Withdraw WRBTC */
            let tx2 = await feeSharingCollector.withdrawRbtcToken([WRBTC.address], 1000, account2, {
                from: account1,
            });

            /** Withdraw IWRBTC */
            let tx3 = await feeSharingCollector.withdrawRbtcToken(
                [loanTokenWrbtc.address],
                1000,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let [processedCheckpointsRBTC, processedCheckpointsWRBTC, processedCheckpointsIWRBTC] =
                await Promise.all([
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
                    ),
                    feeSharingCollector.processedCheckpoints.call(account1, WRBTC.address),
                    feeSharingCollector.processedCheckpoints.call(
                        account1,
                        loanTokenWrbtc.address
                    ),
                ]);

            expect(processedCheckpointsRBTC.toNumber()).to.be.equal(1);
            expect(processedCheckpointsWRBTC.toNumber()).to.be.equal(1);
            expect(processedCheckpointsIWRBTC.toNumber()).to.be.equal(1);

            expectEvent(tx1, "RBTCWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)), // need multiple by 1 only since we only withdraw RBTC in tx1
            });

            expectEvent(tx2, "RBTCWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)), // need multiple by 1 only since we only withdraw WRBTC in tx2
            });

            expectEvent(tx3, "RBTCWithdrawn", {
                sender: account1,
                receiver: account2,
                amount: new BN(feeAmount)
                    .mul(new BN(userStakePercentage).mul(new BN(1)))
                    .div(new BN(10)), // need multiple by 1 only since we only withdraw IWRBTC in tx3
            });
        });

        it("Should be able to withdraw (WRBTC pool)", async () => {
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            let userInitialBtcBalance = new BN(await web3.eth.getBalance(account1));
            let tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address],
                30, ZERO_ADDRESS, {
                from: account1,
            });

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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            // check balances
            let feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );

            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal(0);
            let userLoanTokenBalance = await loanTokenWrbtc.balanceOf.call(account1);
            expect(userLoanTokenBalance.toNumber()).to.be.equal(0);
            let userExpectedBtcBalance = userInitialBtcBalance.add(
                feeAmount.mul(new BN(3)).div(new BN(10))
            );
            expect(userLatestBTCBalance.toString()).to.be.equal(userExpectedBtcBalance.toString());

            expectEvent(tx, "RBTCWithdrawn", {
                sender: account1,
                receiver: account1,
                amount: feeAmount.mul(new BN(3)).div(new BN(10)),
            }, {times: 3});
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
            let tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address],
                1,
                ZERO_ADDRESS, {
                from: account1,
            });

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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            // check balances
            let feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal(0);
            let userBalance = await loanTokenWrbtc.balanceOf.call(account1);
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
            let totalLoanTokenWRBTCBalanceShouldBeAccount1 = feeAmount;
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
            totalLoanTokenWRBTCBalanceShouldBeAccount1 =
                totalLoanTokenWRBTCBalanceShouldBeAccount1.add(feeAmount);
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            await feeSharingCollector.withdrawFees([SUSD.address]);

            // [SECOND] - [THIRD]
            userInitialBtcBalance = new BN(await web3.eth.getBalance(account1));
            tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address],
                2,
                ZERO_ADDRESS, {
                from: account1,
            });
            gasPrice = new BN(parseInt(tx.receipt.effectiveGasPrice));
            console.log("\nwithdraw(checkpoints = 2).gasUsed: " + tx.receipt.gasUsed);
            txFee = new BN(tx.receipt.gasUsed).mul(gasPrice);

            userInitialBtcBalance = userInitialBtcBalance.sub(new BN(txFee));

            // processedCheckpoints
            processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(3);

            // check balances
            feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toNumber()).to.be.equal(0);
            userBalance = await loanTokenWrbtc.balanceOf.call(account1);
            expect(userBalance.toNumber()).to.be.equal(0);

            userLatestBTCBalance = new BN(await web3.eth.getBalance(account1));

            expect(userLatestBTCBalance.toString()).to.be.equal(
                userInitialBtcBalance
                    .add(totalLoanTokenWRBTCBalanceShouldBeAccount1.mul(new BN(1)).div(new BN(10)))
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

            let tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address],
                1000,
                ZERO_ADDRESS, {
                from: account1,
            });
            console.log("\nwithdraw(checkpoints = 10).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
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

            let tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address],
                5,
                ZERO_ADDRESS, {
                from: account1,
            });
            console.log("\nwithdraw(checkpoints = 5).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(5);

            tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address],
                3,
                ZERO_ADDRESS, {
                from: account1,
            });
            console.log("\nwithdraw(checkpoints = 3).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(8);

            tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address],
                1000,
                ZERO_ADDRESS, {
                from: account1,
            });
            console.log("\nwithdraw(checkpoints = 2).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
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

            let tx = await feeSharingCollector.withdrawRbtcToken(
                [RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, WRBTC.address, loanTokenWrbtc.address],
                10,
                ZERO_ADDRESS, {
                from: account1,
            });
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
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
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
            await liquidityPoolV1Converter.setWrbtcToken(WRBTC.address);
            await WRBTC.mint(liquidityPoolV1Converter.address, wei("2", "ether"));

            let previousFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            tx = await feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]);

            //check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // rbtc balance of feeSharingCollector should be increased
            let latestFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(
                previousFeeSharingCollectorProxyRBTCBalance.add(new BN(feeAmount)).toString()
            ).to.equal(latestFeeSharingCollectorProxyRBTCBalance.toString());

            // make sure wrbtc balance is 0 after withdrawal
            let feeSharingCollectorProxyWRBTCBalance = await WRBTC.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyWRBTCBalance.toString()).to.be.equal("0");

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
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
            await liquidityPoolV1Converter.setWrbtcToken(WRBTC.address);
            await WRBTC.mint(liquidityPoolV1Converter.address, wei("2", "ether"));

            let previousFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            tx = await feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]);

            //check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal("0");

            // rbtc balance of feeSharingCollector should be increased
            let latestFeeSharingCollectorProxyRBTCBalance = new BN(
                await web3.eth.getBalance(feeSharingCollector.address)
            );
            expect(
                previousFeeSharingCollectorProxyRBTCBalance.add(new BN(feeAmount)).toString()
            ).to.equal(latestFeeSharingCollectorProxyRBTCBalance.toString());

            // make sure wrbtc balance is 0 after withdrawal
            let feeSharingCollectorProxyWRBTCBalance = await WRBTC.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyWRBTCBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
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
            await liquidityPoolV1Converter.setWrbtcToken(WRBTC.address);
            await WRBTC.mint(liquidityPoolV1Converter.address, wei("2", "ether"));

            tx = await feeSharingCollector.withdrawFeesAMM([liquidityPoolV1Converter.address]);

            //check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingCollectorProxyBalance = await loanTokenWrbtc.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyBalance.toString()).to.be.equal(feeAmount.toString());

            // make sure wrbtc balance is 0 after withdrawal
            let feeSharingCollectorProxyWRBTCBalance = await WRBTC.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingCollectorProxyWRBTCBalance.toString()).to.be.equal(
                new BN(0).toString()
            );

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                loanTokenWrbtc.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(0);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                loanTokenWrbtc.address,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(0);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(0);
            expect(checkpoint.numTokens.toString()).to.be.equal("0");

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                loanTokenWrbtc.address
            );
            expect(lastFeeWithdrawalTime.toString()).to.be.equal("0");
        });
    });

    describe("withdraw wrbtc", async () => {
        it("Withdraw wrbtc from non owner should revert", async () => {
            await protocolDeploymentFixture();
            const receiver = accounts[1];
            const previousBalanceReceiver = await WRBTC.balanceOf(receiver);
            await expectRevert(
                feeSharingCollector.withdrawWRBTC(receiver, 0, { from: accounts[1] }),
                "unauthorized"
            );
        });

        it("Withdraw 0 wrbtc", async () => {
            await protocolDeploymentFixture();
            const receiver = accounts[1];
            const previousBalanceReceiver = await WRBTC.balanceOf(receiver);
            await feeSharingCollector.withdrawWRBTC(receiver, 0);
            const latestBalanceReceiver = await WRBTC.balanceOf(receiver);
            const latestBalanceFeeSharingCollectorProxy = await WRBTC.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal("0");
            expect(latestBalanceFeeSharingCollectorProxy.toString()).to.equal("0");
        });

        it("Withdraw wrbtc more than the balance of feeSharingCollector should revert", async () => {
            await protocolDeploymentFixture();
            await WRBTC.mint(root, wei("500", "ether"));
            await WRBTC.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const previousBalanceReceiver = await WRBTC.balanceOf(receiver);
            const feeSharingCollectorProxyBalance = await WRBTC.balanceOf(
                feeSharingCollector.address
            );
            const amount = feeSharingCollectorProxyBalance.add(new BN(100));
            const previousBalanceFeeSharingCollectorProxy = await WRBTC.balanceOf(
                feeSharingCollector.address
            );

            await expectRevert(
                feeSharingCollector.withdrawWRBTC(receiver, amount.toString()),
                "Insufficient balance"
            );

            const latestBalanceReceiver = await WRBTC.balanceOf(receiver);
            const latestBalanceFeeSharingCollectorProxy = await WRBTC.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal("0");
            expect(latestBalanceFeeSharingCollectorProxy.toString()).to.equal(
                previousBalanceFeeSharingCollectorProxy.toString()
            );
        });

        it("Fully Withdraw wrbtc", async () => {
            await protocolDeploymentFixture();
            await WRBTC.mint(root, wei("500", "ether"));
            await WRBTC.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const previousBalanceReceiver = await WRBTC.balanceOf(receiver);
            const feeSharingCollectorProxyBalance = await WRBTC.balanceOf(
                feeSharingCollector.address
            );

            const tx = await feeSharingCollector.withdrawWRBTC(
                receiver,
                feeSharingCollectorProxyBalance.toString()
            );
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                WRBTC,
                "Transfer",
                {
                    src: feeSharingCollector.address,
                    dst: receiver,
                    wad: feeSharingCollectorProxyBalance.toString(),
                }
            );

            const latestBalanceReceiver = await WRBTC.balanceOf(receiver);
            const latestBalanceFeeSharingCollectorProxy = await WRBTC.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal(feeSharingCollectorProxyBalance.toString());
            expect(latestBalanceFeeSharingCollectorProxy.toString()).to.equal("0");
        });

        it("Partially Withdraw wrbtc", async () => {
            await protocolDeploymentFixture();
            await WRBTC.mint(root, wei("500", "ether"));
            await WRBTC.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const restAmount = new BN("100"); // 100 wei
            const previousBalanceReceiver = await WRBTC.balanceOf(receiver);
            const feeSharingCollectorProxyBalance = await WRBTC.balanceOf(
                feeSharingCollector.address
            );
            const amount = feeSharingCollectorProxyBalance.sub(restAmount);
            const previousBalanceFeeSharingCollectorProxy = await WRBTC.balanceOf(
                feeSharingCollector.address
            );
            expect(previousBalanceFeeSharingCollectorProxy.toString()).to.equal(wei("1", "ether"));

            const tx = await feeSharingCollector.withdrawWRBTC(receiver, amount.toString());
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                WRBTC,
                "Transfer",
                {
                    src: feeSharingCollector.address,
                    dst: receiver,
                    wad: amount,
                }
            );

            const latestBalanceReceiver = await WRBTC.balanceOf(receiver);
            const latestBalanceFeeSharingCollectorProxy = await WRBTC.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal(amount.toString());
            expect(latestBalanceFeeSharingCollectorProxy.toString()).to.equal(
                restAmount.toString()
            );

            // try to withdraw the rest
            const tx2 = await feeSharingCollector.withdrawWRBTC(
                receiver,
                latestBalanceFeeSharingCollectorProxy.toString()
            );
            const finalBalanceFeeSharingCollectorProxy = await WRBTC.balanceOf(
                feeSharingCollector.address
            );
            const finalBalanceReceiver = await WRBTC.balanceOf(receiver);
            expect(new BN(finalBalanceReceiver).toString()).to.equal(
                previousBalanceFeeSharingCollectorProxy.toString()
            );
            expect(finalBalanceFeeSharingCollectorProxy.toString()).to.equal("0");

            await expectEvent.inTransaction(
                tx2.receipt.rawLogs[0].transactionHash,
                WRBTC,
                "Transfer",
                {
                    src: feeSharingCollector.address,
                    dst: receiver,
                    wad: latestBalanceFeeSharingCollectorProxy.toString(),
                }
            );
        });
    });

    describe("get all rbtc balance after transferRBTC", async () => {
        it("deposit 0 RBTC should revert", async () => {
            await protocolDeploymentFixture();
            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            let amount = 1000;

            await expectRevert(
                feeSharingCollector.transferRBTC({ from: root, value: 0 }),
                "FeeSharingCollector::transferRBTC: invalid value"
            );
            const totalAccumulatedRBTCFee =
                await feeSharingCollector.getAccumulatedRBTCFeeBalances(root);
            expect(totalAccumulatedRBTCFee.toNumber()).to.equal(0);
            expect(
                await feeSharingCollector.unprocessedAmount.call(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT)
            ).to.be.bignumber.equal(new BN(0));
        });

        it("deposit RBTC should add the checkpoints", async () => {
            await protocolDeploymentFixture();
            // stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            let amount = 1000;

            let tx = await feeSharingCollector.transferRBTC({ from: root, value: amount });
            let totalAccumulatedRBTCFee = await feeSharingCollector.getAccumulatedRBTCFeeBalances(
                root
            );
            expect(totalAccumulatedRBTCFee.toString()).to.equal(new BN(amount).toString());

            expect(
                await feeSharingCollector.unprocessedAmount.call(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT)
            ).to.be.bignumber.equal(new BN(0));

            expectEvent(tx, "TokensTransferred", {
                sender: root,
                token: ZERO_ADDRESS,
                amount: new BN(amount),
            });

            // checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(amount.toString());

            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "CheckpointAdded", {
                sender: root,
                token: RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                amount: new BN(amount),
            });

            // second time
            tx = await feeSharingCollector.transferRBTC({ from: root, value: amount * 2 });
            totalAccumulatedRBTCFee = await feeSharingCollector.getAccumulatedRBTCFeeBalances(
                root
            );

            // the deposit still in the window of withdraw interval, so the accumulatedFees won't be added at this point.
            expect(totalAccumulatedRBTCFee.toString()).to.equal(new BN(amount).toString());

            expect(
                await feeSharingCollector.unprocessedAmount.call(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT)
            ).to.be.bignumber.equal(new BN(amount * 2));

            expectEvent(tx, "TokensTransferred", {
                sender: root,
                token: ZERO_ADDRESS,
                amount: new BN(amount * 2),
            });

            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            // third time
            tx = await feeSharingCollector.transferRBTC({ from: root, value: amount * 4 });

            totalAccumulatedRBTCFee = await feeSharingCollector.getAccumulatedRBTCFeeBalances(
                root
            );

            // already passed the withdrawal interval
            expect(totalAccumulatedRBTCFee.toString()).to.equal(new BN(amount * 7).toString());

            expect(
                await feeSharingCollector.unprocessedAmount.call(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT)
            ).to.be.bignumber.equal(new BN(0));

            // checkpoints
            totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                1
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toNumber()).to.be.equal(amount * 6);

            // check lastFeeWithdrawalTime
            lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());
        });
    });

    describe("recover incorrect allocated fees", async () => {
        let mockSOV, mockZUSD;
        let rbtcAmount = new BN(wei("878778886164898400", "wei"));

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
                value: rbtcAmount,
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

            expect(previousBalanceOwner.add(rbtcAmount).sub(txFee).toString()).to.be.equal(
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

        it("Should revert if rbtc transfer failed", async () => {
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );

            /** Should revert because feeSharingCollector does not have enough balance of rbtc */
            await expectRevert(
                feeSharingCollector.recoverIncorrectAllocatedFees(),
                "FeeSharingCollector::recoverIncorrectAllocatedFees: Withdrawal rbtc failed"
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
        wrbtcTokenFee = false,
        sovTokenFee = false
    ) {
        let totalFeeAmount = lendingFee.add(tradingFee).add(borrowingFee);
        let tokenFee;
        if (wrbtcTokenFee) {
            tokenFee = WRBTC;
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

    async function checkWithdrawFee(checkSUSD = true, checkWRBTC = false, checkSOV = false) {
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

        if (checkWRBTC) {
            lendingFeeTokensHeld = await sovryn.lendingFeeTokensHeld.call(WRBTC.address);
            expect(lendingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
            tradingFeeTokensHeld = await sovryn.tradingFeeTokensHeld.call(WRBTC.address);
            expect(tradingFeeTokensHeld.toString()).to.be.equal(new BN(0).toString());
            borrowingFeeTokensHeld = await sovryn.borrowingFeeTokensHeld.call(WRBTC.address);
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
