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
  
def test_margin_trading_sending_loan_tokens(accounts, bzx, loanToken, SUSD, RBTC):
    
    loanTokenSent = 100e18
    SUSD.mint(loanToken.address,loanTokenSent*3) 
    SUSD.mint(accounts[0],loanTokenSent)
    SUSD.approve(loanToken.address, loanTokenSent)
    
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        2e18, # leverageAmount
        loanTokenSent, #loanTokenSent
        0, # no collateral token sent
        RBTC.address, #collateralTokenAddress
        accounts[0], #trader, 
        b'' #loanDataBytes (only required with ether)
    )

    bZxAfterRBTCBalance = RBTC.balanceOf(bzx.address)
    loantokenAfterSUSDBalance = SUSD.balanceOf(loanToken.address)
    
    assert(tx.events['Trade']['borrowedAmount'] == 2 * loanTokenSent)
    assert(tx.events['Trade']['positionSize'] == bZxAfterRBTCBalance)
    assert(300e18 - tx.events['Trade']['borrowedAmount'] == loantokenAfterSUSDBalance)

   
    
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
def test_liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, bzx, priceFeeds, rate):
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
    loan = bzx.getLoan(loan_id).dict()
    with reverts("healthy position"):
        bzx.liquidate(loan_id, lender, loan_token_sent)

    SUSD.approve(bzx.address, loan_token_sent, {'from': liquidator})
    priceFeeds.setRates(RBTC.address, SUSD.address, rate)
    tx_liquidation = bzx.liquidate(loan_id, liquidator, loan_token_sent, {'from': liquidator})

    collateral_ = loan['collateral']
    principal_ = loan['principal']

    (current_margin, collateral_to_loan_rate) = priceFeeds.getCurrentMargin(
        SUSD.address,
        RBTC.address,
        principal_,
        collateral_
    )
    liquidation_incentive_percent = bzx.liquidationIncentivePercent()
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
