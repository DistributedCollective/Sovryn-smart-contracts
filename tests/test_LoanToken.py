#!/usr/bin/python3
 
# test script for testing the most basic loan token logic. 
# for now we do not require complete test coverage. just make sure, the regular calls are successful.

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

@pytest.fixture(scope="module", autouse=True)
def loanToken(LoanToken, LoanTokenLogicStandard, LoanTokenSettingsLowerAdmin, SUSD, WETH, accounts, bzx, Constants, priceFeeds, swapsImpl):

    loanTokenLogic = accounts[0].deploy(LoanTokenLogicStandard)
    #Deploying loan token using the loan logic as target for delegate calls
    loanToken = accounts[0].deploy(LoanToken, loanTokenLogic.address, bzx.address, WETH.address)
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
def loanOpenings(LoanOpenings, accounts, bzx, Constants, priceFeeds, swapsImpl):
    bzx.replaceContract(accounts[0].deploy(LoanOpenings).address)
    bzx.setPriceFeedContract(priceFeeds.address)
    bzx.setSwapsImplContract(swapsImpl.address )


def test_loanAddress(loanToken, SUSD):
    loanTokenAddress = loanToken.loanTokenAddress()
    assert loanTokenAddress == SUSD.address

@pytest.fixture(scope="module", autouse=True)
def margin_pool_setup(accounts, RBTC, loanTokenSettings, loanToken, bzx, SUSD):
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
    print(tx.info())
    bzx.setLoanPool(
        [loanToken.address],
        [SUSD.address] 
    )

    
def test_margin_trading_sending_collateral_tokens(accounts, bzx, loanToken, SUSD, RBTC):
    
    loanTokenSent = 10000e18
    SUSD.mint(loanToken.address,loanTokenSent*6) 
    #   address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = bzx.getRequiredCollateral(SUSD.address,RBTC.address,loanTokenSent*2,50e18, False)
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
    
    bZxAfterSUSDBalance = SUSD.balanceOf(bzx.address)
    print("bZxAfterSUSDBalance", bZxAfterSUSDBalance/1e18)
    
    bZxAfterRBTCBalance = RBTC.balanceOf(bzx.address)
    print("bZxAfterRBTCBalance", bZxAfterRBTCBalance/1e18)
    
    bZxAfterSUSDBalance = SUSD.balanceOf(loanToken.address)
    print("loanTokenAfterSUSDBalance", bZxAfterSUSDBalance/1e18)
    
    bZxAfterRBTCBalance = RBTC.balanceOf(loanToken.address)
    print("loanTokenAftereRBTCBalance", bZxAfterRBTCBalance/1e18)
    
    #assert(False)#just to make sure, we can read the print statements, will be removed after the test works


def test_margin_trading_sending_loan_tokens(accounts, bzx, loanToken, SUSD, RBTC, priceFeeds, chain):

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

    bzx_after_rbtc_balance = RBTC.balanceOf(bzx.address)
    loantoken_after_susd_balance = SUSD.balanceOf(loanToken.address)

    assert(tx.events['Trade']['borrowedAmount'] == 2 * loan_token_sent)
    assert(tx.events['Trade']['positionSize'] == bzx_after_rbtc_balance)
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
    loan = bzx.getLoan(loan_id).dict()
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


def test_lend_to_the_pool(loanToken, accounts, SUSD):
    receiver = accounts[0]
    deposit_amount = 100e18
    total_deposit_amount = deposit_amount * 2
    SUSD.mint(receiver, total_deposit_amount)
    SUSD.approve(loanToken.address, total_deposit_amount)

    loanToken.mint(receiver, deposit_amount)
    earned_interests = 0  # Shouldn't be earned interests
    assert loanToken.tokenPrice() == get_itoken_price(deposit_amount, earned_interests, loanToken.totalSupply())

    loanToken.mint(receiver, deposit_amount)
    assert loanToken.tokenPrice() == get_itoken_price(total_deposit_amount, earned_interests, loanToken.totalSupply())


def get_itoken_price(assets_deposited, earned_interests, total_supply):
    return ((assets_deposited + earned_interests) / total_supply) * 1e18


def test_cash_out_from_the_pool(loanToken, accounts, SUSD):
    receiver = accounts[0]
    amount_withdrawn = 100e18
    total_deposit_amount = amount_withdrawn * 2
    SUSD.mint(receiver, total_deposit_amount)
    SUSD.approve(loanToken.address, total_deposit_amount)

    loanToken.mint(receiver, total_deposit_amount)

    assert loanToken.totalSupply() == total_deposit_amount
    loanToken.burn(receiver, amount_withdrawn)

    assert loanToken.totalSupply() == amount_withdrawn
    assert loanToken.tokenPrice() == get_itoken_price(amount_withdrawn, 0, loanToken.totalSupply())
    assert loanToken.balanceOf(receiver) == amount_withdrawn

def test_Demand_Curve_Setting(loanToken, loanTokenSettings, LoanTokenSettingsLowerAdmin, accounts, LoanToken, LoanTokenLogicStandard):
    baseRate = 1e18
    rateMultiplier = 20.25e18
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenSettings.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    localLoanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier)
    loanTokenLogic = accounts[0].deploy(LoanTokenLogicStandard)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenLogic.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    borrowInterestRate = loanToken.borrowInterestRate()
    print("borrowInterestRate: ",borrowInterestRate)
    assert(borrowInterestRate > 1e18)

    
def test_lending_fee_setting(bzx):
    tx = bzx.setLendingFeePercent(1e20)
    lfp = bzx.lendingFeePercent()
    assert(lfp == 1e20)
    
def test_supply_interest_fee(accounts,loanToken, SUSD, RBTC, LoanTokenLogicStandard, LoanToken, LoanTokenSettingsLowerAdmin, loanTokenSettings):
    baseRate = 1e18
    rateMultiplier = 20.25e18
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenSettings.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    localLoanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier)
    loanTokenLogic = accounts[0].deploy(LoanTokenLogicStandard)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenLogic.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    borrowInterestRate = loanToken.borrowInterestRate()
    print("borrowInterestRate: ",borrowInterestRate)
    assert(borrowInterestRate > 1e18)
    
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
def loanClosings(LoanClosings, accounts, bzx, Constants, priceFeeds, swapsImpl):
    bzx.replaceContract(accounts[0].deploy(LoanClosings))


def test_close_margin_trade(accounts, bzx, loanToken, SUSD, RBTC, web3):
    loanTokenSent = 100e18
    SUSD.mint(loanToken.address, loanTokenSent * 3)
    SUSD.mint(accounts[0], loanTokenSent)
    SUSD.approve(loanToken.address, loanTokenSent)
    tx = loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        2e18,  # leverageAmount
        loanTokenSent,  # loanTokenSent
        0,  # no collateral token sent
        RBTC.address,  # collateralTokenAddress
        accounts[0],  # trader,
        b''  # loanDataBytes (only required with ether)
    )

    loan_id = tx.events['Trade']['loanId']
    initial_loan = bzx.getLoan(loan_id)
    print('Before', initial_loan.dict())

    tx_loan_closing = bzx.closeWithSwap(loan_id, accounts[0], loanTokenSent, False, "")
    print('***************************************************')
    closed_loan = bzx.getLoan(loan_id).dict()
    print('After', closed_loan)

    assert(tx_loan_closing.events['CloseWithSwap']['loanId'] == loan_id)
    assert(tx_loan_closing.events['CloseWithSwap']['loanCloseAmount'] == initial_loan['principal'])
    assert(tx_loan_closing.events['CloseWithSwap']['currentLeverage'] == 0)
    assert(tx_loan_closing.events['CloseWithSwap']['closer'] == accounts[0])

    assert(closed_loan['principal'] == 0)
    last_block_timestamp = web3.eth.getBlock(web3.eth.blockNumber)['timestamp']
    assert(closed_loan['endTimestamp'] <= last_block_timestamp)

    # TODO returnTokenIsCollateral True
    # TODO swapAmount < initial_loan.collateral