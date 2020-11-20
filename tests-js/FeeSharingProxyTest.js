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

const LoanTokenLogic = artifacts.require('LoanTokenLogicStandard');
const LoanToken = artifacts.require('LoanToken');

const FeeSharingProxy = artifacts.require('FeeSharingProxy');

const TOTAL_SUPPLY = etherMantissa(1000000000);

contract('FeeSharingProxy:', accounts => {
    const name = 'Test token';
    const symbol = 'TST';
    
    let root, account1, account2, account3, account4;
    let token, susd, wrbtc, staking;
    let protocolSettings, loanTokenLogic, protocol, loanToken;
    let feeSharingProxy;
    
    before(async () => {
        [root, account1, account2, account3, account4, ...accounts] = accounts;
    });
    
    beforeEach(async () => {
        //Token
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        susd = await TestToken.new("SUSD", "SUSD", 18, TOTAL_SUPPLY);
        wrbtc = await TestWrbtc.new();
        
        //Staking
        let stakingLogic = await StakingLogic.new(token.address);
        staking = await StakingProxy.new(token.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);
    
        //Protocol
        protocolSettings = await ProtocolSettings.new();
        protocol = await Protocol.new();
        await protocol.replaceContract(protocolSettings.address);
        protocol = await ProtocolSettings.at(protocol.address);
    
        //Loan token
        loanTokenLogic = await LoanTokenLogic.new();
        loanToken = await LoanToken.new(root, loanTokenLogic.address, protocol.address, wrbtc.address);
        await loanToken.initialize(susd.address, "iSUSD", "iSUSD");
        loanToken = await LoanTokenLogic.at(loanToken.address);
        
        await protocol.setLoanPool([loanToken.address], [susd.address]);
        
        //TODO ?
        await susd.approve(loanToken.address, TOTAL_SUPPLY);
        // await loanToken.mint(root, etherMantissa(1000));
    
        // if network.show_active() == "development":
        // testDeployment(acct, sovryn,contractSUSD.address, tokens.susd, tokens.wrbtc, 21e18, 0)
    
        //FeeSharingProxy
        feeSharingProxy = await FeeSharingProxy.new(protocol.address, staking.address);
    });
    
    describe("withdrawFees", () => {
        
        it("check setup", async () => {
            
            console.log("\n==============================================================");
        
        });
        
    });
    
});
