#!/usr/bin/python3

import pytest

def test_targetSetup(Constants, sovryn):

    sig1 = "testFunction1(address,uint256,bytes)"
    sig2 = "testFunction2(address[],uint256[],bytes[])"

    sigs = [sig1,sig2]
    targets = [Constants["ONE_ADDRESS"]] * len(sigs)
    sovryn.setTargets(sigs, targets)

    assert sovryn.getTarget(sig1) == Constants["ONE_ADDRESS"]
    assert sovryn.getTarget(sig2) == Constants["ONE_ADDRESS"]

    targets = [Constants["ZERO_ADDRESS"]] * len(sigs)
    sovryn.setTargets(sigs, targets)

    assert sovryn.getTarget(sig1) == Constants["ZERO_ADDRESS"]
    assert sovryn.getTarget(sig2) == Constants["ZERO_ADDRESS"]

def test_replaceContract(Constants, sovryn, accounts, LoanSettings, WETH, BZRX):

    sig = "setupLoanParams((bytes32,bool,address,address,address,uint256,uint256,uint256)[])"
    loanSettings = accounts[0].deploy(LoanSettings, WETH.address, BZRX.address)

    sovryn.setTargets([sig], [Constants["ZERO_ADDRESS"]])
    assert sovryn.getTarget(sig) == Constants["ZERO_ADDRESS"]

    sovryn.replaceContract(loanSettings.address)
    assert sovryn.getTarget(sig) == loanSettings.address

def test_receivesEther(web3, sovryn, accounts):

    assert(web3.eth.getBalance(sovryn.address) == 0)
    web3.eth.sendTransaction({ "from": str(accounts[0]), "to": sovryn.address, "value": 10000, "gas": "5999" })
    assert(web3.eth.getBalance(sovryn.address) == 10000)
