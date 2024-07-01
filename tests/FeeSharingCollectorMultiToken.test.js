const { expect } = require("chai");
const { loadFixture, takeSnapshot, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = constants;

const { etherMantissa, mineBlock, increaseTime } = require("./Utils/Ethereum.js");

const {
    deployAndGetIStaking,
    replaceStakingModule,
    getStakingModulesObject,
    getStakingModulesAddressList,
} = require("./Utils/initializer.js");

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

const FeeSharingCollector = artifacts.require("FeeSharingCollectorMultiToken");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const FeeSharingCollectorMockup = artifacts.require("FeeSharingCollectorMultiTokenMockup");
const MockSovrynDex = artifacts.require("MockSovrynDexMultiToken");
const WeightedStakingModuleMockup = artifacts.require("WeightedStakingModuleMockup");
const IWeightedStakingModuleMockup = artifacts.require("IWeightedStakingModuleMockup");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");

const VestingFactory = artifacts.require("VestingFactory");
const VestingRegistry = artifacts.require("VestingRegistry3");

const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const SwapsImplSovrynSwap = artifacts.require("SwapsImplSovrynSwapModule");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsExternal = artifacts.require("SwapsExternal");

const TOTAL_SUPPLY = etherMantissa(1000000000);

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const TWO_WEEKS = 1209600;

const MAX_VOTING_WEIGHT = 10;

const FEE_WITHDRAWAL_INTERVAL = 172800;

const MOCK_PRIOR_WEIGHTED_STAKE = false;

const wei = web3.utils.toWei;

const { lend_btc_before_cashout } = require("./loan-token/helpers.js");

const mutexUtils = require("../deployment/helpers/reentrancy/utils.js");

let cliff = 1; // This is in 4 weeks. i.e. 1 * 4 weeks.
let duration = 11; // This is in 4 weeks. i.e. 11 * 4 weeks.

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

contract("FeeSharingCollectorMultiToken:", (accounts) => {
    const name = "Test SOVToken";
    const symbol = "TST";

    let root, account1, account2, account3, account4;
    let SOVToken, SUSD, WrappedNativeToken, sovryn, staking;
    let loanTokenSettings, loanTokenLogic, loanToken;
    let feeSharingCollectorProxyObj;
    let feeSharingCollector;
    let feeSharingCollectorLogic;
    let loanWrappedNativeToken;
    let tradingFeePercent;
    let mockPrice;
    let sovrynDex;

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

        await replaceStakingModule(
            stakingProxy.address,
            modulesAddressList["WeightedStakingModule"],
            weightedStakingModuleMockup.address
        );

        iWeightedStakingModuleMockup = await IWeightedStakingModuleMockup.at(staking.address);

        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WrappedNativeToken = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WrappedNativeToken, SUSD, RBTC, BZRX);

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

        // FeeSharingCollector
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

        sovrynDex = await MockSovrynDex.new();

        await feeSharingCollector.initialize(WrappedNativeToken.address, sovrynDex.address);

        return sovryn;
    }

    beforeEach(async () => {
        await loadFixture(protocolDeploymentFixture);
    });

    describe("initialization", async () => {
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

        it("should revert if initialized more than once", async () => {
            const wrappedNativeTokenAddress = (
                await TestToken.new("WrappedNativeToken", "WNT", 18, 100)
            ).address;
            const loanWrappedNativeTokenAddress = (
                await TestToken.new("IWrappedNativeToken", "IWNT", 18, 100)
            ).address;
            await expectRevert(
                feeSharingCollector.initialize(wrappedNativeTokenAddress, sovrynDex.address),
                "function can only be called once"
            );
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
    });

    describe("withdrawFees", () => {
        it("Shouldn't be able to use zero token address", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.withdrawFees([ZERO_ADDRESS]),
                "FeeSharingCollectorMultiToken::withdrawFees: token is not a contract"
            );
        });

        it("Shouldn't be able to withdraw if wRBTC loan pool does not exist", async () => {
            await protocolDeploymentFixture();
            // Unset the loanPool for wRBTC
            await sovryn.setLoanPool([loanWrappedNativeToken.address], [ZERO_ADDRESS]);

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

            await expectRevert(
                feeSharingCollector.withdrawFees([WrappedNativeToken.address]),
                "FeeSharingCollectorMultiToken::withdrawFees: loan wrappedNativeTokenAddress not found"
            );
        });

        it("Shouldn't be able to withdraw zero amount", async () => {
            await protocolDeploymentFixture();
            const tx = await feeSharingCollector.withdrawFees([SUSD.address]);
            expectEvent(tx, "FeeWithdrawn", {
                sender: root,
                token: loanWrappedNativeToken.address,
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
            let previousProtocolWrbtcBalance = await WrappedNativeToken.balanceOf(
                protocol.address
            );
            // let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            await protocol.setFeesController(root);
            let tx = await protocol.withdrawFees([SUSD.address], root);
            let latestProtocolWrbtcBalance = await WrappedNativeToken.balanceOf(protocol.address);

            await checkWithdrawFee();

            //check wrappedNativeToken balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let userBalance = await WrappedNativeToken.balanceOf.call(root);
            expect(userBalance.toString()).to.be.equal(feeAmount.toString());

            // wrappedNativeToken balance should remain the same
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
            let tx = await sovryn.withdrawFees([WrappedNativeToken.address], account1);

            await checkWithdrawFee(true, true, false);

            //check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let userBalance = await WrappedNativeToken.balanceOf.call(account1);
            expect(userBalance.toString()).to.be.equal(feeAmount.toString());

            expectEvent(tx, "WithdrawFees", {
                sender: root,
                token: WrappedNativeToken.address,
                receiver: account1,
                lendingAmount: lendingFeeTokensHeld,
                tradingAmount: tradingFeeTokensHeld,
                borrowingAmount: borrowingFeeTokensHeld,
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
            let previousProtocolWrbtcBalance = await WrappedNativeToken.balanceOf(
                protocol.address
            );

            tx = await feeSharingCollector.withdrawFees([SUSD.address]);

            await checkWithdrawFee();

            //check irbtc balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toString()).to.be.equal(feeAmount.toString());

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingProxyWRBTCBalance = await WrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyWRBTCBalance.toString()).to.be.equal(new BN(0).toString());

            // wrappedNativeToken balance should remain the same
            let latestProtocolWrbtcBalance = await WrappedNativeToken.balanceOf(protocol.address);
            expect(previousProtocolWrbtcBalance.toString()).to.equal(
                latestProtocolWrbtcBalance.toString()
            );

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                loanWrappedNativeToken.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                loanWrappedNativeToken.address,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                loanWrappedNativeToken.address
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "FeeWithdrawn", {
                sender: root,
                token: loanWrappedNativeToken.address,
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

            tx = await feeSharingCollector.withdrawFees([WrappedNativeToken.address]);

            await checkWithdrawFee();

            //check irbtc balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toString()).to.be.equal(feeAmount.toString());

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingProxyWRBTCBalance = await WrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyWRBTCBalance.toString()).to.be.equal(new BN(0).toString());

            //checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                loanWrappedNativeToken.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                loanWrappedNativeToken.address,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                loanWrappedNativeToken.address
            );
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            expectEvent(tx, "FeeWithdrawn", {
                sender: root,
                token: loanWrappedNativeToken.address,
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
            tx = await feeSharingCollector.withdrawFees([SOVToken.address]);

            await checkWithdrawFee(false, false, true);

            //check WRBTC balance (wrbt balance = (totalFeeTokensHeld * mockPrice) - swapFee)
            let feeSharingProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toString()).to.be.equal(feeAmount.toString());

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingProxyWRBTCBalance = await WrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyWRBTCBalance.toString()).to.be.equal(new BN(0).toString());

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
            let feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toString()).to.be.equal(feeAmount.toString());

            // checkpoints
            let totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                loanWrappedNativeToken.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                loanWrappedNativeToken.address,
                0
            );
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(
                totalStake * MAX_VOTING_WEIGHT
            );
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());

            // check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime.call(
                loanWrappedNativeToken.address
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
            feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toString()).to.be.equal(totalFeeAmount.toString());

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
            feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toString()).to.be.equal(totalFeeAmount.toString());

            // checkpoints
            totalTokenCheckpoints = await feeSharingCollector.totalTokenCheckpoints.call(
                loanWrappedNativeToken.address
            );
            expect(totalTokenCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await feeSharingCollector.tokenCheckpoints.call(
                loanWrappedNativeToken.address,
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
                loanWrappedNativeToken.address
            );
            block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());

            // make sure wrappedNativeToken balance is 0 after withdrawal
            let feeSharingProxyWRBTCBalance = await WrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyWRBTCBalance.toString()).to.be.equal(new BN(0).toString());
        });
    });

    describe("withdraw Dex Fees", async () => {
        it("should not be able to withdraw fees if invalid token address", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            await expectRevert(
                feeSharingCollector.withdrawFeesFromDex([accounts[0]]),
                "FeeSharingCollector::withdrawFeesFromDex: token is not a contract"
            );
        });

        it("Should be able to withdraw Dex Fees", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            await expectRevert(
                feeSharingCollector.withdrawFeesFromDex([SUSD.address]),
                "Only Treasury"
            );

            //mock data
            const feeAmount = new BN(wei("1", "ether"));
            await sovrynDex.setTokenDexFee(SUSD.address, feeAmount.toString());
            await sovrynDex.setTreasury(feeSharingCollector.address);
            await sovrynDex.setWrbtcToken(WrappedNativeToken.address);

            await SUSD.mint(sovrynDex.address, wei("2000", "ether"));

            let previousProtocolBalance = await SUSD.balanceOf(sovrynDex.address);
            let previousFeeSharingCollectorBalance = await SUSD.balanceOf(
                feeSharingCollector.address
            );
            tx = await feeSharingCollector.withdrawFeesFromDex([SUSD.address]);

            let latestProtocolBalance = await SUSD.balanceOf(sovrynDex.address);
            let latestFeeSharingCollectorBalance = await SUSD.balanceOf(
                feeSharingCollector.address
            );

            expect(previousProtocolBalance.toString()).to.equal(
                latestProtocolBalance.add(feeAmount).toString()
            );

            expect(previousFeeSharingCollectorBalance.toString()).to.equal("0");
            expect(latestFeeSharingCollectorBalance.toString()).to.equal(feeAmount.toString());
        });

        it("Should not be able to withdraw with 0 AMM Fees", async () => {
            /// @dev This test requires redeploying the protocol
            await protocolDeploymentFixture();

            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(totalStake, root);

            await expectRevert(
                feeSharingCollector.withdrawFeesFromDex([SUSD.address]),
                "Only Treasury"
            );

            //mock data
            const feeAmount = new BN(wei("0", "ether"));
            await sovrynDex.setTokenDexFee(SUSD.address, feeAmount.toString());
            await sovrynDex.setTreasury(feeSharingCollector.address);
            await sovrynDex.setWrbtcToken(WrappedNativeToken.address);

            await SUSD.mint(sovrynDex.address, wei("2", "ether"));
            await expectRevert(
                feeSharingCollector.withdrawFeesFromDex([SUSD.address]),
                "FeeSharingCollectorMultiToken::transferTokens: invalid amount"
            );
        });
    });

    describe("transferTokens", () => {
        it("Shouldn't be able to use zero token address", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.transferTokens(ZERO_ADDRESS, 1000),
                "FeeSharingCollectorMultiToken::transferTokens: invalid address"
            );
        });

        it("Shouldn't be able to transfer zero amount", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.transferTokens(SOVToken.address, 0),
                "FeeSharingCollectorMultiToken::transferTokens: invalid amount"
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
                feeSharingCollector.withdraw(loanToken.address, 0, account2, { from: account1 }),
                "FeeSharingCollectorMultiToken::withdraw: _maxCheckpoints should be positive"
            );
        });

        it("Shouldn't be able to withdraw without checkpoints (for wRBTC pool)", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.withdraw(loanWrappedNativeToken.address, 0, account2, {
                    from: account1,
                }),
                "FeeSharingCollectorMultiToken::withdraw: _maxCheckpoints should be positive"
            );
        });

        it("Shouldn't be able to withdraw zero amount (for token pool)", async () => {
            await protocolDeploymentFixture();
            let fees = await feeSharingCollector.getAccumulatedFees(account1, loanToken.address);
            expect(fees).to.be.bignumber.equal("0");

            await expectRevert(
                feeSharingCollector.withdraw(loanToken.address, 10, ZERO_ADDRESS, {
                    from: account1,
                }),
                "FeeSharingCollectorMultiToken::withdrawFees: no tokens for a withdrawal"
            );
        });

        it("Shouldn't be able to withdraw zero amount (for wRBTC pool)", async () => {
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
                "FeeSharingCollectorMultiToken::withdrawFees: no tokens for a withdrawal"
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
                loanWrappedNativeToken.address
            );
            expect(fees).to.be.bignumber.equal(new BN(feeAmount).mul(new BN(3)).div(new BN(10)));

            let tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
                1000,
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account2,
                token: loanWrappedNativeToken.address,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw (token pool)", async () => {
            await protocolDeploymentFixture();
            // FeeSharingCollector
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            await feeSharingCollector.initialize(WrappedNativeToken.address, sovrynDex.address);

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // Mock (transfer loanToken to FeeSharingProxy contract)
            const loanPoolTokenAddress = await sovryn.underlyingToLoanPool(SUSD.address);
            const amountLend = new BN(wei("500", "ether"));
            await SUSD.approve(loanPoolTokenAddress, amountLend);
            await loanToken.mint(feeSharingCollector.address, amountLend);

            // Check ISUSD Balance for feeSharingProxy
            const feeSharingProxyLoanBalanceToken = await loanToken.balanceOf(
                feeSharingCollector.address
            );
            expect(feeSharingProxyLoanBalanceToken.toString()).to.be.equal(amountLend.toString());

            // Withdraw ISUSD from feeSharingProxy
            // const initial
            await feeSharingCollector.addCheckPoint(loanPoolTokenAddress, amountLend.toString());
            let tx = await feeSharingCollector.trueWithdrawTokens(
                [loanToken.address],
                [10],
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            const updatedFeeSharingProxyLoanBalanceToken = await loanToken.balanceOf(
                feeSharingCollector.address
            );
            const updatedAccount1LoanBalanceToken = await loanToken.balanceOf(account1);
            console.log("\nwithdraw(checkpoints = 1).gasUsed: " + tx.receipt.gasUsed);

            expect(updatedFeeSharingProxyLoanBalanceToken.toString()).to.be.equal(
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
                loanWrappedNativeToken.address
            );
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            let userInitialBtcBalance = new BN(await web3.eth.getBalance(account1));
            let tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
                10,
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
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            // check balances
            let feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
            let userLoanTokenBalance = await loanWrappedNativeToken.balanceOf.call(account1);
            expect(userLoanTokenBalance.toNumber()).to.be.equal(0);
            let userExpectedBtcBalance = userInitialBtcBalance.add(
                feeAmount.mul(new BN(3)).div(new BN(10))
            );
            expect(userLatestBTCBalance.toString()).to.be.equal(userExpectedBtcBalance.toString());

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account1,
                token: loanWrappedNativeToken.address,
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
            let feeSharingProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
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
            let feeSharingProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
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
            let tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
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
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            // check balances
            let feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal((totalFeeAmount * 9) / 10);
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
            tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
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
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(3);

            // check balances
            feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal(
                parseInt((totalFeeAmount * 9) / 10)
            );
            userBalance = await loanWrappedNativeToken.balanceOf.call(account1);
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

            let tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
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
                loanWrappedNativeToken.address
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

            let tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
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
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(5);

            tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
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
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(8);

            tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
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
                loanWrappedNativeToken.address
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

            let tx = await feeSharingCollector.withdraw(
                loanWrappedNativeToken.address,
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

    describe("withdrawTokens", () => {
        it("Shouldn't be able to withdraw without checkpoints (for token pool)", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.withdrawTokens([loanToken.address], [0], account2, {
                    from: account1,
                }),
                "FeeSharingCollectorMultiToken::withdraw: _maxCheckpoints should be positive"
            );
        });

        it("Shouldn't be able to withdraw without checkpoints (for wRBTC pool)", async () => {
            await protocolDeploymentFixture();
            await expectRevert(
                feeSharingCollector.withdrawTokens(
                    [loanWrappedNativeToken.address],
                    [0],
                    account2,
                    { from: account1 }
                ),
                "FeeSharingCollectorMultiToken::withdraw: _maxCheckpoints should be positive"
            );
        });

        it("Shouldn't be able to withdraw zero amount (for token pool)", async () => {
            await protocolDeploymentFixture();
            let fees = await feeSharingCollector.getAccumulatedFees(account1, loanToken.address);
            expect(fees).to.be.bignumber.equal("0");

            await expectRevert(
                feeSharingCollector.withdrawTokens([loanToken.address], [10], ZERO_ADDRESS, {
                    from: account1,
                }),
                "FeeSharingCollectorMultiToken::withdrawFees: no tokens for a withdrawal"
            );
        });

        it("Shouldn't be able to withdraw zero amount (for wRBTC pool)", async () => {
            await protocolDeploymentFixture();
            let fees = await feeSharingCollector.getAccumulatedFees(
                account1,
                loanWrappedNativeToken.address
            );
            expect(fees).to.be.bignumber.equal("0");

            await expectRevert(
                feeSharingCollector.withdrawTokens(
                    [loanWrappedNativeToken.address],
                    [10],
                    ZERO_ADDRESS,
                    {
                        from: account1,
                    }
                ),
                "FeeSharingCollectorMultiToken::withdrawFees: no tokens for a withdrawal"
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
                loanWrappedNativeToken.address
            );
            expect(fees).to.be.bignumber.equal(new BN(feeAmount).mul(new BN(3)).div(new BN(10)));

            let tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [1000],
                account2,
                {
                    from: account1,
                }
            );

            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account2,
                token: loanWrappedNativeToken.address,
                amount: new BN(feeAmount).mul(new BN(3)).div(new BN(10)),
            });
        });

        it("Should be able to withdraw (token pool)", async () => {
            await protocolDeploymentFixture();
            // FeeSharingCollector
            feeSharingCollector = await FeeSharingCollectorMockup.new(
                sovryn.address,
                staking.address
            );
            await sovryn.setFeesController(feeSharingCollector.address);

            await feeSharingCollector.initialize(WrappedNativeToken.address, sovrynDex.address);

            // stake - getPriorTotalVotingPower
            let rootStake = 700;
            await stake(rootStake, root);

            let userStake = 300;
            if (MOCK_PRIOR_WEIGHTED_STAKE) {
                await staking.MOCK_priorWeightedStake(userStake * 10);
            }
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);

            // Mock (transfer loanToken to FeeSharingProxy contract)
            const loanPoolTokenAddress = await sovryn.underlyingToLoanPool(SUSD.address);
            const amountLend = new BN(wei("500", "ether"));
            await SUSD.approve(loanPoolTokenAddress, amountLend);
            await loanToken.mint(feeSharingCollector.address, amountLend);

            // Check ISUSD Balance for feeSharingProxy
            const feeSharingProxyLoanBalanceToken = await loanToken.balanceOf(
                feeSharingCollector.address
            );
            expect(feeSharingProxyLoanBalanceToken.toString()).to.be.equal(amountLend.toString());

            // Withdraw ISUSD from feeSharingProxy
            // const initial
            await feeSharingCollector.addCheckPoint(loanPoolTokenAddress, amountLend.toString());
            let tx = await feeSharingCollector.trueWithdrawTokens(
                [loanToken.address],
                [10],
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            const updatedFeeSharingProxyLoanBalanceToken = await loanToken.balanceOf(
                feeSharingCollector.address
            );
            const updatedAccount1LoanBalanceToken = await loanToken.balanceOf(account1);
            console.log("\nwithdraw(checkpoints = 1).gasUsed: " + tx.receipt.gasUsed);

            expect(updatedFeeSharingProxyLoanBalanceToken.toString()).to.be.equal(
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
                loanWrappedNativeToken.address
            );
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            let userInitialBtcBalance = new BN(await web3.eth.getBalance(account1));
            let tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [10],
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
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            // check balances
            let feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
            let userLoanTokenBalance = await loanWrappedNativeToken.balanceOf.call(account1);
            expect(userLoanTokenBalance.toNumber()).to.be.equal(0);
            let userExpectedBtcBalance = userInitialBtcBalance.add(
                feeAmount.mul(new BN(3)).div(new BN(10))
            );
            expect(userLatestBTCBalance.toString()).to.be.equal(userExpectedBtcBalance.toString());

            expectEvent(tx, "UserFeeWithdrawn", {
                sender: account1,
                receiver: account1,
                token: loanWrappedNativeToken.address,
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
            expect(fees).to.be.bignumber.equal(feeAmount.mul(new BN(3)).div(new BN(10)));

            let userInitialISOVBalance = await SOVToken.balanceOf(account1);
            let tx = await feeSharingCollector.withdrawTokens(
                [SOVToken.address],
                [10],
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
            let feeSharingProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
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
            let tx = await feeSharingCollector.withdrawTokens([SOVToken.address], [10], account2, {
                from: account1,
            });

            //processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                SOVToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            //check balances
            let feeSharingProxyBalance = await SOVToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal((feeAmount * 7) / 10);
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
            let tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [1],
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
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(1);

            // check balances
            let feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal((totalFeeAmount * 9) / 10);
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
            tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [2],
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
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(3);

            // check balances
            feeSharingProxyBalance = await loanWrappedNativeToken.balanceOf.call(
                feeSharingCollector.address
            );
            expect(feeSharingProxyBalance.toNumber()).to.be.equal(
                parseInt((totalFeeAmount * 9) / 10)
            );
            userBalance = await loanWrappedNativeToken.balanceOf.call(account1);
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

            let tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [1000],
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 10).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                loanWrappedNativeToken.address
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

            let tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [5],
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 5).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            let processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(5);

            tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [3],
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 3).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                loanWrappedNativeToken.address
            );
            expect(processedCheckpoints.toNumber()).to.be.equal(8);

            tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [1000],
                ZERO_ADDRESS,
                {
                    from: account1,
                }
            );
            console.log("\nwithdraw(checkpoints = 2).gasUsed: " + tx.receipt.gasUsed);
            // processedCheckpoints
            processedCheckpoints = await feeSharingCollector.processedCheckpoints.call(
                account1,
                loanWrappedNativeToken.address
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

            let tx = await feeSharingCollector.withdrawTokens(
                [loanWrappedNativeToken.address],
                [10],
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
                "FeeSharingCollectorMultiToken::withdrawFees: no tokens for a withdrawal"
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
                loanWrappedNativeToken.address
            );

            // 100% of the fees should go to the user -> vesting contract not considered
            expect(feesWithdrawn).to.be.bignumber.equal(userFees);
        });
    });

    describe("withdraw wrbtc", async () => {
        it("Withdraw wrappedNativeToken from non owner should revert", async () => {
            await protocolDeploymentFixture();
            const receiver = accounts[1];
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            await expectRevert(
                feeSharingCollector.withdrawWrappedNativeToken(receiver, 0, { from: accounts[1] }),
                "unauthorized"
            );
        });

        it("Withdraw 0 wrbtc", async () => {
            await protocolDeploymentFixture();
            const receiver = accounts[1];
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            await feeSharingCollector.withdrawWrappedNativeToken(receiver, 0);
            const latestBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const latestBalanceFeeSharingProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal("0");
            expect(latestBalanceFeeSharingProxy.toString()).to.equal("0");
        });

        it("Withdraw wrappedNativeToken more than the balance of feeSharingProxy should revert", async () => {
            await protocolDeploymentFixture();
            await WrappedNativeToken.mint(root, wei("500", "ether"));
            await WrappedNativeToken.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const feeSharingProxyBalance = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );
            const amount = feeSharingProxyBalance.add(new BN(100));
            const previousBalanceFeeSharingProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            await expectRevert(
                feeSharingCollector.withdrawWrappedNativeToken(receiver, amount.toString()),
                "Insufficient balance"
            );

            const latestBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const latestBalanceFeeSharingProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal("0");
            expect(latestBalanceFeeSharingProxy.toString()).to.equal(
                previousBalanceFeeSharingProxy.toString()
            );
        });

        it("Fully Withdraw wrbtc", async () => {
            await protocolDeploymentFixture();
            await WrappedNativeToken.mint(root, wei("500", "ether"));
            await WrappedNativeToken.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const feeSharingProxyBalance = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            const tx = await feeSharingCollector.withdrawWrappedNativeToken(
                receiver,
                feeSharingProxyBalance.toString()
            );
            await expectEvent.inTransaction(
                tx.receipt.rawLogs[0].transactionHash,
                WrappedNativeToken,
                "Transfer",
                {
                    src: feeSharingCollector.address,
                    dst: receiver,
                    wad: feeSharingProxyBalance.toString(),
                }
            );

            const latestBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const latestBalanceFeeSharingProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal(feeSharingProxyBalance.toString());
            expect(latestBalanceFeeSharingProxy.toString()).to.equal("0");
        });

        it("Partially Withdraw wrbtc", async () => {
            await protocolDeploymentFixture();
            await WrappedNativeToken.mint(root, wei("500", "ether"));
            await WrappedNativeToken.transfer(feeSharingCollector.address, wei("1", "ether"));

            const receiver = accounts[1];
            const restAmount = new BN("100"); // 100 wei
            const previousBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            const feeSharingProxyBalance = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );
            const amount = feeSharingProxyBalance.sub(restAmount);
            const previousBalanceFeeSharingProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );
            expect(previousBalanceFeeSharingProxy.toString()).to.equal(wei("1", "ether"));

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
            const latestBalanceFeeSharingProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );

            expect(
                new BN(latestBalanceReceiver).sub(new BN(previousBalanceReceiver)).toString()
            ).to.equal(amount.toString());
            expect(latestBalanceFeeSharingProxy.toString()).to.equal(restAmount.toString());

            // try to withdraw the rest
            const tx2 = await feeSharingCollector.withdrawWrappedNativeToken(
                receiver,
                latestBalanceFeeSharingProxy.toString()
            );
            const finalBalanceFeeSharingProxy = await WrappedNativeToken.balanceOf(
                feeSharingCollector.address
            );
            const finalBalanceReceiver = await WrappedNativeToken.balanceOf(receiver);
            expect(new BN(finalBalanceReceiver).toString()).to.equal(
                previousBalanceFeeSharingProxy.toString()
            );
            expect(finalBalanceFeeSharingProxy.toString()).to.equal("0");

            await expectEvent.inTransaction(
                tx2.receipt.rawLogs[0].transactionHash,
                WrappedNativeToken,
                "Transfer",
                {
                    src: feeSharingCollector.address,
                    dst: receiver,
                    wad: latestBalanceFeeSharingProxy.toString(),
                }
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
