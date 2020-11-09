const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');

const {
  address,
  minerStart,
  minerStop,
  unlockedAccount,
  mineBlock,
  etherMantissa,
  etherUnsigned
} = require('../Utils/Ethereum');

const EIP712 = require('../Utils/EIP712');

const GovernorAlpha = artifacts.require('GovernorAlphaMockup');
const Timelock = artifacts.require('TimelockHarness');
const Staking = artifacts.require('Staking');
const TestToken = artifacts.require('TestToken');

const TOTAL_SUPPLY = "10000000000000000000000000";
const delay = etherUnsigned(2 * 24 * 60 * 60).multipliedBy(2);

contract('Staking', accounts => {
  const name = 'Test token';
  const symbol = 'TST';

  let root, a1, a2, chainId;
  let token, comp;

  // beforeEach(async () => {
  before(async () => {
    [root, a1, a2, a3, ...accounts] = accounts;
    chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    await web3.eth.net.getId();
    token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
    comp = await Staking.new(token.address);
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
          "revert Comp::delegateBySig: invalid signature");
    });

    it('reverts if the nonce is bad ', async () => {
      const delegatee = root, nonce = 1, expiry = 0;
      const { v, r, s } = EIP712.sign(Domain(comp), 'Delegation', { delegatee, nonce, expiry }, Types, unlockedAccount(a1).secretKey);
      await expectRevert(comp.delegateBySig(delegatee, nonce, expiry, v, r, s),
          "revert Comp::delegateBySig: invalid nonce");
    });

    it('reverts if the signature has expired', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      const { v, r, s } = EIP712.sign(Domain(comp), 'Delegation', { delegatee, nonce, expiry }, Types, unlockedAccount(a1).secretKey);
      await expectRevert(comp.delegateBySig(delegatee, nonce, expiry, v, r, s),
          "revert Comp::delegateBySig: signature expired");
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

      await expect((await comp.numCheckpoints.call(a1)).toString()).to.be.equal('0');

      await token.approve(comp.address, "1000", { from: guy });

      await comp.stake("100", delay, a2, { from: guy });
      await comp.delegate(a1, { from: guy });

      await expect((await comp.numCheckpoints.call(a1)).toString()).to.be.equal('1');

      await comp.delegate(a2, { from: guy });
      await expect((await comp.numCheckpoints.call(a1)).toString()).to.be.equal('2');
    });

    it('does not add more than one checkpoint in a block', async () => {
      let guy = accounts[1];
      await token.transfer(guy, '1000'); //give an account a few tokens for readability
      await expect((await comp.numCheckpoints.call(a3)).toString()).to.be.equal('0');

      await token.approve(comp.address, "1000", { from: guy });

      await minerStop();
      let t1 = comp.stake("80", delay, a3, { from: guy });


      let t2 = comp.delegate(a3, { from: guy });
      let t3 = token.transfer(a2, 10, { from: guy });
      let t4 = token.transfer(a2, 10, { from: guy });

      await minerStart();
      t1 = await t1;
      t2 = await t2;
      t3 = await t3;
      t4 = await t4;

      await expect((await comp.numCheckpoints.call(a3)).toString()).to.be.equal('1');

      let checkpoint0 = await comp.checkpoints.call(a3, 0);
      await expect(checkpoint0.fromBlock.toString()).to.be.equal(t1.receipt.blockNumber.toString());
      await expect(checkpoint0.votes.toString()).to.be.equal("80");

      let checkpoint1 = await comp.checkpoints.call(a3, 1);
      await expect(checkpoint1.fromBlock.toString()).to.be.equal("0");
      await expect(checkpoint1.votes.toString()).to.be.equal("0");

      let checkpoint2 = await comp.checkpoints.call(a3, 2);
      await expect(checkpoint2.fromBlock.toString()).to.be.equal("0");
      await expect(checkpoint2.votes.toString()).to.be.equal("0");

      await token.approve(comp.address, "20", { from: a2 });
      let t5 = await comp.stake("20", delay, a3, { from: a2 });

      await expect((await comp.numCheckpoints.call(a3)).toString()).to.be.equal('2');

      checkpoint1 = await comp.checkpoints.call(a3, 1);
      await expect(checkpoint1.fromBlock.toString()).to.be.equal(t5.receipt.blockNumber.toString());
      await expect(checkpoint1.votes.toString()).to.be.equal("100");

    });
  });

  describe('getPriorVotes', () => {
    let amount = "1000";

    before(async () => {
      [root, a1, a2, a3, ...accounts] = accounts;
      chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
      await web3.eth.net.getId();
      token = await TestToken.new(name, symbol, 18, TOTAL_SUPPLY);
      comp = await Staking.new(token.address);

      await token.approve(comp.address, TOTAL_SUPPLY);
      await comp.stake(amount, delay, root);
    });

    it('reverts if block number >= current block', async () => {
      await expectRevert(comp.getPriorVotes.call(a1, 5e10),
          "revert Comp::getPriorVotes: not yet determined");
    });

    it('returns 0 if there are no checkpoints', async () => {
      expect((await comp.getPriorVotes.call(a1, 0)).toString()).to.be.equal('0');
    });

    it('returns the latest block if >= last checkpoint block', async () => {
      const t1 = await comp.delegate(a1);
      await mineBlock();
      await mineBlock();

      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber))).toString()).to.be.equal(amount);
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1))).toString()).to.be.equal(amount);
    });

    it('returns zero if < first checkpoint block', async () => {
      await mineBlock();
      const t1 = await comp.delegate(a2);
      await mineBlock();
      await mineBlock();

      expect((await comp.getPriorVotes.call(a2, new BN(t1.receipt.blockNumber - 1))).toString()).to.be.equal('0');
      expect((await comp.getPriorVotes.call(a2, new BN(t1.receipt.blockNumber + 1))).toString()).to.be.equal(amount);
    });

    it('generally returns the voting balance at the appropriate checkpoint', async () => {
      const t1 = await comp.delegate(a1);
      await mineBlock();
      await mineBlock();
      await token.transfer(a2, 10);
      await token.approve(comp.address, "10", { from: a2 });
      const t2 = await comp.stake("10", delay, a1, { from: a2 });
      await mineBlock();
      await mineBlock();
      await token.transfer(a3, 101);
      await token.approve(comp.address, "101", { from: a3 });
      const t3 = await comp.stake("101", delay, a1, { from: a3 });
      await mineBlock();
      await mineBlock();

      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber - 1))).toString()).to.be.equal('0');
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber))).toString()).to.be.equal('1000');
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1))).toString()).to.be.equal('1000');
      expect((await comp.getPriorVotes.call(a1, new BN(t2.receipt.blockNumber))).toString()).to.be.equal('1010');
      expect((await comp.getPriorVotes.call(a1, new BN(t2.receipt.blockNumber + 1))).toString()).to.be.equal('1010');
      expect((await comp.getPriorVotes.call(a1, new BN(t3.receipt.blockNumber))).toString()).to.be.equal('1111');
      expect((await comp.getPriorVotes.call(a1, new BN(t3.receipt.blockNumber + 1))).toString()).to.be.equal('1111');
    });
  });
});
