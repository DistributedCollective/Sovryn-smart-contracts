'''
Test adding more margin to existing loans.
1. Deposit more collateral
2. Should fail to deposit collateral to an non-existent loan
3. Should fail to deposit 0 collateral
'''

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared


def test_deposit_collateral(sovryn,set_demand_curve,lend_to_pool,open_margin_trade_position, RBTC, priceFeeds):
    #prepare the test
    set_demand_curve()
    (receiver, _) = lend_to_pool()
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position()
    startCollateral = sovryn.getLoan(loan_id).dict()["collateral"]
    deposit_amount = startCollateral/2
    
    #deposit collateral to add margin to the loan created above
    RBTC.approve(sovryn, deposit_amount)
    tx = sovryn.depositCollateral(loan_id, deposit_amount)

    (currentMargin, collateralInEthAmount) = priceFeeds.getCurrentMargin(
        sovryn.getLoan(loan_id).dict()["loanToken"],
        sovryn.getLoan(loan_id).dict()["collateralToken"],
        sovryn.getLoan(loan_id).dict()["principal"],
        sovryn.getLoan(loan_id).dict()["collateral"]
    )
    
    #verify the deposit collateral event
    print(tx.info())
    assert(tx.events['DepositCollateral']['loanId'] == loan_id)
    assert(tx.events['DepositCollateral']['depositAmount'] == deposit_amount)
    assert(tx.events['DepositCollateral']['rate'] == collateralInEthAmount)
    
    #make sure, collateral was increased
    endCollateral = sovryn.getLoan(loan_id).dict()["collateral"]
    assert(endCollateral-startCollateral == deposit_amount)

def test_deposit_collateral_to_non_existent_loan(sovryn, RBTC):
    #try to deposit collateral to a loan with id 0
    RBTC.approve(sovryn, 1e15)
    with reverts("loan is closed"):
        sovryn.depositCollateral("0", 1e15)
        
def test_deposit_collateral_0_value(sovryn,set_demand_curve,lend_to_pool,open_margin_trade_position, RBTC):
    #prepare the test
    set_demand_curve()
    (receiver, _) = lend_to_pool()
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position()
    
    with reverts("depositAmount is 0"):
        sovryn.depositCollateral(loan_id, 0)
    
