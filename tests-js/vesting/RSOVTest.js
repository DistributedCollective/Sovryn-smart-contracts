const {expect} = require('chai');
const {expectRevert, expectEvent, constants, BN, balance, time} = require('@openzeppelin/test-helpers');

const StakingLogic = artifacts.require('Staking');
const StakingProxy = artifacts.require('StakingProxy');
const TestToken = artifacts.require('TestToken');
const RSOV = artifacts.require('RSOV');

const TOTAL_SUPPLY = "10000000000000000000000000";
const TWO_WEEKS = 1209600;
const HALF_YEAR = 182 * 86400;
const ZERO_ADDRESS = constants.ZERO_ADDRESS;
const ZERO = new BN(0);

const NAME = "Sovryn Reward Token";
const SYMBOL = "RSOV";
const DECIMALS = 18;

contract('RSOV:', accounts => {
    const name = 'Test tokenSOV';
    const symbol = 'TST';
    
    let root, account1, account2, account3;
    let tokenSOV, tokenRSOV, staking;
    
    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
    });
    
    beforeEach(async () => {
        tokenSOV = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
        
        let stakingLogic = await StakingLogic.new(tokenSOV.address);
        staking = await StakingProxy.new(tokenSOV.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);
    
        tokenRSOV = await RSOV.new(tokenSOV.address, staking.address);
    });
    
    describe('constructor:', () => {
        
        it('sets the expected values', async () => {
            let tokenTemp = await RSOV.new(tokenSOV.address, staking.address);
            
            expect(await tokenTemp.name.call()).to.be.equal(NAME);
            expect(await tokenTemp.symbol.call()).to.be.equal(SYMBOL);
            expect(await tokenTemp.decimals.call()).to.be.bignumber.equal(new BN(DECIMALS));
            
            expect(await tokenTemp.SOV.call()).to.be.equal(tokenSOV.address);
            expect(await tokenTemp.staking.call()).to.be.equal(staking.address);
            expect(await tokenTemp.stakingDuration.call()).to.be.bignumber.equal(new BN(HALF_YEAR));
        });
    
        it('fails if SOV address is zero', async () => {
            await expectRevert(RSOV.new(ZERO_ADDRESS, staking.address),
                "RSOV::SOV address invalid");
        });
    
        it('fails if staking address is zero', async () => {
            await expectRevert(RSOV.new(tokenSOV.address, ZERO_ADDRESS),
                "RSOV::staking address invalid");
        });
        
    });
    
    describe('mint:', () => {
        
        it('should be able to mint RSOV tokens', async () => {
            let amount = new BN(1000);
    
            await tokenSOV.transfer(account1, amount);
            await tokenSOV.approve(tokenRSOV.address, amount, {from: account1});
            let tx = await tokenRSOV.mint(amount, {from: account1});
    
            expect(await tokenSOV.balanceOf.call(account1)).to.be.bignumber.equal(ZERO);
            expect(await tokenRSOV.balanceOf.call(account1)).to.be.bignumber.equal(amount);
            expect(await tokenSOV.balanceOf.call(tokenRSOV.address)).to.be.bignumber.equal(amount);
           
            expectEvent(tx, "Mint", {
                sender: account1,
                amount: "1000"
            });
        });
        
        it('fails if amount is zero', async () => {
            await expectRevert(tokenRSOV.mint(0),
                "RSOV::mint: amount invalid");
        });

        it('fails if transfer is not approved', async () => {
            await expectRevert(tokenRSOV.mint(100),
                "invalid transfer");
        });
        
    });
    
    describe('burn:', () => {
        
        it('should be able to burn RSOV tokens', async () => {
            let amount = new BN(1000);
            
            await tokenSOV.transfer(account1, amount);
            await tokenSOV.approve(tokenRSOV.address, amount, {from: account1});
            await tokenRSOV.mint(amount, {from: account1});
    
            let tx = await tokenRSOV.burn(amount, {from: account1});
            
            expect(await tokenRSOV.balanceOf.call(account1)).to.be.bignumber.equal(ZERO);
            expect(await tokenSOV.balanceOf.call(staking.address)).to.be.bignumber.equal(new BN(amount));
            let lockDate = await getTimeFromKickoff(HALF_YEAR);
            expect(await staking.numUserStakingCheckpoints.call(account1, lockDate)).to.be.bignumber.equal(new BN(1));
            let checkpoint = await staking.userStakingCheckpoints.call(account1, lockDate, 0);
            expect(checkpoint.stake).to.be.bignumber.equal(amount);
            
            expectEvent(tx, 'Burn', {
                sender: account1,
                amount: amount
            });
        });
        
        it('fails if amount is zero', async () => {
            await expectRevert(tokenRSOV.burn(0),
                "RSOV:: burn: amount invalid");
        });
        
    });
    
    describe('setStakingDuration:', () => {
        
        it('should be able to set staking duration', async () => {
            await tokenRSOV.setStakingDuration(TWO_WEEKS);
    
            expect(await tokenRSOV.stakingDuration.call()).to.be.bignumber.equal(new BN(TWO_WEEKS));
        });
        
        it('fails if staking duration less then 2 weeks', async () => {
            await expectRevert(tokenRSOV.setStakingDuration(3600),
                "RSOV:: staking duration is too short");
        });
    
        it('fails if staking duration less then 2 weeks', async () => {
            await expectRevert(tokenRSOV.setStakingDuration(TWO_WEEKS, {from: account1}),
                "Ownable: caller is not the owner");
        });
    
    });
    
    async function getTimeFromKickoff(delay) {
        let kickoffTS = await staking.kickoffTS.call();
        return kickoffTS.add(new BN(delay));
    }

});
