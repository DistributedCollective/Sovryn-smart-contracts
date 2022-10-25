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

def removeFromPoolWithMS(loanTokenAddress, amount, receiver):
    loanToken = Contract.from_abi("loanToken", address = loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = loanToken.burn.encode_input(receiver, amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], loanTokenAddress, data, conf.acct)

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
        {'value': sendValue}#, 'allow_revert': True
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

def withdrawRBTCFromIWRBTC(toAddress, amount):
    loanTokenAddress = conf.contracts['iRBTC']
    withdrawRBTCFromLoanTokenTo(loanTokenAddress, toAddress, amount)

def goSOVLongWithMS(sovSent):
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iRBTC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    sovToken = Contract.from_abi("TestToken", address = conf.contracts['SOV'], abi = TestToken.abi, owner = conf.acct)

    if(sovToken.allowance(conf.contracts['multisig'], loanToken.address) < sovSent):
        print("getting approval")
        data = sovToken.approve.encode_input(loanToken.address, sovSent)
        print(data)
        sendWithMultisig(conf.contracts['multisig'], sovToken, data, conf.acct)

    print('going to trade')
    data = loanToken.marginTrade.encode_input(
        "0",  # loanId  (0 for new loans)
        0.33e18,  # leverageAmount, 18 decimals
        0,  # loanTokenSent
        sovSent,  # no collateral token sent
        sovToken.address,  # collateralTokenAddress
        conf.contracts['multisig'],  # trader,
        0, # slippage
        b''
    )
    print(data)
    sendWithMultisig(conf.contracts['multisig'], loanToken, data, conf.acct)
    

def withdrawRBTCFromIWRBTC(toAddress, amount):
    loanTokenAddress = conf.contracts['iRBTC']
    withdrawRBTCFromLoanTokenTo(loanTokenAddress, toAddress, amount)

def withdrawRBTCFromLoanTokenTo(loanTokenAddress, toAddress, amount):
    #read contract abis
    tokenContract = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = tokenContract.withdrawRBTCTo.encode_input(toAddress, amount)
    print("=============================================================")
    print("Sending RBTC")
    print("from LoanToken:          ", tokenContract.address)
    print("RBTC LoanToken balance:  ", tokenContract.balance())
    print("address to:              ", toAddress)
    print("amount to withdraw:      ", amount)
    print("=============================================================")
   # sendWithMultisig(conf.contracts['multisig'], tokenContract, data, conf.acct)

def withdrawRBTCFromLoanTokenTo(loanTokenAddress, toAddress, amount):
    #read contract abis
    tokenContract = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = tokenContract.withdrawRBTCTo.encode_input(toAddress, amount)
    print("=============================================================")
    print("Sending RBTC")
    print("from LoanToken:          ", tokenContract.address)
    print("RBTC LoanToken balance:  ", tokenContract.balance())
    print("address to:              ", toAddress)
    print("amount to withdraw:      ", amount)
    print("=============================================================")
    sendWithMultisig(conf.contracts['multisig'], tokenContract, data, conf.acct)
    

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

def borrowRBTCWithMultisigUsingSOV(withdrawAmount, receiver):
    print("amount: ", withdrawAmount)

    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iRBTC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    sovToken = Contract.from_abi("SOV", address = conf.contracts['SOV'], abi = TestToken.abi, owner = conf.acct)

    durationInSeconds = 28*24*60*60 # 28 days
    collateralTokenSent = loanToken.getDepositAmountForBorrow(withdrawAmount, durationInSeconds, conf.contracts['SOV'])
    print("collateral needed", collateralTokenSent/1e18)
    
    #approve the transfer of the collateral if needed
    if(sovToken.allowance(conf.contracts['multisig'], loanToken.address) < collateralTokenSent):
        data = sovToken.approve.encode_input(loanToken.address, collateralTokenSent)
        print('approving the transfer')
        sendWithMultisig(conf.contracts['multisig'], sovToken.address, data, conf.acct)
    
    # borrow some funds
    data = loanToken.borrow.encode_input(
        "0",                            # bytes32 loanId
        withdrawAmount,                 # uint256 withdrawAmount
        durationInSeconds,              # uint256 initialLoanDuration
        collateralTokenSent,            # uint256 collateralTokenSent
        sovToken.address,               # address collateralTokenAddress
        conf.contracts['multisig'],     # address borrower
        receiver,                       # address receiver
        b''
    )
    print('borrowing and sending tokens to ', receiver)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)


'''
sets a collateral token address as collateral for borrowing
'''
def setupTorqueLoanParams(loanTokenAddress, underlyingTokenAddress, collateralTokenAddress, minInitialMargin):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    params = []
    setup = [
        b"0x0", ## id
        False, ## active
        str(conf.acct), ## owner
        underlyingTokenAddress, ## loanToken
        collateralTokenAddress, ## collateralToken. 
        minInitialMargin, ## minInitialMargin
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm 
    ]
    params.append(setup)
    dataT = loanToken.setupLoanParams.encode_input(params, True)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, dataT, conf.acct)

 
'''
sets a collateral token address as collateral for margin trading
'''
def setupMarginLoanParams(collateralTokenAddress, loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=conf.acct)
    
    params = [];
    setup = [
        b"0x0", ## id
        False, ## active
        conf.contracts['multisig'], ## owner
        "0x0000000000000000000000000000000000000000", ## loanToken -> will be overwritten
        collateralTokenAddress, ## collateralToken.
        Wei("20 ether"), ## minInitialMargin
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm -> will be overwritten
    ]
    params.append(setup)
    data = loanToken.setupLoanParams.encode_input(params, False)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

'''
sets a collateral token address as collateral for margin trading
'''
def setupMarginLoanParamsMinInitialMargin(collateralTokenAddress, loanTokenAddress, minInitialMargin):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=conf.acct)
    #loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, #abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    
    params = []
    setup = [
        b"0x0", ## id
        False, ## active
        conf.contracts['multisig'], ## owner
        "0x0000000000000000000000000000000000000000", ## loanToken -> will be overwritten
        collateralTokenAddress, ## collateralToken.
        minInitialMargin,
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm -> will be overwritten
    ]
    params.append(setup)
    data = loanToken.setupLoanParams.encode_input(params, False)
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)


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
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=conf.acct)
    data = localLoanToken.setTransactionLimits.encode_input(addresses,limits)
    sendWithMultisig(conf.contracts['multisig'], localLoanToken.address, data, conf.acct)

def readTransactionLimits(loanTokenAddress, SUSD, RBTC, USDT, BPro, XUSD):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=conf.acct)
    limit = localLoanToken.transactionLimit(RBTC)
    print("RBTC limit, ",limit)
    limit = localLoanToken.transactionLimit(SUSD)
    print("DOC limit, ",limit)
    limit = localLoanToken.transactionLimit(USDT)
    print("USDT limit, ",limit)
    limit = localLoanToken.transactionLimit(BPro)
    print("BPro limit, ",limit)
    limit = localLoanToken.transactionLimit(XUSD)
    print("XUSD limit, ",limit)

def readLendingBalanceForUser(loanTokenAddress, userAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=userAddress)
    bal = loanToken.balanceOf(userAddress)
    print('iToken balance', bal)
    bal = loanToken.assetBalanceOf(userAddress)
    print('underlying token balance', bal)

def deployNewLoanTokenLogicFirstTime():
    # This function only be called one time (right after the changes of the refactoring LoanTokenLogic https://github.com/DistributedCollective/Sovryn-tasks-discussions/discussions/7)
    # Unless we want to redeploy the loan token logic proxy

    # ============================= 1. Deploy LoanTokenLogicProxy for each LoanToken (iUSDT, iDOC, iBPro, iXUSD, iRBTC) =====================================
    # iUSDTProxy
    loanTokenLogicProxyUSDT = conf.acct.deploy(LoanTokenLogicProxy)
    print("Loan Token Logic Proxy USDT deployed at: ", loanTokenLogicProxyUSDT.address)

    # iDOCProxy
    loanTokenLogicProxyDOC = conf.acct.deploy(LoanTokenLogicProxy)
    print("Loan Token Logic Proxy DOC deployed at: ", loanTokenLogicProxyDOC.address)

    # iBProProxy
    loanTokenLogicProxyBPro = conf.acct.deploy(LoanTokenLogicProxy)
    print("Loan Token Logic Proxy BPro deployed at: ", loanTokenLogicProxyBPro.address)

    # iXUSDProxy
    loanTokenLogicProxyXUSD = conf.acct.deploy(LoanTokenLogicProxy)
    print("Loan Token Logic Proxy XUSD deployed at: ", loanTokenLogicProxyXUSD.address)

    # iRBTCProxy
    loanTokenLogicProxyRBTC = conf.acct.deploy(LoanTokenLogicProxy)
    print("Loan Token Logic Proxy RBTC deployed at: ", loanTokenLogicProxyRBTC.address)

    # ============================== 2. Deploy the beacons (2 beacons, 1 for LM & 1 for wRBTC) =======================================
    loanTokenLogicBeaconLM = conf.acct.deploy(LoanTokenLogicBeacon)
    print("LoanTokenLogicBeaconLM is deployed at: ", loanTokenLogicBeaconLM.address)

    loanTokenLogicBeaconWrbtc = conf.acct.deploy(LoanTokenLogicBeacon)
    print("LoanTokenLogicBeaconWrbtc is deployed at: ", loanTokenLogicBeaconWrbtc.address)

    # ============================== 3. Deploy the LoanTokenLogicLM, Register all of the module to the BeaconLM ============================
    print("Deploying LoanTokenlogicLM")
    logicContractLM = conf.acct.deploy(LoanTokenLogicLM)
    print("new LoanTokenLogicLM contract deployed at: ", logicContractLM.address)

    print("Registering module to LoanTokenLogicBeaconLM")
    loanTokenLogicBeaconLM.registerLoanTokenModule(logicContractLM.address)
    # check marginTrade function signature
    if loanTokenLogicBeaconLM.getTarget("0x28a02f19") != logicContractLM.address:
        raise Exception("Module loan token logic standard is not registered properly")

    print("Deploy Loan Token Settings Lower Admin Module")
    loanTokenSettingsLowerAdmin = conf.acct.deploy(LoanTokenSettingsLowerAdmin)
    print("LoanTokenSettingsLowerAdmin for BeaconLM module deployed at: ", loanTokenSettingsLowerAdmin.address)

    print("Registering Loan Protocol Settings Module to LoanTOkenLogicBeaconLM")
    loanTokenLogicBeaconLM.registerLoanTokenModule(loanTokenSettingsLowerAdmin.address)
    #check setAdmin function signature
    if loanTokenLogicBeaconLM.getTarget("0x704b6c02") != loanTokenSettingsLowerAdmin.address:
        raise Exception("Module loan token settings lower admin is not registered properly")

    print("registering loan token module LM success...")

    # ============================== 4. Deploy the LoanTokenLogicWrbtc, Register all of the module to the BeaconWrbtc ==============================
    print("Deploying LoanTokenlogicWrbtc")
    logicContractWrbtc = conf.acct.deploy(LoanTokenLogicWrbtc)
    print("new LoanTokenLogicWRBTC contract deployed at: ", logicContractWrbtc.address)

    print("Registering module to LoanTokenLogicBeaconWrbtc")
    loanTokenLogicBeaconWrbtc.registerLoanTokenModule(logicContractWrbtc.address)
    # check marginTrade function signature
    if loanTokenLogicBeaconWrbtc.getTarget("0x28a02f19") != logicContractWrbtc.address:
        raise Exception("Module loan token logic standard is not registered properly")

    print("Registering Loan Protocol Settings Module to LoanTOkenLogicBeaconWrbtc")
    loanTokenLogicBeaconWrbtc.registerLoanTokenModule(loanTokenSettingsLowerAdmin.address)
    #check setAdmin function signature
    if loanTokenLogicBeaconWrbtc.getTarget("0x704b6c02") != loanTokenSettingsLowerAdmin.address:
        raise Exception("Module loan token settings lower admin is not registered properly")

    print("registering loan token module wrbtc success...")

    # ============================== 5. Set each LoanTokenLogicProxy with the beacon accordingly (iUSDTProxy, iDOCProxy, iBProProxy, iXUSDProxy) with the BeaconLM and (iRBTC) with the BeaconWrbtc ==============================
    # iUSDT
    setBeaconLoanTokenLogicProxy(conf.contracts['iUSDT'], loanTokenLogicBeaconLM.address)

    # iDOCProxy
    setBeaconLoanTokenLogicProxy(conf.contracts['iDOC'], loanTokenLogicBeaconLM.address)

    # iBPro
    setBeaconLoanTokenLogicProxy(conf.contracts['iBPro'], loanTokenLogicBeaconLM.address)

    # iXUSD
    setBeaconLoanTokenLogicProxy(conf.contracts['iXUSD'], loanTokenLogicBeaconLM.address)

    # iRBTC
    setBeaconLoanTokenLogicProxy(conf.contracts['iRBTC'], loanTokenLogicBeaconWrbtc.address)

    # ============================== 6. Set target of each LoanToken to its proxy accordingly (iUSDT -> iUSDTPRoxy) (iDOC -> iDOC) (iBPro -> iBPro) (iXUSD -> iXUSD) (iRBTC -> iRBTCProxy) ==============================
    # iUSDT
    replaceLoanTokenLogic(conf.contracts['iUSDT'], loanTokenLogicProxyUSDT.address)

    # iDOC
    replaceLoanTokenLogic(conf.contracts['iDOC'], loanTokenLogicProxyDOC.address)

    # iBPro
    replaceLoanTokenLogic(conf.contracts['iBPro'], loanTokenLogicProxyBPro.address)

    # iXUSD
    replaceLoanTokenLogic(conf.contracts['iXUSD'], loanTokenLogicProxyXUSD.address)

    # iRBTC
    replaceLoanTokenLogic(conf.contracts['iRBTC'], loanTokenLogicProxyRBTC.address)

    # ============================== 7. Transfer the ownership of LoanTokenLogicBeaconLM & LoanTokenLogicBeaconWrbtc to the multisig ==============================
    print("LoanTokenLogicLM previous owner: ", loanTokenLogicBeaconLM.owner())
    print("Transferring LoanTokenLogicBeaconLM to multisig...")
    loanTokenLogicBeaconLM.transferOwnership(conf.contracts['multisig'])
    print("LoanTokenLogicLM new owner: ", loanTokenLogicBeaconLM.owner())

    print("LoanTokenLogicWrbtc previous owner: ", loanTokenLogicBeaconWrbtc.owner())
    print("Transferring LoanTokenLogicWrbtc to multisig...")
    loanTokenLogicBeaconWrbtc.transferOwnership(conf.contracts['multisig'])
    print("LoanTokenLogicWrbtc new owner: ", loanTokenLogicBeaconWrbtc.owner())

def setBeaconLoanTokenLogicProxy(loanTokenAddress, loanTokenLogicBeaconAddress):
    loanTokenWithProxyABI = Contract.from_abi("loanTokenWithProxyABI", address=loanTokenAddress, abi=LoanTokenLogicProxy.abi, owner=conf.acct)
    data = loanTokenWithProxyABI.setBeaconAddress.encode_input(loanTokenLogicBeaconAddress)
    sendWithMultisig(conf.contracts['multisig'], loanTokenWithProxyABI.address, data, conf.acct)

def replaceLoanTokenLogicOnAllContracts():
    # This function will do:
    # 1. Deploy the LoanTokenLogicLM
    # 2. Re-register the module/function signature inside LoanTokenLogicLM to the LoanTokenLogicBeaconLM
    # 3. Deploy the LoanTokenLogicWrbtc
    # 4. Re-register the module/function signature inside LoanTokenLogicWrbtc to the LoanTokenLogicBeaconWrbtc


    # ===================================== LM =====================================
    print("Deploying LoanTokenlogicLM")
    logicContractLM = conf.acct.deploy(LoanTokenLogicLM)
    print("new LoanTokenLogicLM contract deployed at: ", logicContractLM.address)

    print("Registering function signature to the LoanTokenLogicBeaconLM")
    loanTokenLogicBeaconLM = Contract.from_abi("loanTokenLogicBeaconLM", address=conf.contracts['LoanTokenLogicBeaconLM'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    data = loanTokenLogicBeaconLM.registerLoanTokenModule.encode_input(logicContractLM.address)
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconLM.address, data, conf.acct)

    print("Deploy Loan Token Settings Lower Admin Module")
    loanTokenSettingsLowerAdmin = conf.acct.deploy(LoanTokenSettingsLowerAdmin)
    print("LoanTokenSettingsLowerAdmin for BeaconLM module deployed at: ", loanTokenSettingsLowerAdmin.address)

    print("Registering Loan Protocol Settings Module to LoanTOkenLogicBeaconLM")
    data = loanTokenLogicBeaconLM.registerLoanTokenModule.encode_input(loanTokenSettingsLowerAdmin.address)
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconLM.address, data, conf.acct)

    # ===================================== WRBTC =====================================

    print("Deploying LoanTokenlogicWrbtc")
    logicContractWrbtc = conf.acct.deploy(LoanTokenLogicWrbtc)
    print("new LoanTokenLogicWRBTC contract deployed at: ", logicContractWrbtc.address)

    print("Registering function signature to the LoanTokenLogicBeaconWRBTC")
    loanTokenLogicBeaconWrbtc = Contract.from_abi("loanTokenLogicBeaconWrbtc", address=conf.contracts['LoanTokenLogicBeaconWrbtc'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    data = loanTokenLogicBeaconWrbtc.registerLoanTokenModule.encode_input(logicContractWrbtc.address)
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconWrbtc.address, data, conf.acct)

    # Can use the same Loan Protocol Settings with the LoanTokenLogicLM
    print("Registering Loan Protocol Settings Module to LoanTOkenLogicBeaconWrbtc")
    data = loanTokenLogicBeaconWrbtc.registerLoanTokenModule.encode_input(loanTokenSettingsLowerAdmin.address)
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconWrbtc.address, data, conf.acct)
    

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
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=interface.ILoanTokenModules.abi, owner=conf.acct)
    print(loanToken.pauser())

def setPauser(loanTokenAddress, pauser):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=interface.ILoanTokenModules.abi, owner=conf.acct)
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
    print(tabRBTC/tasRBTC)
    print("liquidity on iRBTC", (tasRBTC-tabRBTC)/1e18)
    
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iDOC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    tasIUSD = loanToken.totalAssetSupply()
    tabIUSD = loanToken.totalAssetBorrow()
    print("liquidity on iDOC", (tasIUSD-tabIUSD)/1e18)
    
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iXUSD'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    tasIUSD = loanToken.totalAssetSupply()
    tabIUSD = loanToken.totalAssetBorrow()
    print(tabIUSD/tasIUSD)
    print("liquidity on iUSDT", (tasIUSD-tabIUSD)/1e18)

    tokenContract = Contract.from_abi("Token", address=conf.contracts['USDT'], abi=TestToken.abi, owner=conf.acct)
    bal = tokenContract.balanceOf(conf.contracts['ConverterUSDT'])
    print("supply of USDT on swap", bal/1e18)
    
    tokenContract = Contract.from_abi("Token", address=conf.contracts['WRBTC'], abi=TestToken.abi, owner=conf.acct)
    bal = tokenContract.balanceOf(conf.contracts['ConverterUSDT'])
    print("supply of rBTC on swap", bal/1e18)

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

def getDepositAmountForBorrow(loanTokenAddress, borrowAmount, initialLoanDuration, collateralTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    result = loanToken.getDepositAmountForBorrow(borrowAmount, initialLoanDuration, collateralTokenAddress)
    print(result)


def pauseLoanTokenLogicBeaconLM():
    loanTokenLogicBeaconLM = Contract.from_abi("loanTokenLogicBeaconLM", address=conf.contracts['LoanTokenLogicBeaconLM'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    data = loanTokenLogicBeaconLM.pause.encode_input()
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconLM.address, data, conf.acct)

def unpauseLoanTokenLogicBeaconLM():
    loanTokenLogicBeaconLM = Contract.from_abi("loanTokenLogicBeaconLM", address=conf.contracts['LoanTokenLogicBeaconLM'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    data = loanTokenLogicBeaconLM.unpause.encode_input()
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconLM.address, data, conf.acct)

def pauseLoanTokenLogicBeaconWRBTC():
    loanTokenLogicBeaconWRBTC = Contract.from_abi("loanTokenLogicBeaconWRBTC", address=conf.contracts['LoanTokenLogicBeaconWrbtc'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    data = loanTokenLogicBeaconWRBTC.pause.encode_input()
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconWRBTC.address, data, conf.acct)

def unpauseLoanTokenLogicBeaconWRBTC():
    loanTokenLogicBeaconWRBTC = Contract.from_abi("loanTokenLogicBeaconWRBTC", address=conf.contracts['LoanTokenLogicBeaconWrbtc'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    data = loanTokenLogicBeaconWRBTC.unpause.encode_input()
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconWRBTC.address, data, conf.acct)

def pauseAllLoanTokens():
    pauseLoanTokenLogicBeaconLM()
    pauseLoanTokenLogicBeaconWRBTC()

def unpauseAllLoanTokens():
    unpauseLoanTokenLogicBeaconLM()
    unpauseLoanTokenLogicBeaconWRBTC()

def get_estimated_margin_details(collateralToken, loanSize, collateralTokenSent, leverageAmount):
            
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    result = loanToken.getEstimatedMarginDetails.call(leverageAmount, 0, collateralTokenSent, collateralToken.address)
    
    assert(result[0] == loanSize * collateralTokenSent * leverageAmount / 1e36)
    assert(result[2] == 0)

    print("principal", result[0])
    print("collateral", result[1])
    print("interestRate", result[2])
    print("loanSize",loanSize)
    print("collateralTokenSent",collateralTokenSent)
    print("leverageAmount", leverageAmount)

def replaceLoanTokenSettingsLowerAdmin():
    print("Deploy Loan Token Settings Lower Admin Module")
    loanTokenSettingsLowerAdmin = conf.acct.deploy(LoanTokenSettingsLowerAdmin)
    print("LoanTokenSettingsLowerAdmin for BeaconLM module deployed at: ", loanTokenSettingsLowerAdmin.address)

    loanTokenLogicBeaconLM = Contract.from_abi("LoanTokenLogicBeacon", address=conf.contracts['LoanTokenLogicBeaconLM'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    print("Registering Loan Protocol Settings Module to LoanTOkenLogicBeaconLM")
    data = loanTokenLogicBeaconLM.registerLoanTokenModule.encode_input(loanTokenSettingsLowerAdmin.address)
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconLM.address, data, conf.acct)

    loanTokenLogicBeaconWrbtc = Contract.from_abi("LoanTokenLogicBeacon", address=conf.contracts['LoanTokenLogicBeaconWrbtc'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    print("Registering Loan Protocol Settings Module to LoanTOkenLogicBeaconWrbtc")
    data = loanTokenLogicBeaconWrbtc.registerLoanTokenModule.encode_input(loanTokenSettingsLowerAdmin.address)
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconWrbtc.address, data, conf.acct)

def transferBeaconOwnershipToGovernance():
    # transfer beacon LM
    print("Transferring beacon LM ownserhip to: ", conf.contracts['TimelockOwner'])
    loanTokenLogicBeaconLM = Contract.from_abi("loanTokenLogicBeaconLM", address=conf.contracts['LoanTokenLogicBeaconLM'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    data = loanTokenLogicBeaconLM.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconLM.address, data, conf.acct)

    # transfer beacon wrbtc
    print("Transferring beacon WRBTC ownserhip to: ", conf.contracts['TimelockOwner'])
    loanTokenLogicBeaconWrbtc = Contract.from_abi("loanTokenLogicBeaconWrbtc", address=conf.contracts['LoanTokenLogicBeaconWrbtc'], abi=LoanTokenLogicBeacon.abi, owner=conf.acct)
    data = loanTokenLogicBeaconWrbtc.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], loanTokenLogicBeaconWrbtc.address, data, conf.acct)

def transferLoanTokenAdminRoleToGovernance():
    # iDOC
    print("Transferring iDOC admin to: ", conf.contracts['TimelockAdmin'])
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iDOC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = loanToken.setAdmin.encode_input(conf.contracts['TimelockAdmin'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

    # iRBTC
    print("Transferring iRBTC admin to: ", conf.contracts['TimelockAdmin'])
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iRBTC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = loanToken.setAdmin.encode_input(conf.contracts['TimelockAdmin'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

    # iXUSD
    print("Transferring iXUSD admin to: ", conf.contracts['TimelockAdmin'])
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iXUSD'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = loanToken.setAdmin.encode_input(conf.contracts['TimelockAdmin'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

    # iUSDT
    print("Transferring iUSDT admin to: ", conf.contracts['TimelockAdmin'])
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iUSDT'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = loanToken.setAdmin.encode_input(conf.contracts['TimelockAdmin'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

    # iBPro
    print("Transferring iBPro admin to: ", conf.contracts['TimelockAdmin'])
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iBPro'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    data = loanToken.setAdmin.encode_input(conf.contracts['TimelockAdmin'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def transferLoanTokenOwnershipToGovernance():
    # iDOC
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iDOC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    print("Transferring iDOC ownserhip to: ", conf.contracts['TimelockOwner'])
    data = loanToken.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

    # iRBTC
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iRBTC'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    print("Transferring iRBTC ownserhip to: ", conf.contracts['TimelockOwner'])
    data = loanToken.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

    # iXUSD
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iXUSD'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    print("Transferring iXUSD ownserhip to: ", conf.contracts['TimelockOwner'])
    data = loanToken.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

    # iUSDT
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iUSDT'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    print("Transferring iUSDT ownserhip to: ", conf.contracts['TimelockOwner'])
    data = loanToken.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

    # iBPro
    loanToken = Contract.from_abi("loanToken", address=conf.contracts['iBPro'], abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    print("Transferring iBPro ownserhip to: ", conf.contracts['TimelockOwner'])
    data = loanToken.transferOwnership.encode_input(conf.contracts['TimelockOwner'])
    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def readLoanTokenStorage(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStorage.abi, owner=conf.acct)
    print(loanToken.sovrynContractAddress())
    print(loanToken.wrbtcTokenAddress())
    print(loanToken.target_())
    print(loanToken.admin())
    #print(loanToken.earlyAccessToken())
    print(loanToken.pauser())
    #print(loanToken.liquidityMiningAddress())

def getTotalAssetSupply(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=conf.acct)
    print(loanToken.totalAssetSupply())
    return loanToken.totalAssetSupply()
