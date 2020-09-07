'''
shared functions for the lending tests
'''

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

'''
computes the expected iToken price 
'''
def get_itoken_price(assets_deposited, earned_interests, total_supply):
    return fixedint(assets_deposited).add(earned_interests).mul(1e18).div(total_supply)

'''
Test lend to the pool. The lender mint tokens from loanToken using the underlyingToken as deposit.
Then check if user balance change and the token price varies
'''   
def lend_to_the_pool(loanToken, accounts, underlyingToken, collateralToken, chain, set_demand_curve, sovryn):
    # set the demand curve to set interest rates
    set_demand_curve()
    
    #set the params
    lender = accounts[0]
    deposit_amount = 400e18
    loan_token_sent = 100e18
    total_deposit_amount = fixedint(deposit_amount).add(loan_token_sent)
    initial_balance = underlyingToken.balanceOf(lender)
    
    # approve the token transfer
    underlyingToken.approve(loanToken.address, total_deposit_amount)
    
    #check the start conditions are met
    verify_start_conditions(underlyingToken, loanToken, lender, initial_balance, deposit_amount)
    
    #supply funds to the pool (the actual lending)
    loanToken.mint(lender, deposit_amount)
    
    #verify the result
    assert(underlyingToken.balanceOf(lender) == initial_balance - deposit_amount)
    verify_lending_result_and_itoken_price_change(accounts, underlyingToken, collateralToken, loanToken, lender, loan_token_sent, initial_balance, deposit_amount, chain, sovryn)

'''
verifies the start conditions are met to make sure, the end conditions are checked correctly. 
'''
def verify_start_conditions(underlyingToken, loanToken, lender, initial_balance, deposit_amount):
    assert(underlyingToken.balanceOf(lender) == initial_balance)
    assert(loanToken.totalSupply() == 0)
    assert(loanToken.profitOf(lender) == 0)
    assert(loanToken.checkpointPrice(lender) == 0)
    assert(loanToken.totalSupplyInterestRate(deposit_amount) == 0)

'''    
1. checks the balances of the lender on the underlying token and the loan token contract
2. makes a trade in order to get a innterest rate > 0
3. travels in time to accumulate interest
4. verifies the token price changed according to the gained interest
'''
def verify_lending_result_and_itoken_price_change(accounts, underlyingToken, collateralToken, loanToken, lender, loan_token_sent, initial_balance, deposit_amount, chain, sovryn, sendValue = False):
    #verify the result
    
    assert(loanToken.balanceOf(lender) == fixedint(deposit_amount).div(loanToken.initialPrice()).mul(1e18))
    earned_interests_1 = 0  # Shouldn't be earned interests
    price1 = get_itoken_price(deposit_amount, earned_interests_1, loanToken.totalSupply())
    assert(loanToken.tokenPrice() == price1)
    assert(loanToken.checkpointPrice(lender) == loanToken.initialPrice())
    assert(loanToken.totalSupplyInterestRate(deposit_amount) == 0)
    
    # Should borrow money to get an interest rate different of zero (interest rate depends on the total borrowed amount)
    value = loan_token_sent if sendValue else 0
    loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        2e18,  # leverageAmount
        loan_token_sent,  # loanTokenSent
        0,  # no collateral token sent
        collateralToken.address,  # collateralTokenAddress
        accounts[0],  # trader,
        b'',  # loanDataBytes (only required with ether)
        {'value': value}
    )
    #time travel for interest to accumulate
    chain.sleep(100)
    chain.mine(1)
    
    #verify the token price changed according to the gained interest
    price_2 = loanToken.tokenPrice()
    lender_interest_data = sovryn.getLenderInterestData(loanToken.address, underlyingToken.address).dict()
    earned_interest_2 = fixedint(lender_interest_data['interestUnPaid'])\
        .mul(fixedint(1e20).sub(lender_interest_data['interestFeePercent'])).div(1e20)
    assert(price_2 == get_itoken_price(deposit_amount, earned_interest_2, loanToken.totalSupply()))

'''
1. lend to the pool
2. check balance and supply
3. withdraw from the pool by burning iTokens
4. check balance and supply
'''
def cash_out_from_the_pool(loanToken, accounts, underlyingToken):
    lender = accounts[0]
    initial_balance = underlyingToken.balanceOf(lender)
    amount_withdrawn = 100e18
    total_deposit_amount = amount_withdrawn * 2
    assert(initial_balance > total_deposit_amount)

    underlyingToken.approve(loanToken.address, total_deposit_amount)
    assert(loanToken.checkpointPrice(lender) == 0)
    loanToken.mint(lender, total_deposit_amount)
    assert(loanToken.checkpointPrice(lender) == loanToken.initialPrice())
    loan_token_initial_balance = total_deposit_amount / loanToken.initialPrice() * 1e18
    assert(loanToken.balanceOf(lender) == loan_token_initial_balance)
    assert(loanToken.totalSupply() == total_deposit_amount)

    loanToken.burn(lender, amount_withdrawn)
    assert(loanToken.checkpointPrice(lender) == loanToken.initialPrice())
    assert(loanToken.totalSupply() == amount_withdrawn)
    assert(loanToken.tokenPrice() == get_itoken_price(amount_withdrawn, 0, loanToken.totalSupply()))
    assert(loanToken.balanceOf(lender) == amount_withdrawn)
    assert(underlyingToken.balanceOf(lender) == initial_balance - amount_withdrawn * loanToken.tokenPrice() / 1e18)
