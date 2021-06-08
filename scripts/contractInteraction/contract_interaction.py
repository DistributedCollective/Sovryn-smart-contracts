
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    #call the function you want here
    


    #transferTokensFromWallet(contracts['SOV'], contracts['LiquidityMiningProxy'], 40000e18)
    #sendTokensFromMultisig(contracts['SOV'], contracts['LiquidityMiningProxy'], 40000e18)
    #setWrapperOnLM()
    #addAdmin(contracts['LockedSOV'], contracts['VestingRegistry3'])
    #setFeesController()
    #withdrawFees()
    #replaceProtocolSettings()

    #addPoolsToLM()

    #lookupCurrentPoolReserveBalances('0x74EA268426770750695d1ea876918CDb22F8D917')

    '''
    r1 = readPrice(contracts['WRBTC'], contracts['USDT'])
    r2 =readSwapRate(contracts['WRBTC'], contracts['USDT'])

    print('diff: ', (r1-r2*1e5)/r1)
    print('diff: ', (r1-r2*1e5)/(r2*1e5))
    '''
    #0x37A706259F5201C03f6Cb556A960F30F86842d01  -ms aggregator
    #deployMultisig(['0xfe9d5402dc3c86cbaBE80231Cd48d98ba742D3f6','0x4C3d3505d34213751c4b4d621cB6bDe7E664E222',acct], 2)
    sendFromMultisig('0x2064242b697830535A2d76BE352e82Cf85E0EC2c', 30e18)
    #removeLiquidityV1toMultisigUsingWrapper(contracts['RBTCWrapperProxyWithoutLM'], contracts["ConverterETHs"], 90e18, [contracts['WRBTC'], contracts['ETHs']], [8e18,1])

    #amount = getBalance('0x09c5FAf7723B13434ABdF1A65AB1b667bc02a902', contracts['multisig'])
    #approval = hasApproval('0x09c5FAf7723B13434ABdF1A65AB1b667bc02a902', contracts['multisig'], contracts['RBTCWrapperProxyWithoutLM'])
    #print(amount <= approval)
    #removeLiquidityV1toMultisigUsingWrapper(contracts['RBTCWrapperProxyWithoutLM'], contracts["WRBTCtoSOVConverter"], 1200e18, [contracts['WRBTC'], contracts['SOV']], [28e18,1])
    #replaceOwnerOnMultisig('0x37A706259F5201C03f6Cb556A960F30F86842d01', '0x4C3d3505d34213751c4b4d621cB6bDe7E664E222', '0xEaBB83a1cEFc5f50C83BC4252C618d3294152A86')
    #upgradeAggregator('0x37A706259F5201C03f6Cb556A960F30F86842d01','0x3E9De61dC23D4BC1b84D174781809e5820cfceb7')
    
    #addLiquidityV1FromMultisigUsingWrapper(contracts['RBTCWrapperProxyWithoutLM'], contracts['ConverterETHs'], [contracts['WRBTC'], contracts['ETHs']], [25e18,352e18], 248e18)
    #addLiquidityV1UsingWrapper(contracts['RBTCWrapperProxyWithoutLM'], contracts['ConverterETHs'], [contracts['WRBTC'], contracts['ETHs']], [0.002e18,0.01e18])
    #readWRBTCAddressFromWrapper(contracts['RBTCWrapperProxyWithoutLM'])

    #readSwapRate('0x542fDA317318eBF1d3DEAf76E0b632741A7e677d', '0x1D931Bf8656d795E50eF6D639562C5bD8Ac2B78f')

    #swapTokens(0.0013e18, 1, contracts['swapNetwork'], contracts['WRBTC'], contracts['ETHs'])

def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("Network not supported.")
    contracts = json.load(configFile)

    
def readLendingFee():
    sovryn = Contract.from_abi("sovryn", address='0xBAC609F5C8bb796Fa5A31002f12aaF24B7c35818', abi=interface.ISovrynBrownie.abi, owner=acct)
    lfp = sovryn.lendingFeePercent()
    print(lfp/1e18)
    
def setupLoanTokenRates(loanTokenAddress):
    baseRate = 1e18
    rateMultiplier = 20.25e18
    targetLevel=80*10**18
    kinkLevel=90*10**18
    maxScaleRate=100*10**18
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    localLoanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier, targetLevel, kinkLevel, maxScaleRate)
    borrowInterestRate = localLoanToken.borrowInterestRate()
    print("borrowInterestRate: ",borrowInterestRate)
    
def lendToPool(loanTokenAddress, tokenAddress, amount):
    token = Contract.from_abi("TestToken", address = tokenAddress, abi = TestToken.abi, owner = acct)
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    if(token.allowance(acct, loanToken.address) < amount):
        token.approve(loanToken.address, amount)
    loanToken.mint(acct, amount)
    
def removeFromPool(loanTokenAddress, amount):
    loanToken = Contract.from_abi("loanToken", address = loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    loanToken.burn(acct, amount)

def readLoanTokenState(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
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
    
def readLoan(loanId):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    print(sovryn.getLoan(loanId).dict())

def getTokenPrice(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    price = loanToken.tokenPrice()
    print("token price",price)
    return price
    
def testTokenBurning(loanTokenAddress, testTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    testToken = Contract.from_abi("TestToken", address = testTokenAddress, abi = TestToken.abi, owner = acct)

    testToken.approve(loanToken,1e17) 
    loanToken.mint(acct, 1e17)
    balance = loanToken.balanceOf(acct)
    print("balance", balance)
    tokenPrice = loanToken.tokenPrice()
    print("token price",tokenPrice/1e18)
    burnAmount = int(balance / 2)
    print("burn amount", burnAmount)
    
    tx = loanToken.burn(acct, burnAmount)
    print(tx.info())
    balance = loanToken.balanceOf(acct)
    print("remaining balance", balance/1e18)
    assert(tx.events["Burn"]["tokenAmount"] == burnAmount)
    
def liquidate(protocolAddress, loanId):
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=acct)
    loan = sovryn.getLoan(loanId).dict()
    print(loan)
    if(loan['maintenanceMargin'] > loan['currentMargin']):
        value = 0
        if(loan['loanToken']==contracts['WRBTC']):
            value = loan['maxLiquidatable']
        else:
            testToken = Contract.from_abi("TestToken", address = loan['loanToken'], abi = TestToken.abi, owner = acct)
            testToken.approve(sovryn, loan['maxLiquidatable'])
        sovryn.liquidate(loanId, acct, loan['maxLiquidatable'],{'value': value})
    else:
        print("can't liquidate because the loan is healthy")
    
def testTradeOpeningAndClosing(protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress, loanTokenSent, leverage, testClose, sendValue):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    testToken = Contract.from_abi("TestToken", address = underlyingTokenAddress, abi = TestToken.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=acct)
    if(sendValue == 0 and testToken.allowance(acct, loanTokenAddress) < loanTokenSent):
        testToken.approve(loanToken, loanTokenSent)
    print('going to trade')
    tx = loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        leverage,  # leverageAmount, 18 decimals
        loanTokenSent,  # loanTokenSent
        0,  # no collateral token sent
        collateralTokenAddress,  # collateralTokenAddress
        acct,  # trader,
        b'',  # loanDataBytes (only required with ether)
        {'value': sendValue}
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
        tx = sovryn.closeWithSwap(loanId, acct, collateral, True, b'')

def testTradeOpeningAndClosingWithCollateral(protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress, collateralTokenSent, leverage, testClose, sendValue):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    testToken = Contract.from_abi("TestToken", address = underlyingTokenAddress, abi = TestToken.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=acct)
    #if(sendValue == 0 and testToken.allowance(acct, loanTokenAddress) < loanTokenSent):
    #    testToken.approve(loanToken, loanTokenSent)
    print('going to trade')
    tx = loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        leverage,  # leverageAmount, 18 decimals
        0,  # loanTokenSent
        collateralTokenSent,  # no collateral token sent
        collateralTokenAddress,  # collateralTokenAddress
        acct,  # trader,
        b'',  # loanDataBytes (only required with ether)
        {'value': sendValue}
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
        tx = sovryn.closeWithSwap(loanId, acct, collateral, True, b'')



def testBorrow(protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress):
    #read contract abis
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=acct)
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    testToken = Contract.from_abi("TestToken", address = collateralTokenAddress, abi = TestToken.abi, owner = acct)
    
    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = 2* sovryn.getRequiredCollateral(underlyingTokenAddress,collateralTokenAddress,withdrawAmount,50e18, True)
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
    if(testToken.address.lower() != contracts['WRBTC'].lower() and testToken.allowance(acct, loanToken.address) < collateralTokenSent):
        testToken.approve(loanToken.address, collateralTokenSent)
    
    # borrow some funds
    tx = loanToken.borrow(
        "0",                            # bytes32 loanId
        withdrawAmount,                 # uint256 withdrawAmount
        durationInSeconds,              # uint256 initialLoanDuration
        collateralTokenSent,            # uint256 collateralTokenSent
        testToken.address,                   # address collateralTokenAddress
        acct,                    # address borrower
        acct,                    # address receiver
        b'' ,                            # bytes memory loanDataBytes
        {'value': collateralTokenSent}
    )
    
    #assert the trade was processed as expected
    print(tx.info())
    
def setupTorqueLoanParams(loanTokenAddress, underlyingTokenAddress, collateralTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    setup = [
        b"0x0", ## id
        False, ## active
        str(acct), ## owner
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
    
def rollover(loanId):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    tx = sovryn.rollover(loanId, b'')
    print(tx.info())

def replaceLoanClosings():
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)

    print('replacing loan closings base')
    loanClosingsBase = acct.deploy(LoanClosingsBase)
    data = sovryn.replaceContract.encode_input(loanClosingsBase.address)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

    print('replacing loan closings with')
    loanClosingsWith = acct.deploy(LoanClosingsWith)
    data = sovryn.replaceContract.encode_input(loanClosingsWith.address)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);
    
def transferOwner(contractAddress, newOwner):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=acct)
    tx= contract.transferOwnership(newOwner)
    tx.info()
    checkOwnerIsAddress(contractAddress, newOwner)

def acceptOwnershipWithMultisig(contractAddress):
    abiFile =  open('./scripts/contractInteraction/Owned.json')
    abi = json.load(abiFile)
    ownedContract = Contract.from_abi("Owned", address=contractAddress, abi=abi, owner=acct)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    data=ownedContract.acceptOwnership.encode_input()
    tx= multisig.submitTransaction(contractAddress,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);
    
def getBalance(contractAddress, acct):
    contract = Contract.from_abi("Token", address=contractAddress, abi=LoanToken.abi, owner=acct)
    print(contract.balanceOf(acct))
    
def buyWRBTC():
    contract = Contract.from_abi("WRBTC", address=contracts["WRBTC"], abi=WRBTC.abi, owner=acct)
    tx = contract.deposit({'value':1e18})
    tx.info()
    print("new balance", getBalance(contracts["WRBTC"], acct))
    
def mintEarlyAccessTokens(contractAddress, userAddress):
    contract = Contract.from_abi("EarlyAccessToken", address=contractAddress, abi=EarlyAccessToken.abi, owner=acct)
    tx = contract.mint(userAddress)
    tx.info()
    
def setTransactionLimits(loanTokenAddress, addresses, limits):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    data = localLoanToken.setTransactionLimits.encode_input(addresses,limits)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(loanTokenAddress,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);

def setTransactionLimitsOld(loanTokenAddress, settingsAddress, logicAddress, addresses, limits):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    localLoanToken.setTarget(settingsAddress)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)
    tx = localLoanToken.setTransactionLimits(addresses,limits)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    localLoanToken.setTarget(logicAddress)
    

def readTransactionLimits(loanTokenAddress, SUSD, RBTC, USDT, BPro):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    limit = localLoanToken.transactionLimit(RBTC)
    print("RBTC limit, ",limit)
    limit = localLoanToken.transactionLimit(SUSD)
    print("DOC limit, ",limit)
    limit = localLoanToken.transactionLimit(USDT)
    print("USDT limit, ",limit)
    limit = localLoanToken.transactionLimit(BPro)
    print("BPro limit, ",limit)
    
def readLiquidity():
    loanToken = Contract.from_abi("loanToken", address=contracts['iRBTC'], abi=LoanTokenLogicStandard.abi, owner=acct)
    tasRBTC = loanToken.totalAssetSupply()
    tabRBTC = loanToken.totalAssetBorrow()
    print("liquidity on iRBTC", (tasRBTC-tabRBTC)/1e18)
    
    loanToken = Contract.from_abi("loanToken", address=contracts['iDOC'], abi=LoanTokenLogicStandard.abi, owner=acct)
    tasIUSD = loanToken.totalAssetSupply()
    tabIUSD = loanToken.totalAssetBorrow()
    print("liquidity on iDOC", (tasIUSD-tabIUSD)/1e18)
    
    loanToken = Contract.from_abi("loanToken", address=contracts['iUSDT'], abi=LoanTokenLogicStandard.abi, owner=acct)
    tasIUSD = loanToken.totalAssetSupply()
    tabIUSD = loanToken.totalAssetBorrow()
    print("liquidity on iUSDT", (tasIUSD-tabIUSD)/1e18)

    tokenContract = Contract.from_abi("Token", address=contracts['USDT'], abi=TestToken.abi, owner=acct)
    bal = tokenContract.balanceOf(contracts['ConverterUSDT'])
    print("supply of USDT on swap", bal/1e18)
    
    tokenContract = Contract.from_abi("Token", address=contracts['WRBTC'], abi=TestToken.abi, owner=acct)
    bal = tokenContract.balanceOf(contracts['ConverterUSDT'])
    print("supply of rBTC on swap", bal/1e18)
    

def hasApproval(tokenContractAddr, sender, receiver):
    tokenContract = Contract.from_abi("Token", address=tokenContractAddr, abi=TestToken.abi, owner=sender)
    allowance = tokenContract.allowance(sender, receiver)
    print("allowance: ", allowance/1e18)
    return allowance
    
def checkIfUserHasToken(EAT, user):
    tokenContract = Contract.from_abi("Token", address=EAT, abi=TestToken.abi, owner=user)
    balance = tokenContract.balanceOf(user)
    print("balance: ", balance)
    
def readLendingBalanceForUser(loanTokenAddress, userAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=userAddress)
    bal = loanToken.balanceOf(userAddress)
    print('iToken balance', bal)
    bal = loanToken.assetBalanceOf(userAddress)
    print('underlying token balance', bal)
    
def replaceLoanTokenLogic(loanTokenAddress, logicAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    loanToken.setTarget(logicAddress)
    
def readOwner(contractAddress):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=acct)
    print('owner:',contract.owner())

def checkOwnerIsAddress(contractAddress, expectedOwner):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=acct)
    owner = contract.owner()
    print("owner == expectedOwner?", owner == expectedOwner)

def setupMarginLoanParams(collateralTokenAddress, loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    params = [];
    setup = [
        b"0x0", ## id
        False, ## active
        acct, ## owner
        "0x0000000000000000000000000000000000000000", ## loanToken -> will be overwritten
        collateralTokenAddress, ## collateralToken.
        Wei("20 ether"), ## minInitialMargin
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm -> will be overwritten
    ]
    params.append(setup)
    tx = loanToken.setupLoanParams(params, False)
    print(tx.info())

def swapTokens(amount, minReturn, swapNetworkAddress, sourceTokenAddress, destTokenAddress):
    abiFile =  open('./scripts/contractInteraction/SovrynSwapNetwork.json')
    abi = json.load(abiFile)
    swapNetwork = Contract.from_abi("SovrynSwapNetwork", address=swapNetworkAddress, abi=abi, owner=acct)
    sourceToken = Contract.from_abi("Token", address=sourceTokenAddress, abi=TestToken.abi, owner=acct)

    contract = Contract.from_abi("WRBTC", address=contracts["WRBTC"], abi=WRBTC.abi, owner=acct)
    tx = contract.deposit({'value':amount})
    tx.info()

    if(sourceToken.allowance(acct, swapNetworkAddress) < amount):
        sourceToken.approve(swapNetworkAddress,amount)
    path = swapNetwork.conversionPath(sourceTokenAddress,destTokenAddress)
    print("path", path)
    expectedReturn = swapNetwork.getReturnByPath(path, amount)
    print("expected return ", expectedReturn)

    tx = swapNetwork.convertByPath(
        path,
        amount,
        minReturn,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        0
    )
    tx.info()
    

def replaceLoanTokenLogic(loanTokenAddress, logicAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    loanToken.setTarget(logicAddress)
    
def readFromMedianizer():
    medianizer = Contract.from_abi("Medianizer", address=contracts['medianizer'], abi=PriceFeedsMoCMockup.abi, owner=acct)
    print(medianizer.peek())

def updateOracleAddress(newAddress):
    print("set oracle address to", newAddress)
    priceFeedsMoC = Contract.from_abi("PriceFeedsMoC", address = '0x066ba9453e230a260c2a753d9935d91187178C29', abi = PriceFeedsMoC.abi, owner = acct)
    priceFeedsMoC.setMoCOracleAddress(newAddress)

    
def addLiquidity(converter, reserve, amount):
    abiFile =  open('./scripts/contractInteraction/LiquidityPoolV2Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV2Converter", address=converter, abi=abi, owner=acct)
    print("is active? ", converter.isActive())
    print("price oracle", converter.priceOracle())
    tx = converter.addLiquidity(reserve, amount, 1)
    print(tx)

def deployMultisig(owners, requiredConf):
     multisig = acct.deploy(MultiSigWallet, owners, requiredConf)
     print("multisig:", multisig)

def setupLoanParamsForCollaterals(loanTokenAddress, collateralAddresses):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    marginParams = []
    torqueParams = []
    for collateralAddress in collateralAddresses:
        marginData = [
            b"0x0", ## id
            False, ## active
            str(acct), ## owner
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

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)

    tx = multisig.submitTransaction(loanToken.address,0,dataM)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);

    tx = multisig.submitTransaction(loanToken.address,0,dataT)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);


def updatePriceFeedToRSKOracle():
    newPriceFeed = acct.deploy(PriceFeedRSKOracle, contracts['RSKOracle'])
    print("new price feed: ", newPriceFeed)
    feeds = Contract.from_abi("PriceFeeds", address= contracts['PriceFeeds'], abi = PriceFeeds.abi, owner = acct)
    feeds.setPriceFeed([contracts['WRBTC']], [newPriceFeed.address])

def updatePriceFeedToMOCOracle():
    newPriceFeed = acct.deploy(PriceFeedsMoC, contracts['medianizer'], contracts['RSKOracle'])
    print("new price feed: ", newPriceFeed)
    feeds = Contract.from_abi("PriceFeeds", address= contracts['PriceFeeds'], abi = PriceFeeds.abi, owner = acct)
    data = feeds.setPriceFeed.encode_input([contracts['WRBTC']], [newPriceFeed.address])
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(feeds.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);


def readPrice(source, destination):
    feeds = Contract.from_abi("PriceFeeds", address= contracts['PriceFeeds'], abi = PriceFeeds.abi, owner = acct)
    rate = feeds.queryRate(source, destination)
    print('rate is ', rate)
    return rate[0]

def readSwapRate(source, destination):
    abiFile =  open('./scripts/contractInteraction/SovrynSwapNetwork.json')
    abi = json.load(abiFile)
    swapNetwork = Contract.from_abi("SovrynSwapNetwork", address=contracts['swapNetwork'], abi=abi, owner=acct)
    path = swapNetwork.conversionPath(source,destination)
    #print("path:", path)
    expectedReturn = swapNetwork.getReturnByPath(path, 1e10)
    print('rate is ', expectedReturn)
    return expectedReturn[0]

def readConversionFee(converterAddress):
    abiFile =  open('./scripts/contractInteraction/LiquidityPoolV1Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("Converter", address=converterAddress, abi=abi, owner=acct)
    fee = converter.conversionFee()
    print('fee is ', fee)

def readPriceFromOracle(oracleAddress):
    oracle = Contract.from_abi("Oracle", address=oracleAddress, abi=PriceFeedsMoC.abi, owner=acct)
    price = oracle.latestAnswer()
    print('rate is ', price)

def readTargetWeights(converter, reserve):
    abiFile =  open('./scripts/contractInteraction/LiquidityPoolV2Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV2Converter", address=converter, abi=abi, owner=acct)
    res = converter.reserves(reserve).dict()
    print(res)
    print('target weight is ',res['weight'])

def updateContracts():
    replaceSwapsImplSovrynSwap()
    replaceSwapsUser()
    replaceLoanOpenings()
    replaceLoanTokenLogicOnAllContracts()

def replaceSwapsExternal():
    #swapsExternal = acct.deploy(SwapsExternal)
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.replaceContract.encode_input('0xAa1dEDE8C097349Dd25C98A0bF79c8D9B6e55caf')
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def replaceLoanOpenings():
    print("replacing loan openings")
    loanOpenings = acct.deploy(LoanOpenings)
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.replaceContract.encode_input(loanOpenings.address)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def replaceSwapsUser():
    print("replacing swaps user")
    swapsUser = acct.deploy(SwapsUser)
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.replaceContract.encode_input(swapsUser.address)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def replaceSwapsImplSovrynSwap():
    print("replacing swaps")
    swaps = acct.deploy(SwapsImplSovrynSwap)
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.setSwapsImplContract.encode_input(swaps.address)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def replaceLoanTokenLogicOnAllContracts():
    print("replacing loan token logic")
    logicContract = acct.deploy(LoanTokenLogicStandard)
    print('new LoanTokenLogicStandard contract for iDoC:' + logicContract.address)
    replaceLoanTokenLogic(contracts['iDOC'],logicContract.address)
    replaceLoanTokenLogic(contracts['iUSDT'],logicContract.address)
    replaceLoanTokenLogic(contracts['iBPro'],logicContract.address)
    logicContract = acct.deploy(LoanTokenLogicWrbtc)
    print('new LoanTokenLogicStandard contract for iWRBTC:' + logicContract.address)
    replaceLoanTokenLogic(contracts['iRBTC'], logicContract.address)

def replaceLoanTokenLogic(loanTokenAddress, logicAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    data = loanToken.setTarget.encode_input(logicAddress)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(loanToken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def checkRates():
    print('reading price from WRBTC to DOC')
    readPrice(contracts['WRBTC'], contracts['DoC'])
    print('reading price from WRBTC to USDT')
    readPrice(contracts['WRBTC'], contracts['USDT'])
    print('reading price from WRBTC to BPRO')
    readPrice(contracts['WRBTC'], contracts['BPro'])
    print('read price from USDT to DOC')
    readPrice(contracts['USDT'], contracts['DoC'])

    print('read swap rate from WRBTC to DOC')
    readSwapRate(contracts['WRBTC'], contracts['DoC'])
    print('read swap rate from WRBTC to USDT')
    readSwapRate(contracts['WRBTC'], contracts['USDT'])
    print('read swap rate from WRBTC to BPRO')
    readSwapRate(contracts['WRBTC'], contracts['BPro'])
    print('read swap rate from USDT to DOC')
    readSwapRate(contracts['USDT'], contracts['DoC'])
    print('read swap rate from BPro to DOC')
    readSwapRate(contracts['BPro'], contracts['DoC'])
    print('read swap rate from BPro to USDT')
    readSwapRate(contracts['BPro'], contracts['USDT'])
    print('read swap rate from USDT to WRBTC')
    readSwapRate(contracts['USDT'], contracts['WRBTC'])
    print('read swap rate from DOC to WRBTC')
    readSwapRate(contracts['DoC'], contracts['WRBTC'])

    print("price from the USDT oracle on AMM:")
    readPriceFromOracle('0x78F0b35Edd78eD564830c45F4A22e4b553d7f042')

    readTargetWeights('0x133eBE9c8bA524C9B1B601E794dF527f390729bF', contracts['USDT'])
    readTargetWeights('0x133eBE9c8bA524C9B1B601E794dF527f390729bF', contracts['WRBTC'])

def addOwnerToMultisig(newOwner):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    data = multisig.addOwner.encode_input(newOwner)
    tx = multisig.submitTransaction(multisig.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);


def governorAcceptAdmin(type):
    governor = Contract.from_abi("GovernorAlpha", address=contracts[type], abi=GovernorAlpha.abi, owner=acct)
    data = governor.__acceptAdmin.encode_input()

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(governor.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def setEarlyAccessToken(loanTokenAddress, EATokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    data = loanToken.setEarlyAccessToken.encode_input(EATokenAddress)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(loanToken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def queueProposal(id):
    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acct)
    tx = governor.queue(id)
    tx.info()

def executeProposal(id):
    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acct)
    tx = governor.execute(id)
    tx.info()

def setLendingFee(fee):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.setLendingFeePercent.encode_input(fee)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def setTradingFee(fee):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.setTradingFeePercent.encode_input(fee)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def setBorrowingFee(fee):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.setBorrowingFeePercent.encode_input(fee)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def setAffiliateFeePercent(fee):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.setAffiliateFeePercent.encode_input(fee)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def setAffiliateTradingTokenFeePercent(percentFee):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.setAffiliateTradingTokenFeePercent.encode_input(percentFee)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def setMinReferralsToPayout(minReferrals):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.setMinReferralsToPayoutAffiliates.encode_input(minReferrals)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def sendFromMultisigToVesting(amount):
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    data = vestingRegistry.deposit.encode_input()
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(vestingRegistry.address,amount,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);



def sendFromMultisig(receiver, amount):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(receiver,amount,'')
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def sendTokensFromMultisig(token, receiver, amount):
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=acct)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    data = tokenContract.transfer.encode_input(receiver, amount)
    print(data)
    tx = multisig.submitTransaction(token,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)


def mintNFT(contractAddress, receiver):
    abiFile =  open('./scripts/contractInteraction/SovrynNft.json')
    abi = json.load(abiFile)
    nft = Contract.from_abi("NFT", address=contractAddress, abi=abi, owner=acct)
    nft.mint(receiver)

def transferSOVtoOriginInvestorsClaim():
    originInvestorsClaimAddress = contracts['OriginInvestorsClaim']
    if (originInvestorsClaimAddress == ''):
        print('Please set originInvestorsClaimAddress and run again')
        return

    originInvestorsClaim = Contract.from_abi("OriginInvestorsClaim", address=originInvestorsClaimAddress, abi=OriginInvestorsClaim.abi, owner=acct)
    amount = originInvestorsClaim.totalAmount()
    if (amount == 0):
        print('Please set amount and run again')
        return

    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    data = SOVtoken.transfer.encode_input(originInvestorsClaimAddress, amount)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(SOVtoken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def createVesting():
    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    tokenOwner = "0x21e1AaCb6aadF9c6F28896329EF9423aE5c67416"
    amount = 27186538 * 10**16
    # TODO cliff 4 weeks or less ?
    # cliff = CLIFF_DELAY + int(vesting[2]) * FOUR_WEEKS
    # duration = cliff + (int(vesting[3]) - 1) * FOUR_WEEKS

    # i think we don't need the delay anymore
    # because 2 weeks after TGE passed already
    # we keep the 4 weeks (26th of march first payout)

    cliff = 1 * FOUR_WEEKS
    duration = cliff + (10 - 1) * FOUR_WEEKS

    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    data = vestingRegistry.createVesting.encode_input(tokenOwner, amount, cliff, duration)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(vestingRegistry.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def transferSOVtoVestingRegistry(vestingRegistryAddress, amount):

    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    data = SOVtoken.transfer.encode_input(vestingRegistryAddress, amount)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(SOVtoken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def stakeTokens2():
    tokenOwner = "0x21e1AaCb6aadF9c6F28896329EF9423aE5c67416"
    # 271,865.38 SOV
    amount = 27186538 * 10**16

    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    vestingAddress = vestingRegistry.getVesting(tokenOwner)
    print("vestingAddress: " + vestingAddress)
    data = vestingRegistry.stakeTokens.encode_input(vestingAddress, amount)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(vestingRegistry.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def transferSOVtoVestingRegistry2():
    # Vesting Amount: 20751256676253082407040 (about 21K SOV)
    # BTC Amount: 2.0203423499999995
    amount = 20751256676253082407040

    # Origin - VestingRegistry2
    vestingRegistryAddress = contracts['VestingRegistry2']
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    data = SOVtoken.transfer.encode_input(vestingRegistryAddress, amount)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(SOVtoken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def triggerEmergencyStop(loanTokenAddress, turnOn):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    #functionSignature = "marginTrade(bytes32,uint256,uint256,uint256,address,address,bytes)"
    functionSignature = "borrow(bytes32,uint256,uint256,uint256,address,address,address,bytes)"
    data = loanToken.toggleFunctionPause.encode_input(functionSignature, turnOn)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(loanToken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def readPauser(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    print(loanToken.pauser())

def setPauser(loanTokenAddress, pauser):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    data = loanToken.setPauser.encode_input(pauser)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(loanToken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def executeOnMultisig(transactionId):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)

    multisig.executeTransaction(transactionId)

def checkPause(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    funcId = "borrow(bytes32,uint256,uint256,uint256,address,address,address,bytes)"
    print(loanToken.checkPause(funcId))

def determineFundsAtRisk():
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    borrowedPositions = []
    sum = 0
    possible = 0
    for i in range (0, 10000, 10):
        loans = sovryn.getActiveLoans(i, i+10, False)
        if(len(loans) == 0):
            break
        for loan in loans:
            if loan[11] == 0 and loan[10] > 150e18:
                print(loan[1])
                sum += loan[3]
                possible += loan[3] * (loan[10] / 150e18)
                borrowedPositions.append(loan)

    print(borrowedPositions)
    print(len(borrowedPositions))
    print('total height of affected loans: ', sum/1e18)
    print('total potential borrowed: ', possible/1e18)
    print('could have been stolen: ', (possible - sum)/1e18)

def addInvestorToBlacklist():
    # we need to process CSOV->SOV exchnage manually,
    # investor address should be added to blacklist in VestingRegistry
    tokenOwner = "0x75F7d09110631FE60a804642003bE00C8Bcd26b7"

    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    data = vestingRegistry.setBlacklistFlag.encode_input(tokenOwner, True)
    print(data)

    # multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    # tx = multisig.submitTransaction(vestingRegistry.address,0,data)
    # txId = tx.events["Submission"]["transactionId"]
    # print(txId)

def stake80KTokens():
    # another address of the investor (addInvestorToBlacklist)
    tokenOwner = "0x21e1AaCb6aadF9c6F28896329EF9423aE5c67416"
    # 80K SOV
    amount = 80000 * 10**18

    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    vestingAddress = vestingRegistry.getVesting(tokenOwner)
    print("vestingAddress: " + vestingAddress)
    data = vestingRegistry.stakeTokens.encode_input(vestingAddress, amount)
    print(data)

    # multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    # tx = multisig.submitTransaction(vestingRegistry.address,0,data)
    # txId = tx.events["Submission"]["transactionId"]
    # print(txId)

def transferSOVtoTokenSender():
    # 875.39 SOV
    amount = 87539 * 10**16

    tokenSenderAddress = contracts['TokenSender']
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    data = SOVtoken.transfer.encode_input(tokenSenderAddress, amount)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(SOVtoken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def transferSOVtoScriptAccount():
    # 5825.7 SOV
    amount = 58257 * 10**17

    # TODO set receiver address
    receiver = "0x27D55f5668eF4438635bdCE0aDCA083507E77752"
    if (receiver == ""):
        raise Exception("Invalid address")
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    data = SOVtoken.transfer.encode_input(receiver, amount)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(SOVtoken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def setSupportedToken(tokenAddress):
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)

    data = sovryn.setSupportedTokens.encode_input([tokenAddress],[True])
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def readBalanceFromAMM():

    tokenContract = Contract.from_abi("Token", address=contracts['USDT'], abi=TestToken.abi, owner=acct)
    bal = tokenContract.balanceOf(contracts['ConverterUSDT'])
    print("supply of USDT on swap", bal/1e18)

    abiFile =  open('./scripts/contractInteraction/LiquidityPoolV2Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV2Converter", address=contracts['ConverterUSDT'], abi=abi, owner=acct)

    reserve = converter.reserves(contracts['USDT'])

    print("registered upply of USDT on swap", reserve[0]/1e18)
    print(reserve)

def testV1Converter(converterAddress, reserve1, reserve2):
    abiFile =  open('./scripts/contractInteraction/LiquidityPoolV1Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV1Converter", address=converterAddress, abi=abi, owner=acct)

    print(converter.reserveRatio())
    print(converter.reserves(reserve1))
    print(converter.reserves(reserve2))
    bal1 = converter.reserves(reserve1)[0]
    bal2 = converter.reserves(reserve2)[0]

    tokenContract1 = Contract.from_abi("Token", address=reserve1, abi=TestToken.abi, owner=acct)
    tokenContract1.approve(converter.address, bal1/100)

    tokenContract2 = Contract.from_abi("Token", address=reserve2, abi=TestToken.abi, owner=acct)
    tokenContract2.approve(converter.address, bal2/50)
    accountBalance = tokenContract2.balanceOf(acct)

    converter.addLiquidity([reserve1, reserve2],[bal1/100, bal2/50],1)

    newAccountBalance = tokenContract2.balanceOf(acct)

    print('oldBalance: ', accountBalance)
    print('newBalance: ', newAccountBalance)
    print('difference:', accountBalance - newAccountBalance)
    print('expected differnce:', bal2/100)

    addLiquidityV1UsingWrapper(converterAddress, [reserve1, reserve2], [bal1/100, bal2/50])

    newerAccountBalance = tokenContract2.balanceOf(acct)
    print('difference:', newAccountBalance - newerAccountBalance)
    print('expected differnce:', bal2/100)

    balanceOnProxy = tokenContract2.balanceOf(contracts['RBTCWrapperProxy'])
    print('balance on proxy contract after the interaction: ', balanceOnProxy)


def addLiquidityV1(converter, tokens, amounts):
    abiFile =  open('./scripts/contractInteraction/LiquidityPoolV1Converter.json')
    abi = json.load(abiFile)
    converter = Contract.from_abi("LiquidityPoolV1Converter", address=converter, abi=abi, owner=acct)

    print("is active? ", converter.isActive())

    token = Contract.from_abi("ERC20", address=tokens[0], abi=ERC20.abi, owner=acct)
    token.approve(converter.address, amounts[0])
    token = Contract.from_abi("ERC20", address=tokens[1], abi=ERC20.abi, owner=acct)
    token.approve(converter.address, amounts[1])

    tx = converter.addLiquidity(tokens, amounts, 1)
    print(tx)

def addLiquidityV1UsingWrapper(wrapper, converter, tokens, amounts):
    abiFile =  open('./scripts/contractInteraction/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=wrapper, abi=abi, owner=acct)
    '''
    token = Contract.from_abi("ERC20", address=tokens[1], abi=ERC20.abi, owner=acct)
    token.approve(wrapperProxy.address, amounts[1])
    '''
    tx = wrapperProxy.addLiquidityToV1(converter, tokens, amounts, 1, {'value': amounts[0], 'allow_revert':True})
    print(tx)

def addLiquidityV2UsingWrapper(converter, tokenAddress, amount):
    abiFile =  open('./scripts/contractInteraction/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=contracts['RBTCWrapperProxy'], abi=abi, owner=acct)
    
    token = Contract.from_abi("ERC20", address=tokenAddress, abi=ERC20.abi, owner=acct)
    token.approve(wrapperProxy.address, amount)
    
    tx = wrapperProxy.addLiquidityToV2(converter, tokenAddress, amount, 1, {'allow_revert':True})
    print(tx)


def getTargetAmountFromAMM(_sourceReserveBalance, _sourceReserveWeight, _targetReserveBalance, _targetReserveWeight, _amount):
    abiFile =  open('./scripts/contractInteraction/SovrynSwapFormula.json')
    abi = json.load(abiFile)

    sovrynSwapFormula = Contract.from_abi("SovrynSwapFormula", address=contracts['SovrynSwapFormula'], abi=abi, owner=acct)

    targetAmount = sovrynSwapFormula.crossReserveTargetAmount(_sourceReserveBalance, _sourceReserveWeight, _targetReserveBalance, _targetReserveWeight, _amount)

    print(targetAmount)

#expects the first token to be wrbtc
def addLiquidityV1FromMultisigUsingWrapper(wrapper, converter, tokens, amounts, minReturn):
    abiFile =  open('./scripts/contractInteraction/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=wrapper, abi=abi, owner=acct)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    
    # approve
    token = Contract.from_abi("ERC20", address=tokens[1], abi=ERC20.abi, owner=acct)
    data = token.approve.encode_input(wrapperProxy.address, amounts[1])
    print(data)

    tx = multisig.submitTransaction(token.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
    
    # addLiquidityToV1
    data = wrapperProxy.addLiquidityToV1.encode_input(converter, tokens, amounts, minReturn)
    print(data)

    tx = multisig.submitTransaction(wrapperProxy.address,amounts[0],data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def removeLiquidityV1toMultisigUsingWrapper(wrapper, converter, amount, tokens, minReturn):
    abiFile =  open('./scripts/contractInteraction/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address= wrapper, abi=abi, owner=acct)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)

    converterAbiFile =  open('./scripts/contractInteraction/LiquidityPoolV1Converter.json')
    converterAbi = json.load(converterAbiFile)
    converterContract = Contract.from_abi("LiquidityPoolV1Converter", address=converter, abi=converterAbi, owner=acct)
    poolToken = converterContract.anchor()
    '''
    # approve
    token = Contract.from_abi("ERC20", address=poolToken, abi=ERC20.abi, owner=acct)
    data = token.approve.encode_input(wrapperProxy.address, amount)
    print(data)
    
    tx = multisig.submitTransaction(token.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
    '''
    # removeLiquidityFromV1
    data = wrapperProxy.removeLiquidityFromV1.encode_input(converter, amount, tokens, minReturn)
    print(data)

    tx = multisig.submitTransaction(wrapperProxy.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def readClaimBalanceOrigin(address):
    originClaimContract = Contract.from_abi("originClaim", address=contracts['OriginInvestorsClaim'], abi=OriginInvestorsClaim.abi, owner=acct)
    amount = originClaimContract.investorsAmountsList(address)
    print(amount)

def sendSOVFromVestingRegistry():
    amount = 307470805 * 10**14
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    data = vestingRegistry.transferSOV.encode_input(contracts['multisig'], amount)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(vestingRegistry.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def replaceProtocolSettings():
    print("Deploying ProtocolSettings.")
    settings = acct.deploy(ProtocolSettings)

    print("Calling replaceContract.")
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.replaceContract.encode_input(settings.address)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def replaceLoanSettings():
    print("Deploying LoanSettings.")
    settings = acct.deploy(LoanSettings)

    print("Calling replaceContract.")
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.replaceContract.encode_input(settings.address)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def deployAffiliate():
    loadConfig()
    # -------------------------------- 1. Replace the protocol settings contract ------------------------------
    replaceProtocolSettings()

    # -------------------------------- 2. Deploy the affiliates -----------------------------------------------
    affiliates = acct.deploy(Affiliates)
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.replaceContract.encode_input(affiliates.address)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

    # Set protocolAddress
    data = sovryn.setSovrynProtocolAddress.encode_input(sovryn.address)
    print("Set Protocol Address in protocol settings")
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
    print("protocol address loaded:", sovryn.getProtocolAddress())

    # Set SOVTokenAddress
    sovToken = Contract.from_abi("SOV", address=contracts["SOV"], abi=SOV.abi, owner=acct)
    data = sovryn.setSOVTokenAddress.encode_input(sovToken.address)
    print("Set SOV Token address in protocol settings")
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
    print("sovToken address loaded:", sovryn.getSovTokenAddress())

    # Set LockedSOVAddress
    lockedSOV = Contract.from_abi("LockedSOV", address=contracts["LockedSOV"], abi=LockedSOV.abi, owner=acct)
    data = sovryn.setLockedSOVAddress.encode_input(lockedSOV.address)
    print("Set Locked SOV address in protocol settings")
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
    print("lockedSOV address loaded:", lockedSOV.address)

    # Set minReferralsToPayout
    setMinReferralsToPayout(3)

    # Set affiliateTradingTokenFeePercent
    setAffiliateTradingTokenFeePercent(20 * 10**18)

    # Set affiliateFeePercent
    setAffiliateFeePercent(5 * 10**18)

    # ---------------------------- 3. Redeploy modules which implement InterestUser and SwapsUser -----------------------
    # LoanClosingsBase
    # LoanClosingsWith
    replaceLoanClosings()
    # LoanOpenings
    replaceLoanOpenings()
    # LoanMaintenance
    replaceLoanMaintenance()
    # SwapsExternal
    redeploySwapsExternal()
    # LoanSettings()
    replaceLoanSettings()

    # -------------------------------- 4. Replace Token Logic Standard ----------------------------------------
    replaceLoanTokenLogicOnAllContracts()

def replaceLoanMaintenance():
    print("replacing loan maintenance")
    loanMaintenance = acct.deploy(LoanMaintenance)
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.replaceContract.encode_input(loanMaintenance.address)
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def redeploySwapsExternal():
    print('replacing swaps external')
    swapsExternal = acct.deploy(SwapsExternal)
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.replaceContract.encode_input(swapsExternal.address)
    print(data)
    
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def printMultisigOwners():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    print(multisig.getOwners())

def addAdmin(admin, vestingRegistryAddress):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    vestingRegistry = Contract.from_abi("VestingRegistry", address=vestingRegistryAddress, abi=VestingRegistry.abi, owner=acct)
    data = vestingRegistry.addAdmin.encode_input(admin)
    tx = multisig.submitTransaction(vestingRegistry.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def isVestingAdmin(admin, vestingRegistryAddress):
    vestingRegistry = Contract.from_abi("VestingRegistry", address=vestingRegistryAddress, abi=VestingRegistry.abi, owner=acct)
    print(vestingRegistry.admins(admin))

def replaceOwnerOnMultisig(multisig, oldOwner, newOwner):
    multisig = Contract.from_abi("MultiSig", address= multisig, abi=MultiSigWallet.abi, owner=acct)
    data = multisig.replaceOwner.encode_input(oldOwner, newOwner)
    tx = multisig.submitTransaction(multisig.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);

def readOwnersOfAllContracts():
    for contractName in contracts:
        #print(contractName)
        contract = Contract.from_abi("Ownable", address=contracts[contractName], abi=LoanToken.abi, owner=acct)
        if(contractName != 'multisig' and contractName != 'WRBTC' and contractName != 'og'  and contractName != 'USDT' and contractName != 'medianizer' and contractName != 'USDTtoUSDTOracleAMM' and contractName != 'GovernorOwner'  and contractName != 'GovernorAdmin' and contractName != 'SovrynSwapFormula' and contractName != 'MOCState' and contractName != 'USDTPriceFeed' and contractName != 'FeeSharingProxy'  and contractName != 'TimelockOwner'  and contractName != 'TimelockAdmin' and contractName != 'AdoptionFund' and contractName != 'DevelopmentFund'):
            owner = contract.owner()
            if(owner != contracts['multisig']):
                print("owner of ", contractName, " is ", owner)

def readVestingContractForAddress(userAddress):
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    address = vestingRegistry.getVesting(userAddress)
    if(address == '0x0000000000000000000000000000000000000000'):
        vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
        address = vestingRegistry.getVesting(userAddress)

    print(address)

def readLMVestingContractForAddress(userAddress):
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry3'], abi=VestingRegistry.abi, owner=acct)
    address = vestingRegistry.getVesting(userAddress)
    print(address)

def readStakingKickOff():
    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    print(staking.kickoffTS())

def setWrapperOnLM():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)
    data = lm.setWrapper.encode_input(contracts['RBTCWrapperProxy'])
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);

def transferTokensFromWallet(tokenContract, receiver, amount):
    token = Contract.from_abi("Token", address= tokenContract, abi = TestToken.abi, owner=acct)
    token.transfer(receiver, amount)

def getPoolId(poolToken):
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)
    print(lm.getPoolId(poolToken))


def getLMInfo():
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)
    print(lm.getPoolLength())
    print(lm.getPoolInfoList())
    print(lm.wrapper())

def setLockedSOV(newLockedSOV):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)
    data = lm.setLockedSOV.encode_input(newLockedSOV)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);

def setFeesController():
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    data = sovryn.setFeesController.encode_input(contracts['FeeSharingProxy'])
    print(data)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId);

def withdrawFees():
    feeSharingProxy = Contract.from_abi("FeeSharingProxy", address=contracts['FeeSharingProxy'], abi=FeeSharingProxy.abi, owner=acct)
    feeSharingProxy.withdrawFees(contracts['USDT'])
    feeSharingProxy.withdrawFees(contracts['DoC'])
    feeSharingProxy.withdrawFees(contracts['WRBTC'])

def addPoolsToLM():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    liquidityMining = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)
    # TODO prepare pool tokens list
    poolTokens = [contracts['(WR)BTC/USDT1'], contracts['(WR)BTC/USDT2'], contracts['(WR)BTC/DOC1'], contracts['(WR)BTC/DOC2'], contracts['(WR)BTC/BPRO1'], contracts['(WR)BTC/BPRO2']]
    allocationPoints = [1, 1, 1, 1, 1, 1]
    # token weight = allocationPoint / SUM of allocationPoints for all pool tokens
    withUpdate = False # can be False if we adding pool tokens before mining started
    for i in range(0,len(poolTokens)):
        print('adding pool', i)
        data = liquidityMining.add.encode_input(poolTokens[i], allocationPoints[i], withUpdate)
        print(data)
        tx = multisig.submitTransaction(liquidityMining.address,0,data)
        txId = tx.events["Submission"]["transactionId"]
    data = liquidityMining.updateAllPools.encode_input()
    print(data)
    tx = multisig.submitTransaction(liquidityMining.address,0,data)
    txId = tx.events["Submission"]["transactionId"]

def lookupCurrentPoolReserveBalances(userAddress):
    wrbtc = Contract.from_abi("TestToken", address = contracts['WRBTC'], abi = TestToken.abi, owner = acct)
    sov = Contract.from_abi("TestToken", address = contracts['SOV'], abi = TestToken.abi, owner = acct)
    poolToken = Contract.from_abi("TestToken", address = contracts['(WR)BTC/SOV'], abi = TestToken.abi, owner = acct)
    liquidityMining = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)

    wrbtcBal = wrbtc.balanceOf(contracts['WRBTCtoSOVConverter']) / 1e18
    sovBal = sov.balanceOf(contracts['WRBTCtoSOVConverter']) / 1e18
    poolSupply = poolToken.totalSupply() / 1e18
    userBal = liquidityMining.getUserPoolTokenBalance(poolToken.address, userAddress) / 1e18
    print('total sov balance ', sovBal)
    print('total wrbtc balance ', wrbtcBal)
    print('pool supply ', poolSupply)
    print('user balance ', userBal)
    
    print('user has in SOV', userBal/poolSupply * sovBal)
    print('user has in BTC', userBal/poolSupply * wrbtcBal)

def upgradeAggregator(multisig, newImpl):
    abiFile =  open('./scripts/contractInteraction/AggregatorProxy.json')
    abi = json.load(abiFile)
    proxy = Contract.from_abi("ETHAggregatorProxy", address = contracts['ETHAggregatorProxy'], abi = abi, owner = acct)
    data = proxy.upgradeTo(newImpl)
    multisig = Contract.from_abi("MultiSig", multisig, abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(proxy.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def readWRBTCAddressFromWrapper(wrapper):
    abiFile =  open('./scripts/contractInteraction/RBTCWrapperProxy.json')
    abi = json.load(abiFile)
    wrapperProxy = Contract.from_abi("RBTCWrapperProxy", address=wrapper, abi=abi, owner=acct)
    print(wrapperProxy.wrbtcTokenAddress())
