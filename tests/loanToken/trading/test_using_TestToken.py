#!/usr/bin/python3
 
# test script for testing the loan token logic with 2 TestTokens. 

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared
from shared_functions import *

'''
verifies that the loan token address is set on the contract
'''
def test_loanAddress(loanToken, SUSD):
    loanTokenAddress = loanToken.loanTokenAddress()
    assert loanTokenAddress == SUSD.address
  
'''
tests margin trading sending loan tokens.
process is handled by the shared function margin_trading_sending_loan_tokens
1. approve the transfer
2. send the margin trade tx
3. verify the trade event and balances are correct
4. retrieve the loan from the smart contract and make sure all values are set as expected
'''
def test_margin_trading_sending_loan_tokens(accounts, sovryn, loanToken, SUSD, RBTC, priceFeeds, chain):
    margin_trading_sending_loan_tokens(accounts, sovryn, loanToken, SUSD, RBTC, priceFeeds, chain, False)

'''
tests margin trading sending collateral tokens as collateral. 
process:
1. send the margin trade tx with the passed parameter (NOTE: the token transfer needs to be approved already)
2. TODO verify the trade event and balances are correct
''' 
def test_margin_trading_sending_collateral_tokens(accounts, sovryn, loanToken, SUSD, RBTC):
    
    loanSize = 10000e18
    SUSD.mint(loanToken.address,loanSize*6) 
    #   address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = sovryn.getRequiredCollateral(SUSD.address,RBTC.address,loanSize*2,50e18, False)
    RBTC.mint(accounts[0],collateralTokenSent)
    #important! WBTC is being held by the loanToken contract itself, all other tokens are transfered directly from 
    #the sender and need approval
    RBTC.approve(loanToken.address, collateralTokenSent)
    
    margin_trading_sending_collateral_tokens(accounts, sovryn, loanToken, SUSD, RBTC, loanSize, collateralTokenSent, 5e18, 0)


'''
should completely close a position.
first with returning loan tokens, then with returning collateral tokens to the sender.
process is handled by the shared function close_complete_margin_trade
1. prepares the test by setting up the interest rates, lending to the pool and opening a position
2. travels in time, so interest needs to be paid
3. makes sure closing with an unauthorized caller fails (only the trader may close his position)
4. sends the closing tx from the trader
5. verifies the result
'''
@pytest.mark.parametrize('return_token_is_collateral', [False, True])
def test_close_complete_margin_trade(sovryn, loanToken, web3, set_demand_curve, lend_to_pool, open_margin_trade_position, priceFeeds, chain, return_token_is_collateral):
    close_complete_margin_trade(sovryn, loanToken, web3, set_demand_curve, lend_to_pool, open_margin_trade_position, priceFeeds, chain, return_token_is_collateral)

'''
should partially close a position.
first with returning loan tokens, then with returning collateral tokens to the sender.
process is handled by the shared function close_partial_margin_trade
1. prepares the test by setting up the interest rates, lending to the pool and opening a position
2. travels in time, so interest needs to be paid
3. makes sure closing with an unauthorized caller fails (only the trader may close his position)
4. sends the closing tx from the trader
5. verifies the result
'''
@pytest.mark.parametrize('return_token_is_collateral', [False, True])
def test_close_partial_margin_trade(sovryn, loanToken, web3, set_demand_curve, lend_to_pool, open_margin_trade_position, priceFeeds, chain, return_token_is_collateral):
    close_partial_margin_trade(sovryn, loanToken, web3, set_demand_curve, lend_to_pool, open_margin_trade_position, priceFeeds, chain, return_token_is_collateral)


