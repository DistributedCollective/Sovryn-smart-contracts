#!/usr/bin/python3
 
# test script for testing the most basic loan token logic. 
# for now we do not require complete test coverage. just make sure, the regular calls are successful.
import textwrap

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

@pytest.fixture(scope="module", autouse=True)
def loanToken(LoanToken, LoanTokenLogicStandard, LoanTokenSettingsLowerAdmin, SUSD, WETH, accounts, sovryn, Constants, priceFeeds, swapsImpl):

    loanTokenLogic = accounts[0].deploy(LoanTokenLogicStandard)
    #Deploying loan token using the loan logic as target for delegate calls
    loanToken = accounts[0].deploy(LoanToken, loanTokenLogic.address, sovryn.address, WETH.address)
    #Initialize loanTokenAddress
    loanToken.initialize(SUSD, "SUSD", "SUSD")
    #setting the logic ABI for the loan token contract
    loanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])

    # loan token Price should be equals to initial price
    assert loanToken.tokenPrice() == loanToken.initialPrice()
    initial_total_supply = loanToken.totalSupply()
    # loan token total supply should be zero
    assert initial_total_supply == loanToken.totalSupply()

    return loanToken
 
@pytest.fixture(scope="module", autouse=True)   
def loanTokenSettings(accounts, LoanTokenSettingsLowerAdmin):
    loanTokenSettings = accounts[0].deploy(LoanTokenSettingsLowerAdmin)
    return loanTokenSettings
    
@pytest.fixture(scope="module", autouse=True)
def loanOpenings(LoanOpenings, accounts, sovryn, Constants, priceFeeds, swapsImpl):
    sovryn.replaceContract(accounts[0].deploy(LoanOpenings).address)
    sovryn.setPriceFeedContract(priceFeeds.address)
    sovryn.setSwapsImplContract(swapsImpl.address )


def test_loanAddress(loanToken, SUSD):
    loanTokenAddress = loanToken.loanTokenAddress()
    assert loanTokenAddress == SUSD.address

@pytest.fixture(scope="module", autouse=True)
def loan_pool_setup(accounts, RBTC, loanTokenSettings, loanToken, sovryn, SUSD):
    constants = shared.Constants()
    params = [];
    setup1 = [
        b"0x0", ## id
        False, ## active
        str(accounts[0]), ## owner
        constants.ZERO_ADDRESS, ## loanToken -> will be overwritten
        RBTC.address, ## collateralToken. 
        Wei("20 ether"), ## minInitialMargin
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm -> will be overwritten
    ]
    params.append(setup1)
    calldata = loanTokenSettings.setupMarginLoanParams.encode_input(params)
    tx = loanToken.updateSettings(loanTokenSettings.address, calldata)
    assert('LoanParamsSetup' in tx.events)
    assert('LoanParamsIdSetup' in tx.events)
    calldata = loanTokenSettings.setupTorqueLoanParams.encode_input(params)
    tx = loanToken.updateSettings(loanTokenSettings.address, calldata)
    assert('LoanParamsSetup' in tx.events)
    assert('LoanParamsIdSetup' in tx.events)
    print(tx.info())
    sovryn.setLoanPool(
        [loanToken.address],
        [SUSD.address] 
    )


@pytest.fixture
def set_demand_curve(loanToken, LoanToken, LoanTokenLogicStandard, LoanTokenSettingsLowerAdmin, accounts, loanTokenSettings):
    def internal_set_demand_curve(baseRate=1e18, rateMultiplier=20.25e18):
        local_loan_token = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
        local_loan_token.setTarget(loanTokenSettings.address)
        local_loan_token_settings = Contract.from_abi("loanToken", address=loanToken.address,
                                                      abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
        local_loan_token_settings.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier)
        loan_token_logic = accounts[0].deploy(LoanTokenLogicStandard)
        local_loan_token = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
        local_loan_token.setTarget(loan_token_logic.address)
        Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi,
                          owner=accounts[0])
        borrow_interest_rate = loanToken.borrowInterestRate()
        print("borrowInterestRate: ", borrow_interest_rate)
        assert (borrow_interest_rate > baseRate)

    return internal_set_demand_curve


@pytest.fixture
def lend_to_pool(accounts, SUSD, loanToken):
    def internal_lend(lender=accounts[0], lend_amount=1e30):
        # lend
        SUSD.mint(lender, lend_amount)
        SUSD.approve(loanToken.address, lend_amount)
        loanToken.mint(lender, lend_amount)

        return lender, lend_amount

    return internal_lend


@pytest.fixture
def open_margin_trade_position(accounts, SUSD, RBTC, loanToken):
    def internal_open_margin_trade(trader=accounts[1],
                                   loan_token_sent=100e18,
                                   leverage_amount=2e18):
        """
        Opens a margin trade position
        :param trader: trader address
        :param loan_token_sent: loan token amount sent
        :param leverage_amount: leverage amount in form 1x,2x,3x,4x,5x where 1 is 1e18
        :return: loan_id, trader, loan_token_sent and leverage_amount
        """
        SUSD.mint(trader, loan_token_sent)
        SUSD.approve(loanToken.address, loan_token_sent, {'from': trader})

        tx = loanToken.marginTrade(
            "0",  # loanId  (0 for new loans)
            leverage_amount,  # leverageAmount
            loan_token_sent,  # loanTokenSent
            0,  # no collateral token sent
            RBTC.address,  # collateralTokenAddress
            trader,  # trader,
            b'',  # loanDataBytes (only required with ether)
            {'from': trader}
        )

        return tx.events['Trade']['loanId'], trader, loan_token_sent, leverage_amount

    return internal_open_margin_trade


def test_margin_trading_sending_collateral_tokens(accounts, sovryn, loanToken, SUSD, RBTC):
    
    loanTokenSent = 10000e18
    SUSD.mint(loanToken.address,loanTokenSent*6) 
    #   address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = sovryn.getRequiredCollateral(SUSD.address,RBTC.address,loanTokenSent*2,50e18, False)
    RBTC.mint(accounts[0],collateralTokenSent)
    #important! WEth is being held by the loanToken contract itself, all other tokens are transfered directly from 
    #the sender and need approval
    RBTC.approve(loanToken.address, collateralTokenSent)
    
    print("loanTokenSent",loanTokenSent)
    print("collateralTokenSent",collateralTokenSent/1e18)
    
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        5e18, # leverageAmount
        0, #loanTokenSent
        collateralTokenSent, 
        RBTC.address, #collateralTokenAddress
        accounts[0], #trader, 
        b'' #loanDataBytes (only required with ether)
    )

    print(tx.info())
    
    sovrynAfterSUSDBalance = SUSD.balanceOf(sovryn.address)
    print("sovrynAfterSUSDBalance", sovrynAfterSUSDBalance/1e18)
    
    sovrynAfterRBTCBalance = RBTC.balanceOf(sovryn.address)
    print("sovrynAfterRBTCBalance", sovrynAfterRBTCBalance/1e18)
    
    sovrynAfterSUSDBalance = SUSD.balanceOf(loanToken.address)
    print("loanTokenAfterSUSDBalance", sovrynAfterSUSDBalance/1e18)
    
    sovrynAfterRBTCBalance = RBTC.balanceOf(loanToken.address)
    print("loanTokenAftereRBTCBalance", sovrynAfterRBTCBalance/1e18)
    
    #assert(False)#just to make sure, we can read the print statements, will be removed after the test works


def test_margin_trading_sending_loan_tokens(accounts, sovryn, loanToken, SUSD, RBTC, priceFeeds, chain):

    loan_token_sent = 100e18
    SUSD.mint(loanToken.address, loan_token_sent*3)
    SUSD.mint(accounts[0], loan_token_sent)
    SUSD.approve(loanToken.address, loan_token_sent)

    leverage_amount = 2e18
    collateral_sent = 0
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        leverage_amount, # leverageAmount
        loan_token_sent, #loanTokenSent
        collateral_sent, # no collateral token sent
        RBTC.address, #collateralTokenAddress
        accounts[0], #trader,
        b'' #loanDataBytes (only required with ether)
    )


    sovryn_after_rbtc_balance = RBTC.balanceOf(sovryn.address)
    loantoken_after_susd_balance = SUSD.balanceOf(loanToken.address)

    assert(tx.events['Trade']['borrowedAmount'] == 2 * loan_token_sent)
    assert(tx.events['Trade']['positionSize'] == sovryn_after_rbtc_balance)
    assert(300e18 - tx.events['Trade']['borrowedAmount'] == loantoken_after_susd_balance)

    start_margin = 1e38 / leverage_amount
    total_deposit = loan_token_sent + collateral_sent
    (trade_rate, trade_rate_precision) = priceFeeds.queryRate(SUSD.address, RBTC.address)
    (collateral_to_loan_rate, _) = priceFeeds.queryRate(RBTC.address, SUSD.address)
    interest_rate = loanToken.nextBorrowInterestRate(total_deposit * 1e20 / start_margin)
    principal = loan_token_sent * 2
    seconds_per_day = 24 * 60 * 60
    max_loan_duration = 28 * seconds_per_day
    seconds_per_year = 365 * seconds_per_day
    borrow_amount = total_deposit / (interest_rate / seconds_per_year * max_loan_duration / start_margin * 1e20 + 1e20) \
                    / start_margin * 1e40
    owed_per_day = borrow_amount * interest_rate / 365e20
    interest_amount_required = 28 * owed_per_day / seconds_per_day
    trading_fee = (loan_token_sent + borrow_amount) / 1e20 * 15e16  # 0.15% fee
    collateral = (collateral_sent + loan_token_sent + borrow_amount - interest_amount_required - trading_fee) \
                 * trade_rate / trade_rate_precision
    current_margin = (collateral * collateral_to_loan_rate / 1e18 - principal) / principal * 1e20

    loan_id = tx.events['Trade']['loanId']
    loan = sovryn.getLoan(loan_id).dict()
    end_timestamp = loan['endTimestamp']
    block_timestamp = chain.time().real
    interest_deposit_remaining = (end_timestamp - block_timestamp) * owed_per_day / seconds_per_day if (end_timestamp >= block_timestamp) else 0
    assert(loan['loanToken'] == SUSD.address)
    assert(loan['collateralToken'] == RBTC.address)
    assert(loan['principal'] == principal)
    # LoanOpening::_borrowOrTrade::300
    assert(loan['collateral'] == collateral)
    # LoanOpening::_initializeInterest:574
    assert(loan['interestOwedPerDay'] == owed_per_day)
    # LoanOpening::_getLoan:567
    assert(loan['interestDepositRemaining'] == interest_deposit_remaining)
    assert(loan['startRate'] == collateral_to_loan_rate)
    assert(loan['startMargin'] == start_margin)
    assert(loan['maintenanceMargin'] == 15e18)
    # LoanMaintenance::_getLoan::539
    assert(loan['currentMargin'] == current_margin)
    assert(loan['maxLoanTerm'] == max_loan_duration)  # In the SC is hardcoded to 28 days
    assert((block_timestamp + max_loan_duration) - end_timestamp <= 1)
    # LoanMaintenance::_getLoan::549
    assert(loan['maxLiquidatable'] == 0)
    # LoanMaintenance::_getLoan::549
    assert(loan['maxSeizable'] == 0)

#     TODO test with a currentMargin <= liquidationIncentivePercent
#     TODO test with a liquidationIncentivePercent < currentMargin <= maintenanceMargin



def test_lend_to_the_pool(loanToken, accounts, SUSD, RBTC, chain, set_demand_curve, sovryn):
    """
    Test lend to the pool. The lender mint tokens from loanToken using SUSD as deposit.
    Then check if user balance change and the token price varies
    """
    baseRate = 1e18
    rateMultiplier = 20.25e18
    set_demand_curve(baseRate, rateMultiplier)

    lender = accounts[0]
    deposit_amount = 400e18
    loan_token_sent = 100e18
    total_deposit_amount = fixedint(deposit_amount).add(loan_token_sent)
    initial_balance = SUSD.balanceOf(lender)

    SUSD.approve(loanToken.address, total_deposit_amount)

    assert(SUSD.balanceOf(lender) == initial_balance)
    assert(loanToken.totalSupply() == 0)
    assert(loanToken.profitOf(lender) == 0)
    assert(loanToken.checkpointPrice(lender) == 0)

    assert(loanToken.totalSupplyInterestRate(deposit_amount) == 0)
    loanToken.mint(lender, deposit_amount)
    assert(SUSD.balanceOf(lender) == initial_balance - deposit_amount)
    assert(loanToken.balanceOf(lender) == fixedint(deposit_amount).div(loanToken.initialPrice()).mul(1e18))
    earned_interests_1 = 0  # Shouldn't be earned interests
    price1 = get_itoken_price(deposit_amount, earned_interests_1, loanToken.totalSupply())
    assert(loanToken.tokenPrice() == price1)
    assert(loanToken.checkpointPrice(lender) == loanToken.initialPrice())

    # Should borrow money to get an interest rate different of zero
    assert(loanToken.totalSupplyInterestRate(deposit_amount) == 0)
    loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        2e18,  # leverageAmount
        loan_token_sent,  # loanTokenSent
        0,  # no collateral token sent
        RBTC.address,  # collateralTokenAddress
        accounts[0],  # trader,
        b''  # loanDataBytes (only required with ether)
    )

    chain.sleep(100)
    chain.mine(1)
    price_2 = loanToken.tokenPrice()
    lender_interest_data = sovryn.getLenderInterestData(loanToken.address, SUSD.address).dict()
    earned_interest_2 = fixedint(lender_interest_data['interestUnPaid'])\
        .mul(fixedint(1e20).sub(lender_interest_data['interestFeePercent'])).div(1e20)
    assert(price_2 == get_itoken_price(deposit_amount, earned_interest_2, loanToken.totalSupply()))


def get_itoken_price(assets_deposited, earned_interests, total_supply):
    return fixedint(assets_deposited).add(earned_interests).mul(1e18).div(total_supply)


def test_cash_out_from_the_pool(loanToken, accounts, SUSD):
    lender = accounts[0]
    initial_balance = SUSD.balanceOf(lender)
    amount_withdrawn = 100e18
    total_deposit_amount = amount_withdrawn * 2
    assert(initial_balance > total_deposit_amount)

    SUSD.approve(loanToken.address, total_deposit_amount)
    assert(loanToken.checkpointPrice(lender) == 0)
    loanToken.mint(lender, total_deposit_amount)
    assert(loanToken.checkpointPrice(lender) == loanToken.initialPrice())
    loan_token_initial_balance = total_deposit_amount / loanToken.initialPrice() * 1e18
    assert(loanToken.balanceOf(lender) == loan_token_initial_balance)
    assert(loanToken.totalSupply() == total_deposit_amount)

    loanToken.burn(lender, amount_withdrawn)
    assert(loanToken.checkpointPrice(lender) == loanToken.initialPrice())
    assert(loanToken.totalSupply() == amount_withdrawn)
    assert(loanToken.tokenPrice() == get_itoken_price(amount_withdrawn, 0, loanToken.totalSupply()))
    assert(loanToken.balanceOf(lender) == amount_withdrawn)
    assert(SUSD.balanceOf(lender) == initial_balance - amount_withdrawn * loanToken.tokenPrice() / 1e18)


def test_cash_out_from_the_pool_more_of_lender_balance_should_not_fail(loanToken, accounts, SUSD):
    lender = accounts[0]
    initial_balance = SUSD.balanceOf(lender)
    amount_withdrawn = 100e18
    total_deposit_amount = amount_withdrawn * 2
    assert(initial_balance > total_deposit_amount)

    SUSD.approve(loanToken.address, total_deposit_amount)
    loanToken.mint(lender, total_deposit_amount)
    loanToken.burn(lender, total_deposit_amount * 2)
    assert(loanToken.balanceOf(lender) == 0)
    assert(loanToken.tokenPrice() == loanToken.initialPrice())
    assert(SUSD.balanceOf(lender) == initial_balance)



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


@pytest.fixture(scope="module", autouse=True)
def loanClosings(LoanClosings, accounts, sovryn, Constants, priceFeeds, swapsImpl):
    sovryn.replaceContract(accounts[0].deploy(LoanClosings))


@pytest.mark.parametrize('return_token_is_collateral', [False, True])
def test_close_all_margin_trade(sovryn, loanToken, web3, set_demand_curve, lend_to_pool, open_margin_trade_position, priceFeeds, chain, return_token_is_collateral):
    set_demand_curve()
    (receiver, _) = lend_to_pool()
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position()

    chain.sleep(10*24*60*60)  # time travel 10 days
    chain.mine(1)
    initial_loan = sovryn.getLoan(loan_id)

    with reverts("unauthorized"):
        sovryn.closeWithSwap(loan_id, trader, loan_token_sent, return_token_is_collateral, "")

    swap_amount = loan_token_sent

    internal_test_close_margin_trade(swap_amount, initial_loan, loanToken, loan_id, priceFeeds, sovryn, trader, web3, return_token_is_collateral)


@pytest.mark.parametrize('return_token_is_collateral', [False, True])
def test_close_partial_margin_trade(sovryn, loanToken, web3, set_demand_curve, lend_to_pool, open_margin_trade_position, priceFeeds, chain, return_token_is_collateral):
    set_demand_curve()
    (receiver, _) = lend_to_pool()
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position()

    chain.sleep(10*24*60*60)  # time travel 10 days
    chain.mine(1)
    initial_loan = sovryn.getLoan(loan_id)

    with reverts("unauthorized"):
        sovryn.closeWithSwap(loan_id, trader, loan_token_sent, return_token_is_collateral, "")

    swap_amount = fixedint(initial_loan['collateral']).mul(80*10**18).div(10**20).num

    internal_test_close_margin_trade(swap_amount, initial_loan, loanToken, loan_id, priceFeeds, sovryn, trader, web3, return_token_is_collateral)


@pytest.fixture
def borrow_indefinite_loan(RBTC, SUSD, accounts, loanToken, sovryn):
    def internal_borrow(withdraw_amount=10e18, margin=50e18, duration_in_seconds=60 * 60 * 24 * 10,
                        borrower=accounts[2], receiver=accounts[1]):
        collateral_token_sent = sovryn.getRequiredCollateral(SUSD.address, RBTC.address, withdraw_amount, margin, True)
        # approve the transfer of the collateral
        RBTC.mint(borrower, collateral_token_sent)
        RBTC.approve(loanToken.address, collateral_token_sent, {'from': borrower})
        # borrow some funds
        tx = loanToken.borrow(
            "0",  # bytes32 loanId
            withdraw_amount,  # uint256 withdrawAmount
            duration_in_seconds,  # uint256 initialLoanDuration
            collateral_token_sent,  # uint256 collateralTokenSent
            RBTC.address,  # address collateralTokenAddress
            borrower,  # address borrower
            receiver,  # address receiver
            b'',  # bytes memory loanDataBytes
            {'from': borrower}
        )
        loan_id = tx.events['Borrow']['loanId']
        return loan_id, borrower, receiver, withdraw_amount, duration_in_seconds, margin, tx

    return internal_borrow


def internal_test_close_margin_trade(swap_amount, initial_loan, loanToken, loan_id, priceFeeds, sovryn, trader, web3, return_token_is_collateral):
    principal_ = initial_loan['principal']
    collateral_ = initial_loan['collateral']

    tx_loan_closing = sovryn.closeWithSwap(loan_id, trader, swap_amount, return_token_is_collateral, "", {'from': trader})
    closed_loan = sovryn.getLoan(loan_id).dict()
    loan_token_ = initial_loan['loanToken']
    collateral_token_ = initial_loan['collateralToken']
    (trade_rate, precision) = priceFeeds.queryRate(collateral_token_, loan_token_)

    swap_amount = collateral_ if swap_amount > collateral_ else swap_amount

    loan_close_amount = \
        principal_ if swap_amount == collateral_ \
        else fixedint(principal_).mul(swap_amount).div(collateral_) if return_token_is_collateral \
        else 0

    interest_refund_to_borrower = fixedint(initial_loan['interestDepositRemaining']) \
        .mul(loan_close_amount).div(principal_)

    loan_close_amount_less_interest = fixedint(loan_close_amount).sub(interest_refund_to_borrower) \
        if loan_close_amount != 0 and fixedint(loan_close_amount).num >= interest_refund_to_borrower.num \
        else interest_refund_to_borrower

    trading_fee_percent = sovryn.tradingFeePercent()
    aux_trading_fee = loan_close_amount_less_interest if return_token_is_collateral else swap_amount
    trading_fee = fixedint(aux_trading_fee).mul(trading_fee_percent).div(1e20)

    source_token_amount_used = \
        swap_amount if not return_token_is_collateral \
        else fixedint(loan_close_amount_less_interest).add(trading_fee).mul(precision).div(trade_rate)

    dest_token_amount_received = \
        fixedint(swap_amount).sub(trading_fee).mul(trade_rate).div(precision) if not return_token_is_collateral \
        else loan_close_amount_less_interest

    collateral_to_loan_swap_rate = fixedint(dest_token_amount_received).mul(precision).div(source_token_amount_used)
    # 1e36 produces a wrong number because of floating point
    collateral_to_loan_swap_rate = fixedint(10**36).div(collateral_to_loan_swap_rate)

    source_token_amount_used_2 = collateral_ if dest_token_amount_received >= principal_ else source_token_amount_used.num
    used_collateral = source_token_amount_used_2 if source_token_amount_used_2 > swap_amount else swap_amount

    covered_principal = \
        loan_close_amount_less_interest if swap_amount == collateral_ or return_token_is_collateral\
        else principal_ if dest_token_amount_received >= principal_ \
        else dest_token_amount_received

    loan_close_amount = covered_principal if loan_close_amount == 0 else loan_close_amount

    new_collateral = fixedint(collateral_).sub(used_collateral) if used_collateral != 0 else collateral_
    new_principal = 0 if loan_close_amount == principal_ else fixedint(principal_).sub(loan_close_amount).num

    if return_token_is_collateral and collateral_ > swap_amount:
        print(new_principal)
        print(int(new_principal))

    current_margin = fixedint(new_collateral).mul(trade_rate).mul(1e18).div(precision).div(1e18)
    current_margin = current_margin.sub(new_principal).mul(1e20).div(new_principal) \
        if (new_principal != 0 and current_margin.num >= new_principal) else 0
    current_margin = fixedint(10**38).div(current_margin) if current_margin != 0 else 0

    loan_swap_event = tx_loan_closing.events['LoanSwap']
    assert (loan_swap_event['loanId'] == loan_id)
    assert (loan_swap_event['sourceToken'] == collateral_token_)
    assert (loan_swap_event['destToken'] == loan_token_)
    assert (loan_swap_event['borrower'] == trader)
    assert (loan_swap_event['sourceAmount'] == source_token_amount_used)
    assert (fixedint(loan_swap_event['destAmount']).sub(dest_token_amount_received).num <= 100)

    tx_loan_closing.info()
    close_with_swap_event = tx_loan_closing.events['CloseWithSwap']
    assert (close_with_swap_event['loanId'] == loan_id)
    assert (close_with_swap_event['loanCloseAmount'] == loan_close_amount)
    assert (close_with_swap_event['currentLeverage'] == current_margin)
    assert (close_with_swap_event['closer'] == trader)
    assert (close_with_swap_event['user'] == trader)
    assert (close_with_swap_event['lender'] == loanToken.address)
    assert (close_with_swap_event['collateralToken'] == collateral_token_)
    assert (close_with_swap_event['loanToken'] == loan_token_)
    assert (close_with_swap_event['positionCloseSize'] == used_collateral)
    assert (close_with_swap_event['exitPrice'] == collateral_to_loan_swap_rate)

    assert (closed_loan['principal'] == new_principal)
    if loan_close_amount == principal_:
        last_block_timestamp = web3.eth.getBlock(web3.eth.blockNumber)['timestamp']
        assert (closed_loan['endTimestamp'] <= last_block_timestamp)


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


@pytest.mark.parametrize('rate', [1e21, 6.7e21])
def test_liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate):
    """
    First test if fails when the position is healthy currentMargin > maintenanceRate
    Then, test with different rates so the currentMargin is <= liquidationIncentivePercent
    or > liquidationIncentivePercent
    liquidationIncentivePercent = 5e18 by default
    """

    baseRate = 1e18
    rateMultiplier = 20.25e18
    set_demand_curve(baseRate, rateMultiplier)
    SUSD.approve(loanToken.address, 1e40)
    lender = accounts[0]
    borrower = accounts[1]
    liquidator = accounts[2]
    loanToken.mint(lender, 1e30)
    loan_token_sent = 100e18
    SUSD.mint(borrower, loan_token_sent)
    SUSD.mint(liquidator, loan_token_sent)

    SUSD.approve(loanToken.address, loan_token_sent, {'from': borrower})

    tx = loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        2e18,  # leverageAmount
        loan_token_sent,  # loanTokenSent
        0,  # no collateral token sent
        RBTC.address,  # collateralTokenAddress
        borrower,  # trader,
        b'',  # loanDataBytes (only required with ether)
        {'from': borrower}
    )

    loan_id = tx.events['Trade']['loanId']
    loan = sovryn.getLoan(loan_id).dict()
    with reverts("healthy position"):
        sovryn.liquidate(loan_id, lender, loan_token_sent)

    SUSD.approve(sovryn.address, loan_token_sent, {'from': liquidator})
    priceFeeds.setRates(RBTC.address, SUSD.address, rate)
    tx_liquidation = sovryn.liquidate(loan_id, liquidator, loan_token_sent, {'from': liquidator})

    collateral_ = loan['collateral']
    principal_ = loan['principal']

    (current_margin, collateral_to_loan_rate) = priceFeeds.getCurrentMargin(
        SUSD.address,
        RBTC.address,
        principal_,
        collateral_
    )
    liquidation_incentive_percent = sovryn.liquidationIncentivePercent()
    maintenance_margin = loan['maintenanceMargin']

    desired_margin = fixedint(maintenance_margin).add(5e18)
    max_liquidatable = fixedint(desired_margin).add(1e20).mul(principal_).div(1e20)
    max_liquidatable = max_liquidatable.sub(fixedint(collateral_).mul(collateral_to_loan_rate).div(1e18))
    max_liquidatable = max_liquidatable.mul(1e20).div(fixedint(desired_margin).sub(liquidation_incentive_percent))
    max_liquidatable = principal_ if max_liquidatable > principal_ else max_liquidatable

    max_seizable = fixedint(max_liquidatable).mul(fixedint(liquidation_incentive_percent).add(1e20))
    max_seizable = max_seizable.div(collateral_to_loan_rate).div(100)
    max_seizable = collateral_ if (max_seizable > collateral_) else max_seizable

    loan_close_amount = max_liquidatable if (loan_token_sent > max_liquidatable) else loan_token_sent
    collateral_withdraw_amount = fixedint(max_seizable).mul(loan_close_amount).div(max_liquidatable)

    liquidate_event = tx_liquidation.events['Liquidate']
    assert(liquidate_event['user'] == borrower)
    assert(liquidate_event['liquidator'] == liquidator)
    assert(liquidate_event['loanId'] == loan_id)
    assert(liquidate_event['lender'] == loanToken.address)
    assert(liquidate_event['loanToken'] == SUSD.address)
    assert(liquidate_event['collateralToken'] == RBTC.address)
    assert(liquidate_event['repayAmount'] == loan_token_sent)
    assert(liquidate_event['collateralWithdrawAmount'] == collateral_withdraw_amount)
    assert(liquidate_event['collateralToLoanRate'] == collateral_to_loan_rate)
    assert(liquidate_event['currentMargin'] == current_margin)



def test_rollover(accounts, chain, loanToken, set_demand_curve, sovryn, priceFeeds, SUSD, RBTC, BZRX):

    """
    Tests paid interests to lender
    Test that loan attributes are updated
    Test loan swap event
    """

    baseRate = 1e18
    rateMultiplier = 20.25e18
    set_demand_curve(baseRate, rateMultiplier)
    SUSD.approve(loanToken.address, 10**40)
    lender = accounts[0]
    borrower = accounts[1]
    loanToken.mint(lender, 10**30)
    loan_token_sent = 100e18
    SUSD.mint(borrower, loan_token_sent)

    SUSD.approve(loanToken.address, loan_token_sent, {'from': borrower})

    tx = loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        2e18,  # leverageAmount
        loan_token_sent,  # loanTokenSent
        0,  # no collateral token sent
        RBTC.address,  # collateralTokenAddress
        borrower,  # trader,
        b'',  # loanDataBytes (only required with ether)
        {'from': borrower}
    )

    loan_id = tx.events['Trade']['loanId']
    loan = sovryn.getLoan(loan_id).dict()
    time_until_loan_end = loan['endTimestamp'] - chain.time()
    chain.sleep(time_until_loan_end)
    chain.mine(1)
    lender_interest_data = sovryn.getLenderInterestData(loanToken.address, SUSD.address).dict()

    lender_pool_initial_balance = SUSD.balanceOf(loanToken.address)
    borrower_initial_balance = SUSD.balanceOf(borrower)
    tx_rollover = sovryn.rollover(loan_id, b'')

    lender_interest_after = sovryn.getLenderInterestData(loanToken.address, SUSD.address).dict()

    lending_fee_percent = sovryn.lendingFeePercent()
    interest_unpaid = lender_interest_data['interestUnPaid']
    lending_fee = fixedint(interest_unpaid).mul(lending_fee_percent).div(1e20)
    interest_owed_now = fixedint(interest_unpaid).sub(lending_fee)
    assert(SUSD.balanceOf(loanToken.address) == fixedint(lender_pool_initial_balance).add(interest_owed_now))
    assert(lender_interest_after['interestPaid'] == interest_unpaid)
    assert(lender_interest_after['interestUnPaid'] == 0)

    # Settles and pays borrowers based on fees generated by their interest payments
    if sovryn.protocolTokenHeld() != 0:  # TODO I'm not sure if it is correct that protocolTokenHeld is zero
        print(sovryn.getLoanInterestData(loan_id).dict())
        interest_deposit_remaining = sovryn.getLoanInterestData(loan_id).dict()['interestDepositRemaining']
        interest_expense_fee = fixedint(interest_deposit_remaining).mul(lending_fee_percent).div(1e20)
        amount = fixedint(borrower_initial_balance).add(interest_expense_fee)
        query_return = priceFeeds.queryReturn(SUSD.address, BZRX.address, fixedint(amount).div(2))
        print('query_return', query_return)
        print('protocolTokenHeld', sovryn.protocolTokenHeld())
        assert(loanToken.balanceOf(BZRX.address) == fixedint(borrower_initial_balance).add(interest_expense_fee))
        earn_reward_event = tx_rollover.events['EarnReward']
        assert(earn_reward_event['receiver'] == borrower)
        assert(earn_reward_event['token'] == BZRX.address)
        assert(earn_reward_event['loanId'] == loan_id)
        assert(earn_reward_event['amount'] == fixedint(borrower_initial_balance).add(interest_expense_fee))

    loan_after = sovryn.getLoan(loan_id).dict()
    assert(loan_after['endTimestamp'] >= loan['endTimestamp'] + 28*24*60*60)

    (trade_rate, precision) = priceFeeds.queryRate(RBTC.address, SUSD.address)
    trading_fee_percent = sovryn.tradingFeePercent()
    trading_fee = fixedint(interest_unpaid).mul(trading_fee_percent).div(1e20)
    loan_swap_event = tx_rollover.events['LoanSwap']
    assert(loan_swap_event['loanId'] == loan_id)
    assert(loan_swap_event['sourceToken'] == RBTC.address)
    assert(loan_swap_event['destToken'] == SUSD.address)
    assert(loan_swap_event['borrower'] == borrower)
    assert(loan_swap_event['sourceAmount'] == fixedint(interest_unpaid).add(trading_fee).mul(precision).div(trade_rate))
    assert(loan_swap_event['destAmount'] == interest_unpaid)


def test_borrow(accounts,loanToken,sovryn,set_demand_curve,lend_to_pool, SUSD, RBTC):
    '''
    borrows some funds, checks the event is correct (including principal and collateral -> interest check)
    and that the receiver received the correct amount of tokens
    '''
    
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
    
#note: deposit collateral tests for WETH still missing. 


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


def test_extend_fix_term_loan_duration_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, LoanMaintenance):
    """
    At this moment the maxLoanTerm is always 28 because it is hardcoded in setupMarginLoanParams.
    So there are only fix-term loans.
    """
    # prepare the test
    set_demand_curve()
    (receiver, _) = lend_to_pool()
    (loan_id, trader, loan_token_sent, leverage_amount) = open_margin_trade_position()

    loan_maintenance = Contract.from_abi("loanMaintenance", address=sovryn.address, abi=LoanMaintenance.abi, owner=accounts[0])

    with reverts("indefinite-term only"):
        loan_maintenance.extendLoanDuration(loan_id, loan_token_sent, False, b'', {'from': trader})


def test_extend_loan_duration(accounts, sovryn, set_demand_curve, lend_to_pool, SUSD, LoanMaintenance, borrow_indefinite_loan):
    """
    Extend the loan duration and see if the new timestamp is the expected, the interest increase,
    the borrower SUSD balance decrease and the sovryn SUSD balance increase
    """

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


def test_extend_loan_duration_with_collateral(accounts, sovryn, set_demand_curve, lend_to_pool, RBTC, SUSD, LoanMaintenance, priceFeeds, borrow_indefinite_loan):
    """
    Extend the loan duration with collateral and see if the new timestamp is the expected, the interest increase,
    the loan's collateral decrease, sovryn SUSD balance increase and RBTC decrease
    """

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

def test_reduce_fix_term_loan_duration_should_fail(accounts, sovryn, set_demand_curve, lend_to_pool, open_margin_trade_position, LoanMaintenance):
    """
    At this moment the maxLoanTerm is always 28 because it is hardcoded in setupMarginLoanParams.
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

