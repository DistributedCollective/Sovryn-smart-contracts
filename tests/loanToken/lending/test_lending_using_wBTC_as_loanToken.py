'''
test script for testing the loan token lending logic with the sUSD test token as collateral token and wBTC as underlying loan token. 
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
def test_lend_to_the_pool(loanTokenWBTC, accounts, SUSD, WBTC, chain, set_demand_curve, sovryn):
    # set the demand curve to set interest rates
    set_demand_curve()
    
    #set the params
    lender = accounts[0]
    deposit_amount = 4e18
    loan_token_sent = 1e18
    total_deposit_amount = fixedint(deposit_amount).add(loan_token_sent)
    initial_balance = 0 # dummy value to be able to use the shared functions
    
    #check the start conditions are met
    verify_start_conditions(WBTC, loanTokenWBTC, lender, initial_balance, deposit_amount)
    
    #supply funds to the pool (the actual lending)
    loanTokenWBTC.mintWithBTC(lender, {'value':deposit_amount})
    
    #verify the result
    initial_balance = 5e18 # dummy value to be able to use the shared functions
    verify_lending_result_and_itoken_price_change(accounts, WBTC, SUSD, loanTokenWBTC, lender, loan_token_sent, initial_balance, deposit_amount, chain, sovryn, True)
    
    