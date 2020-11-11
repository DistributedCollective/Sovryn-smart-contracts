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

const DELAY = 86400 * 14;

contract('Staking', accounts => {
  const name = 'Test token';
  const symbol = 'TST';

  let root, a1, a2, a3;
  let token, comp;

  before(async () => {
    [root, a1, a2, a3, ...accounts] = accounts;
    token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
    comp = await Staking.new(token.address);
  });

  describe('stake', () => {

    beforeEach(async () => {
      token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
      comp = await Staking.new(token.address);
    });

    it("Amount should be positive", async () => {
      await expectRevert(comp.stake(0, DELAY, root, root),
          "amount of tokens to stake needs to be bigger than 0");
    });

    it("Use 'increaseStake' to increase an existing staked position", async () => {
      await token.approve(comp.address, TOTAL_SUPPLY);
      await comp.stake(100, DELAY, root, root);

      await expectRevert(comp.stake(100, DELAY, root, root),
          "Staking:stake: use 'increaseStake' to increase an existing staked position");
    });

    it("Amount should be approved", async () => {
      await expectRevert(comp.stake(100, DELAY, root, root),
          "invalid transfer");
    });

    // it("Staking balance should be less than  2**96", async () => {
    //   await token.approve(comp.address, TOTAL_SUPPLY);
    //
    //   await comp.stake(100, MAX_DURATION, root, root);
    //
    //   await expectRevert(comp.stake(new BN(Math.pow(2, 96)).minus(new BN(2)), MAX_DURATION, root, root),
    //       "msg.sender already has a lock. locking duration cannot be reduced.");
    // });

  });

  describe('timestampToLockDate', () => {
    before(async () => {
      [root, a1, a2, a3, ...accounts] = accounts;

      token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
      comp = await Staking.new(token.address);
    });

    it("Lock date should be start + 1 period", async () => {
      let kickoffTS = await comp.kickoffTS.call();
      let newTime = kickoffTS.add(new BN(TWO_WEEKS));
      setTime(newTime);

      let result = await comp.timestampToLockDate(newTime);
      expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS);
    });

    it("Lock date should be start + 2 period", async () => {
      let kickoffTS = await comp.kickoffTS.call();
      let newTime = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(2)).add(new BN(DAY)));
      setTime(newTime);

      let result = await comp.timestampToLockDate(newTime);
      expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS * 2);
    });

    it("Lock date should be start + 3 period", async () => {
      let kickoffTS = await comp.kickoffTS.call();
      let newTime = kickoffTS.add(new BN(TWO_WEEKS).mul(new BN(3)).add(new BN(DAY)));
      setTime(newTime);

      let result = await comp.timestampToLockDate(newTime);
      expect(result.sub(kickoffTS).toNumber()).to.be.equal(TWO_WEEKS * 3);
    });

  });

});
