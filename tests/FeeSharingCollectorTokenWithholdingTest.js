/**
 * Tests for FeeSharingCollector Token-Specific Withholding feature
 */

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = constants;
const { etherMantissa, increaseTime, mineBlock } = require("./Utils/Ethereum");

const {
    deployAndGetIStaking,
    getStakingModulesObject,
    getSUSD,
    getRBTC,
    getWRBTC,
    getLoanTokenLogicWrbtc,
} = require("./Utils/initializer");

const TestToken = artifacts.require("TestToken");
const StakingProxy = artifacts.require("StakingProxy");
const ISovryn = artifacts.require("ISovryn");
const Protocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettingsMockup");
const LoanToken = artifacts.require("LoanToken");
const ILoanTokenLogicProxy = artifacts.require("ILoanTokenLogicProxy");
const ILoanTokenModules = artifacts.require("ILoanTokenModules");
const FeeSharingCollector = artifacts.require("FeeSharingCollector");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const LiquidityPoolV1Converter = artifacts.require("LiquidityPoolV1ConverterMockup");

const mutexUtils = require("../deployment/helpers/reentrancy/utils");

const TOTAL_SUPPLY = etherMantissa(1000000000);
const FEE_WITHDRAWAL_INTERVAL = 172800;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const wei = web3.utils.toWei;

contract("FeeSharingCollector - Token-Specific Withholding", (accounts) => {
    const name = "Test token";
    const symbol = "TST";

    let root, account1, account2, account3;
    let SOVToken, staking, feeSharingCollector;
    let SUSD, WRBTC, loanTokenWrbtc;
    let sovryn;
    let RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT;

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
    });

    async function deploymentFixture(_wallets, _provider) {
        await mutexUtils.getOrDeployMutex();

        // Deploy SOV Token
        SOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);

        // Deploy Staking
        const stakingProxy = await StakingProxy.new(SOVToken.address);
        const modulesObject = await getStakingModulesObject();
        staking = await deployAndGetIStaking(stakingProxy.address, modulesObject);

        // Get standard tokens
        SUSD = await getSUSD();
        const RBTC = await getRBTC();
        WRBTC = await getWRBTC();

        // Deploy Sovryn Protocol
        const sovrynproxy = await Protocol.new();
        sovryn = await ISovryn.at(sovrynproxy.address);
        await sovryn.replaceContract((await ProtocolSettings.new()).address);
        await sovryn.setWrbtcToken(WRBTC.address);
        sovryn = await ProtocolSettings.at(sovryn.address);

        // Deploy Loan Token for WRBTC
        const initLoanTokenLogicWrbtc = await getLoanTokenLogicWrbtc();
        const loanTokenLogicWrbtc = initLoanTokenLogicWrbtc[0];
        const loanTokenLogicBeaconWrbtc = initLoanTokenLogicWrbtc[1];

        loanTokenWrbtc = await LoanToken.new(
            root,
            loanTokenLogicWrbtc.address,
            sovryn.address,
            WRBTC.address
        );
        await loanTokenWrbtc.initialize(WRBTC.address, "iWRBTC", "iWRBTC");

        loanTokenWrbtc = await ILoanTokenLogicProxy.at(loanTokenWrbtc.address);
        await loanTokenWrbtc.setBeaconAddress(loanTokenLogicBeaconWrbtc.address);

        loanTokenWrbtc = await ILoanTokenModules.at(loanTokenWrbtc.address);

        // Deploy FeeSharingCollector
        const feeSharingCollectorLogic = await FeeSharingCollector.new();
        const feeSharingCollectorProxyObj = await FeeSharingCollectorProxy.new(
            sovryn.address,
            staking.address
        );
        await feeSharingCollectorProxyObj.setImplementation(feeSharingCollectorLogic.address);
        feeSharingCollector = await FeeSharingCollector.at(feeSharingCollectorProxyObj.address);

        await sovryn.setFeesController(feeSharingCollector.address);
        await sovryn.setSOVTokenAddress(SOVToken.address);

        // Initialize FeeSharingCollector
        await feeSharingCollector.initialize(WRBTC.address, loanTokenWrbtc.address);

        RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT =
            await feeSharingCollector.RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT();

        // Stake SOV so that _writeTokenCheckpoint doesn't revert with "Invalid totalWeightedStake"
        const stakeAmount = new BN(wei("1000", "ether"));
        await SOVToken.approve(staking.address, stakeAmount);
        let kickoffTS = await staking.kickoffTS.call();
        let stakingDate = kickoffTS.add(new BN(MAX_DURATION));
        await staking.stake(stakeAmount, stakingDate, root, root);
        await mineBlock();

        return sovryn;
    }

    beforeEach(async () => {
        await loadFixture(deploymentFixture);
    });

    describe("Protocol Withhold Token List Management", () => {
        it("should start with empty withhold list", async () => {
            const tokens = await feeSharingCollector.getProtocolWithholdTokensList();
            assert.equal(tokens.length, 0, "Withhold list should be empty initially");
        });

        it("should allow owner to add token to withhold list", async () => {
            const tx = await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, {
                from: root,
            });

            expectEvent(tx, "TokenAddedToProtocolWithholdList", {
                sender: root,
                token: SOVToken.address,
            });

            const isInList = await feeSharingCollector.isTokenInProtocolWithholdList(
                SOVToken.address
            );
            assert.equal(isInList, true, "Token should be in withhold list");

            const tokens = await feeSharingCollector.getProtocolWithholdTokensList();
            assert.equal(tokens.length, 1, "List should have 1 token");
            assert.equal(tokens[0], SOVToken.address, "Token address should match");
        });

        it("should allow owner to remove token from withhold list", async () => {
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });

            const tx = await feeSharingCollector.removeProtocolWithholdToken(SOVToken.address, {
                from: root,
            });

            expectEvent(tx, "TokenRemovedFromProtocolWithholdList", {
                sender: root,
                token: SOVToken.address,
            });

            const isInList = await feeSharingCollector.isTokenInProtocolWithholdList(
                SOVToken.address
            );
            assert.equal(isInList, false, "Token should not be in withhold list");

            const tokens = await feeSharingCollector.getProtocolWithholdTokensList();
            assert.equal(tokens.length, 0, "List should be empty");
        });

        it("should revert if non-owner tries to add token", async () => {
            await expectRevert(
                feeSharingCollector.addProtocolWithholdToken(SOVToken.address, {
                    from: account1,
                }),
                "unauthorized"
            );
        });

        it("should revert if non-owner tries to remove token", async () => {
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });

            await expectRevert(
                feeSharingCollector.removeProtocolWithholdToken(SOVToken.address, {
                    from: account1,
                }),
                "unauthorized"
            );
        });

        it("should revert if adding zero address", async () => {
            await expectRevert(
                feeSharingCollector.addProtocolWithholdToken(ZERO_ADDRESS, { from: root }),
                "addProtocolWithholdToken: invalid token"
            );
        });

        it("should revert if adding token that is already in list", async () => {
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });

            await expectRevert(
                feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root }),
                "addProtocolWithholdToken: token already in list"
            );
        });

        it("should revert if removing token that is not in list", async () => {
            await expectRevert(
                feeSharingCollector.removeProtocolWithholdToken(SOVToken.address, {
                    from: root,
                }),
                "removeProtocolWithholdToken: token not in list"
            );
        });

        it("should handle multiple tokens in withhold list", async () => {
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });
            await feeSharingCollector.addProtocolWithholdToken(SUSD.address, { from: root });

            const tokens = await feeSharingCollector.getProtocolWithholdTokensList();
            assert.equal(tokens.length, 2, "List should have 2 tokens");

            assert.equal(
                await feeSharingCollector.isTokenInProtocolWithholdList(SOVToken.address),
                true
            );
            assert.equal(
                await feeSharingCollector.isTokenInProtocolWithholdList(SUSD.address),
                true
            );
        });
    });

    describe("Token-Specific Fee Withholding", () => {
        it("should withhold 100% of fees for tokens in withhold list", async () => {
            // Add SOV to withhold list
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });

            const transferAmount = new BN(wei("100", "ether"));

            // Transfer SOV tokens
            await SOVToken.approve(feeSharingCollector.address, transferAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, transferAmount, {
                from: root,
            });

            // Fast forward to create checkpoint
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);

            // Transfer more to trigger checkpoint
            await SOVToken.approve(feeSharingCollector.address, 1, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, 1, { from: root });

            // Check withheld fees (both transfers are withheld: transferAmount + 1)
            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                SOVToken.address
            );
            assert.equal(
                withheldFees.toString(),
                transferAmount.add(new BN(1)).toString(),
                "Should withhold 100% for protocol"
            );

            // Check that no checkpoint was created
            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                SOVToken.address
            );
            assert.equal(totalCheckpoints.toString(), "0", "Should not create checkpoint");
        });

        it("should distribute 100% to stakers for tokens NOT in withhold list", async () => {
            const transferAmount = new BN(wei("100", "ether"));

            // Transfer SOV tokens (not in withhold list)
            await SOVToken.approve(feeSharingCollector.address, transferAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, transferAmount, {
                from: root,
            });

            // Fast forward to create checkpoint
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);

            // Transfer more to trigger checkpoint
            await SOVToken.approve(feeSharingCollector.address, 1, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, 1, { from: root });

            // Check that checkpoint was created
            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                SOVToken.address
            );
            assert.equal(
                totalCheckpoints.toString(),
                "2",
                "Should create checkpoints for stakers"
            );

            // Check withheld fees (should be 0)
            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                SOVToken.address
            );
            assert.equal(withheldFees.toString(), "0", "Should not withhold fees");
        });

        it("should not create checkpoint when amount is zero in _addCheckpoint", async () => {
            // Note: The zero-value checkpoint prevention is in _addCheckpoint's internal logic
            // It only creates a checkpoint if amount > 0 after accumulating unprocessedAmount
            // This test verifies the initial state - no transfers means no checkpoints

            // Fast forward to trigger checkpoint interval
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);

            // Verify no checkpoint exists (nothing was transferred)
            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                SOVToken.address
            );
            assert.equal(
                totalCheckpoints.toString(),
                "0",
                "Should not create checkpoint without transfers"
            );
        });

        it("should handle RBTC withholding", async () => {
            // Add RBTC to withhold list
            await feeSharingCollector.addProtocolWithholdToken(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, {
                from: root,
            });

            const transferAmount = new BN(wei("1", "ether"));

            // Transfer RBTC
            await feeSharingCollector.transferRBTC({ from: account1, value: transferAmount });

            // Fast forward
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);
            await feeSharingCollector.transferRBTC({ from: account1, value: new BN(1) });

            // Check withheld fees (both transfers are withheld: transferAmount + 1)
            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            assert.equal(
                withheldFees.toString(),
                transferAmount.add(new BN(1)).toString(),
                "Should withhold RBTC"
            );

            // Check no checkpoint created
            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            assert.equal(totalCheckpoints.toString(), "0", "Should not create RBTC checkpoint");
        });

        it("should switch behavior when token is added/removed from list", async () => {
            const transferAmount = new BN(wei("100", "ether"));

            // Transfer SOV (not in list - should create checkpoint)
            await SOVToken.approve(feeSharingCollector.address, transferAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, transferAmount, {
                from: root,
            });
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);
            await SOVToken.approve(feeSharingCollector.address, 1, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, 1, { from: root });

            let totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                SOVToken.address
            );
            assert.equal(totalCheckpoints.toString(), "2", "Should create checkpoints");

            // Add to withhold list
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });

            // Transfer more SOV (in list - should withhold)
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);
            await SOVToken.approve(feeSharingCollector.address, transferAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, transferAmount, {
                from: root,
            });

            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                SOVToken.address
            );
            assert.equal(
                withheldFees.toString(),
                transferAmount.toString(),
                "Should withhold after being added to list"
            );

            // No new checkpoint should be created
            totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(SOVToken.address);
            assert.equal(totalCheckpoints.toString(), "2", "Should not create new checkpoint");
        });

        it("should move unprocessedAmount to protocol fees when adding token to list", async () => {
            const firstAmount = new BN(1);
            const secondAmount = new BN(wei("100", "ether"));

            // First transfer creates a checkpoint and sets lastFeeWithdrawalTime
            await SOVToken.approve(feeSharingCollector.address, firstAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, firstAmount, {
                from: root,
            });

            let totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                SOVToken.address
            );
            assert.equal(totalCheckpoints.toString(), "1", "Initial checkpoint should be created");

            // Second transfer within the interval should accumulate in unprocessedAmount
            await SOVToken.approve(feeSharingCollector.address, secondAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, secondAmount, {
                from: root,
            });

            const unprocessedBefore = await feeSharingCollector.unprocessedAmount(
                SOVToken.address
            );
            assert.equal(
                unprocessedBefore.toString(),
                secondAmount.toString(),
                "unprocessed amount should be set"
            );

            const tx = await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, {
                from: root,
            });

            expectEvent(tx, "ProtocolRevenueAccumulated", {
                token: SOVToken.address,
                amount: secondAmount,
            });

            const unprocessedAfter = await feeSharingCollector.unprocessedAmount(SOVToken.address);
            assert.equal(unprocessedAfter.toString(), "0", "unprocessed amount should be cleared");

            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                SOVToken.address
            );
            assert.equal(
                withheldFees.toString(),
                secondAmount.toString(),
                "withheld fees should include unprocessed amount"
            );

            totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(SOVToken.address);
            assert.equal(totalCheckpoints.toString(), "1", "Should not create new checkpoint");
        });

        it("should reset fee interval baseline when token is added to withhold list", async () => {
            const firstAmount = new BN(1);
            const secondAmount = new BN(2);

            // Initial transfer creates first checkpoint and sets lastFeeWithdrawalTime.
            await SOVToken.approve(feeSharingCollector.address, firstAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, firstAmount, {
                from: root,
            });

            let totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                SOVToken.address
            );
            assert.equal(totalCheckpoints.toString(), "1", "Initial checkpoint should be created");

            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });

            const lastFeeWithdrawalTime = await feeSharingCollector.lastFeeWithdrawalTime(
                SOVToken.address
            );
            assert.equal(
                lastFeeWithdrawalTime.toString(),
                "0",
                "lastFeeWithdrawalTime should be reset while token is withheld"
            );

            // Remove from withhold list before interval passes and transfer again.
            await feeSharingCollector.removeProtocolWithholdToken(SOVToken.address, {
                from: root,
            });
            await SOVToken.approve(feeSharingCollector.address, secondAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, secondAmount, {
                from: root,
            });

            // Because the baseline was reset, transfer creates checkpoint immediately.
            totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(SOVToken.address);
            assert.equal(
                totalCheckpoints.toString(),
                "2",
                "Should create checkpoint immediately after token is removed from withhold list"
            );

            const unprocessedAfter = await feeSharingCollector.unprocessedAmount(SOVToken.address);
            assert.equal(unprocessedAfter.toString(), "0", "No unprocessed amount should remain");
        });

        it("should withhold RBTC from withdrawFees() when RBTC dummy token is withheld", async () => {
            const feeAmount = new BN(wei("1", "ether"));

            await feeSharingCollector.addProtocolWithholdToken(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, {
                from: root,
            });

            // Seed protocol fee accounting and token balance so protocol.withdrawFees can transfer WRBTC.
            await sovryn.setLendingFeeTokensHeld(WRBTC.address, feeAmount);
            await WRBTC.deposit({ from: root, value: feeAmount });
            await WRBTC.transfer(sovryn.address, feeAmount, { from: root });

            const tx = await feeSharingCollector.withdrawFees([WRBTC.address], { from: root });

            expectEvent(tx, "FeeWithdrawnInRBTC", {
                sender: root,
                amount: feeAmount,
            });
            expectEvent(tx, "ProtocolRevenueAccumulated", {
                token: RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                amount: feeAmount,
            });

            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            assert.equal(
                withheldFees.toString(),
                feeAmount.toString(),
                "RBTC should be accumulated as withheld protocol fees"
            );

            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            assert.equal(
                totalCheckpoints.toString(),
                "0",
                "No staker checkpoint should be created"
            );

            const unprocessed = await feeSharingCollector.unprocessedAmount(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            assert.equal(
                unprocessed.toString(),
                "0",
                "No unprocessed amount should be accumulated"
            );
        });

        it("should withhold RBTC from withdrawFeesAMM() when RBTC dummy token is withheld", async () => {
            const feeAmount = new BN(wei("1", "ether"));
            const liquidityPoolV1Converter = await LiquidityPoolV1Converter.new(
                SOVToken.address,
                SUSD.address
            );

            await liquidityPoolV1Converter.setTotalFeeMockupValue(feeAmount.toString());
            await liquidityPoolV1Converter.setFeesController(feeSharingCollector.address);
            await liquidityPoolV1Converter.setWrbtcToken(WRBTC.address);
            await WRBTC.deposit({ from: root, value: feeAmount });
            await WRBTC.transfer(liquidityPoolV1Converter.address, feeAmount, { from: root });

            await feeSharingCollector.addWhitelistedConverterAddress(
                liquidityPoolV1Converter.address,
                {
                    from: root,
                }
            );
            await feeSharingCollector.addProtocolWithholdToken(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, {
                from: root,
            });

            const tx = await feeSharingCollector.withdrawFeesAMM(
                [liquidityPoolV1Converter.address],
                {
                    from: root,
                }
            );

            expectEvent(tx, "FeeAMMWithdrawn", {
                sender: root,
                converter: liquidityPoolV1Converter.address,
                amount: feeAmount,
            });

            expectEvent(tx, "ProtocolRevenueAccumulated", {
                token: RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                amount: feeAmount,
            });

            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            assert.equal(
                withheldFees.toString(),
                feeAmount.toString(),
                "AMM RBTC should be accumulated as withheld protocol fees"
            );

            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            assert.equal(
                totalCheckpoints.toString(),
                "0",
                "No staker checkpoint should be created"
            );

            const unprocessed = await feeSharingCollector.unprocessedAmount(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );
            assert.equal(
                unprocessed.toString(),
                "0",
                "No unprocessed amount should be accumulated"
            );
        });
    });

    describe("Withdraw Protocol Withheld Fees", () => {
        beforeEach(async () => {
            // Setup: Add SOV to withhold list and accumulate some fees
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });
            const transferAmount = new BN(wei("100", "ether"));
            await SOVToken.approve(feeSharingCollector.address, transferAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, transferAmount, {
                from: root,
            });
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);
            await SOVToken.approve(feeSharingCollector.address, 1, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, 1, { from: root });
        });

        it("should allow owner to withdraw withheld fees", async () => {
            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                SOVToken.address
            );

            const receiverBalanceBefore = await SOVToken.balanceOf(account2);

            const tx = await feeSharingCollector.withdrawProtocolWithheldFees(
                SOVToken.address,
                account2,
                { from: root }
            );

            expectEvent(tx, "ProtocolWithheldFeesWithdrawn", {
                sender: root,
                receiver: account2,
                token: SOVToken.address,
                amount: withheldFees,
            });

            const receiverBalanceAfter = await SOVToken.balanceOf(account2);
            assert.equal(
                receiverBalanceAfter.sub(receiverBalanceBefore).toString(),
                withheldFees.toString(),
                "Receiver should receive withheld fees"
            );

            const remainingFees = await feeSharingCollector.getProtocolWithheldFees(
                SOVToken.address
            );
            assert.equal(remainingFees.toString(), "0", "Withheld fees should be cleared");
        });

        it("should revert if non-owner tries to withdraw", async () => {
            await expectRevert(
                feeSharingCollector.withdrawProtocolWithheldFees(SOVToken.address, account2, {
                    from: account1,
                }),
                "unauthorized"
            );
        });

        it("should revert if receiver is zero address", async () => {
            await expectRevert(
                feeSharingCollector.withdrawProtocolWithheldFees(SOVToken.address, ZERO_ADDRESS, {
                    from: root,
                }),
                "withdrawProtocolWithheldFees: invalid receiver"
            );
        });

        it("should revert if no fees to withdraw", async () => {
            // Withdraw all fees first
            await feeSharingCollector.withdrawProtocolWithheldFees(SOVToken.address, account2, {
                from: root,
            });

            // Try to withdraw again - should fail
            await expectRevert(
                feeSharingCollector.withdrawProtocolWithheldFees(SOVToken.address, account2, {
                    from: root,
                }),
                "withdrawProtocolWithheldFees: no fees to withdraw"
            );
        });

        it("should allow withdrawal of RBTC withheld fees", async () => {
            // Setup RBTC withholding
            await feeSharingCollector.addProtocolWithholdToken(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, {
                from: root,
            });
            const transferAmount = new BN(wei("1", "ether"));
            await feeSharingCollector.transferRBTC({ from: account1, value: transferAmount });
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);
            await feeSharingCollector.transferRBTC({ from: account1, value: new BN(1) });

            const withheldFees = await feeSharingCollector.getProtocolWithheldFees(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            );

            const receiverBalanceBefore = new BN(await web3.eth.getBalance(account2));

            await feeSharingCollector.withdrawProtocolWithheldFees(
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
                account2,
                { from: root }
            );

            const receiverBalanceAfter = new BN(await web3.eth.getBalance(account2));
            assert.equal(
                receiverBalanceAfter.sub(receiverBalanceBefore).toString(),
                withheldFees.toString(),
                "Receiver should receive RBTC"
            );
        });
    });

    describe("Gas Optimization - Zero-Value Checkpoint Prevention", () => {
        it("verifies _addCheckpoint logic prevents zero-value checkpoints", async () => {
            //The actual protection comes from the fact that transferTokens and transferRBTC require _amount > 0

            // Verify initial state has no checkpoints
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);

            const totalCheckpoints = await feeSharingCollector.totalTokenCheckpoints(
                SOVToken.address
            );
            assert.equal(
                totalCheckpoints.toString(),
                "0",
                "Should not create checkpoint with zero accumulated amount"
            );

            // Note: transferTokens and transferRBTC both require amount > 0 in their input validation,
            // so they won't call _addCheckpoint with 0. The protection in _addCheckpoint handles
            // edge cases where unprocessedAmount could theoretically accumulate to 0.
        });
    });

    describe("Batch Withdrawal of Protocol Withheld Fees", () => {
        beforeEach(async () => {
            // Setup: Add SOV and SUSD to withhold list and accumulate fees
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });
            await feeSharingCollector.addProtocolWithholdToken(SUSD.address, { from: root });

            // Transfer SOV tokens
            const sovAmount = new BN(wei("100", "ether"));
            await SOVToken.approve(feeSharingCollector.address, sovAmount, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, sovAmount, { from: root });
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);
            await SOVToken.approve(feeSharingCollector.address, 1, { from: root });
            await feeSharingCollector.transferTokens(SOVToken.address, 1, { from: root });

            // Transfer SUSD tokens (root already has SUSD from deployment)
            const susdAmount = new BN(wei("200", "ether"));
            await SUSD.approve(feeSharingCollector.address, susdAmount, { from: root });
            await feeSharingCollector.transferTokens(SUSD.address, susdAmount, { from: root });
            await increaseTime(FEE_WITHDRAWAL_INTERVAL + 1);
            await SUSD.approve(feeSharingCollector.address, 1, { from: root });
            await feeSharingCollector.transferTokens(SUSD.address, 1, { from: root });
        });

        it("should allow batch withdrawal of multiple tokens", async () => {
            const sovFees = await feeSharingCollector.getProtocolWithheldFees(SOVToken.address);
            const susdFees = await feeSharingCollector.getProtocolWithheldFees(SUSD.address);

            const tokens = [SOVToken.address, SUSD.address];

            const sovBalanceBefore = await SOVToken.balanceOf(account2);
            const susdBalanceBefore = await SUSD.balanceOf(account2);

            const tx = await feeSharingCollector.withdrawProtocolWithheldFeesBatch(
                tokens,
                account2,
                { from: root }
            );

            // Verify events
            expectEvent(tx, "ProtocolWithheldFeesWithdrawn");

            const sovBalanceAfter = await SOVToken.balanceOf(account2);
            const susdBalanceAfter = await SUSD.balanceOf(account2);

            assert.equal(
                sovBalanceAfter.sub(sovBalanceBefore).toString(),
                sovFees.toString(),
                "SOV should be transferred"
            );
            assert.equal(
                susdBalanceAfter.sub(susdBalanceBefore).toString(),
                susdFees.toString(),
                "SUSD should be transferred"
            );

            // Verify fees are cleared
            const remainingSovFees = await feeSharingCollector.getProtocolWithheldFees(
                SOVToken.address
            );
            const remainingSusdFees = await feeSharingCollector.getProtocolWithheldFees(
                SUSD.address
            );
            assert.equal(remainingSovFees.toString(), "0", "SOV fees should be cleared");
            assert.equal(remainingSusdFees.toString(), "0", "SUSD fees should be cleared");
        });

        it("should revert if array is empty", async () => {
            await expectRevert(
                feeSharingCollector.withdrawProtocolWithheldFeesBatch([], account2, {
                    from: root,
                }),
                "withdrawProtocolWithheldFeesBatch: empty array"
            );
        });

        it("should revert if non-owner tries batch withdrawal", async () => {
            const tokens = [SOVToken.address];

            await expectRevert(
                feeSharingCollector.withdrawProtocolWithheldFeesBatch(tokens, account2, {
                    from: account1,
                }),
                "unauthorized"
            );
        });

        it("should revert if receiver is zero address", async () => {
            const tokens = [SOVToken.address];

            await expectRevert(
                feeSharingCollector.withdrawProtocolWithheldFeesBatch(tokens, ZERO_ADDRESS, {
                    from: root,
                }),
                "withdrawProtocolWithheldFeesBatch: invalid receiver"
            );
        });

        it("should skip tokens with zero fees in batch", async () => {
            // Withdraw SOV fees first
            await feeSharingCollector.withdrawProtocolWithheldFees(SOVToken.address, account2, {
                from: root,
            });

            // SUSD still has fees, SOV has zero
            const susdFees = await feeSharingCollector.getProtocolWithheldFees(SUSD.address);
            const tokens = [SOVToken.address, SUSD.address];

            const susdBalanceBefore = await SUSD.balanceOf(account2);

            await feeSharingCollector.withdrawProtocolWithheldFeesBatch(tokens, account2, {
                from: root,
            });

            const susdBalanceAfter = await SUSD.balanceOf(account2);

            // Only SUSD should be transferred
            assert.equal(
                susdBalanceAfter.sub(susdBalanceBefore).toString(),
                susdFees.toString(),
                "Only SUSD should be transferred"
            );
        });
    });

    describe("ProtocolRevenueAccumulated Event", () => {
        it("should emit ProtocolRevenueAccumulated event", async () => {
            await feeSharingCollector.addProtocolWithholdToken(SOVToken.address, { from: root });

            const amount = new BN(wei("100", "ether"));
            await SOVToken.approve(feeSharingCollector.address, amount, { from: root });
            const tx = await feeSharingCollector.transferTokens(SOVToken.address, amount, {
                from: root,
            });

            expectEvent(tx, "ProtocolRevenueAccumulated", {
                token: SOVToken.address,
                amount: amount,
            });
        });
    });
});
