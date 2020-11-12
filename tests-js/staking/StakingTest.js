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

const EIP712 = require('../Utils/EIP712');

const Staking = artifacts.require('Staking');
const TestToken = artifacts.require('TestToken');

const TOTAL_SUPPLY = "10000000000000000000000000";
const DELAY = 86400 * 14;
const MAX_DURATION = new BN(24 * 60 * 60).mul(new BN(1095));

const DAY = 86400;
const TWO_WEEKS = 1209600;

contract('Staking', accounts => {
  const name = 'Test token';
  const symbol = 'TST';

  let root, a1, a2, a3, chainId;
  let token, comp;
  let MAX_VOTING_WEIGHT;

  before(async () => {
    [root, a1, a2, a3, ...accounts] = accounts;
  });

  beforeEach(async () => {
    chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    await web3.eth.net.getId();
    token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
    comp = await Staking.new(token.address);
  
    MAX_VOTING_WEIGHT = await comp.MAX_VOTING_WEIGHT.call();
  });

  describe('metadata', () => {
    it('has given name', async () => {
      expect(await token.name.call()).to.be.equal(name);
    });

    it('has given symbol', async () => {
      expect(await token.symbol.call()).to.be.equal(symbol);
    });
  });

  describe('balanceOf', () => {
    it('grants to initial account', async () => {
      expect((await token.balanceOf.call(root)).toString()).to.be.equal(TOTAL_SUPPLY);
    });
  });

  describe('delegateBySig', () => {
    const Domain = (comp) => ({ name: 'SOVStaking', chainId, verifyingContract: comp.address });
    const Types = {
      Delegation: [
        { name: 'delegatee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' }
      ]
    };

    it('reverts if the signatory is invalid', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      await expectRevert(comp.delegateBySig(delegatee, nonce, expiry, 0, '0xbad', '0xbad'),
          "revert Staking::delegateBySig: invalid signature");
    });

    it('reverts if the nonce is bad ', async () => {
      const delegatee = root, nonce = 1, expiry = 0;
      const { v, r, s } = EIP712.sign(Domain(comp), 'Delegation', { delegatee, nonce, expiry }, Types, unlockedAccount(a1).secretKey);
      await expectRevert(comp.delegateBySig(delegatee, nonce, expiry, v, r, s),
          "revert Staking::delegateBySig: invalid nonce");
    });

    it('reverts if the signature has expired', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      const { v, r, s } = EIP712.sign(Domain(comp), 'Delegation', { delegatee, nonce, expiry }, Types, unlockedAccount(a1).secretKey);
      await expectRevert(comp.delegateBySig(delegatee, nonce, expiry, v, r, s),
          "revert Staking::delegateBySig: signature expired");
    });

    it('delegates on behalf of the signatory', async () => {
      const delegatee = root, nonce = 0, expiry = 10e9;
      const { v, r, s } = EIP712.sign(Domain(comp), 'Delegation', { delegatee, nonce, expiry }, Types, unlockedAccount(a1).secretKey);
      expect(await comp.delegates.call(a1)).to.be.equal(address(0));
      const tx = await comp.delegateBySig(delegatee, nonce, expiry, v, r, s);
      expect(tx.gasUsed < 80000);
      expect(await comp.delegates.call(a1)).to.be.equal(root);
    });
  });

  describe('numCheckpoints', () => {
    it('returns the number of checkpoints for a delegate', async () => {
      let guy = accounts[0];

      await token.transfer(guy, "1000"); //give an account a few tokens for readability

      await expect((await comp.numUserCheckpoints.call(a1)).toString()).to.be.equal('0');

      await token.approve(comp.address, "1000", { from: guy });
      await comp.stake("100", DELAY, a1, a1, { from: guy });
      await expect((await comp.numUserCheckpoints.call(a1)).toString()).to.be.equal('1');

      await comp.increaseStake("50", a1, { from: guy });
      await expect((await comp.numUserCheckpoints.call(a1)).toString()).to.be.equal('2');
    });

    it('does not add more than one checkpoint in a block', async () => {
      let guy = accounts[1];
      await token.transfer(guy, '1000'); //give an account a few tokens for readability
      await expect((await comp.numUserCheckpoints.call(a3)).toString()).to.be.equal('0');

      await token.approve(comp.address, "1000", { from: guy });

      await minerStop();
      let t1 = comp.stake("80", DELAY, a3, a3, { from: guy });


      let t2 = comp.delegate(a3, { from: guy });
      let t3 = token.transfer(a2, 10, { from: guy });
      let t4 = token.transfer(a2, 10, { from: guy });

      await minerStart();
      t1 = await t1;
      t2 = await t2;
      t3 = await t3;
      t4 = await t4;

      await expect((await comp.numUserCheckpoints.call(a3)).toString()).to.be.equal('1');

      let checkpoint0 = await comp.userCheckpoints.call(a3, 0);
      await expect(checkpoint0.fromBlock.toString()).to.be.equal(t1.receipt.blockNumber.toString());
      await expect(checkpoint0.stake.toString()).to.be.equal("80");

      let checkpoint1 = await comp.userCheckpoints.call(a3, 1);
      await expect(checkpoint1.fromBlock.toString()).to.be.equal("0");
      await expect(checkpoint1.stake.toString()).to.be.equal("0");

      let checkpoint2 = await comp.userCheckpoints.call(a3, 2);
      await expect(checkpoint2.fromBlock.toString()).to.be.equal("0");
      await expect(checkpoint2.stake.toString()).to.be.equal("0");

      await token.approve(comp.address, "20", { from: a2 });
      let t5 = await comp.increaseStake("20", a3, { from: a2 });

      await expect((await comp.numUserCheckpoints.call(a3)).toString()).to.be.equal('2');

      checkpoint1 = await comp.userCheckpoints.call(a3, 1);
      await expect(checkpoint1.fromBlock.toString()).to.be.equal(t5.receipt.blockNumber.toString());
      await expect(checkpoint1.stake.toString()).to.be.equal("100");

    });
  });
  
  describe('getPriorVotes', () => {
    let amount = "1000";
    
    it('reverts if block number >= current block', async () => {
      let kickoffTS = await comp.kickoffTS.call();
      let time = kickoffTS.add(new BN(DELAY));
      await expectRevert(comp.getPriorVotes.call(a1, 5e10, time),
          "revert Staking::getPriorStakeByDateForDelegatee: not yet determined");
    });

    it('returns 0 if there are no checkpoints', async () => {
      let time = await comp.kickoffTS.call();
      expect((await comp.getPriorVotes.call(a1, 0, time)).toString()).to.be.equal('0');
    });

    it('returns the latest block if >= last checkpoint block', async () => {
      await token.approve(comp.address, amount);
      let t1 = await comp.stake(amount, MAX_DURATION, a1, a1);
      await mineBlock();
      await mineBlock();

      let time = await comp.kickoffTS.call();
      let amountWithWeight = getAmountWithWeight(amount);
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber), time)).toString()).to.be.equal(amountWithWeight.toString());
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1), time)).toString()).to.be.equal(amountWithWeight.toString());
    });

    it('returns zero if < first checkpoint block', async () => {
      await mineBlock();
      await token.approve(comp.address, amount);
      let t1 = await comp.stake(amount, MAX_DURATION, a1, a1);
      await mineBlock();
      await mineBlock();
  
      let time = await comp.kickoffTS.call();
      let amountWithWeight = getAmountWithWeight(amount);
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber - 1), time)).toString()).to.be.equal('0');
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1), time)).toString()).to.be.equal(amountWithWeight.toString());
    });

    it('generally returns the voting balance at the appropriate checkpoint', async () => {
      await token.approve(comp.address, "1000");
      await comp.stake("1000", MAX_DURATION, root, root);
      const t1 = await comp.delegate(a1);
      await mineBlock();
      await mineBlock();
      await token.transfer(a2, 10);
      await token.approve(comp.address, "10", { from: a2 });
      const t2 = await comp.stake("10", MAX_DURATION, a1, a1, { from: a2 });
      await mineBlock();
      await mineBlock();
      await token.transfer(a3, 101);
      await token.approve(comp.address, "101", { from: a3 });
      const t3 = await comp.increaseStake("101", a1, { from: a3 });
      await mineBlock();
      await mineBlock();

      let time = await comp.kickoffTS.call();

      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber - 1), time)).toString()).to.be.equal('0');
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber), time)).toString()).to.be.equal(getAmountWithWeight('1000').toString());
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1), time)).toString()).to.be.equal(getAmountWithWeight('1000').toString());
      expect((await comp.getPriorVotes.call(a1, new BN(t2.receipt.blockNumber), time)).toString()).to.be.equal(getAmountWithWeight('1010').toString());
      expect((await comp.getPriorVotes.call(a1, new BN(t2.receipt.blockNumber + 1), time)).toString()).to.be.equal(getAmountWithWeight('1010').toString());
      expect((await comp.getPriorVotes.call(a1, new BN(t3.receipt.blockNumber), time)).toString()).to.be.equal(getAmountWithWeight('1111').toString());
      expect((await comp.getPriorVotes.call(a1, new BN(t3.receipt.blockNumber + 1), time)).toString()).to.be.equal(getAmountWithWeight('1111').toString());
    });
  });
  
  function getAmountWithWeight(amount) {
    return MAX_VOTING_WEIGHT.mul(new BN(amount));
  }
  
});
