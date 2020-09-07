'''
test script for testing the loan token lending logic with wBTC as collateral token and the sUSD test token as underlying loan token. 

'''

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared
from shared_lending_functions import *

'''
Test lend to the pool. The lender mint tokens from loanToken using SUSD as deposit.
Then check if user balance change and the token price varies
'''
def test_lend_to_the_pool(loanToken, accounts, SUSD, WBTC, chain, set_demand_curve, sovryn):
    lend_to_the_pool(loanToken, accounts, SUSD, WBTC, chain, set_demand_curve, sovryn)
