import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

def test_swap_external(accounts, sovryn, RBTC, SUSD, priceFeeds, web3):
    tx = sovryn.swapExternal(RBTC.address, SUSD.address, accounts[1], accounts[0], 1e18, 0, 1, web3.toBytes(0), priceFeeds.address)
    print(tx)
    external_swap = tx.events['ExternalSwap']
    print(external_swap['sourceAmount'])
    print(external_swap['destAmount'])
    assert(external_swap['user'] == accounts[0])
    assert(external_swap['sourceToken'] == SUSD.address)
    assert(external_swap['destToken'] == WRBTC.address)


