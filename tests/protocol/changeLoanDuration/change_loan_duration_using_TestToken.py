'''
Test extending and reducing loan durations.
1. Should fail to extend a fixed-term loan
2. Extend  a loan
3. Should fail to extend a loan with 0 deposit 
4. Should fail to extend a closed loan
5. Should fail to extend another user's loan
6. Extend a loan with collateral
7. Should fail to extend a loan with collateral tokens and rBTC value
8. Should fail to reduce the duration of a fixed-term loan
9. Reduce the duration of a loan
10. Should fail to reduce the loan duration without withdrawing some funds
11. Should fail to reduce the loan duration of a closed loan
12. Should fail to reduce the loan duration of another user's loan
13. Should fail to reduce the loan duration if the max duration was already surpassed
14. Should fail to reduce the loan duration when withdrawing too much
15. Should fail to reduce the loan duration by less than an hour
'''

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

"""
At this moment the maxLoanTerm is always 28 because it is hardcoded in setupLoanParams.
So there are only fix-term loans.
"""
def test_extend_fix_term_loan_duration_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, LoanMaintenance):
    
    # prepare the test
    set_demand_curve()
    (receiver, _) = lend_to_pool()
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position()

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])

    with reverts("indefinite-term only"):
        loan_maintenance.extendLoanDuration(loan_id, loan_token_sent, False, b'', {'from': trader})

"""
Extend the loan duration and see if the new timestamp is the expected, the interest increase,
the borrower SUSD balance decrease and the sovryn SUSD balance increase
"""
def test_extend_loan_duration(accounts, sovryn, set_demand_curve, lend_to_pool, SUSD, LoanMaintenance, borrow_indefinite_loan):

    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, _ = borrow_indefinite_loan()

    initial_loan = sovryn.getLoan(loan_id)
    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    initial_loan_token_lender_balance = SUSD.balanceOf(sovryn.address)

    days_to_extend = 10
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    deposit_amount = owed_per_day * days_to_extend

    # Approve the transfer of loan token
    SUSD.mint(borrower, deposit_amount)
    SUSD.approve(sovryn, deposit_amount, {'from': borrower})
    initial_borrower_balance = SUSD.balanceOf(borrower)

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    loan_maintenance.extendLoanDuration(loan_id, deposit_amount, False, b'', {'from': borrower})

    end_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    end_loan = sovryn.getLoan(loan_id)

    assert(end_loan['endTimestamp'] == initial_loan['endTimestamp'] + days_to_extend*24*60*60)
    assert(end_loan_interest_data['interestDepositTotal'] == initial_loan_interest_data['interestDepositTotal'] + deposit_amount)
    assert(SUSD.balanceOf(borrower) == initial_borrower_balance - deposit_amount)
    # Due to block timestamp could be paying outstanding interest to lender or not
    assert(SUSD.balanceOf(sovryn.address) <= initial_loan_token_lender_balance + deposit_amount)


def test_extend_loan_duration_0_deposit_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, _ = borrow_indefinite_loan()

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("depositAmount is 0"):
        loan_maintenance.extendLoanDuration(loan_id, 0, False, b'', {'from': borrower})


def test_extend_closed_loan_duration_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, tx = borrow_indefinite_loan()
    borrow_event = tx.events['Borrow']
    collateral = borrow_event['newCollateral']
    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)

    days_to_extend = 10
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    deposit_amount = owed_per_day * days_to_extend

    sovryn.closeWithSwap(loan_id, borrower, collateral, False, "", {'from': borrower})

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("loan is closed"):
        loan_maintenance.extendLoanDuration(loan_id, deposit_amount, False, b'', {'from': borrower})


def test_extend_loan_duration_user_unauthorized_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, _, receiver, _, _, _, _ = borrow_indefinite_loan()
    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)

    days_to_extend = 10
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    deposit_amount = owed_per_day * days_to_extend

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("unauthorized"):
        loan_maintenance.extendLoanDuration(loan_id, deposit_amount, True, b'', {'from': receiver})



"""
Extend the loan duration with collateral and see if the new timestamp is the expected, the interest increase,
the loan's collateral decrease, sovryn SUSD balance increase and RBTC decrease
"""
def test_extend_loan_duration_with_collateral(accounts, sovryn, set_demand_curve, lend_to_pool, RBTC, SUSD, LoanMaintenance, priceFeeds, borrow_indefinite_loan):

    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, _ = borrow_indefinite_loan()

    initial_loan = sovryn.getLoan(loan_id)
    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    initial_loan_token_lender_balance = SUSD.balanceOf(sovryn.address)
    initial_collateral_token_lender_balance = RBTC.balanceOf(sovryn.address)

    days_to_extend = 10
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    deposit_amount = fixedint(owed_per_day).mul(days_to_extend).num

    (rate, precision) = priceFeeds.queryRate(RBTC.address, SUSD.address)
    deposit_amount_in_collateral = fixedint(deposit_amount).mul(precision).div(rate)

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    loan_maintenance.extendLoanDuration(loan_id, deposit_amount, True, b'', {'from': borrower})

    end_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    end_loan = sovryn.getLoan(loan_id)

    assert(end_loan['endTimestamp'] == initial_loan['endTimestamp'] + days_to_extend*24*60*60)
    assert(end_loan_interest_data['interestDepositTotal'] == initial_loan_interest_data['interestDepositTotal'] + deposit_amount)
    assert(end_loan['collateral'] == initial_loan['collateral'] - deposit_amount_in_collateral)
    assert(RBTC.balanceOf(sovryn.address) == initial_collateral_token_lender_balance - deposit_amount_in_collateral)
    assert(SUSD.balanceOf(sovryn.address) <= initial_loan_token_lender_balance + deposit_amount)


def test_extend_loan_duration_with_collateral_and_eth_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, _ = borrow_indefinite_loan()

    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)

    days_to_extend = 10
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    deposit_amount = fixedint(owed_per_day).mul(days_to_extend).num

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("wrong asset sent"):
        loan_maintenance.extendLoanDuration(loan_id, deposit_amount, True, b'', {'from': borrower, 'value': deposit_amount})


def test_reduce_fix_term_loan_duration_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, LoanMaintenance):
    """
    At this moment the maxLoanTerm is always 28 because it is hardcoded in setupLoanParams.
    So there are only fix-term loans.
    """
    # prepare the test
    set_demand_curve()
    (receiver, _) = lend_to_pool()
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position()

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])

    with reverts("indefinite-term only"):
        loan_maintenance.reduceLoanDuration(loan_id, trader, loan_token_sent, {'from': trader})


def test_reduce_loan_duration(accounts, sovryn, set_demand_curve, lend_to_pool, SUSD, LoanMaintenance, borrow_indefinite_loan):
    """
    Reduce the loan duration and see if the new timestamp is the expected, the interest decrease,
    the receiver SUSD balance increase and the sovryn SUSD balance decrease
    """

    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, _ = borrow_indefinite_loan()

    initial_loan = sovryn.getLoan(loan_id)
    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    initial_loan_token_lender_balance = SUSD.balanceOf(sovryn.address)

    days_to_reduce = 5
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    withdraw_amount = owed_per_day * days_to_reduce

    receiver = accounts[3]
    initial_receiver_balance = SUSD.balanceOf(receiver)

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    loan_maintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {'from': borrower})

    end_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    end_loan = sovryn.getLoan(loan_id)

    assert(end_loan['endTimestamp'] == initial_loan['endTimestamp'] - days_to_reduce*24*60*60)
    assert(end_loan_interest_data['interestDepositTotal'] == initial_loan_interest_data['interestDepositTotal'] - withdraw_amount)
    assert(SUSD.balanceOf(receiver) == initial_receiver_balance + withdraw_amount)
    # Due to block timestamp could be paying outstanding interest to lender or not
    assert(SUSD.balanceOf(sovryn.address) <= initial_loan_token_lender_balance - withdraw_amount)


def test_reduce_loan_duration_0_withdraw_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, _ = borrow_indefinite_loan()
    receiver = accounts[3]

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("withdrawAmount is 0"):
        loan_maintenance.reduceLoanDuration(loan_id, receiver, 0, {'from': borrower})


def test_reduce_closed_loan_duration_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, tx = borrow_indefinite_loan()
    borrow_event = tx.events['Borrow']
    collateral = borrow_event['newCollateral']
    receiver = accounts[3]

    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    sovryn.closeWithSwap(loan_id, borrower, collateral, False, "", {'from': borrower})

    days_to_reduce = 5
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    withdraw_amount = owed_per_day * days_to_reduce

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("loan is closed"):
        loan_maintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {'from': borrower})


def test_reduce_loan_duration_user_unauthorized_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, _ = borrow_indefinite_loan()

    receiver = accounts[3]
    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    days_to_reduce = 5
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    withdraw_amount = owed_per_day * days_to_reduce

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("unauthorized"):
        loan_maintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {'from': receiver})


def test_reduce_loan_duration_with_loan_term_ended_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan, chain):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, _, _, _ = borrow_indefinite_loan()

    receiver = accounts[3]
    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    days_to_reduce = 5
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    withdraw_amount = owed_per_day * days_to_reduce

    initial_loan = sovryn.getLoan(loan_id)
    loan_end_timestamp = initial_loan['endTimestamp']

    chain.sleep(loan_end_timestamp)
    chain.mine(1)

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("loan term has ended"):
        loan_maintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {'from': borrower})


def test_reduce_loan_duration_withdraw_amount_too_high_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, withdraw_amount, _, _, _ = borrow_indefinite_loan()

    receiver = accounts[3]

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("withdraw amount too high"):
        loan_maintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount * 2, {'from': borrower})


def test_reduce_loan_duration_less_than_one_hour_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, LoanMaintenance, borrow_indefinite_loan):
    # prepare the test
    set_demand_curve()
    lend_to_pool()
    loan_id, borrower, _, _, duration_in_seconds, _, _ = borrow_indefinite_loan()

    receiver = accounts[3]
    initial_loan_interest_data = sovryn.getLoanInterestData(loan_id)
    owed_per_day = initial_loan_interest_data['interestOwedPerDay']
    # reduce the loan upto 50 minutes
    withdraw_amount = fixedint(owed_per_day).mul(duration_in_seconds - 50*60).div(24*60*60)

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])
    with reverts("loan too short"):
        loan_maintenance.reduceLoanDuration(loan_id, receiver, withdraw_amount, {'from': borrower})
