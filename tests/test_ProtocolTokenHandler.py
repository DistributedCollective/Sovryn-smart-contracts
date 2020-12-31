import pytest
from brownie import Contract, Wei, reverts, convert
from fixedint import *
import shared
from eth_account.messages import encode_defunct, _hash_eip191_message

@pytest.fixture
def sovHandler(accounts, ProtocolTokenHandler, SOV):
    return accounts[0].deploy(ProtocolTokenHandler, SOV.address)

def test_add_signer(accounts, sovHandler):
    assert(sovHandler.isSigner(accounts[1]) == False)

    tx = sovHandler.addSigner(accounts[1])
    signer = tx.events['AddSigner']['singer']

    assert(sovHandler.isSigner(accounts[1]) == True)
    assert(signer == accounts[1])

def test_remove_signer(accounts, sovHandler):
    sovHandler.addSigner(accounts[1])
    assert(sovHandler.isSigner(accounts[1]) == True)

    tx = sovHandler.removeSigner(accounts[1])
    signer = tx.events['RemoveSigner']['singer']

    assert(sovHandler.isSigner(accounts[1]) == False)
    assert(signer == accounts[1])

def test_set_required_count(accounts, sovHandler):
    tx = sovHandler.setRequiredCount(1)
    count = tx.events['SetRequiredCount']['requiredCount']

    assert(sovHandler.requiredCount() == 1)
    assert(count == 1)

def test_deposit(accounts, sovHandler, SOV):
    SOV.approve(sovHandler.address, 1e20)

    tx = sovHandler.deposit(1e20)
    sender = tx.events['Deposit']['sender']
    amount = tx.events['Deposit']['amount']

    assert(SOV.balanceOf(sovHandler.address) == 1e20)
    assert(sender == accounts[0])
    assert(amount == 1e20)

def test_withdraw(accounts, sovHandler, SOV, web3):
    sovHandler.addSigner(accounts[0])
    sovHandler.addSigner(accounts[1])
    sovHandler.addSigner(accounts[2])

    SOV.approve(sovHandler.address, 1e20)
    sovHandler.deposit(1e20)

    msgHash = web3.solidityKeccak(['address', 'address', 'uint256', 'uint256'], [str(accounts[1]), sovHandler.address, convert.to_uint(1e20, "uint256"), 1])
    hash = web3.solidityKeccak(['string', 'bytes32'], ["\x19Ethereum Signed Message:\n32", web3.toHex(msgHash)])

    sign1 = web3.eth.sign(str(accounts[0]), hexstr = web3.toHex(hash))
    sign2 = web3.eth.sign(str(accounts[1]), hexstr = web3.toHex(hash))

    res = sovHandler.withdraw(accounts[1], sovHandler.address, 1e20, 1, [web3.toHex(sign1), web3.toHex(sign2)])

    assert(res == True)
    assert(res.events['Withdraw']['caller'] == accounts[0])
    assert(res.events['Withdraw']['recipient'] == accounts[1])
    assert(res.events['Withdraw']['amount'] == 1e20)
    assert(SOV.balanceOf(sovHandler.address) == 0)
    assert(SOV.balanceOf(accounts[1]) == 1e20)

