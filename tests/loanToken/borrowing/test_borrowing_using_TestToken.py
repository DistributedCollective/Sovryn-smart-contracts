'''
Test borrowing from the pool.
1. Regular borrowing
2. Should fail to borrow with 0 collateral
3. Should fail to borrow 0 tokens
4. Should fail to borrow when sending rBTC along with tokens
5. Should fail to borrow with an invalid collateral token
6. Should fail to borrow if the demand curve has not been set
7. Should fail to borrow with insufficient collateral
'''

import pytest
from brownie import reverts
from fixedint import *
import shared
from loanToken.sov_reward import verify_sov_reward_payment

'''
borrows some funds, checks the event is correct (including principal and collateral -> interest check)
and that the receiver received the correct amount of tokens
'''
def test_borrow(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC, FeesEvents, SOV):
  
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

    borrower = accounts[0]
    sov_initial_balance = SOV.balanceOf(borrower)

    # borrow some funds
    tx = loanToken.borrow(
        "0",                            # bytes32 loanId
        withdrawAmount,                 # uint256 withdrawAmount
        durationInSeconds,              # uint256 initialLoanDuration
        collateralTokenSent,            # uint256 collateralTokenSent
        RBTC.address,                   # address collateralTokenAddress
        borrower,                    # address borrower
        accounts[1],                    # address receiver
        b''                             # bytes memory loanDataBytes
    )
    
    #assert the trade was processed as expected
    print(tx.info())
    borrow_event = tx.events['Borrow']
    assert(borrow_event['user'] == borrower)
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

    verify_sov_reward_payment(tx, FeesEvents, SOV, borrower, borrow_event['loanId'], sov_initial_balance, 1)


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
    
def test_borrow_without_early_access_token_should_fail_if_required(TestToken,accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
    # prepare the test
    lend_to_pool()
    set_demand_curve()

    # prepare early access token
    early_access_token = accounts[0].deploy(TestToken, "Sovryn Early Access Token", "SEAT", 1, 10)
    early_access_token.transfer(accounts[1], early_access_token.balanceOf(accounts[0]))
    loanToken.setEarlyAccessToken(early_access_token.address)

    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
    collateralTokenSent = sovryn.getRequiredCollateral(SUSD.address,RBTC.address,withdrawAmount,50e18, True)
    print("sending collateral",collateralTokenSent)

    #approve the transfer of the collateral
    RBTC.approve(loanToken.address, collateralTokenSent)

    with reverts("No early access tokens"):
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

'''
borrows some funds from account 0 and then takes out some more from account 2 with 'borrow' without paying
should fail.
'''
def test_borrow_from_foreign_loan_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC, FeesEvents, SOV):
    # prepare the test
    lend_to_pool()
    set_demand_curve()

    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = 2* sovryn.getRequiredCollateral(SUSD.address,RBTC.address,withdrawAmount,50e18, True)
    print("collateral needed", collateralTokenSent)
    durationInSeconds = 60*60*24*10 #10 days
    
    #approve the transfer of the collateral
    RBTC.approve(loanToken.address, collateralTokenSent)

    borrower = accounts[0]

    # borrow some funds
    tx = loanToken.borrow(
        "0",                            # bytes32 loanId
        withdrawAmount,                 # uint256 withdrawAmount
        durationInSeconds,              # uint256 initialLoanDuration
        collateralTokenSent,            # uint256 collateralTokenSent
        RBTC.address,                   # address collateralTokenAddress
        borrower,                       # address borrower
        accounts[1],                    # address receiver
        b''                             # bytes memory loanDataBytes
    )
    borrow_event = tx.events['Borrow']
    loanId = borrow_event['loanId']

    RBTC.transfer(accounts[2], collateralTokenSent)
    #approve the transfer of the collateral
    RBTC.approve(loanToken.address, collateralTokenSent, {'from': accounts[2]})

    with reverts("unauthorized use of existing loan"):
        tx = loanToken.borrow(
            loanId,                            # bytes32 loanId
            withdrawAmount/2,                 # uint256 withdrawAmount
            durationInSeconds,              # uint256 initialLoanDuration
            1,            # uint256 collateralTokenSent
            RBTC.address,                   # address collateralTokenAddress
            borrower,                       # address borrower
            accounts[2],                    # address receiver
            b'',                             # bytes memory loanDataBytes
            {'from': accounts[2]}
        )

'''
borrows some funds from account 0 and then takes out some more from account 2 with a marginTrade without paying
should fail.
'''   
def test_margin_trade_from_foreign_loan_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC, FeesEvents, SOV, priceFeeds):

    # prepare the test
    lend_to_pool()
    set_demand_curve()

    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = 2* sovryn.getRequiredCollateral(SUSD.address,RBTC.address,withdrawAmount,50e18, True)
    print("collateral needed", collateralTokenSent)
    durationInSeconds = 60*60*24*10 #10 days
    
    #approve the transfer of the collateral
    RBTC.approve(loanToken.address, collateralTokenSent)

    borrower = accounts[0]

    # borrow some funds
    tx = loanToken.borrow(
        "0",                            # bytes32 loanId
        withdrawAmount,                 # uint256 withdrawAmount
        durationInSeconds,              # uint256 initialLoanDuration
        collateralTokenSent,            # uint256 collateralTokenSent
        RBTC.address,                   # address collateralTokenAddress
        borrower,                       # address borrower
        accounts[1],                    # address receiver
        b''                             # bytes memory loanDataBytes
    )
    borrow_event = tx.events['Borrow']
    loanId = borrow_event['loanId']

    SUSD.transfer(accounts[2], collateralTokenSent)
    #approve the transfer of the collateral
    SUSD.approve(loanToken.address, collateralTokenSent, {'from': accounts[2]})

    with reverts("borrower mismatch"):
        tx = loanToken.marginTrade(
            loanId, #loanId  (0 for new loans)
            1e18, # leverageAmount
            10000000, #loanTokenSent
            0, # no collateral token sent
            RBTC.address, #collateralTokenAddress
            accounts[2], #trader,
            b'', #loanDataBytes (only required with ether)
            {'from': accounts[2]}
        )

'''
margin trades from account 0 and then borrows from same loan.
should fail.
'''
def test_borrow_from_trade_position_should_fail(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC, FeesEvents, SOV):
    # prepare the test
    lend_to_pool()
    set_demand_curve()

    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    
    #approve the transfer of the collateral
    SUSD.approve(loanToken.address, withdrawAmount)

    tx = loanToken.marginTrade(
        0, #loanId  (0 for new loans)
        1e18, # leverageAmount
        withdrawAmount, #loanTokenSent
        0, # no collateral token sent
        RBTC.address, #collateralTokenAddress
        accounts[0], #trader,
        b'', #loanDataBytes (only required with ether)
    )
    borrow_event = tx.events['Trade']
    loanId = borrow_event['loanId']

    #approve the transfer of the collateral
    RBTC.approve(loanToken.address, withdrawAmount)

    with reverts("loanParams mismatch"):
        tx = loanToken.borrow(
            loanId,                            # bytes32 loanId
            withdrawAmount/10,                 # uint256 withdrawAmount
            60*60*24*10,              # uint256 initialLoanDuration
            1,            # uint256 collateralTokenSent
            RBTC.address,                   # address collateralTokenAddress
            accounts[0],                       # address borrower
            accounts[0],                    # address receiver
            b'',                             # bytes memory loanDataBytes
            {'from': accounts[0]}
        )