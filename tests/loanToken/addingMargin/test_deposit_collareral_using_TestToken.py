import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared


def test_deposit_collateral(sovryn,set_demand_curve,lend_to_pool,open_margin_trade_position, RBTC):
    #prepare the test
    set_demand_curve()
    (receiver, _) = lend_to_pool()
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position()
    startCollateral = sovryn.getLoan(loan_id).dict()["collateral"]
    
    #deposit collateral to add margin to the loan created above
    RBTC.approve(sovryn, startCollateral/2)
    sovryn.depositCollateral(loan_id, startCollateral/2)
    
    #make sure, collateral was increased
    endCollateral = sovryn.getLoan(loan_id).dict()["collateral"]
    assert(endCollateral-startCollateral == startCollateral/2)


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
    
