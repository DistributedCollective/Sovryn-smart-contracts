const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');

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

const Staking = artifacts.require('Staking');
const TestToken = artifacts.require('TestToken');

const TOTAL_SUPPLY = "10000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1095));

const DAY = 86400;
const TWO_WEEKS = 1209600;
const DELAY = TWO_WEEKS;

contract('WeightedStaking', accounts => {
  const name = 'Test token';
  const symbol = 'TST';

  let root, a1, a2, a3;
  let token, staking;

  before(async () => {
    [root, a1, a2, a3, ...accounts] = accounts;
  });

  beforeEach(async () => {
    token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
    staking = await Staking.new(token.address);
    await token.transfer(a2, "1000");
    await token.approve(staking.address, "1000", {from: a2});
  });

  describe('numCheckpoints', () => {
    it('returns the number of checkpoints for a user', async () => {
      await expect((await staking.numUserCheckpoints.call(a1)).toString()).to.be.equal('0');

      await staking.stake("100", DELAY, a1, a1, {from: a2});
      await expect((await staking.numUserCheckpoints.call(a1)).toString()).to.be.equal('1');

      await expectRevert(staking.stake("50", DELAY, a1, a1, {from: a2}),"Staking:stake: use 'increaseStake' to increase an existing staked position");
      
      await expect(await staking.increaseStake("50", a1, {from: a2}));
      await expect((await staking.numUserCheckpoints.call(a1)).toString()).to.be.equal('2');
    });
    
    it('returns the number of checkpoints for a delegate and date', async () => {
      
      
      let kickoffTS = await staking.kickoffTS.call();
      let newTime = kickoffTS.add(new BN(DELAY));

      await expect((await staking.numDelegateStakingCheckpoints.call(a3, newTime)).toString()).to.be.equal('0');

      await staking.stake("100", DELAY, a1, a3, {from: a2});
      await expect((await staking.numDelegateStakingCheckpoints.call(a3, newTime)).toString()).to.be.equal('1');
     
      await expect(await staking.increaseStake("50", a1, {from: a2}));
      await expect((await staking.numDelegateStakingCheckpoints.call(a3, newTime)).toString()).to.be.equal('1');
      
      await staking.stake("100", DELAY, a2, a3, {from: a2});
      await expect((await staking.numDelegateStakingCheckpoints.call(a3, newTime)).toString()).to.be.equal('2');
      
    });
    
    it('returns the number of total staking checkpoints for a date', async () => {
      
      
      let kickoffTS = await staking.kickoffTS.call();
      let newTime = kickoffTS.add(new BN(DELAY));

      await expect((await staking.numTotalStakingCheckpoints.call( newTime)).toString()).to.be.equal('0');

      await staking.stake("100", DELAY, a1, a3, {from: a2});
      await expect((await staking.numTotalStakingCheckpoints.call( newTime)).toString()).to.be.equal('1');
     
      await expect(await staking.increaseStake("50", a1, {from: a2}));
      await expect((await staking.numTotalStakingCheckpoints.call( newTime)).toString()).to.be.equal('2');
      
      await staking.stake("100", DELAY, a2, a3, {from: a2});
      await expect((await staking.numTotalStakingCheckpoints.call( newTime)).toString()).to.be.equal('3');
      
    });

  });

  describe('checkpoints', () => {
    it('returns the correct checkpoint for an user', async() => {
      let kickoffTS = await staking.kickoffTS.call();
      let newTime = kickoffTS.add(new BN(DELAY));
      
      let result = await staking.stake("100", DELAY, a1, a3, {from: a2});
      await expect((await staking.balanceOf(a1)).toString()).to.be.equal('100');
      let checkpoint = await staking.userCheckpoints(a1,0);

      await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
      await expect(checkpoint.stake.toString()).to.be.equal('100');
      await expect(checkpoint.lockedUntil.toString()).to.be.equal(newTime.toString());

    });
    
    it('returns the correct checkpoint for a delegate', async() => {
      let kickoffTS = await staking.kickoffTS.call();
      let newTime = kickoffTS.add(new BN(DELAY));
      
      let result = await staking.stake("100", DELAY, a1, a3, {from: a2});
      await expect((await staking.balanceOf(a1)).toString()).to.be.equal('100');
      let checkpoint = await staking.delegateStakingCheckpoints(a3, newTime, 0);

      await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
      await expect(checkpoint.stake.toString()).to.be.equal('100');
    });
    
    it('returns the correct checkpoint for a total stakes', async() => {
      let kickoffTS = await staking.kickoffTS.call();
      let newTime = kickoffTS.add(new BN(DELAY));
      
      let result = await staking.stake("100", DELAY, a1, a3, {from: a2});
      await expect((await staking.balanceOf(a1)).toString()).to.be.equal('100');
      let checkpoint = await staking.totalStakingCheckpoints( newTime, 0);

      await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
      await expect(checkpoint.stake.toString()).to.be.equal('100');
    });
  })
  
  describe('total voting power computation', () => {
    it('should compute the expected voting power', async() =>{
      let kickoffTS = await staking.kickoffTS.call();
      await staking.stake("100", DELAY * 72, a1, a2, {from: a2});
      await staking.stake("100", DELAY * 48, a2, a2, {from: a2});
      let result = await staking.stake("100", DELAY * 36, a3, a3, {from: a2});
      
      let maxVotingWeight = await staking.maxVotingWeight.call();
      //let expectedPower = maxVotingWeight * (weightingFunction(100, DELAY * 26 * 3) + weightingFunction(100, DELAY * 26 * 2) + weightingFunction(100, DELAY * 26));
      //console.log(expectedPower);
      
      //let totalVotingPower = await staking.getPriorTotalVotingPower(result.receipt.blockNumber, kickoffTS);
      //console.log(totalVotingPower);
    });
  })
  
  describe('delegated voting power computation', () => {
    it('', async() =>{
      
    });
  })
  
  describe('user weighted stake computation', () => {
    it('', async() =>{
      
    });
  })

});

async function updateTime(staking) {
  let kickoffTS = await staking.kickoffTS.call();
  let newTime = kickoffTS.add(new BN(DELAY).mul(new BN(2)));
  await setTime(newTime);
  return newTime;
}
