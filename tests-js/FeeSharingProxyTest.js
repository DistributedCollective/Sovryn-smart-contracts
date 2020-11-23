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
const ProtocolSettings = artifacts.require('ProtocolSettings');
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
const TWO_WEEKS = 1209600;

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
        
        //TODO ?
        // await susd.approve(loanToken.address, TOTAL_SUPPLY);
        // await loanToken.mint(root, etherMantissa(1000));
    
        //FeeSharingProxy
        feeSharingProxy = await FeeSharingProxy.new(protocol.address, staking.address, loanToken.address);
        await protocol.setFeesController(feeSharingProxy.address);
    });
    
    describe("withdrawFees", () => {
        
        it("check setup", async () => {
            console.log("\n============================================================");
            
            await SOVToken.approve(staking.address, 1000);
            let tx = await staking.stake(1000, MAX_DURATION, root, root);
            await mineBlock();
    
            let kickoffTS = await staking.kickoffTS.call();
            // let totalVotingPower = await staking.getPriorTotalVotingPower(tx.receipt.blockNumber, kickoffTS);
            let totalVotingPower = await staking.getPriorTotalVotingPower(tx.receipt.blockNumber + 1, kickoffTS);
            console.log(totalVotingPower.toString());
            
            //TODO ?
            await susd.mint(feeSharingProxy.address, 123);
            
            tx = await feeSharingProxy.withdrawFees(susd.address);
    
            expectEvent(tx, 'FeeWithdrawn', {
                sender: root,
                token: susd.address,
                amount: "123"
            });
        });
        
    });
    
});
