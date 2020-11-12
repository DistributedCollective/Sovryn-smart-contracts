const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');

const {
  etherMantissa,
  encodeParameters,
  setTime,
  mineBlock
} = require('../../Utils/Ethereum');

const GovernorAlpha = artifacts.require('GovernorAlphaMockup');
const Timelock = artifacts.require('TimelockHarness');
const Staking = artifacts.require('Staking');
const TestToken = artifacts.require('TestToken');

const DELAY = 86400 * 14;

const QUORUM_VOTES = etherMantissa(4000000);
const TOTAL_SUPPLY = etherMantissa(1000000000);

async function enfranchise(token, comp, actor, amount) {
  await token.transfer(actor, amount);
  await token.approve(comp.address, amount, {from: actor});
  await comp.stake(amount, DELAY, actor, actor, {from: actor});

  await comp.delegate(actor, { from: actor });
}

contract('GovernorAlpha#queue/1', accounts => {
  let root, a1, a2;
  before(async () => {
    [root, a1, a2, ...accounts] = accounts;
  });

  describe("overlapping actions", () => {
    it("reverts on queueing overlapping actions in same proposal", async () => {
      const timelock = await Timelock.new(root, DELAY);
      const token = await TestToken.new("TestToken", "TST", 18, TOTAL_SUPPLY);
      const comp = await Staking.new(token.address);
      const gov = await GovernorAlpha.new(timelock.address, comp.address, root);
      const txAdmin = await timelock.harnessSetAdmin(gov.address);

      await enfranchise(token, comp, a1, QUORUM_VOTES);
      await mineBlock();

      const targets = [comp.address, comp.address];
      const values = ["0", "0"];
      const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
      const calldatas = [encodeParameters(['address'], [root]), encodeParameters(['address'], [root])];

      await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a1 });
      let proposalId1 = await gov.proposalCount.call();
      await mineBlock();

      const txVote1 = await gov.castVote(proposalId1, true, {from: a1});
      await advanceBlocks(30);

      await expectRevert(gov.queue(proposalId1),
          "revert GovernorAlpha::_queueOrRevert: proposal action already queued at eta");
    });

    it("reverts on queueing overlapping actions in different proposals, works if waiting", async () => {
      const timelock = await Timelock.new(root, DELAY);
      const token = await TestToken.new("TestToken", "TST", 18, etherMantissa(10000000000000));
      const comp = await Staking.new(token.address);
      const gov = await GovernorAlpha.new(timelock.address, comp.address, root);
      const txAdmin = await timelock.harnessSetAdmin(gov.address);

      await enfranchise(token, comp, a1, QUORUM_VOTES);
      await enfranchise(token, comp, a2, QUORUM_VOTES);
      await mineBlock();

      const targets = [comp.address];
      const values = ["0"];
      const signatures = ["getBalanceOf(address)"];
      const calldatas = [encodeParameters(['address'], [root])];

      await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a1 });
      let proposalId1 = await gov.proposalCount.call();

      await gov.propose(targets, values, signatures, calldatas, "do nothing", { from: a2 });
      let proposalId2 = await gov.proposalCount.call();
      await mineBlock();

      const txVote1 = await gov.castVote(proposalId1, true, {from: a1});
      const txVote2 = await gov.castVote(proposalId2, true, {from: a2});
      await advanceBlocks(30);
      await setTime(100);

      const txQueue1 = await gov.queue(proposalId1);
      await expectRevert(gov.queue(proposalId2),
          "revert GovernorAlpha::_queueOrRevert: proposal action already queued at eta");

      await setTime(101);
      const txQueue2 = await gov.queue(proposalId2);
    });
  });
});

async function advanceBlocks(number) {
  for (let i = 0; i < number; i++) {
    await mineBlock();
  }
}
