#!/usr/bin/python3
 
# test script for testing the most basic loan token logic. 
# for now we do not require complete test coverage. just make sure, the regular calls are successful.
import textwrap
import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared




def test_Demand_Curve_Setting(loanToken, loanTokenSettings, LoanTokenSettingsLowerAdmin, accounts, LoanToken, LoanTokenLogicStandard):
    baseRate = 1e18
    rateMultiplier = 20.25e18
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenSettings.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    localLoanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier)

    assert(loanToken.baseRate() == baseRate)
    assert(loanToken.rateMultiplier() == rateMultiplier)
    assert(loanToken.lowUtilBaseRate() == baseRate)
    assert(loanToken.lowUtilRateMultiplier() == rateMultiplier)

    loanTokenLogic = accounts[0].deploy(LoanTokenLogicStandard)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenLogic.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])

    borrowInterestRate = loanToken.borrowInterestRate()
    print("borrowInterestRate: ", borrowInterestRate)
    assert(borrowInterestRate > 1e18)


def test_Demand_Curve_Setting_should_fail_if_rateMultiplier_plus_baseRate_is_grater_than_100_percent(
        loanToken, loanTokenSettings, LoanTokenSettingsLowerAdmin, accounts, LoanToken, LoanTokenLogicStandard):
    incorrect_baseRate = 51e18
    incorrect_rateMultiplier = 50e18
    baseRate = 1e18
    rateMultiplier = 20.25e18
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenSettings.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    with reverts():
        localLoanToken.setDemandCurve(incorrect_baseRate, incorrect_rateMultiplier, baseRate, rateMultiplier)
    with reverts():
        localLoanToken.setDemandCurve(baseRate, rateMultiplier, incorrect_baseRate, incorrect_rateMultiplier)


def test_lending_fee_setting(sovryn):
    tx = sovryn.setLendingFeePercent(1e20)
    lfp = sovryn.lendingFeePercent()
    assert(lfp == 1e20)


def test_supply_interest_fee(accounts, loanToken, SUSD, RBTC, set_demand_curve):
    baseRate = 1e18
    rateMultiplier = 20.25e18
    set_demand_curve(baseRate, rateMultiplier)

    SUSD.approve(loanToken.address,1e40)
    loanToken.mint(accounts[0], 1e30)

    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        2e18, # leverageAmount
        100e18, #loanTokenSent
        0, # no collateral token sent
        RBTC.address, #collateralTokenAddress
        accounts[0], #trader,
        b'' #loanDataBytes (only required with ether)
    )

    tas = loanToken.totalAssetSupply()
    print("total supply", tas/1e18);
    tab = loanToken.totalAssetBorrow()
    print("total asset borrowed", tab/1e18)
    abir = loanToken.avgBorrowInterestRate()
    print("average borrow interest rate", abir/1e18)
    ir = loanToken.nextSupplyInterestRate(0)
    print("interest rate", ir)

    loanToken.mint(accounts[0], 1e20)

    #assert(False)




def test_transfer(accounts, loanToken, SUSD):
    amount_sent, receiver, sender = initialize_test_transfer(SUSD, accounts, loanToken)

    tx = loanToken.transfer(receiver, amount_sent)
    assert(loanToken.balanceOf(sender) == amount_sent)
    assert(loanToken.balanceOf(receiver) == amount_sent)

    assert(loanToken.checkpointPrice(sender) == loanToken.initialPrice())
    assert(loanToken.checkpointPrice(receiver) == loanToken.initialPrice())

    transfer_event = tx.events['Transfer']
    assert(transfer_event['from'] == sender)
    assert(transfer_event['to'] == receiver)
    assert(transfer_event['value'] == amount_sent)


def test_transfer_to_zero_account_should_fail(accounts, loanToken, SUSD):
    amount_sent, receiver, sender = initialize_test_transfer(SUSD, accounts, loanToken)
    with reverts("14"):
        loanToken.transfer(shared.Constants().ZERO_ADDRESS, amount_sent)


def test_transfer_with_insufficient_balance(accounts, loanToken, SUSD):
    amount_sent, receiver, sender = initialize_test_transfer(SUSD, accounts, loanToken)
    with reverts("14"):
        loanToken.transfer(sender, amount_sent, {'from': receiver})


def initialize_test_transfer(SUSD, accounts, loanToken):
    sender = accounts[0]
    receiver = accounts[1]
    amount_to_buy = 100e18
    SUSD.approve(loanToken.address, amount_to_buy)
    loanToken.mint(sender, amount_to_buy)
    sender_initial_balance = loanToken.balanceOf(sender)
    assert (sender_initial_balance != 0)
    amount_sent = sender_initial_balance / 2
    assert (loanToken.checkpointPrice(sender) == loanToken.initialPrice())
    return amount_sent, receiver, sender


def test_transfer_from(SUSD, accounts, loanToken):
    amount_sent, receiver, sender = initialize_test_transfer(SUSD, accounts, loanToken)
    loanToken.approve(receiver, amount_sent)
    assert(loanToken.allowance(sender, receiver) == amount_sent)

    loanToken.transferFrom(sender, receiver, amount_sent, {'from': receiver})
    assert(loanToken.balanceOf(sender) == amount_sent)
    assert(loanToken.balanceOf(receiver) == amount_sent)









def test_toggle_function_pause(accounts, loanToken, LoanToken, LoanTokenSettingsLowerAdmin, LoanTokenLogicStandard, loanTokenSettings, SUSD, open_margin_trade_position, lend_to_pool):
    '''
    1. pause a function
    2. try to call the function - should fail
    3. reactivate it
    4. try to call the function - should succeed
    '''
    lend_to_pool()
    functionSignature = "marginTrade(bytes32,uint256,uint256,uint256,address,address,bytes)"
    
    # pause the given function
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenSettings.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    localLoanToken.toggleFunctionPause(functionSignature, True)
    
    # make sure the function can't be called anymore
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    loanTokenLogic = accounts[0].deploy(LoanTokenLogicStandard)
    localLoanToken.setTarget(loanTokenLogic.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    
    with reverts("unauthorized"):
        open_margin_trade_position()
    
    # reactivate the given function
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenSettings.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    localLoanToken.toggleFunctionPause(functionSignature, False)
    
    #make sure the function can be called again
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenLogic.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    open_margin_trade_position()
    
def test_toggle_function_pause_with_non_admin_should_fail(loanToken, LoanTokenSettingsLowerAdmin, loanTokenSettings, LoanToken, accounts):
    '''
    call toggleFunction with a non-admin address and make sure it fails
    '''
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenSettings.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    with reverts("unauthorized"):
        localLoanToken.toggleFunctionPause("mint(address,uint256)", True, {'from':accounts[1]})



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



def test_full_close_with_deposit(sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, SUSD, RBTC, loanToken, priceFeeds, chain, accounts, LoanClosingsEvents):
    """
    Test CloseWithDeposit event parameters
    Test refund collateral to receiver
    Test refund interest to receiver
    Test loan update
    Test returning principal to lender with deposit
    """

    borrower = accounts[3]
    receiver = accounts[4]

    set_demand_curve()
    (_, _) = lend_to_pool(lender=accounts[2])
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position(trader=borrower)

    chain.sleep(10*24*60*60)  # time travel 10 days
    chain.mine(1)

    initial_loan = sovryn.getLoan(loan_id)
    principal = initial_loan['principal']
    collateral = initial_loan['collateral']
    initial_loan_interest = sovryn.getLoanInterestData(loan_id)

    deposit_amount = principal

    internal_test_close_with_deposit(deposit_amount, RBTC, SUSD, borrower, chain, collateral, initial_loan,
                                     initial_loan_interest, loanToken, loan_id, priceFeeds, principal, receiver, sovryn, LoanClosingsEvents)


def test_partial_close_with_deposit(sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, SUSD, RBTC, loanToken, priceFeeds, chain, accounts, LoanClosingsEvents):
    """
    Test CloseWithDeposit event parameters
    Test refund collateral to receiver
    Test refund interest to receiver
    Test loan update
    Test returning principal to lender with deposit
    """

    borrower = accounts[3]
    receiver = accounts[4]

    set_demand_curve()
    (_, _) = lend_to_pool(lender=accounts[2])
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position(trader=borrower)

    chain.sleep(10*24*60*60)  # time travel 10 days
    chain.mine(1)

    initial_loan = sovryn.getLoan(loan_id)
    principal = initial_loan['principal']
    collateral = initial_loan['collateral']
    initial_loan_interest = sovryn.getLoanInterestData(loan_id)

    deposit_amount = principal // 2
    internal_test_close_with_deposit(deposit_amount, RBTC, SUSD, borrower, chain, collateral, initial_loan,
                                     initial_loan_interest, loanToken, loan_id, priceFeeds, principal, receiver, sovryn, LoanClosingsEvents)


def test_close_with_zero_deposit_should_fail(sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, chain, accounts):
    borrower = accounts[3]
    receiver = accounts[4]

    set_demand_curve()
    (_, _) = lend_to_pool(lender=accounts[2])
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position(trader=borrower)

    chain.sleep(10*24*60*60)  # time travel 10 days
    chain.mine(1)

    with reverts("depositAmount == 0"):
        sovryn.closeWithDeposit(loan_id, receiver, 0, {'from': borrower})


def internal_test_close_with_deposit(deposit_amount, RBTC, SUSD, borrower, chain, collateral, initial_loan,
                                     initial_loan_interest, loanToken, loan_id, priceFeeds, principal, receiver, sovryn, LoanClosingsEvents):
    SUSD.mint(borrower, deposit_amount)
    SUSD.approve(sovryn.address, deposit_amount, {'from': borrower})
    (rate, precision) = priceFeeds.queryRate(initial_loan['collateralToken'], initial_loan['loanToken'])

    tx = sovryn.closeWithDeposit(loan_id, receiver, deposit_amount, {'from': borrower})
    tx.info()

    loan_close_amount = principal if deposit_amount > principal else deposit_amount
    withdraw_amount = collateral if loan_close_amount == principal \
        else fixedint(collateral).mul(loan_close_amount).div(principal).num
    end_collateral = collateral - withdraw_amount
    end_principal = 0 if loan_close_amount == principal else principal - loan_close_amount
    collateral_to_loan_rate = fixedint(rate).mul(10 ** 18).div(precision).num
    collateral_to_loan_amount = fixedint(end_collateral).mul(collateral_to_loan_rate).div(10 ** 18).num
    current_margin = fixedint(collateral_to_loan_amount - end_principal).mul(10 ** 20).div(end_principal) \
        if (end_principal <= collateral_to_loan_amount and end_principal != 0) else 0

    owed_per_day = initial_loan_interest['interestOwedPerDay']
    end_timestamp = initial_loan['endTimestamp']
    owed_per_day_refund = fixedint(owed_per_day).mul(loan_close_amount).div(principal).num
    # (loan end timestamp - block timestamp) * owedPerDayRefund / 24*60*60
    interest_refund_to_borrower_1 = fixedint(end_timestamp - chain[-1].timestamp).mul(owed_per_day_refund).div(
        24 * 60 * 60).num
    interest_refund_to_borrower = 0 if interest_refund_to_borrower_1 <= loan_close_amount \
        else interest_refund_to_borrower_1 - loan_close_amount

    # Test CloseWithDeposit event parameters
    if 'CloseWithDeposit' in tx.events:
        close_event = tx.events['CloseWithDeposit']
        assert (close_event['user'] == borrower)
        assert (close_event['lender'] == loanToken.address)
        assert (close_event['loanId'] == loan_id)
        assert (close_event['closer'] == borrower)
        assert (close_event['loanToken'] == initial_loan['loanToken'])
        assert (close_event['collateralToken'] == initial_loan['collateralToken'])
        assert (close_event['repayAmount'] == loan_close_amount)
        assert (close_event['collateralWithdrawAmount'] == withdraw_amount)
        assert (close_event['collateralToLoanRate'] == collateral_to_loan_rate)
        assert (close_event['currentMargin'] == current_margin)
    else:
        # When all the tests are run, the event is not recognized so we have to decode it manually
        # filter all events with topic equals to CloseWithDeposit in '(unknown)' events list
        close_events = list(
            filter(lambda tx_: tx_['topic1'] == LoanClosingsEvents.topics['CloseWithDeposit'], tx.events['(unknown)']))
        assert(len(close_events) == 1)

        def hex_to_str(value):
            return str(value).lower()[2:]

        def hex_to_decimal(value):
            return int(value, 16)

        borrower_address = hex_to_str(borrower)
        lender_address = hex_to_str(loanToken.address)
        loan_token_address = hex_to_str(initial_loan['loanToken'])
        collateral_token_address = hex_to_str(initial_loan['collateralToken'])

        close_event = close_events[0]
        assert (borrower_address in close_event['topic2'])
        assert (lender_address in close_event['topic3'])
        assert (str(loan_id) in close_event['topic4'])

        data = textwrap.wrap(hex_to_str(close_event['data']), 64)
        assert(len(data) == 7)
        assert (borrower_address in data[0])
        assert (loan_token_address in data[1])
        assert (collateral_token_address in data[2])
        assert (loan_close_amount == hex_to_decimal(data[3]))
        assert (withdraw_amount == hex_to_decimal(data[4]))
        assert (collateral_to_loan_rate == hex_to_decimal(data[5]))
        assert (current_margin == hex_to_decimal(data[6]))


    # Test refund collateral to receiver
    # Test refund interest to receiver
    assert (RBTC.balanceOf(receiver) == withdraw_amount)
    assert (SUSD.balanceOf(receiver) == interest_refund_to_borrower)

    # Test loan update
    end_loan = sovryn.getLoan(loan_id)
    new_principal = 0 if loan_close_amount == principal else fixedint(principal).sub(loan_close_amount).num
    assert (end_loan['principal'] == new_principal)
    if loan_close_amount == principal:
        last_block_timestamp = chain[-1]['timestamp']
        assert (end_loan['endTimestamp'] <= last_block_timestamp)

    # Test returning principal to lender with deposit
    loan_close_amount_less_interest = loan_close_amount - interest_refund_to_borrower_1 \
        if loan_close_amount >= interest_refund_to_borrower_1 \
        else 0
    transfer_to_lender = list(filter(lambda tx_event: tx_event['from'] == borrower, tx.events['Transfer']))
    assert (len(transfer_to_lender) == 1)
    transfer_to_lender = transfer_to_lender[0]
    assert (transfer_to_lender['to'] == loanToken.address)
    assert (transfer_to_lender['value'] == loan_close_amount_less_interest)

