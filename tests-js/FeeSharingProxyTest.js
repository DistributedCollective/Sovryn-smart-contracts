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

const StakingLogic = artifacts.require('StakingMockup');
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

const FEE_WITHDRAWAL_INTERVAL = 86400;

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
        await staking.MOCK_priorWeightedStake(1000);
    
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
            await stake(totalStake, root);
    
            //mock data
            let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
    
            await protocol.setFeesController(root);
            let tx = await protocol.withdrawFees(susd.address, account1);
    
            await checkWithdrawFee();
    
            //check pool tokens mint
            let userBalance = await susd.balanceOf.call(account1);
            expect(userBalance.toString()).to.be.equal(feeAmount.toString());
            
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
            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            let tx = await stake(totalStake, root);
            
            //mock data
            let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            
            tx = await feeSharingProxy.withdrawFees(susd.address);
            
            await checkWithdrawFee();
    
            //check pool tokens mint
            let feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toString()).to.be.equal(feeAmount.toString());

            //checkpoints
            let numTokenCheckpoints = await feeSharingProxy.numTokenCheckpoints.call(loanToken.address);
            expect(numTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingProxy.tokenCheckpoints.call(loanToken.address, 0);
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(totalStake * MAX_VOTING_WEIGHT);
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());
            
            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingProxy.lastFeeWithdrawalTime.call();
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());
            
            expectEvent(tx, 'FeeWithdrawn', {
                sender: root,
                token: loanToken.address,
                amount: feeAmount
            });
        });
    
        it("Should be able to withdraw fees 3 times", async () => {
            //stake - getPriorTotalVotingPower
            let totalStake = 1000;
            await stake(1000, root);
    
            //[FIRST]
            //mock data
            let feeAmount = await setFeeTokensHeld(new BN(0), new BN(500), new BN(700));
            let totalFeeAmount = feeAmount;
            
            let tx = await feeSharingProxy.withdrawFees(susd.address);
            await checkWithdrawFee();
        
            //check pool tokens mint
            let feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toString()).to.be.equal(totalFeeAmount.toString());
        
            //checkpoints
            let numTokenCheckpoints = await feeSharingProxy.numTokenCheckpoints.call(loanToken.address);
            expect(numTokenCheckpoints.toNumber()).to.be.equal(1);
            let checkpoint = await feeSharingProxy.tokenCheckpoints.call(loanToken.address, 0);
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(totalStake * MAX_VOTING_WEIGHT);
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());
        
            //check lastFeeWithdrawalTime
            let lastFeeWithdrawalTime = await feeSharingProxy.lastFeeWithdrawalTime.call();
            let block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());
    
            //[SECOND]
            //mock data
            feeAmount = await setFeeTokensHeld(new BN(12345), new BN(0), new BN(0));
            totalFeeAmount = totalFeeAmount.add(feeAmount);
            
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            tx = await feeSharingProxy.withdrawFees(susd.address);
            await checkWithdrawFee();
    
            //check pool tokens mint
            feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toString()).to.be.equal(totalFeeAmount.toString());
    
            //checkpoints
            numTokenCheckpoints = await feeSharingProxy.numTokenCheckpoints.call(loanToken.address);
            expect(numTokenCheckpoints.toNumber()).to.be.equal(2);
            checkpoint = await feeSharingProxy.tokenCheckpoints.call(loanToken.address, 1);
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(totalStake * MAX_VOTING_WEIGHT);
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());
    
            //check lastFeeWithdrawalTime
            lastFeeWithdrawalTime = await feeSharingProxy.lastFeeWithdrawalTime.call();
            block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());
    
            //[THIRD]
            //mock data
            feeAmount = await setFeeTokensHeld(new BN(0), new BN(etherMantissa(1000).toString()), new BN(567));
            totalFeeAmount = totalFeeAmount.add(feeAmount);
    
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            tx = await feeSharingProxy.withdrawFees(susd.address);
            await checkWithdrawFee();
    
            //check pool tokens mint
            feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toString()).to.be.equal(totalFeeAmount.toString());
    
            //checkpoints
            numTokenCheckpoints = await feeSharingProxy.numTokenCheckpoints.call(loanToken.address);
            expect(numTokenCheckpoints.toNumber()).to.be.equal(3);
            checkpoint = await feeSharingProxy.tokenCheckpoints.call(loanToken.address, 2);
            expect(checkpoint.blockNumber.toNumber()).to.be.equal(tx.receipt.blockNumber);
            expect(checkpoint.totalWeightedStake.toNumber()).to.be.equal(totalStake * MAX_VOTING_WEIGHT);
            expect(checkpoint.numTokens.toString()).to.be.equal(feeAmount.toString());
    
            //check lastFeeWithdrawalTime
            lastFeeWithdrawalTime = await feeSharingProxy.lastFeeWithdrawalTime.call();
            block = await web3.eth.getBlock(tx.receipt.blockNumber);
            expect(lastFeeWithdrawalTime.toString()).to.be.equal(block.timestamp.toString());
        });
        
    });
    
    describe("withdraw", () => {
        
        it("Should be able to withdraw", async () => {
            //stake - getPriorTotalVotingPower
            let rootStake = 900;
            await stake(rootStake, root);
    
            let userStake = 100;
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);
            
            //mock data
            let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            
            await feeSharingProxy.withdrawFees(susd.address);
    
            let tx = await feeSharingProxy.withdraw(loanToken.address, 10, ZERO_ADDRESS, {from: account1});
    
            //processedCheckpoints
            let processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(account1, loanToken.address);
            expect(processedCheckpoints.toNumber()).to.be.equal(1);
    
            //check balances
            let feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toNumber()).to.be.equal(feeAmount * 9 / 10);
            let userBalance = await loanToken.balanceOf.call(account1);
            expect(userBalance.toNumber()).to.be.equal(feeAmount / 10);
    
            expectEvent(tx, 'UserFeeWithdrawn', {
                sender: account1,
                receiver: account1,
                token: loanToken.address,
                amount: new BN(feeAmount).div(new BN(10))
            });
            
        });
    
        it("Should be able to withdraw using 3 checkpoints", async () => {
            //stake - getPriorTotalVotingPower
            let rootStake = 900;
            await stake(rootStake, root);
        
            let userStake = 100;
            await SOVToken.transfer(account1, userStake);
            await stake(userStake, account1);
    
            // [FIRST]
            //mock data
            let feeAmount = await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            let totalFeeAmount = feeAmount;
            await feeSharingProxy.withdrawFees(susd.address);
    
            await feeSharingProxy.withdraw(loanToken.address, 1, ZERO_ADDRESS, {from: account1});
        
            //processedCheckpoints
            let processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(account1, loanToken.address);
            expect(processedCheckpoints.toNumber()).to.be.equal(1);
        
            //check balances
            let feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toNumber()).to.be.equal(totalFeeAmount * 9 / 10);
            let userBalance = await loanToken.balanceOf.call(account1);
            expect(userBalance.toNumber()).to.be.equal(totalFeeAmount / 10);
    
            // [SECOND]
            //mock data
            feeAmount = await setFeeTokensHeld(new BN(100), new BN(0), new BN(etherMantissa(123000).toString()));
            totalFeeAmount = totalFeeAmount.add(feeAmount);
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            await feeSharingProxy.withdrawFees(susd.address);
    
            // [THIRD]
            //mock data
            feeAmount = await setFeeTokensHeld(new BN(etherMantissa(123000).toString()),
                new BN(etherMantissa(1000).toString()), new BN(etherMantissa(54321).toString()));
            totalFeeAmount = totalFeeAmount.add(feeAmount);
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            await feeSharingProxy.withdrawFees(susd.address);
    
            // [SECOND] - [THIRD]
            await feeSharingProxy.withdraw(loanToken.address, 2, ZERO_ADDRESS, {from: account1});
    
            //processedCheckpoints
            processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(account1, loanToken.address);
            expect(processedCheckpoints.toNumber()).to.be.equal(3);
    
            //check balances
            feeSharingProxyBalance = await loanToken.balanceOf.call(feeSharingProxy.address);
            expect(feeSharingProxyBalance.toNumber()).to.be.equal(parseInt(totalFeeAmount * 9 / 10) + 1);
            userBalance = await loanToken.balanceOf.call(account1);
            expect(userBalance.toNumber()).to.be.equal(parseInt(totalFeeAmount / 10));
        });
    
        it("Should be able to process 10 checkpoints", async () => {
            //stake - getPriorTotalVotingPower
            await stake(1000, root);
        
            //mock data
            await createCheckpoints(10);
    
            await feeSharingProxy.withdraw(loanToken.address, 1000, ZERO_ADDRESS, {from: account1});
            //processedCheckpoints
            let processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(account1, loanToken.address);
            expect(processedCheckpoints.toNumber()).to.be.equal(10);
        });
    
        it("Should be able to process 10 checkpoints and 3 withdrawal", async () => {
            //stake - getPriorTotalVotingPower
            await stake(1000, root);
        
            //mock data
            await createCheckpoints(10);
        
            await feeSharingProxy.withdraw(loanToken.address, 5, ZERO_ADDRESS, {from: account1});
            //processedCheckpoints
            let processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(account1, loanToken.address);
            expect(processedCheckpoints.toNumber()).to.be.equal(5);
    
            await feeSharingProxy.withdraw(loanToken.address, 3, ZERO_ADDRESS, {from: account1});
            //processedCheckpoints
            processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(account1, loanToken.address);
            expect(processedCheckpoints.toNumber()).to.be.equal(8);
    
            await feeSharingProxy.withdraw(loanToken.address, 1000, ZERO_ADDRESS, {from: account1});
            //processedCheckpoints
            processedCheckpoints = await feeSharingProxy.processedCheckpoints.call(account1, loanToken.address);
            expect(processedCheckpoints.toNumber()).to.be.equal(10);
        });
    
    
    });
    
    async function stake(amount, user) {
        await SOVToken.approve(staking.address, amount);
        let kickoffTS = await staking.kickoffTS.call();
        let stakingDate = kickoffTS.add(new BN(MAX_DURATION));
        let tx = await staking.stake(amount, stakingDate, user, user);
        await mineBlock();
        return tx;
    }
    
    async function setFeeTokensHeld(lendingFee, tradingFee, borrowingFee) {
        let totalFeeAmount = lendingFee.add(tradingFee).add(borrowingFee);
        await susd.transfer(protocol.address, totalFeeAmount);
        await protocol.setLendingFeeTokensHeld(susd.address, lendingFee);
        await protocol.setTradingFeeTokensHeld(susd.address, tradingFee);
        await protocol.setBorrowingFeeTokensHeld(susd.address, borrowingFee);
        return totalFeeAmount;
    }
    
    async function checkWithdrawFee() {
        let protocolBalance = await susd.balanceOf(protocol.address);
        expect(protocolBalance.toNumber()).to.be.equal(0);
        let lendingFeeTokensHeld = await protocol.lendingFeeTokensHeld.call(susd.address);
        expect(lendingFeeTokensHeld.toNumber()).to.be.equal(0);
        let tradingFeeTokensHeld = await protocol.tradingFeeTokensHeld.call(susd.address);
        expect(tradingFeeTokensHeld.toNumber()).to.be.equal(0);
        let borrowingFeeTokensHeld = await protocol.borrowingFeeTokensHeld.call(susd.address);
        expect(borrowingFeeTokensHeld.toNumber()).to.be.equal(0);
    }
    
    async function createCheckpoints(number) {
        for (let i = 0; i < number; i++) {
            await setFeeTokensHeld(new BN(100), new BN(200), new BN(300));
            await increaseTime(FEE_WITHDRAWAL_INTERVAL);
            await feeSharingProxy.withdrawFees(susd.address);
        }
    }
    
});
