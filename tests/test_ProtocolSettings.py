#!/usr/bin/python3

import pytest
from brownie import reverts

def test_setCoreParams(Constants, sovryn):

    sovryn.setPriceFeedContract(
        Constants["ONE_ADDRESS"]
    )

    sovryn.setSwapsImplContract(
        Constants["ONE_ADDRESS"]
    )

    assert sovryn.priceFeeds() == Constants["ONE_ADDRESS"]
    assert sovryn.swapsImpl() == Constants["ONE_ADDRESS"]

def test_setLoanPool(Constants, sovryn, accounts):

    assert(sovryn.loanPoolToUnderlying(accounts[6]) == Constants["ZERO_ADDRESS"])
    assert(sovryn.underlyingToLoanPool(accounts[7]) == Constants["ZERO_ADDRESS"])

    assert(not sovryn.isLoanPool(accounts[6]))
    assert(not sovryn.isLoanPool(accounts[8]))

    sovryn.setLoanPool(
        [
            accounts[6],
            accounts[8]
        ],
        [
            accounts[7],
            accounts[9]
        ]
    )

    assert(sovryn.loanPoolToUnderlying(accounts[6]) == accounts[7])
    assert(sovryn.underlyingToLoanPool(accounts[7]) == accounts[6])

    assert(sovryn.loanPoolToUnderlying(accounts[8]) == accounts[9])
    assert(sovryn.underlyingToLoanPool(accounts[9]) == accounts[8])

    assert(sovryn.isLoanPool(accounts[6]))
    assert(sovryn.isLoanPool(accounts[8]))

    #print(sovryn.getloanPoolsList(0, 100))

    sovryn.setLoanPool(
        [
            accounts[6]
        ],
        [
            Constants["ZERO_ADDRESS"]
        ]
    )

    assert(sovryn.loanPoolToUnderlying(accounts[6]) == Constants["ZERO_ADDRESS"])
    assert(sovryn.underlyingToLoanPool(accounts[7]) == Constants["ZERO_ADDRESS"])

    assert(not sovryn.isLoanPool(accounts[6]))

    #print(sovryn.getloanPoolsList(0, 100))

    #assert(False)
'''
@pytest.mark.parametrize('idx', [0, 1, 2])
def test_transferFrom_reverts(token, accounts, idx):
    with brownie.reverts("Insufficient allowance"):
        token.transferFrom(accounts[0], accounts[2], 1e18, {'from': accounts[idx]})
'''


def test_set_weth_token(sovryn, Constants, WETH, accounts):
    assert(sovryn.owner() == accounts[0])
    assert(sovryn.wethToken() == Constants["ZERO_ADDRESS"])
    sovryn.setWethToken(WETH.address)
    assert(sovryn.wethToken() == WETH.address)

    with reverts("unauthorized"):
        sovryn.setWethToken(WETH.address, {'from': accounts[1]})


def test_set_protocol_token_address(sovryn, Constants, accounts):
    assert(sovryn.owner() == accounts[0])
    assert(sovryn.protocolTokenAddress() == Constants["ZERO_ADDRESS"])
    sovryn.setProtocolTokenAddress(sovryn.address)
    assert(sovryn.protocolTokenAddress() == sovryn.address)

    with reverts("unauthorized"):
        sovryn.setProtocolTokenAddress(sovryn.address, {'from': accounts[1]})
