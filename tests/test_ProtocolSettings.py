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


def test_set_wrbtc_token(sovryn, Constants, WRBTC, accounts):
    assert(sovryn.owner() == accounts[0])
    sovryn.setWrbtcToken(WRBTC.address)
    assert(sovryn.wrbtcToken() == WRBTC.address)

    with reverts("unauthorized"):
        sovryn.setWrbtcToken(WRBTC.address, {'from': accounts[1]})


def test_set_protocol_token_address(sovryn, Constants, accounts):
    assert(sovryn.owner() == accounts[0])
    assert(sovryn.protocolTokenAddress() == Constants["ZERO_ADDRESS"])
    sovryn.setProtocolTokenAddress(sovryn.address)
    assert(sovryn.protocolTokenAddress() == sovryn.address)

    with reverts("unauthorized"):
        sovryn.setProtocolTokenAddress(sovryn.address, {'from': accounts[1]})


'''
    Should set and deposit the protocol token
    1. deploy erc20
    2. set address
    3. approve token transfer
    4. deposit tokens
    5. verify balance
'''
def test_deposit_protocol_token(sovryn, accounts, TestToken):
    sov = accounts[0].deploy(TestToken, "Sovryn", "SOV", 18, 1e50)
    sovryn.setProtocolTokenAddress(sov.address)
    sov.approve(sovryn.address, 1e20)
    sovryn.depositProtocolToken(1e20)
    assert(sovryn.protocolTokenHeld() == 1e20)

    
'''
    Should fail to deposit the protocl token
'''
def test_fail_deposit_protocol_token(sovryn, accounts, TestToken):
    sov = accounts[1].deploy(TestToken, "Sovryn", "SOV", 18, 1e50)
    sovryn.setProtocolTokenAddress(sov.address)
    with reverts("unauthorized"):
        sovryn.depositProtocolToken(sov.address, {"from":accounts[1]})
    
'''
    Should successfully withdraw all deposited protocol tokens
'''
def test_withdraw_protocol_token(sovryn, accounts, TestToken):
    sov = accounts[0].deploy(TestToken, "Sovryn", "SOV", 18, 1e50)
    sovryn.setProtocolTokenAddress(sov.address)
    sov.approve(sovryn.address, 1e20)
    sovryn.depositProtocolToken(1e20)
    balanceBefore = sov.balanceOf(accounts[1])
    sovryn.withdrawProtocolToken(accounts[1], 1e20)
    balanceAfter = sov.balanceOf(accounts[1])
    assert(sovryn.protocolTokenHeld() == 0)
    assert(balanceAfter==balanceBefore+1e20)
    
'''
    Should fail to withdraw 1e30 protocol tokens but withdraw 1e20
'''
def test_fail_withdraw_protocol_token(sovryn, accounts, TestToken):
    sov = accounts[0].deploy(TestToken, "Sovryn", "SOV", 18, 1e50)
    sovryn.setProtocolTokenAddress(sov.address)
    sov.approve(sovryn.address, 1e20)
    sovryn.depositProtocolToken(1e20)
    balanceBefore = sov.balanceOf(accounts[1])
    sovryn.withdrawProtocolToken(accounts[1], 1e30)
    balanceAfter = sov.balanceOf(accounts[1])
    assert(sovryn.protocolTokenHeld() == 0)
    assert(balanceAfter==balanceBefore+1e20)


"""
    Should successfully change rollover base reward
"""
def test_set_rollover_base_reward(sovryn, accounts):
    new_reward = 1e15
    old_reward = sovryn.rolloverBaseReward()
    tx = sovryn.setRolloverBaseReward(new_reward)

    event = tx.events['SetRolloverBaseReward']
    assert(event['sender'] == accounts[0])
    assert(event['oldValue'] == old_reward)
    assert(event['newValue'] == new_reward)
    assert(sovryn.rolloverBaseReward() == new_reward)


"""
    Should fail to change rollover base reward by unauthorized user 
"""
def test_set_rollover_base_reward_by_unauthorized_user(sovryn, accounts):
    with reverts("unauthorized"):
        sovryn.setRolloverBaseReward(1e15, {'from': accounts[1]})
