from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def lendToPool(loanTokenAddress, tokenAddress, amount):
    token = Contract.from_abi("TestToken", address = tokenAddress, abi = TestToken.abi, owner = conf.acct)
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    if(token.allowance(conf.acct, loanToken.address) < amount):
        token.approve(loanToken.address, amount)
    tx = loanToken.mint(conf.acct, amount)
    tx.info()
    return tx

def lendToPoolWithMS(loanTokenAddress, tokenAddress, amount):
    token = Contract.from_abi("TestToken", address = tokenAddress, abi = TestToken.abi, owner = conf.acct)
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    if(token.allowance(conf.contracts['multisig'], loanToken.address) < amount):
        data = token.approve.encode_input(loanToken.address, amount)
        sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)
    data = loanToken.mint.encode_input(conf.contracts['multisig'], amount)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def removeFromPool(loanTokenAddress, amount):
    loanToken = Contract.from_abi("loanToken", address = loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    tx = loanToken.burn(conf.acct, amount)
    tx.info()
    return tx

def testTokenBurning(loanTokenAddress, testTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    testToken = Contract.from_abi("TestToken", address = testTokenAddress, abi = TestToken.abi, owner = conf.acct)

    testToken.approve(loanToken,1e17) 
    loanToken.mint(conf.acct, 1e17)
    balance = loanToken.balanceOf(conf.acct)
    print("balance", balance)
    tokenPrice = loanToken.tokenPrice()
    print("token price",tokenPrice/1e18)
    burnAmount = int(balance / 2)
    print("burn amount", burnAmount)
    
    tx = loanToken.burn(conf.acct, burnAmount)
    print(tx.info())
    balance = loanToken.balanceOf(conf.acct)
    print("remaining balance", balance/1e18)
    assert(tx.events["Burn"]["tokenAmount"] == burnAmount)

def testTradeOpeningAndClosing(protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress, loanTokenSent, leverage, testClose, sendValue):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    testToken = Contract.from_abi("TestToken", address = underlyingTokenAddress, abi = TestToken.abi, owner = conf.acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    if(sendValue == 0 and testToken.allowance(conf.acct, loanTokenAddress) < loanTokenSent):
        testToken.approve(loanToken, loanTokenSent)
    print('going to trade')
    tx = loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        leverage,  # leverageAmount, 18 decimals
        loanTokenSent,  # loanTokenSent
        0,  # no collateral token sent
        collateralTokenAddress,  # collateralTokenAddress
        conf.acct,  # trader,
        0, # slippage
        {'value': sendValue, 'allow_revert': True}
    )
    tx.info()
    loanId = tx.events['Trade']['loanId']
    collateral = tx.events['Trade']['positionSize']
    print("closing loan with id", loanId)
    print("position size is ", collateral)
    loan = sovryn.getLoan(loanId)
    print("found the loan in storage with position size", loan['collateral'])
    print(loan)
    if(testClose):
        tx = sovryn.closeWithSwap(loanId, conf.acct, collateral, True, b'')
        tx.info()

    return tx


def testTradeOpeningAndClosingWithCollateral(protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress, collateralTokenSent, leverage, testClose, sendValue):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    testToken = Contract.from_abi("TestToken", address = collateralTokenAddress, abi = TestToken.abi, owner = conf.acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    if(sendValue == 0 and testToken.allowance(conf.acct, loanTokenAddress) < collateralTokenSent):
       testToken.approve(loanToken, collateralTokenSent)
    print('going to trade')
    tx = loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        leverage,  # leverageAmount, 18 decimals
        0,  # loanTokenSent
        collateralTokenSent,  # no collateral token sent
        collateralTokenAddress,  # collateralTokenAddress
        conf.acct,  # trader,
        0, # slippage
        {'value': sendValue, "allow_revert": True}
    )
    tx.info()
    loanId = tx.events['Trade']['loanId']
    collateral = tx.events['Trade']['positionSize']
    print("closing loan with id", loanId)
    print("position size is ", collateral)
    loan = sovryn.getLoan(loanId)
    print("found the loan in storage with position size", loan['collateral'])
    print(loan)
    if(testClose):
        tx = sovryn.closeWithSwap(loanId, conf.acct, collateral, True, b'')
        tx.info()



def testBorrow(protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress, amount):
    #read contract abis
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    testToken = Contract.from_abi("TestToken", address = collateralTokenAddress, abi = TestToken.abi, owner = conf.acct)
    
    # determine borrowing parameter
    withdrawAmount = amount #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = 2* sovryn.getRequiredCollateral(underlyingTokenAddress,collateralTokenAddress,withdrawAmount, 50e18, True)
    print("collateral needed", collateralTokenSent/1e18)
    durationInSeconds = 60*60*24*10 #10 days
    
    #check requirements
    availableSupply = loanToken.marketLiquidity()
    print('available supply:', availableSupply/1e18)
    assert(availableSupply >= withdrawAmount)
    interestRate = loanToken.nextBorrowInterestRate(withdrawAmount)
    print('interest rate (needs to be > 0):', interestRate)
    assert(interestRate > 0)
    
    #approve the transfer of the collateral if needed
    if(testToken.address.lower() != conf.contracts['WRBTC'].lower() and testToken.allowance(conf.acct, loanToken.address) < collateralTokenSent):
        testToken.approve(loanToken.address, collateralTokenSent)
    
    # borrow some funds
    tx = loanToken.borrow(
        "0",                            # bytes32 loanId
        withdrawAmount,                 # uint256 withdrawAmount
        durationInSeconds,              # uint256 initialLoanDuration
        collateralTokenSent,            # uint256 collateralTokenSent
        testToken.address,                   # address collateralTokenAddress
        conf.acct,                    # address borrower
        conf.acct,                    # address receiver
        {'value': 0, 'allow_revert': True}#collateralTokenSent
    )
    
    #assert the trade was processed as expected
    print(tx.info())


def testSwapsExternal(underlyingTokenAddress, collateralTokenAddress, amount):
    sovryn = Contract.from_abi("sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    underlyingToken = Contract.from_abi("TestToken", address=underlyingTokenAddress, abi=ERC20.abi, owner=conf.acct)

    receiver = conf.acct
    tx = underlyingToken.approve(conf.contracts['sovrynProtocol'], amount)
    tx.info()

    tx = sovryn.swapExternal(
        underlyingTokenAddress,
        collateralTokenAddress,
        receiver,
        receiver,
        amount,
        0,
        0,
        b'',
        {"value": 0, "allow_revert": True})
    tx.info()


# Notes: This function will do:
# 1. tradeOpenAndClosingWithoutCollateral (using amountUnderlying that is sent in the arguments)
# 2. lendToPool (using amountUnderlying that is sent in the arguments)
# 3. removeFromPool (50% of the lending)
# 4. tradeOpenAndClosingWithCollateral (using amountCollateral that is sent in the arguments)
# 5. Test borrow (using amountCollateral that is sent in the arguments)
# 6. SwapsExternal (using amountUnderlying that is sent in the arguments)
#
# WARN:
# 1. make sure you have 3 times balance of underlyingTokenAddress
# 2. make sure you have 2 times balance of amountCollateral
def wrappedIntegrationTest(loanTokenAddress, underlyingTokenAddress, collateralTokenAddress, amountUnderlying, amountCollateral):
    sovryn = Contract.from_abi("sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)

    underlyingToken = Contract.from_abi("TestToken", address=underlyingTokenAddress, abi=ERC20.abi, owner=conf.acct)
    collateralToken = Contract.from_abi("TestToken", address=collateralTokenAddress, abi=ERC20.abi, owner=conf.acct)
    
    prevUnderlyingBalance = underlyingToken.balanceOf(conf.acct)
    prevCollateralBalance = collateralToken.balanceOf(conf.acct)

    # ------------------------------------------------ Test Trade Open & Close without collateral ------------------------------------------------------
    print("Test Trade open and closing without collateral")
    tx = testTradeOpeningAndClosing(sovryn.address, loanToken.address, underlyingTokenAddress, collateralTokenAddress, amountUnderlying, 2e18, True,0)

    print("=============================== PREVIOUS BALANCE ====================================")
    print("Underlying balance: ", prevUnderlyingBalance)
    print("Collateral balance: ", prevCollateralBalance)

    print("=============================== UPDATED BALANCE =====================================")
    updatedUnderlyingBalance = underlyingToken.balanceOf(conf.acct)
    updatedCollateralBalance = collateralToken.balanceOf(conf.acct)
    print("Underlying balance: ", updatedUnderlyingBalance)
    print("Collateral balance: ", updatedCollateralBalance)

    transferEvents = tx.events['Transfer']
    errorMsg = []
    msg = ''

    # Verify
    if prevUnderlyingBalance - updatedUnderlyingBalance != amountUnderlying:
        msg = 'FAILED / INVALID STATE (TRADE OPENING & CLOSING WITHOUT COLLATERAL) : Updated underyling balance: {0} is not matched with the amount that was traded: {1}'.format(prevUnderlyingBalance - updatedUnderlyingBalance, amountUnderlying)
        errorMsg.append(msg)
        print(msg)
    
    if prevCollateralBalance + transferEvents[len(transferEvents)-1]['value'] != updatedCollateralBalance:
        msg = 'FAILED / INVALID STATE (TRADE OPENING & CLOSING WITHOUT COLLATERAL) : Updated collateral balance: {0} is not matched with the amount that was closed with swap: {1}'.format(prevCollateralBalance + transferEvents[len(transferEvents)-1]['value'], updatedCollateralBalance)
        errorMsg.append(msg)
        print(msg)

    prevUnderlyingBalance = updatedUnderlyingBalance
    prevCollateralBalance = updatedCollateralBalance
    

    # ------------------------------------------------ Test Lend to Pool -------------------------------------------------------------------------------
    prevLoanTokenBalance = loanToken.balanceOf(conf.acct)

    tx = lendToPool(loanToken.address, underlyingTokenAddress, amountUnderlying)
    print("=============================== PREVIOUS BALANCE ====================================")
    print("Underlying balance: ", prevUnderlyingBalance)
    print("Collateral balance: ", prevCollateralBalance)
    print("Loantoken Balance: ", prevLoanTokenBalance)

    print("=============================== UPDATED BALANCE =====================================")
    updatedUnderlyingBalance = underlyingToken.balanceOf(conf.acct)
    updatedCollateralBalance = collateralToken.balanceOf(conf.acct)
    updatedLoanTokenBalance = loanToken.balanceOf(conf.acct)
    print("Underlying balance: ", updatedUnderlyingBalance)
    print("Collateral balance: ", updatedCollateralBalance)
    print("Loantoken Balance: ", updatedLoanTokenBalance)

    transferEvents = tx.events['Transfer']

    # Verify
    if prevUnderlyingBalance - updatedUnderlyingBalance != amountUnderlying:
        msg = 'FAILED / INVALID STATE (LEND TO POOL): Updated underyling balance: {0} is not matched with the amount that was lent: {1}'.format(prevUnderlyingBalance - updatedUnderlyingBalance, amountUnderlying)
        errorMsg.append(msg)
        print(msg)

    if prevLoanTokenBalance + transferEvents[len(transferEvents)-1]['value'] != updatedLoanTokenBalance:
        msg = 'FAILED / INVALID STATE (LEND TO POOL) : Updated loanToken balance: {0} is not matched with the amount that was transferred from lending pool: {1}'.format(prevLoanTokenBalance + transferEvents[len(transferEvents)-1]['value'], updatedLoanTokenBalance)
        errorMsg.append(msg)
        print(msg)


    prevUnderlyingBalance = updatedUnderlyingBalance
    prevCollateralBalance = updatedCollateralBalance
    prevLoanTokenBalance = updatedLoanTokenBalance

    # ------------------------------------------------ Test Remove from Pool -------------------------------------------------------------------------------
    removeFromPool(loanToken.address, 0.5*(amountUnderlying))
    print("=============================== PREVIOUS BALANCE ====================================")
    print("Underlying balance: ", prevUnderlyingBalance)
    print("Collateral balance: ", prevCollateralBalance)
    print("LoanToken Balance: ", prevLoanTokenBalance)

    print("=============================== UPDATED BALANCE =====================================")
    updatedUnderlyingBalance = underlyingToken.balanceOf(conf.acct)
    updatedCollateralBalance = collateralToken.balanceOf(conf.acct)
    updatedLoanTokenBalance = loanToken.balanceOf(conf.acct)
    print("Underlying balance: ", updatedUnderlyingBalance)
    print("Collateral balance: ", updatedCollateralBalance)
    print("LoanToken Balance: ", updatedLoanTokenBalance)

    # Verify
    if prevLoanTokenBalance - 0.5*(amountUnderlying) != updatedLoanTokenBalance:
        msg = 'FAILED / INVALID STATE (REMOVE FROM POOL): Updated loanToken balance: {0} is not matched with the amount that was taken from lending pool: {1}'.format(prevLoanTokenBalance - 0.5*(amountUnderlying), updatedLoanTokenBalance)
        errorMsg.append(msg)
        print(msg)

    prevUnderlyingBalance = updatedUnderlyingBalance
    prevCollateralBalance = updatedCollateralBalance

    # ------------------------------------------------ Test Trade Open & Close with collateral -------------------------------------------------------------------------------
    testTradeOpeningAndClosingWithCollateral(sovryn.address, loanToken.address, underlyingTokenAddress, collateralTokenAddress, amountCollateral, 2e18, True, 0)

    print("=============================== PREVIOUS BALANCE ====================================")
    print("Underlying balance: ", prevUnderlyingBalance)
    print("Collateral balance: ", prevCollateralBalance)

    print("=============================== UPDATED BALANCE =====================================")
    updatedUnderlyingBalance = underlyingToken.balanceOf(conf.acct)
    updatedCollateralBalance = collateralToken.balanceOf(conf.acct)
    print("Underlying balance: ", updatedUnderlyingBalance)
    print("Collateral balance: ", updatedCollateralBalance)


    prevUnderlyingBalance = updatedUnderlyingBalance
    prevCollateralBalance = updatedCollateralBalance


    # ------------------------------------------------ Test Borrow -------------------------------------------------------------------------------
    testBorrow(sovryn.address, loanToken.address, underlyingTokenAddress, collateralTokenAddress, amountCollateral)

    print("=============================== PREVIOUS BALANCE ====================================")
    print("Underlying balance: ", prevUnderlyingBalance)
    print("Collateral balance: ", prevCollateralBalance)

    print("=============================== UPDATED BALANCE =====================================")
    updatedUnderlyingBalance = underlyingToken.balanceOf(conf.acct)
    updatedCollateralBalance = collateralToken.balanceOf(conf.acct)
    print("Underlying balance: ", updatedUnderlyingBalance)
    print("Collateral balance: ", updatedCollateralBalance)

    # Verify
    if updatedUnderlyingBalance - prevUnderlyingBalance != amountUnderlying:
        msg = 'FAILED / INVALID STATE (BORROWING): Updated underyling balance {0} is not matched with the amount that was borrowed: {1}'.format(updatedUnderlyingBalance - prevUnderlyingBalance, amountUnderlying)
        errorMsg.append(msg)
        print(msg)

    prevUnderlyingBalance = updatedUnderlyingBalance
    prevCollateralBalance = updatedCollateralBalance


    # ------------------------------------------------ Test External Swap -------------------------------------------------------------------------------
    testSwapsExternal(underlyingTokenAddress, collateralTokenAddress, amountUnderlying)

    print("=============================== PREVIOUS BALANCE ====================================")
    print("Underlying balance: ", prevUnderlyingBalance)
    print("Collateral balance: ", prevCollateralBalance)

    print("=============================== UPDATED BALANCE =====================================")
    updatedUnderlyingBalance = underlyingToken.balanceOf(conf.acct)
    updatedCollateralBalance = collateralToken.balanceOf(conf.acct)
    print("Underlying balance: ", updatedUnderlyingBalance)
    print("Collateral balance: ", updatedCollateralBalance)



    print(errorMsg)