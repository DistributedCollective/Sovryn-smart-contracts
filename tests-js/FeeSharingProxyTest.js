const {expect} = require('chai');
const {expectRevert, expectEvent, constants, BN, balance, time} = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const {
    encodeParameters,
    etherMantissa,
    mineBlock,
    increaseTime,
} = require('./Utils/Ethereum');

const TestToken = artifacts.require('TestToken');
const TestWrbtc = artifacts.require('TestWrbtc');

const StakingLogic = artifacts.require('Staking');
const StakingProxy = artifacts.require('StakingProxy');

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

const TOTAL_SUPPLY = etherMantissa(1000000000);

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

const MAX_VOTING_WEIGHT = 10;

contract('FeeSharingProxy:', accounts => {
    const name = 'Test SOVToken';
    const symbol = 'TST';
    
    let root, account1, account2, account3, account4;
    let SOVToken, susd, wrbtc, staking;
    let protocol;
    let loanTokenSettings, loanTokenLogic, loanToken;
    let feeSharingProxy;
    
    before(async () => {
        [root, account1, account2, account3, account4, ...accounts] = accounts;
    });
    
    beforeEach(async () => {
        //Token
        SOVToken = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        susd = await TestToken.new("SUSD", "SUSD", 18, TOTAL_SUPPLY);
        wrbtc = await TestWrbtc.new();
        
        //Staking
        let stakingLogic = await StakingLogic.new(SOVToken.address);
        staking = await StakingProxy.new(SOVToken.address);
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
        feeSharingProxy = await FeeSharingProxy.new(protocol.address, staking.address, loanToken.address);
        await protocol.setFeesController(feeSharingProxy.address);
    });
    
    describe("withdrawFees", () => {
    
        it("ProtocolSettings.withdrawFees", async () => {
            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await SOVToken.approve(staking.address, totalStake);
            let tx = await staking.stake(totalStake, MAX_DURATION, root, root);
            await mineBlock();
    
            //mock data
            let totalFeeAmount = "600";
            await susd.transfer(protocol.address, totalFeeAmount);
            await protocol.setLendingFeeTokensHeld(susd.address, 100);
            await protocol.setTradingFeeTokensHeld(susd.address, 200);
            await protocol.setBorrowingFeeTokensHeld(susd.address, 300);
    
            await protocol.setFeesController(root);
            tx = await protocol.withdrawFees(susd.address, account1);
    
            //check a withdraw
            let protocolBalance = await susd.balanceOf(protocol.address);
            expect(protocolBalance.toNumber()).to.be.equal(0);
            let lendingFeeTokensHeld = await protocol.lendingFeeTokensHeld.call(susd.address);
            expect(lendingFeeTokensHeld.toNumber()).to.be.equal(0);
            let tradingFeeTokensHeld = await protocol.tradingFeeTokensHeld.call(susd.address);
            expect(tradingFeeTokensHeld.toNumber()).to.be.equal(0);
            let borrowingFeeTokensHeld = await protocol.borrowingFeeTokensHeld.call(susd.address);
            expect(borrowingFeeTokensHeld.toNumber()).to.be.equal(0);

            //check pool tokens mint
            let userBalance = await susd.balanceOf.call(account1);
            expect(userBalance.toString()).to.be.equal(totalFeeAmount);
            
            expectEvent(tx, 'WithdrawFees', {
                sender: root,
                token: susd.address,
                receiver: account1,
                lendingAmount: "100",
                tradingAmount: "200",
                borrowingAmount: "300"
            });
    
        });
        
        it("Should be able to withdraw fees", async () => {
            console.log("\n============================================================");
            
            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await SOVToken.approve(staking.address, totalStake);
            let tx = await staking.stake(totalStake, MAX_DURATION, root, root);
            await mineBlock();

            //TODO remove
            let kickoffTS = await staking.kickoffTS.call();
            // let totalVotingPower = await staking.getPriorTotalVotingPower(tx.receipt.blockNumber, kickoffTS);
            let totalVotingPower = await staking.getPriorTotalVotingPower(tx.receipt.blockNumber + 1, kickoffTS);
            console.log(totalVotingPower.toString());
            
            //mock data
            let totalFeeAmount = "600";
            await susd.transfer(protocol.address, totalFeeAmount);
            await protocol.setLendingFeeTokensHeld(susd.address, 100);
            await protocol.setTradingFeeTokensHeld(susd.address, 200);
            await protocol.setBorrowingFeeTokensHeld(susd.address, 300);
            
            tx = await feeSharingProxy.withdrawFees(susd.address);
            
            //check a withdraw
            let protocolBalance = await susd.balanceOf(protocol.address);
            expect(protocolBalance.toNumber()).to.be.equal(0);
            let lendingFeeTokensHeld = await protocol.lendingFeeTokensHeld.call(susd.address);
            expect(lendingFeeTokensHeld.toNumber()).to.be.equal(0);
            let tradingFeeTokensHeld = await protocol.tradingFeeTokensHeld.call(susd.address);
            expect(tradingFeeTokensHeld.toNumber()).to.be.equal(0);
            let borrowingFeeTokensHeld = await protocol.borrowingFeeTokensHeld.call(susd.address);
            expect(borrowingFeeTokensHeld.toNumber()).to.be.equal(0);
    
            //check pool tokens mint
            let feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toString()).to.be.equal(totalFeeAmount);

            //checkpoints
            let numTokenCheckpoints = await feeSharingProxy.numTokenCheckpoints.call(loanToken.address);
            expect(numTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingProxy.tokenCheckpoints.call(loanToken.address, 0);
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(totalStake * MAX_VOTING_WEIGHT);
            expect(checkpoint.numTokens.toString()).to.be.equal(totalFeeAmount);
            
            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingProxy.lastFeeWithdrawalTime.call();
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());
            
            expectEvent(tx, 'FeeWithdrawn', {
                sender: root,
                token: loanToken.address,
                amount: totalFeeAmount
            });
        });
        
    });
    
    describe("withdraw", () => {
        
        it("Should be able to withdraw fees", async () => {
            //stake - getPriorTotalVotingPower
            let rootStake = 900;
            await SOVToken.approve(staking.address, rootStake);
            await staking.stake(rootStake, MAX_DURATION, root, root);
            await mineBlock();
    
            let userStake = 100;
            await SOVToken.transfer(account1, userStake);
            await SOVToken.approve(staking.address, userStake, {from: account1});
            await staking.stake(userStake, MAX_DURATION, account1, account1, {from: account1});
            await mineBlock();
            
            //mock data
            let totalFeeAmount = 600;
            await susd.transfer(protocol.address, totalFeeAmount);
            await protocol.setLendingFeeTokensHeld(susd.address, 100);
            await protocol.setTradingFeeTokensHeld(susd.address, 200);
            await protocol.setBorrowingFeeTokensHeld(susd.address, 300);
            
            await feeSharingProxy.withdrawFees(susd.address);
    
            let tx = await feeSharingProxy.withdraw(loanToken.address, 10, ZERO_ADDRESS, {from: account1});
    
            //processedCheckpoints
            let processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(account1, loanToken.address);
            expect(processedCheckpoints.toNumber()).to.be.equal(1);
    
            //check balances
            let feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toNumber()).to.be.equal(totalFeeAmount * 9 / 10);
            let userBalance = await loanToken.balanceOf.call(account1);
            expect(userBalance.toNumber()).to.be.equal(totalFeeAmount / 10);
    
            expectEvent(tx, 'UserFeeWithdrawn', {
                sender: account1,
                receiver: account1,
                token: loanToken.address,
                amount: new BN(totalFeeAmount).div(new BN(10))
            });
            
        });
        
    });
    
});
