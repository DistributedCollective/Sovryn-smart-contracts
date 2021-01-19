const {expect} = require('chai');
const {expectRevert, expectEvent, constants, BN, balance, time} = require('@openzeppelin/test-helpers');
const {
    address,
    minerStart,
    minerStop,
    unlockedAccount,
    mineBlock,
    etherMantissa,
    etherUnsigned,
    setTime
} = require('../Utils/Ethereum');

const StakingLogic = artifacts.require('Staking');
const StakingProxy = artifacts.require('StakingProxy');
const StakingMockup = artifacts.require('StakingMockup');

const TestToken = artifacts.require('TestToken');
const TestWrbtc = artifacts.require('TestWrbtc');

const Protocol = artifacts.require('sovrynProtocol');
const ProtocolSettings = artifacts.require('ProtocolSettingsMockup');
const LoanMaintenance = artifacts.require('LoanMaintenance');
const LoanSettings = artifacts.require('LoanSettings');
const LoanOpenings = artifacts.require('LoanOpenings');
const LoanClosings = artifacts.require('LoanClosings');

const LoanTokenLogic = artifacts.require('LoanTokenLogicStandard');
const LoanTokenSettings = artifacts.require('LoanTokenSettingsLowerAdmin');
const LoanToken = artifacts.require('LoanToken');

const FeeSharingProxy = artifacts.require('FeeSharingProxy');

const Vesting = artifacts.require('Vesting');

const TOTAL_SUPPLY = "100000000000000000000000000000";
const ONE_MILLON = "1000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const DELAY = 86400 * 14;
const WEEK = new BN(7 * 24 * 60 * 60);

const ZERO_ADDRESS = constants.ZERO_ADDRESS;

contract('VestingIntegrationTest', accounts => {

    const name = 'Test token';
    const symbol = 'TST';

    let root, account1, account2, account3;
    let token, susd, wrbtc, staking;
    let protocol;
    let loanTokenSettings, loanTokenLogic, loanToken;
    let feeSharingProxy;
    let vesting;
    let kickoffTS, inOneWeek;

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
    });

    beforeEach(async () => {
        //Token
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        susd = await TestToken.new("SUSD", "SUSD", 18, TOTAL_SUPPLY);
        wrbtc = await TestWrbtc.new();

        //staking
        let stakingLogic = await StakingLogic.new(token.address);
        staking = await StakingProxy.new(token.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);

        //Protocol
        protocol = await Protocol.new();
        let protocolSettings = await ProtocolSettings.new();
        await protocol.replaceContract(protocolSettings.address);
        let loanMaintenance = await LoanMaintenance.new();
        await protocol.replaceContract(loanMaintenance.address);
        let loanSettings = await LoanSettings.new();
        await protocol.replaceContract(loanSettings.address);
        let loanOpenings = await LoanOpenings.new();
        await protocol.replaceContract(loanOpenings.address);
        let loanClosings = await LoanClosings.new();
        await protocol.replaceContract(loanClosings.address);

        protocol = await ProtocolSettings.at(protocol.address);

        //Loan token
        loanTokenSettings = await LoanTokenSettings.new();
        loanTokenLogic = await LoanTokenLogic.new();
        loanToken = await LoanToken.new(root, loanTokenLogic.address, protocol.address, wrbtc.address);
        await loanToken.initialize(susd.address, "iSUSD", "iSUSD");
        loanToken = await LoanTokenLogic.at(loanToken.address);

        await protocol.setLoanPool([loanToken.address], [susd.address]);

        //FeeSharingProxy
        feeSharingProxy = await FeeSharingProxy.new(protocol.address, staking.address);
        await protocol.setFeesController(feeSharingProxy.address);
        await staking.setFeeSharing(feeSharingProxy.address);

        await token.transfer(account1, 1000);
        await token.approve(staking.address, TOTAL_SUPPLY);
        kickoffTS = await staking.kickoffTS.call();
        inOneWeek = kickoffTS.add(new BN(DELAY));
    });

    // describe('collectDividends', () => {
    //
    //     let vesting;
    //
    //     it('should be able to collect dividends', async () => {
    //         vesting = await Vesting.new(token.address, staking.address, root, 26 * WEEK, 104 * WEEK, feeSharingProxy.address);
    //         await token.approve(vesting.address, ONE_MILLON);
    //         await vesting.stakeTokens(ONE_MILLON);
    //
    //         //mock data
    //         let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
    //
    //         await feeSharingProxy.withdrawFees(susd.address);
    //
    //         let fees = await feeSharingProxy.getAccumulatedFees(vesting.address, loanToken.address);
    //         expect(fees).to.be.bignumber.equal(new BN(feeAmount));
    //
    //         let tx = await vesting.collectDividends(loanToken.address, 1000, account1);
    //
    //         //processedCheckpoints
    //         let processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(vesting.address, loanToken.address);
    //         expect(processedCheckpoints.toNumber()).to.be.equal(1);
    //
    //         expectEvent(tx, 'DividendsCollected', {
    //             caller: root,
    //             loanPoolToken: loanToken.address,
    //             receiver: account1,
    //             maxCheckpoints: "1000"
    //         });
    //
    //     });
    //
    // });

    describe('migrateToNewStakingContract', () => {

        let vesting;

        it('should be able to migrate to new staking contract', async () => {
            vesting = await Vesting.new(token.address, staking.address, root, 26 * WEEK, 104 * WEEK, feeSharingProxy.address);
            await token.approve(vesting.address, ONE_MILLON);
            await vesting.stakeTokens(ONE_MILLON);

            let balance = await staking.balanceOf.call(vesting.address);
            expect(balance.toString()).equal(ONE_MILLON);

            await staking.setNewStakingContract(account1);
            await vesting.migrateToNewStakingContract();

            await token.approve(vesting.address, ONE_MILLON);
            await vesting.stakeTokens(ONE_MILLON);


        });

    });

    async function setFeeTokensHeld(lendingFee, tradingFee, borrowingFee) {
        let totalFeeAmount = lendingFee.add(tradingFee).add(borrowingFee);
        await susd.transfer(protocol.address, totalFeeAmount);
        await protocol.setLendingFeeTokensHeld(susd.address, lendingFee);
        await protocol.setTradingFeeTokensHeld(susd.address, tradingFee);
        await protocol.setBorrowingFeeTokensHeld(susd.address, borrowingFee);
        return totalFeeAmount;
    }

});