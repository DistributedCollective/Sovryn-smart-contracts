import pytest
from brownie import Contract, Wei, reverts

'''
returns a function to set the transaction limits
'''
@pytest.fixture(scope="module") 
def set_transaction_limit(accounts, loanToken, loanTokenSettings, LoanToken, LoanTokenSettingsLowerAdmin, LoanTokenLogicStandard):
    def internal_set_transaction_limit(sender, addresses, limits):
        localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
        localLoanToken.setTarget(loanTokenSettings.address)
        localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
        tx = localLoanToken.setTransactionLimits(addresses,limits, {'from':sender})
        localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
        loanTokenLogic = accounts[0].deploy(LoanTokenLogicStandard)
        localLoanToken.setTarget(loanTokenLogic.address)
        return tx
    return internal_set_transaction_limit

'''
the owner should be able to set the limits
'''
def test_set_trasaction_limit_with_owner(accounts, set_transaction_limit, SUSD, RBTC):
    tx = set_transaction_limit(accounts[0],[SUSD, RBTC],[21e18, 0.0021e18])
    assert('SetTransactionLimits' in tx.events)

'''
the non-owner should fail to set the limits
'''   
def test_set_transaction_limit_non_owner_should_fail(accounts,set_transaction_limit, SUSD, RBTC):
    with reverts():
        set_transaction_limit(accounts[1],[SUSD, RBTC],[21e18, 0.0021e18])

'''
the owner should fail to set the limits with invalid arrays
'''
def test_set_transaction_limit_array_length_mismatch_should_fail(accounts,set_transaction_limit, SUSD, RBTC):
    with reverts():
        set_transaction_limit(accounts[0],[SUSD],[21e18, 0.0021e18])
 
'''
margin trading should fail if the transfered amount exceeds the transaction limit
'''
def test_margin_trading_exceeding_limit_should_fail(accounts, set_transaction_limit, SUSD, RBTC, open_margin_trade_position, lend_to_pool):
    lend_to_pool()
    set_transaction_limit(accounts[0],[SUSD, RBTC],[21e18, 0.0021e18])
    with reverts():
        open_margin_trade_position()
 
'''
borrowig should fail if the transfered amount exceeds the transaction limit
'''   
def test_borrowing_exceeding_limit_should_fail(accounts, set_transaction_limit, SUSD, RBTC, lend_to_pool, borrow_indefinite_loan, set_demand_curve):
    set_demand_curve()
    lend_to_pool()
    set_transaction_limit(accounts[0],[SUSD, RBTC],[2.1e18, 0.00021e18])
    with reverts():
        borrow_indefinite_loan()

'''
leding should fail if the transfered amount exceeds the transaction limit
'''
def test_lending_exceeding_limit_should_fail(accounts, set_transaction_limit, SUSD, RBTC, lend_to_pool):
    set_transaction_limit(accounts[0],[SUSD, RBTC],[21e18, 0.0021e18])
    with reverts():
        lend_to_pool()

'''
margin trading should succeed if the transfered amount does not exceed the transaction limit
'''  
def test_margin_trading_within_limit(accounts, set_transaction_limit, SUSD, RBTC, open_margin_trade_position, lend_to_pool):
    lend_to_pool()
    set_transaction_limit(accounts[0],[SUSD, RBTC],[1000e18, 1e18])
    open_margin_trade_position()

'''
borrowing should succeed if the transfered amount does not exceed the transaction limit
'''     
def test_borrowing_trading_within_limit(accounts, set_transaction_limit, SUSD, RBTC, lend_to_pool, borrow_indefinite_loan, set_demand_curve):
    set_demand_curve()
    lend_to_pool()
    set_transaction_limit(accounts[0],[SUSD, RBTC],[1000e18, 1e18])
    borrow_indefinite_loan()

'''
lending should succeed if the transfered amount does not exceed the transaction limit
'''     
def test_lending_within_limit(accounts, set_transaction_limit, SUSD, RBTC, lend_to_pool):
    set_transaction_limit(accounts[0],[SUSD, RBTC],[1e30, 10e18])
    lend_to_pool()