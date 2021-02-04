'''
test script for testing the loan token lending logic with 2 TestTokens. 
1. Lending / Minting
2. Cashing Out / Burning
3. Cashing out / Burning more than available
4. profitOf function
'''

#!/usr/bin/python3
import pytest
from loanToken.lending.shared_lending_functions import *

'''
Test lend to the pool. The lender mint tokens from loanToken using SUSD as deposit.
Then check if user balance change and the token price varies
'''
def test_lend_to_the_pool(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn):
    lend_to_the_pool(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn)

'''
1. lend to the pool
2. check balance and supply
3. withdraw from the pool by burning iTokens
4. check balance and supply
'''
def test_cash_out_from_the_pool(loanToken, accounts, SUSD):
    lendBTC = False #lend tokens and not direct rbtc
    cash_out_from_the_pool(loanToken, accounts, SUSD, lendBTC)

'''
try to burn more than I'm possessing. should burn the maximum possible amount.
'''
def test_cash_out_from_the_pool_more_of_lender_balance_should_not_fail(loanToken, accounts, SUSD):
    cash_out_from_the_pool_more_of_lender_balance_should_not_fail(loanToken, accounts, SUSD)

'''
tests if profitOf is showing the current profit (opposed to total profit)
'''
def test_profit(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn):
    lend_to_the_pool(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn)
    #above functionn also opens a trading position, so I need to add some more funds to be able to withdraw everything
    balanceOf0 = loanToken.assetBalanceOf(accounts[0])
    SUSD.approve(loanToken.address, balanceOf0)
    loanToken.mint(accounts[2], balanceOf0)
    profitBefore = loanToken.profitOf(accounts[0])
    iTokenBalance = loanToken.balanceOf(accounts[0])
    
    #burn everything -> profit should be 0
    loanToken.burn(accounts[0], iTokenBalance)
    profitInt = loanToken.profitOf(accounts[0])
    
    #lend again and wait some time -> profit should rise again, but less than before, because there are more funds in the pool.
    SUSD.approve(loanToken.address, balanceOf0+100e18)
    loanToken.mint(accounts[0], balanceOf0)
    SUSD.approve(loanToken.address, balanceOf0+100e18)
    chain.sleep(100)
    chain.mine(1)
    profitAfter = loanToken.profitOf(accounts[0])

    assert(profitInt == 0)
    assert(profitAfter > 0 and profitAfter < profitBefore)

def test_mint_without_early_access_token_should_fail_if_required(TestToken, loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn):
    # prepare early access token
    early_access_token = accounts[0].deploy(TestToken, "Sovryn Early Access Token", "SEAT", 1, 10)
    early_access_token.transfer(accounts[1], early_access_token.balanceOf(accounts[0]))
    loanToken.setEarlyAccessToken(early_access_token.address)

    with reverts("No early access tokens"):
        lend_to_the_pool(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn)

def test_mint_with_early_access_token(TestToken, loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn):
    # prepare early access token
    early_access_token = accounts[0].deploy(TestToken, "Sovryn Early Access Token", "SEAT", 1, 10)
    loanToken.setEarlyAccessToken(early_access_token.address)
    lend_to_the_pool(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn)