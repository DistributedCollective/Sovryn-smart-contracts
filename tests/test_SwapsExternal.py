import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

def test_swapExternal(accounts, sovryn, RBTC, SUSD, priceFeeds):
    SUSD.approve(sovryn.address, 1e18) 

    tx = sovryn.swapExternal(SUSD.address, RBTC.address, accounts[0], accounts[0], 1e18, 0, 0, b'', priceFeeds.address)
    
    external_swap = tx.events['ExternalSwap']
    assert(external_swap['user'] == accounts[0])
    assert(external_swap['sourceToken'] == SUSD.address)
    assert(external_swap['destToken'] == RBTC.address)
    assert(external_swap['sourceAmount'] == 1e18)
    assert(external_swap['sourceAmount'] == tx.return_value[1])
    assert(external_swap['destAmount'] == tx.return_value[0])


'''
    Should fail with zero sourceTokenAmount
'''
def test_swapExternal_with_zero_sourceTokenAmount(accounts, sovryn, RBTC, SUSD, priceFeeds):
    SUSD.approve(sovryn.address, 1e18)
    with reverts("sourceTokenAmount == 0"):
        sovryn.swapExternal(SUSD.address, RBTC.address, accounts[0], accounts[0], 0, 0, 0, b'', priceFeeds.address)


'''
    Should fail without enough allowance
'''
def test_swapExternal_without_enough_allowance(accounts, sovryn, RBTC, SUSD, priceFeeds):
    SUSD.approve(sovryn.address, 1e17)
    with reverts("SafeERC20: low-level call failed"):
        sovryn.swapExternal(SUSD.address, RBTC.address, accounts[0], accounts[0], 1e18, 0, 0, b'', priceFeeds.address)


'''
    Should fail with larger minReturn than destTokenAmountReceived
'''
def test_swapExternal_with_larger_minReturn(accounts, sovryn, RBTC, SUSD, priceFeeds):
    SUSD.approve(sovryn.address, 1e18)
    with reverts("destTokenAmountReceived too low"):
        sovryn.swapExternal(SUSD.address, RBTC.address, accounts[0], accounts[0], 1e18, 0, 1e18, b'', priceFeeds.address)


def test_getSwapExpectedReturn(accounts, sovryn, RBTC, SUSD):
    result = sovryn.getSwapExpectedReturn(SUSD.address, RBTC.address, 1e18)
    assert(result > 0)


def test_checkPriceDivergence(accounts, sovryn, RBTC, SUSD, priceFeeds):
    tx = sovryn.checkPriceDivergence(SUSD.address, RBTC.address, 1e18, priceFeeds)
    assert(tx.return_value)