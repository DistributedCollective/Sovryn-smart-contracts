const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');

const {
  etherUnsigned,
  encodeParameters,
  etherMantissa,
  mineBlock,
  setTime,
  increaseTime
} = require('../../Utils/Ethereum');

const path = require('path');
const solparse = require('solparse');

const GovernorAlpha = artifacts.require('GovernorAlphaMockup');
const Timelock = artifacts.require('TimelockHarness');
const Staking = artifacts.require('Staking');
const TestToken = artifacts.require('TestToken');

const governorAlphaPath = path.join(__dirname, '../../..', 'contracts', 'governance/GovernorAlpha.sol');

const statesInverted = solparse
  .parseFile(governorAlphaPath)
  .body
  .find(k => k.type === 'ContractStatement')
  .body
  .find(k => k.name === 'ProposalState')
  .members

const states = Object.entries(statesInverted).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});

const QUORUM_VOTES = etherMantissa(4000000);

contract('GovernorAlpha#state/1', accounts => {
  let token, comp, gov, root, acct, delay, timelock;

  before(async () => {
    await setTime(100);
    [root, acct, ...accounts] = accounts;
    token = await TestToken.new("TestToken", "TST", 18, etherMantissa(10000000000000));
    comp = await Staking.new(token.address);
    delay = etherUnsigned(2 * 24 * 60 * 60).multipliedBy(2)
    timelock = await Timelock.new(root, delay);
    delay = etherUnsigned(10)
    await timelock.setDelay(delay);
    gov = await GovernorAlpha.new(timelock.address, comp.address, root);
    await timelock.harnessSetAdmin(gov.address);
    await token.approve(comp.address, QUORUM_VOTES);
    await comp.stake(QUORUM_VOTES, delay, acct);

    await token.transfer(acct, QUORUM_VOTES);
    await token.approve(comp.address, QUORUM_VOTES, {from: acct});
    await comp.stake(QUORUM_VOTES, delay, acct, {from: acct});

    await comp.delegate(acct, { from: acct });
  });

  let trivialProposal, targets, values, signatures, callDatas;
  before(async () => {
    targets = [root];
    values = ["0"];
    signatures = ["getBalanceOf(address)"]
    callDatas = [encodeParameters(['address'], [acct])];
    await comp.delegate(root);
    await gov.propose(targets, values, signatures, callDatas, "do nothing");
    proposalId = await gov.latestProposalIds.call(root);
    trivialProposal = await gov.proposals.call(proposalId);
  })

  it("Invalid for proposal not found", async () => {
    await expectRevert(gov.state.call("5"),
        "revert GovernorAlpha::state: invalid proposal id");
  })

  it("Pending", async () => {
    expect((await gov.state.call(trivialProposal.id)).toString()).to.be.equal(states["Pending"].toString())
  })

  it("Active", async () => {
    await mineBlock()
    await mineBlock()
    expect((await gov.state.call(trivialProposal.id)).toString()).to.be.equal(states["Active"].toString())
  })

  it("Canceled", async () => {
    await mineBlock()
    await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
    let newProposalId = await gov.proposalCount.call();

    await gov.cancel(newProposalId);

    expect((await gov.state.call(+newProposalId)).toString()).to.be.equal(states["Canceled"]);
  })

  it("Defeated", async () => {
    // travel to end block
    await advanceBlocks(20)

    expect((await gov.state(trivialProposal.id)).toString()).to.be.equal(states["Defeated"]);
  })

  it("Succeeded", async () => {
    await mineBlock()
    await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
    let newProposalId = await gov.latestProposalIds.call(acct);
    await mineBlock()
    await gov.castVote(newProposalId, true);
    await advanceBlocks(20);

    expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Succeeded"]);
  })

  it("Queued", async () => {
    await mineBlock()
    await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
    let newProposalId = await gov.latestProposalIds.call(acct);
    await mineBlock()
    await gov.castVote(newProposalId, true);
    await advanceBlocks(20)

    await gov.queue(newProposalId, { from: acct });
    expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Queued"]);
  })

  it("Expired", async () => {
    await mineBlock()
    await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
    let newProposalId = await gov.latestProposalIds.call(acct);
    await mineBlock()
    await gov.castVote(newProposalId, true);
    await advanceBlocks(20)

    await increaseTime(1)
    await gov.queue(newProposalId, { from: acct });

    let gracePeriod = await timelock.GRACE_PERIOD.call();
    let p = await gov.proposals.call(newProposalId);
    let eta = etherUnsigned(p.eta)

    await setTime(eta.plus(gracePeriod).minus(1).toNumber())

    expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Queued"]);

    await increaseTime(eta.plus(gracePeriod).toNumber())

    expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Expired"]);
  })

  it("Executed", async () => {
    await mineBlock()
    await gov.propose(targets, values, signatures, callDatas, "do nothing", { from: acct });
    let newProposalId = await gov.latestProposalIds.call(acct);

    await mineBlock()
    await gov.castVote(newProposalId, true);
    await advanceBlocks(20)

    await increaseTime(1)
    await gov.queue(newProposalId, { from: acct });

    let gracePeriod = await timelock.GRACE_PERIOD.call();
    let p = await gov.proposals.call(newProposalId);
    let eta = etherUnsigned(p.eta)

    await setTime(eta.plus(gracePeriod).minus(1).toNumber())

    expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Queued"])
    await gov.execute(newProposalId, { from: acct });

    expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Executed"]);

    // still executed even though would be expired
    await setTime(eta.plus(gracePeriod).toNumber());

    expect((await gov.state.call(newProposalId)).toString()).to.be.equal(states["Executed"]);
  })

})

async function advanceBlocks(number) {
  for (let i = 0; i < number; i++) {
    await mineBlock();
  }
}
