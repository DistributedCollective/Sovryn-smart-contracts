from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def readLoanTokenState(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    tas = loanToken.totalAssetSupply()
    print("total supply", tas/1e18);
    #print((balance - tas)/1e18)
    tab = loanToken.totalAssetBorrow()
    print("total asset borrowed", tab/1e18)
    abir = loanToken.avgBorrowInterestRate()
    print("average borrow interest rate", abir/1e18)
    ir = loanToken.nextSupplyInterestRate(0)
    print("next supply interest rate", ir)
    bir = loanToken.nextBorrowInterestRate(0)
    print("next borrow interest rate", bir)

def readUnderlying(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    print(loanToken.loanTokenAddress())

def getTokenPrice(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    price = loanToken.tokenPrice()
    print("token price",price)
    return price

'''
sets a collateral token address as collateral for borrowing
'''
def setupTorqueLoanParams(loanTokenAddress, underlyingTokenAddress, collateralTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    params = []
    setup = [
        b"0x0", ## id
        False, ## active
        str(conf.acct), ## owner
        underlyingTokenAddress, ## loanToken
        collateralTokenAddress, ## collateralToken. 
        Wei("50 ether"), ## minInitialMargin
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm 
    ]
    params.append(setup)
    tx = loanToken.setupLoanParams(params, True)
    assert('LoanParamsSetup' in tx.events)
    assert('LoanParamsIdSetup' in tx.events)
    print(tx.info())
 
'''
sets a collateral token address as collateral for margin trading
'''
def setupMarginLoanParams(collateralTokenAddress, loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    
    params = [];
    setup = [
        b"0x0", ## id
        False, ## active
        conf.acct, ## owner
        "0x0000000000000000000000000000000000000000", ## loanToken -> will be overwritten
        collateralTokenAddress, ## collateralToken.
        Wei("20 ether"), ## minInitialMargin
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm -> will be overwritten
    ]
    params.append(setup)
    tx = loanToken.setupLoanParams(params, False)
    print(tx.info())

def setupLoanParamsForCollaterals(loanTokenAddress, collateralAddresses):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    marginParams = []
    torqueParams = []
    for collateralAddress in collateralAddresses:
        marginData = [
            b"0x0", ## id
            False, ## active
            str(conf.acct), ## owner
            "0x0000000000000000000000000000000000000000", ## loanToken -> will be overwritten
            collateralAddress, ## collateralToken.
            Wei("20 ether"), ## minInitialMargin -> 20% (allows up to 5x leverage)
            Wei("15 ether"), ## maintenanceMargin -> 15%, below liquidation
            0 ## fixedLoanTerm -> will be overwritten with 28 days
        ]
        torqueData = copy.deepcopy(marginData)
        torqueData[5] = Wei("50 ether")
        print(torqueData)

        marginParams.append(marginData)
        torqueParams.append(torqueData)

    #configure the token settings, and set the setting contract address at the loan token logic contract
    dataM = loanToken.setupLoanParams.encode_input(marginParams, False)
    dataT = loanToken.setupLoanParams.encode_input(torqueParams, True)

    sendWithMultisig(conf.contracts['multisig'], loanToken.address, dataM, conf.acct)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, dataT, conf.acct)


def setTransactionLimits(loanTokenAddress, addresses, limits):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = localLoanToken.setTransactionLimits.encode_input(addresses,limits)
    sendWithMultisig(conf.contracts['multisig'], localLoanToken.address, data, conf.acct)

def readTransactionLimits(loanTokenAddress, SUSD, RBTC, USDT, BPro):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=conf.acct)
    limit = localLoanToken.transactionLimit(RBTC)
    print("RBTC limit, ",limit)
    limit = localLoanToken.transactionLimit(SUSD)
    print("DOC limit, ",limit)
    limit = localLoanToken.transactionLimit(USDT)
    print("USDT limit, ",limit)
    limit = localLoanToken.transactionLimit(BPro)
    print("BPro limit, ",limit)

def readLendingBalanceForUser(loanTokenAddress, userAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=userAddress)
    bal = loanToken.balanceOf(userAddress)
    print('iToken balance', bal)
    bal = loanToken.assetBalanceOf(userAddress)
    print('underlying token balance', bal)

def replaceLoanTokenLogicOnAllContracts():
    print("replacing loan token logic")
    logicContract = conf.acct.deploy(LoanTokenLogicLM)
    print('new LoanTokenLogicStandard contract for iDoC:' + logicContract.address)
    replaceLoanTokenLogic(conf.contracts['iDOC'],logicContract.address)
    replaceLoanTokenLogic(conf.contracts['iUSDT'],logicContract.address)
    replaceLoanTokenLogic(conf.contracts['iBPro'],logicContract.address)
    replaceLoanTokenLogic(conf.contracts['iXUSD'],logicContract.address)
    logicContract = conf.acct.deploy(LoanTokenLogicWrbtc)
    print('new LoanTokenLogicStandard contract for iWRBTC:' + logicContract.address)
    replaceLoanTokenLogic(conf.contracts['iRBTC'], logicContract.address)

def replaceLoanTokenLogic(loanTokenAddress, logicAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=conf.acct)
    data = loanToken.setTarget.encode_input(logicAddress)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)
    

def triggerEmergencyStop(loanTokenAddress, turnOn):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    functionSignature = "marginTrade(bytes32,uint256,uint256,uint256,address,address,bytes)"
    #functionSignature = "borrow(bytes32,uint256,uint256,uint256,address,address,address,bytes)"
    data = loanToken.toggleFunctionPause.encode_input(functionSignature, turnOn)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def readPauser(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    print(loanToken.pauser())

def setPauser(loanTokenAddress, pauser):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = loanToken.setPauser.encode_input(pauser)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def checkPause(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    funcId = "borrow(bytes32,uint256,uint256,uint256,address,address,address,bytes)"
    print(loanToken.checkPause(funcId))

def disableLoanParams(loanTokenAddress, collateralToken):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=conf.acct)
    data = loanToken.disableLoanParams.encode_input([collateralToken, collateralToken], [False, True])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def readAdminOfLoanToken(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=conf.acct)
    print(loanToken.admin())

def setAdminOnLoanToken(loanTokenAddress, admin):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=conf.acct)
    data = loanToken.setAdmin.encode_input(admin)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def readLiquidity():
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iRBTC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    tasRBTC = loanToken.totalAssetSupply()
    tabRBTC = loanToken.totalAssetBorrow()
    print("liquidity on iRBTC", (tasRBTC-tabRBTC)/1e18)
    
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iDOC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    tasIUSD = loanToken.totalAssetSupply()
    tabIUSD = loanToken.totalAssetBorrow()
    print("liquidity on iDOC", (tasIUSD-tabIUSD)/1e18)
    
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iUSDT'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    tasIUSD = loanToken.totalAssetSupply()
    tabIUSD = loanToken.totalAssetBorrow()
    print("liquidity on iUSDT", (tasIUSD-tabIUSD)/1e18)

    tokenContract = Contract.from_abi("Token", address=conf.contracts['USDT'], abi=TestToken.abi, owner=conf.acct)
    bal = tokenContract.balanceOf(conf.contracts['ConverterUSDT'])
    print("supply of USDT on swap", bal/1e18)
    
    tokenContract = Contract.from_abi("Token", address=conf.contracts['WRBTC'], abi=TestToken.abi, owner=conf.acct)
    bal = tokenContract.balanceOf(conf.contracts['ConverterUSDT'])
    print("supply of rBTC on swap", bal/1e18)
