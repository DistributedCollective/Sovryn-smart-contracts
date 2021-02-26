require('@openzeppelin/test-helpers/configure')({
    provider: web3.currentProvider,
    singletons: {
      abstraction: 'truffle',
    },
  });

const { expect, assert } = require('chai');
const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const TestToken = artifacts.require('TestToken');
const ProtocolTokenHandler = artifacts.require('ProtocolTokenHandler');

contract('ProtocolTokenHandler', async (accounts) => {
  let sov;
  let sovHandler;

  beforeEach(async () => {
    sov = await TestToken.new("SOV", "SOV", 18, web3.utils.toBN(1e18));
    sovHandler = await ProtocolTokenHandler.new(sov.address);
  });

  it('addSigner', async () => {
    assert.isFalse(await sovHandler.isSigner(accounts[1]));

    let res = await sovHandler.addSigner(accounts[1]);

    await expectEvent(res, 'AddSigner', {signer:accounts[1]});

    assert.isTrue(await sovHandler.isSigner(accounts[1]));
  });

  it('removeSigner', async () => {
    await sovHandler.addSigner(accounts[1]);
    assert.isTrue(await sovHandler.isSigner(accounts[1]));

    let res = await sovHandler.removeSigner(accounts[1]);

    await expectEvent(res, 'RemoveSigner', {signer:accounts[1]});

    assert.isFalse(await sovHandler.isSigner(accounts[1]));
  });

  it('setRequiredCount', async () => {
    assert.equal(await sovHandler.requiredCount(), 2);

    let res = await sovHandler.setRequiredCount(3);

    await expectEvent(res, 'SetRequiredCount', {requiredCount:"3"});

    assert.equal(await sovHandler.requiredCount(), 3);
  });

  it('deposit', async () => {
    assert.equal(await sov.balanceOf(sovHandler.address), 0);

    await sov.approve(sovHandler.address, web3.utils.toBN(1e17));

    let res = await sovHandler.deposit(web3.utils.toBN(1e17));

    await expectEvent(res, 'Deposit', {sender:accounts[0], amount:web3.utils.toBN(1e17)});

    assert.equal(await sov.balanceOf(sovHandler.address), 1e17);
  });

  it('withdraw', async () => {
    await sovHandler.addSigner(accounts[0]);
    await sovHandler.addSigner(accounts[1]);
    await sovHandler.addSigner(accounts[2]);

    await sov.approve(sovHandler.address, web3.utils.toBN(1e17));
    await sovHandler.deposit(web3.utils.toBN(1e17));

    let msgHash = await web3.utils.soliditySha3(accounts[1], web3.utils.toBN(1e17), 1);
    let hash = await web3.utils.soliditySha3("\x19Ethereum Signed Message:\n32", msgHash);

    let sig1 = await web3.eth.sign(msgHash, accounts[0]);
    let sig2 = await web3.eth.sign(msgHash, accounts[1]);
    
    let recoverSig1 = await web3.eth.accounts.recover(msgHash, sig1);
    let recoverSig2 = await web3.eth.accounts.recover(msgHash, sig2);
    assert.equal(recoverSig1, accounts[0]);
    assert.equal(recoverSig2, accounts[1]);

    let res = await sovHandler.withdraw(accounts[1], web3.utils.toBN(1e17), 1, [sig1, sig2]);

    await expectEvent(res, 'Withdraw', {caller:accounts[0], recipient:accounts[1], amount:web3.utils.toBN(1e17)});
  });
 
  it('should revert when using older nonce', async () => {
    await sovHandler.addSigner(accounts[0]);
    await sovHandler.addSigner(accounts[1]);
    await sovHandler.addSigner(accounts[2]);

    await sov.approve(sovHandler.address, web3.utils.toBN(1e17));
    await sovHandler.deposit(web3.utils.toBN(1e17));

    let msgHash = await web3.utils.soliditySha3(accounts[1], web3.utils.toBN(1e16), 2);

    let sig1 = await web3.eth.sign(msgHash, accounts[0]);
    let sig2 = await web3.eth.sign(msgHash, accounts[1]);

    let recoverSig1 = await web3.eth.accounts.recover(msgHash, sig1);
    let recoverSig2 = await web3.eth.accounts.recover(msgHash, sig2);
    assert.equal(recoverSig1, accounts[0]);
    assert.equal(recoverSig2, accounts[1]);

    let res = await sovHandler.withdraw(accounts[1], web3.utils.toBN(1e16), 2, [sig1, sig2]);

    await expectEvent(res, 'Withdraw', {caller:accounts[0], recipient:accounts[1], amount:web3.utils.toBN(1e16)});

    await expectRevert(sovHandler.withdraw(accounts[1], web3.utils.toBN(1e16), 1, [sig1, sig2]), "nonce smaller than last know nonce");
  });

  it('should revert when using unauthorized signer', async () => {
    await sovHandler.addSigner(accounts[0]);
    await sovHandler.addSigner(accounts[1]);
    await sovHandler.addSigner(accounts[2]);

    await sov.approve(sovHandler.address, web3.utils.toBN(1e17));
    await sovHandler.deposit(web3.utils.toBN(1e17));

    let msgHash = await web3.utils.soliditySha3(accounts[1], web3.utils.toBN(1e17), 1);

    let sig1 = await web3.eth.sign(msgHash, accounts[0]);
    let sig2 = await web3.eth.sign(msgHash, accounts[3]);

    let recoverSig1 = await web3.eth.accounts.recover(msgHash, sig1);
    let recoverSig2 = await web3.eth.accounts.recover(msgHash, sig2);
    assert.equal(recoverSig1, accounts[0]);
    assert.equal(recoverSig2, accounts[3]);
    
    await expectRevert(sovHandler.withdraw(accounts[1], web3.utils.toBN(1e17), 1, [sig1, sig2]), "signer not authorized");
  });

  it('should revert when using duplicate signers', async () => {
    await sovHandler.addSigner(accounts[0]);
    await sovHandler.addSigner(accounts[1]);
    await sovHandler.addSigner(accounts[2]);

    await sov.approve(sovHandler.address, web3.utils.toBN(1e17));
    await sovHandler.deposit(web3.utils.toBN(1e17));

    let msgHash = await web3.utils.soliditySha3(accounts[1], web3.utils.toBN(1e17), 1);

    let sig1 = await web3.eth.sign(msgHash, accounts[0]);
    let sig2 = await web3.eth.sign(msgHash, accounts[1]);

    let recoverSig1 = await web3.eth.accounts.recover(msgHash, sig1);
    let recoverSig2 = await web3.eth.accounts.recover(msgHash, sig2);
    assert.equal(recoverSig1, accounts[0]);
    assert.equal(recoverSig2, accounts[1]);
    
    await expectRevert(sovHandler.withdraw(accounts[1], web3.utils.toBN(1e17), 1, [sig1, sig1]), "signer verified");
  });

  it('should revert when signers not enough', async () => {
    await sovHandler.addSigner(accounts[0]);
    await sovHandler.addSigner(accounts[1]);
    await sovHandler.addSigner(accounts[2]);
  
    await sov.approve(sovHandler.address, web3.utils.toBN(1e17));
    await sovHandler.deposit(web3.utils.toBN(1e17));
  
    let msgHash = await web3.utils.soliditySha3(accounts[1], web3.utils.toBN(1e17), 1);
  
    let sig1 = await web3.eth.sign(msgHash, accounts[0]);
  
    let recoverSig1 = await web3.eth.accounts.recover(msgHash, sig1);
    assert.equal(recoverSig1, accounts[0]);

    await expectRevert(sovHandler.withdraw(accounts[1], web3.utils.toBN(1e17), 1, [sig1]), "invalid opcode");
  });

  it('should revert when balance not enough', async () => {
    await sovHandler.addSigner(accounts[0]);
    await sovHandler.addSigner(accounts[1]);
    await sovHandler.addSigner(accounts[2]);

    await sov.approve(sovHandler.address, web3.utils.toBN(1e17));
    await sovHandler.deposit(web3.utils.toBN(1e17));

    let msgHash = await web3.utils.soliditySha3(accounts[1], web3.utils.toBN(1e18), 1);

    let sig1 = await web3.eth.sign(msgHash, accounts[0]);
    let sig2 = await web3.eth.sign(msgHash, accounts[1]);

    let recoverSig1 = await web3.eth.accounts.recover(msgHash, sig1);
    let recoverSig2 = await web3.eth.accounts.recover(msgHash, sig2);
    assert.equal(recoverSig1, accounts[0]);
    assert.equal(recoverSig2, accounts[1]);
    
    await expectRevert(sovHandler.withdraw(accounts[1], web3.utils.toBN(1e18), 1, [sig1, sig2]), "balance not enough");
  });

});
