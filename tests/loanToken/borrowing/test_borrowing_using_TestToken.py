import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

'''
borrows some funds, checks the event is correct (including principal and collateral -> interest check)
and that the receiver received the correct amount of tokens
'''
def test_borrow(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
  
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    
    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = sovryn.getRequiredCollateral(SUSD.address,RBTC.address,withdrawAmount,50e18, True)
    print("collateral needed", collateralTokenSent)
    durationInSeconds = 60*60*24*10 #10 days
    
    # compute expected values for asserts
    interestRate = loanToken.nextBorrowInterestRate(withdrawAmount)
    #principal = withdrawAmount/(1 - interestRate/1e20 * durationInSeconds /  31536000)
    principal = fixedint(withdrawAmount).mul(1e18).div(fixedint(1e18).sub(fixedint(interestRate).mul(durationInSeconds).mul(10e18).div(31536000).div(10e20)))
    borrowingFee = fixedint(sovryn.borrowingFeePercent()).mul(collateralTokenSent).div(1e20)
    expectedBalance = fixedint(SUSD.balanceOf(accounts[1])).add(withdrawAmount)
    
    #approve the transfer of the collateral
    RBTC.approve(loanToken.address, collateralTokenSent)
    
    # borrow some funds
    tx = loanToken.borrow(
        "0",                            # bytes32 loanId
        withdrawAmount,                 # uint256 withdrawAmount
        durationInSeconds,              # uint256 initialLoanDuration
        collateralTokenSent,            # uint256 collateralTokenSent
        RBTC.address,                   # address collateralTokenAddress
        accounts[0],                    # address borrower
        accounts[1],                    # address receiver
        b''                             # bytes memory loanDataBytes
    )
    
    #assert the trade was processed as expected
    print(tx.info())
    borrow_event = tx.events['Borrow']
    assert(borrow_event['user'] == accounts[0])
    assert(borrow_event['lender'] == loanToken.address)
    assert(borrow_event['loanToken'] == SUSD.address)
    assert(borrow_event['collateralToken'] == RBTC.address)
    assert(borrow_event['newPrincipal'] == principal)
    assert(borrow_event['newCollateral'] == fixedint(collateralTokenSent).sub(borrowingFee))
    assert(borrow_event['interestRate'] == interestRate)
    assert(borrow_event['interestDuration'] >= durationInSeconds-1 and borrow_event['interestDuration'] <= durationInSeconds)
    assert(borrow_event['currentMargin'] >= 49e18)
    
    #assert the user received the borrowed amount
    assert(SUSD.balanceOf(accounts[1]) == expectedBalance)

def test_borrow_0_collateral_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
    # prepare the test
    lend_to_pool()
    set_demand_curve()
    
    with reverts("8"):
        loanToken.borrow(
            "0",                            # bytes32 loanId
            10 ,                            # uint256 withdrawAmount
            24*60*60,                       # uint256 initialLoanDuration
            0,                              # uint256 collateralTokenSent
            RBTC.address,                   # address collateralTokenAddress
            accounts[0],                    # address borrower
            accounts[1],                    # address receiver
            b''                             # bytes memory loanDataBytes
        )
        
def test_borrow_0_withdraw_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
    # prepare the test
    lend_to_pool()
    set_demand_curve()
    
    with reverts("6"):
        loanToken.borrow(
            "0",                            # bytes32 loanId
            0 ,                            # uint256 withdrawAmount
            24*60*60,                       # uint256 initialLoanDuration
            10,                              # uint256 collateralTokenSent
            RBTC.address,                   # address collateralTokenAddress
            accounts[0],                    # address borrower
            accounts[1],                    # address receiver
            b''                             # bytes memory loanDataBytes
        )

def test_borrow_sending_value_with_tokens_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
    # prepare the test
    lend_to_pool()
    set_demand_curve()
    
    with reverts("7"):
        loanToken.borrow(
            "0",                            # bytes32 loanId
            10 ,                            # uint256 withdrawAmount
            24*60*60,                       # uint256 initialLoanDuration
            10,                              # uint256 collateralTokenSent
            RBTC.address,                   # address collateralTokenAddress
            accounts[0],                    # address borrower
            accounts[1],                    # address receiver
            b''  ,                           # bytes memory loanDataBytes
            {'value': 100}
        )
        
def test_borrow_invalid_collateral_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
    # prepare the test
    lend_to_pool()
    set_demand_curve()
    constants = shared.Constants()
    
    with reverts("9"):
        loanToken.borrow(
            "0",                            # bytes32 loanId
            10 ,                            # uint256 withdrawAmount
            24*60*60,                       # uint256 initialLoanDuration
            10,                              # uint256 collateralTokenSent
            constants.ZERO_ADDRESS,                   # address collateralTokenAddress
            accounts[0],                    # address borrower
            accounts[1],                    # address receiver
            b''                             # bytes memory loanDataBytes
        )
        
    with reverts("10"):
        loanToken.borrow(
            "0",                            # bytes32 loanId
            10 ,                            # uint256 withdrawAmount
            24*60*60,                       # uint256 initialLoanDuration
            10,                              # uint256 collateralTokenSent
            SUSD.address,                   # address collateralTokenAddress
            accounts[0],                    # address borrower
            accounts[1],                    # address receiver
            b''                             # bytes memory loanDataBytes
        )
        
        
def test_borrow_no_interest_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
    #no demand curve settings -> no interest set
    # prepare the test
    lend_to_pool()
    
    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = sovryn.getRequiredCollateral(SUSD.address,RBTC.address,withdrawAmount,50e18, True)
    
    #approve the transfer of the collateral
    RBTC.approve(loanToken.address, collateralTokenSent)
    
    with reverts("invalid interest"):
        loanToken.borrow(
            "0",                            # bytes32 loanId
            withdrawAmount ,                # uint256 withdrawAmount
            24*60*60,                       # uint256 initialLoanDuration
            collateralTokenSent,            # uint256 collateralTokenSent
            RBTC.address,                   # address collateralTokenAddress
            accounts[0],                    # address borrower
            accounts[1],                    # address receiver
            b''                             # bytes memory loanDataBytes
        )
        
        
def test_borrow_insufficient_collateral_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
    # prepare the test
    lend_to_pool()
    set_demand_curve()
    
    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = sovryn.getRequiredCollateral(SUSD.address,RBTC.address,withdrawAmount,50e18, True)
    collateralTokenSent /= 2
    print("sending collateral",collateralTokenSent)
    
    #approve the transfer of the collateral
    RBTC.approve(loanToken.address, collateralTokenSent)
    
    with reverts("collateral insufficient"):
        loanToken.borrow(
            "0",                            # bytes32 loanId
            withdrawAmount ,                # uint256 withdrawAmount
            24*60*60,                       # uint256 initialLoanDuration
            collateralTokenSent,            # uint256 collateralTokenSent
            RBTC.address,                   # address collateralTokenAddress
            accounts[0],                    # address borrower
            accounts[1],                    # address receiver
            b''                             # bytes memory loanDataBytes
        )
    
