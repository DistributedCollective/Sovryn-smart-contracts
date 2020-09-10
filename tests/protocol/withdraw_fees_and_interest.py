import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

def test_withdraw_accrued_interest(sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, SUSD, loanToken, chain):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    (loan_id, _, _, _) = open_margin_trade_position()
    initial_block_timestamp = chain[-1].timestamp

    loan = sovryn.getLoan(loan_id).dict()
    lender = loanToken.address

    # Time travel
    time_until_loan_end = loan['endTimestamp'] - initial_block_timestamp
    chain.sleep(time_until_loan_end)
    chain.mine(1)
    second_block_timestamp = chain[-1].timestamp
    end_interest_data_1 = sovryn.getLenderInterestData(lender, SUSD.address)
    assert(end_interest_data_1['interestPaid'] == 0)

    # lend to pool to call settle interest which calls withdrawAccruedInterest
    lend_to_pool()
    end_interest_data_2 = sovryn.getLenderInterestData(lender, SUSD.address)

    interest_owed_now = fixedint(second_block_timestamp - initial_block_timestamp)\
        .mul(end_interest_data_1['interestOwedPerDay']).div(24*60*60)

    assert(end_interest_data_2['interestOwedPerDay'] != 0)
    assert(end_interest_data_2['interestPaid'] == interest_owed_now)
    assert(end_interest_data_2['interestPaidDate'] - second_block_timestamp <= 2)
    assert(end_interest_data_2['interestUnPaid'] == end_interest_data_1['interestUnPaid'] - interest_owed_now)


    
    
'''
    Should successfully withdraw lending fees
    1. Set demand curve (fixture) 
    2. Lend to the pool (fixture)
    3. Make a margin trade (fixture)
    4. Set fees controller (address)
    5. Read lending fees
    6. Call withdraw lending fees
    7. Verify the right amount was paid out and the lending fees reduced on the smart contract 
''' 
def test_withdraw_lending_fees(accounts, sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, SUSD, chain):
    # prepare tests - need some loan to generate fees, then time must pass
    set_demand_curve() 
    lend_to_pool()
    open_margin_trade_position()
    sovryn.setFeesController(accounts[0])
    chain.sleep(100)
    chain.mine(1)
    lend_to_pool() #lend again to update fees
    
    #withdraw fees and verify
    fees = sovryn.lendingFeeTokensHeld(SUSD.address)
    sovryn.withdrawLendingFees(SUSD.address, accounts[1], fees)
    paid = sovryn.lendingFeeTokensPaid(SUSD.address)
    
    assert(paid==fees)
    assert(sovryn.lendingFeeTokensHeld(SUSD.address)==0)
    assert(SUSD.balanceOf(accounts[1])==fees)

'''
    Should successfully withdraw trading fees
    1. Set demand curve (fixture) 
    2. Lend to the pool (fixture)
    3. Make a margin trade (fixture)
    4. Set fees controller (address)
    5. Read trading fees
    6. Call withdraw trading fees
    7. Verify the right amount was paid out and the trading fees reduced on the smart contract 
'''
def test_withdraw_trading_fees(accounts, sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, SUSD, chain):
    # prepare tests - need some loan to generate fees, then time must pass
    set_demand_curve() 
    lend_to_pool()
    open_margin_trade_position()
    sovryn.setFeesController(accounts[0])
    chain.sleep(100)
    chain.mine(1)
    lend_to_pool() #lend again to update fees
    
    #withdraw fees and verify
    fees = sovryn.tradingFeeTokensHeld(SUSD.address)
    sovryn.withdrawTradingFees(SUSD.address, accounts[1], fees)
    paid = sovryn.tradingFeeTokensPaid(SUSD.address)
    
    assert(paid==fees)
    assert(sovryn.tradingFeeTokensHeld(SUSD.address)==0)
    assert(SUSD.balanceOf(accounts[1])==fees)



'''
    Should successfully withdraw borrowing fees
    1. Set demand curve (fixture) 
    2. Lend to the pool (fixture)
    3. Make a margin trade (fixture)
    4. Set fees controller (address)
    5. Read borrowing fees
    6. Call withdraw borrowing fees
    7. Verify the right amount was paid out and the borrowing fees reduced on the smart contract 
'''
def test_withdraw_borrowing_fees(accounts, sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, SUSD, chain):
    # prepare tests - need some loan to generate fees, then time must pass
    set_demand_curve() 
    lend_to_pool()
    open_margin_trade_position()
    sovryn.setFeesController(accounts[0])
    chain.sleep(100)
    chain.mine(1)
    lend_to_pool()
    
    #withdraw fees and verify
    fees = sovryn.borrowingFeeTokensHeld(SUSD.address)
    sovryn.withdrawBorrowingFees(SUSD.address, accounts[1], fees)
    paid = sovryn.borrowingFeeTokensPaid(SUSD.address)
    
    assert(paid==fees)
    assert(sovryn.borrowingFeeTokensHeld(SUSD.address)==0)
    assert(SUSD.balanceOf(accounts[1])==fees)

