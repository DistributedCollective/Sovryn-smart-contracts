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

const StakingLogic = artifacts.require('Staking');
const StakingProxy = artifacts.require('StakingProxy');
const TestToken = artifacts.require('TestToken');

const TOTAL_SUPPLY = "10000000000000000000000000";
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1092));

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
    
    let stakingLogic = await StakingLogic.new(token.address);
    staking = await StakingProxy.new(token.address);
    await staking.setImplementation(stakingLogic.address);
    staking = await StakingLogic.at(staking.address);
    
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
      
      //shortest staking duration
      let newTime = kickoffTS.add(new BN(DELAY));
      let result = await staking.stake("100", DELAY, a1, a3, {from: a2});
      await expect((await staking.balanceOf(a1)).toString()).to.be.equal('100');
      let checkpoint = await staking.userCheckpoints(a1,0);

      await expect(checkpoint.fromBlock.toNumber()).to.be.equal(result.receipt.blockNumber);
      await expect(checkpoint.stake.toString()).to.be.equal('100');
      await expect(checkpoint.lockedUntil.toString()).to.be.equal(newTime.toString());
      
      //max staking duration
      newTime = kickoffTS.add(new BN(DELAY*3*26));
      result = await staking.stake("100", DELAY * 3 *26, a2, a3, {from: a2});
      checkpoint = await staking.userCheckpoints(a2,0);
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
      await staking.stake("100", DELAY * (26 * 3 ), a1, a2, {from: a2});
      await staking.stake("100", DELAY * 26 * 2, a2, a2, {from: a2});
      let result = await staking.stake("100", DELAY * 26, a3, a3, {from: a2});
      await mineBlock();
      
      let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
      let maxDuration = await staking.MAX_DURATION.call();
      
      //power on kickoff date
      let expectedPower =  weightingFunction(100, DELAY * (26 * 3 ), maxDuration, maxVotingWeight) + weightingFunction(100, DELAY * 26 * 2, maxDuration, maxVotingWeight) + weightingFunction(100, DELAY * 26, maxDuration, maxVotingWeight);
      let totalVotingPower = await staking.getPriorTotalVotingPower(result.receipt.blockNumber, kickoffTS);
      await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
      
      //power 52 weeks later
      expectedPower =  weightingFunction(100, DELAY * (26 * 2 ), maxDuration, maxVotingWeight) + weightingFunction(100, DELAY * 26 * 1, maxDuration, maxVotingWeight) + weightingFunction(100, DELAY * 26 * 0, maxDuration, maxVotingWeight);
      totalVotingPower = await staking.getPriorTotalVotingPower(result.receipt.blockNumber, kickoffTS.add(new BN(DELAY*26)));
      await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
    });
    
    it('should be unable to compute the total voting power for the current block', async() =>{
      let kickoffTS = await staking.kickoffTS.call();
      let result = await staking.stake("100", DELAY * 26, a3, a3, {from: a2});
      await expectRevert(staking.getPriorTotalVotingPower(result.receipt.blockNumber, kickoffTS), "Staking::getPriorTotalStakesForDate: not yet determined");
    });
  })
  
  describe('delegated voting power computation', () => {
    it('should compute the expected voting power', async() =>{
      let kickoffTS = await staking.kickoffTS.call();
      await staking.stake("100", DELAY * (26 * 3 ), a1, a2, {from: a2});
      await staking.stake("100", DELAY * 26 * 2, a2, a3, {from: a2});
      let result = await staking.stake("100", DELAY * 26, a3, a2, {from: a2});
      await mineBlock();
      
      let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
      let maxDuration = await staking.MAX_DURATION.call();
      
      //power on kickoff date
      let expectedPower =  weightingFunction(100, DELAY * (26 * 3 ), maxDuration, maxVotingWeight) + weightingFunction(100, DELAY * 26, maxDuration, maxVotingWeight);
      let totalVotingPower = await staking.getPriorVotes(a2, result.receipt.blockNumber, kickoffTS);
      await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
      
      //power 52 weeks later
      expectedPower =  weightingFunction(100, DELAY * (26 * 2 ), maxDuration, maxVotingWeight)  + weightingFunction(100, DELAY * 26 * 0, maxDuration, maxVotingWeight);
      totalVotingPower = await staking.getPriorVotes(a2, result.receipt.blockNumber, kickoffTS.add(new BN(DELAY*26)));
      await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
    });
    
    it('should be unable to compute the voting power for the current block', async() =>{
      let kickoffTS = await staking.kickoffTS.call();
      let result = await staking.stake("100", DELAY * 26, a3, a3, {from: a2});
      await expectRevert(staking.getPriorVotes(a3, result.receipt.blockNumber, kickoffTS), "Staking::getPriorStakeByDateForDelegatee: not yet determined");
    });
  })
  
  describe('user weighted stake computation', () => {
    it('should compute the expected weighted stake', async() =>{
      let kickoffTS = await staking.kickoffTS.call();
      await staking.stake("100", DELAY * (26 * 3 ), a2, a2, {from: a2});
      await staking.stake("100", DELAY * 26 * 2, a1, a3, {from: a2});
      let result = await staking.increaseStake("100", a2, {from: a2});
      await mineBlock();
      
      let maxVotingWeight = await staking.MAX_VOTING_WEIGHT.call();
      let maxDuration = await staking.MAX_DURATION.call();
      
      //power on kickoff date
      let expectedPower =  weightingFunction(200, DELAY * (26 * 3 ), maxDuration, maxVotingWeight)
      let totalVotingPower = await staking.getPriorWeightedStake(a2, result.receipt.blockNumber, kickoffTS);
      await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
      
      //power 52 weeks later
      expectedPower =  weightingFunction(200, DELAY * (26 * 2 ), maxDuration, maxVotingWeight);
      totalVotingPower = await staking.getPriorWeightedStake(a2, result.receipt.blockNumber, kickoffTS.add(new BN(DELAY*26)));
      await expect(totalVotingPower.toNumber()).to.be.equal(expectedPower);
    });
    
    it('should be unable to compute the weighted stake for the current block', async() =>{
      let kickoffTS = await staking.kickoffTS.call();
      let result = await staking.stake("100", DELAY * 26, a3, a3, {from: a2});
      await expectRevert(staking.getPriorWeightedStake(a3, result.receipt.blockNumber, kickoffTS), "Staking::getPriorUserStakeAndDate: not yet determined");
    });
  })

});

async function updateTime(staking, multiplier) {
  let kickoffTS = await staking.kickoffTS.call();
  let newTime = kickoffTS.add(new BN(DELAY).mul(new BN(multiplier)));
  await setTime(newTime);
  return newTime;
}

function weightingFunction(stake, time, maxDuration, maxVotingWeight){
  let x = maxDuration - time;
  let mD2 = maxDuration * maxDuration;
  return stake * Math.floor(maxVotingWeight * (mD2 - x*x) / mD2) ;

}