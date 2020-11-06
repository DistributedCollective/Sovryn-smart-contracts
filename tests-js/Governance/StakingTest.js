const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');

const {
  address,
  minerStart,
  minerStop,
  unlockedAccount,
  mineBlock,
  etherMantissa
} = require('../Utils/Ethereum');

const EIP712 = require('../Utils/EIP712');

const GovernorAlpha = artifacts.require('GovernorAlphaMockup');
const Timelock = artifacts.require('TimelockHarness');
const Staking = artifacts.require('Staking');
const TestToken = artifacts.require('TestToken');

contract('Staking', accounts => {
  const name = 'Test token';
  const symbol = 'TST';

  let root, a1, a2, chainId;
  let token, comp;

  // beforeEach(async () => {
  before(async () => {
    [root, a1, a2, ...accounts] = accounts;
    //TODO ?
    chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    await web3.eth.net.getId();
    token = await TestToken.new(name, symbol, 18, etherMantissa(1000000000));
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
      expect(await token.balanceOf.call(root)).to.be.equal("10000000000000000000000000");
    });
  });

  describe('delegateBySig', () => {
    const Domain = (comp) => ({ name, chainId, verifyingContract: comp.address });
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
      await comp.transfer(guy, '100'); //give an account a few tokens for readability
      await expect(comp.numCheckpoints.call(a1)).resolves.to.be.equal('0');

      const t1 = await comp.delegate(a1, { from: guy });
      await expect(comp.numCheckpoints.call(a1)).resolves.to.be.equal('1');

      const t2 = await comp.transfer(a2, 10, { from: guy });
      await expect(comp.numCheckpoints.call(a1)).resolves.to.be.equal('2');

      const t3 = await comp.transfer(a2, 10, { from: guy });
      await expect(comp.numCheckpoints.call(a1)).resolves.to.be.equal('3');

      const t4 = await comp.transfer(guy, 20, { from: root });
      await expect(compnumCheckpoints.call(a1)).resolves.to.be.equal('4');

      await expect(comp.checkpoints.call(a1, 0)).resolves.to.be.equal(expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: '100' }));
      await expect(comp.checkpoints.call(a1, 1)).resolves.to.be.equal(expect.objectContaining({ fromBlock: t2.blockNumber.toString(), votes: '90' }));
      await expect(comp.checkpoints.call(a1, 2)).resolves.to.be.equal(expect.objectContaining({ fromBlock: t3.blockNumber.toString(), votes: '80' }));
      await expect(comp.checkpoints.call(a1, 3)).resolves.to.be.equal(expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: '100' }));
    });

    it('does not add more than one checkpoint in a block', async () => {
      let guy = accounts[0];

      await comp.transfer(guy, '100'); //give an account a few tokens for readability
      await expect(comp.numCheckpoints.call(a1)).resolves.to.be.equal('0');
      await minerStop();

      let t1 = send(comp, 'delegate', [a1], { from: guy });
      let t2 = send(comp, 'transfer', [a2, 10], { from: guy });
      let t3 = send(comp, 'transfer', [a2, 10], { from: guy });

      await minerStart();
      t1 = await t1;
      t2 = await t2;
      t3 = await t3;

      await expect(comp.numCheckpoints.call(a1)).resolves.to.be.equal('1');

      await expect(comp.checkpoints.call(a1, 0)).resolves.to.be.equal(expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: '80' }));
      await expect(comp.checkpoints.call(a1, 1)).resolves.to.be.equal(expect.objectContaining({ fromBlock: '0', votes: '0' }));
      await expect(comp.checkpoints.call(a1, 2)).resolves.to.be.equal(expect.objectContaining({ fromBlock: '0', votes: '0' }));

      const t4 = await comp.transfer(guy, 20, { from: root });
      await expect(comp.numCheckpoints.call(a1)).resolves.to.be.equal('2');
      await expect(comp.checkpoints.call(a1, 1)).resolves.to.be.equal(expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: '100' }));
    });
  });

  describe('getPriorVotes', () => {
    it('reverts if block number >= current block', async () => {
      await expectRevert(comp.getPriorVotes.call(a1, 5e10),
          "revert Comp::getPriorVotes: not yet determined");
    });

    it('returns 0 if there are no checkpoints', async () => {
      expect(await comp.getPriorVotes.call(a1, 0)).to.be.equal('0');
    });

    it('returns the latest block if >= last checkpoint block', async () => {
      const t1 = await comp.delegate(a1, { from: root });
      await mineBlock();
      await mineBlock();

      expect(await comp.getPriorVotes.call(a1, t1.blockNumber)).to.be.equal('10000000000000000000000000');
      expect(await comp.getPriorVotes.call(a1, t1.blockNumber + 1)).to.be.equal('10000000000000000000000000');
    });

    it('returns zero if < first checkpoint block', async () => {
      await mineBlock();
      const t1 = await comp.delegate(a1, { from: root });
      await mineBlock();
      await mineBlock();

      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber - 1))).toString()).to.be.equal('0');
      expect((await comp.getPriorVotes.call(a1, new BN(t1.receipt.blockNumber + 1))).toString()).to.be.equal('10000000000000000000000000');
    });

    it('generally returns the voting balance at the appropriate checkpoint', async () => {
      const t1 = await comp.delegate(a1, { from: root });
      await mineBlock();
      await mineBlock();
      const t2 = await token.transfer(a2, 10, { from: root });
      await mineBlock();
      await mineBlock();
      const t3 = await token.transfer(a2, 10, { from: root });
      await mineBlock();
      await mineBlock();
      const t4 = await token.transfer(root, 20, { from: a2 });
      await mineBlock();
      await mineBlock();

      expect((await comp.getPriorVotes.call(a1, new BN(t1.blockNumber - 1))).toString()).to.be.equal('0');
      expect((await comp.getPriorVotes.call(a1, new BN(t1.blockNumber))).toString()).to.be.equal('10000000000000000000000000');
      expect((await comp.getPriorVotes.call(a1, new BN(t1.blockNumber + 1))).toString()).to.be.equal('10000000000000000000000000');
      expect((await comp.getPriorVotes.call(a1, new BN(t2.blockNumber))).toString()).to.be.equal('9999999999999999999999990');
      expect((await comp.getPriorVotes.call(a1, new BN(t2.blockNumber + 1))).toString()).to.be.equal('9999999999999999999999990');
      expect((await comp.getPriorVotes.call(a1, new BN(t3.blockNumber))).toString()).to.be.equal('9999999999999999999999980');
      expect((await comp.getPriorVotes.call(a1, new BN(t3.blockNumber + 1))).toString()).to.be.equal('9999999999999999999999980');
      expect((await comp.getPriorVotes.call(a1, new BN(t4.blockNumber))).toString()).to.be.equal('10000000000000000000000000');
      expect((await comp.getPriorVotes.call(a1, new BN(t4.blockNumber + 1))).toString()).to.be.equal('10000000000000000000000000');
    });
  });
});
