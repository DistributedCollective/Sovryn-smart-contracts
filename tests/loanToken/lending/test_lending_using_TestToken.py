'''
test script for testing the loan token lending logic with 2 TestTokens. 
'''

#!/usr/bin/python3
import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared
from shared_lending_functions import *

'''
Test lend to the pool. The lender mint tokens from loanToken using SUSD as deposit.
Then check if user balance change and the token price varies
'''
def test_lend_to_the_pool(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn):
    lend_to_the_pool(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn)

'''

'''
def test_cash_out_from_the_pool(loanToken, accounts, SUSD):
    cash_out_from_the_pool(loanToken, accounts, SUSD)


def test_cash_out_from_the_pool_more_of_lender_balance_should_not_fail(loanToken, accounts, SUSD):
    lender = accounts[0]
    initial_balance = SUSD.balanceOf(lender)
    amount_withdrawn = 100e18
    total_deposit_amount = amount_withdrawn * 2
    assert(initial_balance > total_deposit_amount)

    SUSD.approve(loanToken.address, total_deposit_amount)
    loanToken.mint(lender, total_deposit_amount)
    loanToken.burn(lender, total_deposit_amount * 2)
    assert(loanToken.balanceOf(lender) == 0)
    assert(loanToken.tokenPrice() == loanToken.initialPrice())
    assert(SUSD.balanceOf(lender) == initial_balance)

