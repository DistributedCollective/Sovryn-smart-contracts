'''
Test the asministrative functions of the loan token contract
1. set the demand curve (base for interest calculation)
2. fail is trying to set the demand curve resulting in a interest rate > 100%
3. test if the lending fee is set
4. toggle function pause
5. fail if trying to toggle the function pause with a non-admin wallet
'''

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

def test_Demand_Curve_Setting(loanToken, loanTokenSettings, LoanTokenSettingsLowerAdmin, accounts, LoanToken, LoanTokenLogicStandard):
    baseRate = 1e18
    rateMultiplier = 20.25e18
    targetLevel=80*10**18
    kinkLevel=90*10**18
    maxScaleRate=100*10**18

    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    localLoanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate)

    assert(loanToken.baseRate() == baseRate)
    assert(loanToken.rateMultiplier() == rateMultiplier)
    assert(loanToken.lowUtilBaseRate() == baseRate)
    assert(loanToken.lowUtilRateMultiplier() == rateMultiplier)

    borrowInterestRate = loanToken.borrowInterestRate()
    print("borrowInterestRate: ", borrowInterestRate)
    assert(borrowInterestRate > 1e18)


def test_Demand_Curve_Setting_should_fail_if_rateMultiplier_plus_baseRate_is_grater_than_100_percent(
        loanToken, loanTokenLogic, accounts, LoanToken, LoanTokenLogicStandard):
    incorrect_baseRate = 51e18
    incorrect_rateMultiplier = 50e18
    baseRate = 1e18
    rateMultiplier = 20.25e18
    targetLevel=80*10**18
    kinkLevel=90*10**18
    maxScaleRate=100*10**18
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    with reverts():
        localLoanToken.setDemandCurve(incorrect_baseRate, incorrect_rateMultiplier, baseRate, rateMultiplier,
                                      targetLevel, kinkLevel, maxScaleRate)
    with reverts():
        localLoanToken.setDemandCurve(baseRate, rateMultiplier, incorrect_baseRate, incorrect_rateMultiplier,
                                      targetLevel, kinkLevel, maxScaleRate)


def test_lending_fee_setting(sovryn):
    tx = sovryn.setLendingFeePercent(1e20)
    lfp = sovryn.lendingFeePercent()
    assert(lfp == 1e20)


'''
1. pause a function
2. try to call the function - should fail
3. reactivate it
4. try to call the function - should succeed
'''
def test_toggle_function_pause(accounts, loanToken, LoanToken, LoanTokenSettingsLowerAdmin, LoanTokenLogicStandard, loanTokenSettings, SUSD, open_margin_trade_position, lend_to_pool):
    
    lend_to_pool()
    functionSignature = "marginTrade(bytes32,uint256,uint256,uint256,address,address,uint256,bytes)"

    # pause the given function and make sure the function can't be called anymore
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    localLoanToken.toggleFunctionPause(functionSignature, True)

    with reverts("unauthorized"):
        open_margin_trade_position()
        
    #check if checkPause returns true
    assert(localLoanToken.checkPause(functionSignature))
    
    # reactivate the given function and make sure the function can be called again
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    localLoanToken.toggleFunctionPause(functionSignature, False)
    open_margin_trade_position()
    
    #check if checkPause returns false
    assert(not localLoanToken.checkPause(functionSignature))
 
'''
call toggleFunction with a non-admin address and make sure it fails
'''   
def test_toggle_function_pause_with_non_admin_should_fail(loanToken, loanTokenLogic, LoanToken, LoanTokenLogicStandard, accounts):
    
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    with reverts("unauthorized"):
        localLoanToken.toggleFunctionPause("mint(address,uint256)", True, {'from':accounts[1]})

