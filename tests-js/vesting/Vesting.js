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
const TestToken = artifacts.require('TestToken');
const Vesting = artifacts.require('Vesting');

const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));
const TOTAL_SUPPLY = "10000000000000000000000000";

contract('Vesting', accounts => {
    const name = 'Test token';
    const symbol = 'TST';
    
    let root, a1, a2, a3;
    let token, staking;
    let kickoffTS;
    
    before(async () => {
        [root, a1, a2, a3, ...accounts] = accounts;
        token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        
        let stakingLogic = await StakingLogic.new(token.address);
        staking = await StakingProxy.new(token.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);
        
        await token.transfer(a2, "1000");
        await token.approve(staking.address, "1000", {from: a2});
        
        kickoffTS = await staking.kickoffTS.call();
    });
    
    describe('constructor', () => {
        it('sets the expected values', async () => {

        });
        
        it('fails if the 0 address is passed as SOV address', async () => {

        });
        
        it('fails if the 0 address is passed as token owner address', async () => {

        });
        
        it('fails if the 0 address is passed as staking address', async () => {

        });
        
        it('fails if the vesting duration is bigger than the max staking duration', async () => {

        });
        
        it('fails if the vesting duration is shorter than the cliff', async () => {

        });
    });
    
    describe('stakeTokens', () => {
        it('should stake 1,000,000 SOV with a duration of 104 weeks and a 26 week cliff', async () => {

        });
        
        it('should stake the same, but this time the user already possesses a stake', async () => {

        });
        
        it('should fail to stake twice', async () => {

        });
        
    });
    
    describe('withdrawTokens',() => {
        it('should withdraw unlocked tokens', async () => {
            //Stake
            //time travel
            //withdraw
            //verify amount
        });
        
        it('should do nothing if withdrawing a second time', async() => {
            
        });
        
        it('should do nothing if withdrawing before reaching the cliff', async() => {
            
        });
        
        it('should fail if the caller is neither owner nor token owner', async() => {
            
        });
    });
    
    describe('collectDividends', async() => {
        it('', async() => {
            
        });
        
        it('should fail if the caller is neither owner nor token owner', async() => {
            
        });
    })
    
    describe('migrateToNewStakingContract', async() => {
        it('should set the new staking contract', async() => {
            //1. set new staking contract address on staking contract
            //2. call migrateToNewStakingContract
        });
        
        it('should fail if there is no new staking contract set', async() => {
            
        });
        
        it('should fail if the caller is neither owner nor token owner', async() => {
            
        });
    })
});