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
    token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
    staking = await Staking.new(token.address);
  });

  //TODO Example
  describe('numCheckpoints', () => {
    it('returns the number of checkpoints for a delegate', async () => {
      await token.transfer(a2, "1000");
      await token.approve(staking.address, "1000", {from: a2});

      await expect((await staking.numUserCheckpoints.call(a1)).toString()).to.be.equal('0');

      await staking.stake("100", DELAY, a1, a1, {from: a2});
      await expect((await staking.numUserCheckpoints.call(a1)).toString()).to.be.equal('1');

      await expectRevert(staking.stake("50", DELAY, a1, a1, {from: a2}),"Staking:stake: use 'increaseStake' to increase an existing staked position");
      
      await expect(await staking.increaseStake("50", a1, {from: a2}));
      await expect((await staking.numUserCheckpoints.call(a1)).toString()).to.be.equal('2');
    });

  });

});

async function updateTime(staking) {
  let kickoffTS = await staking.kickoffTS.call();
  let newTime = kickoffTS.add(new BN(DELAY).mul(new BN(2)));
  await setTime(newTime);
  return newTime;
}
