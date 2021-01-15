
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()
    #call the function you want here
    #setupMarginLoanParams(contracts['WRBTC'], contracts['iDOC'])
    #testTradeOpeningAndClosing(contracts['sovrynProtocol'], contracts['iDOC'], contracts['DoC'], contracts['WRBTC'], 1e18, 5e18, False, 0)
    #setupMarginLoanParams(contracts['DoC'],  contracts['iRBTC'])
    #testTradeOpeningAndClosing(contracts['sovrynProtocol'], contracts['iRBTC'], contracts['WRBTC'], contracts['DoC'], 1e15, 5e18, False, 1e15)
    
    #swapTokens(0.02e18,200e18, contracts['swapNetwork'], contracts['WRBTC'], contracts['DoC'])
    #swapTokens(300e18, 0.02e18, contracts['swapNetwork'], contracts['DoC'], contracts['WRBTC'])
    #liquidate(contracts['sovrynProtocol'], '0xc9b8227bcf953e45f16d5d9a8a74cad92f403b90d0daf00900bb02e4a35c542c')
    #readLiquidity()
    #getBalance(contracts['WRBTC'], '0xE5646fEAf7f728C12EcB34D14b4396Ab94174827')
    #getBalance(contracts['WRBTC'], '0x7BE508451Cd748Ba55dcBE75c8067f9420909b49')
    #readLoan('0xb2bbd9135a7cfbc5adda48e90430923108ad6358418b7ac27c9edcf2d44911e5')
    # replaceLoanClosings()
    
    #logicContract = acct.deploy(LoanTokenLogicStandard)
    #print('new LoanTokenLogicStandard contract for iDoC:' + logicContract.address)
    #replaceLoanTokenLogic(contracts['iDOC'],logicContract.address)
    #replaceLoanTokenLogic(contracts['iUSDT'],'0x2d4F27e9F82d315c389E5290D94dbA062993e40a')
    #replaceLoanTokenLogic(contracts['iBPro'],'0x2d4F27e9F82d315c389E5290D94dbA062993e40a')
    #logicContract = acct.deploy(LoanTokenLogicWrbtc)
    #print('new LoanTokenLogicStandard contract for iWRBTC:' + logicContract.address)
    #replaceLoanTokenLogic(contracts['iRBTC'], logicContract.address)

    # governorAcceptAdmin("governorOwner")
    # governorAcceptAdmin("governorAdmin")

    # governorAcceptAdmin("governor")

    # prepareProposalData()
    createProposalStartSale()
    # createProposalCloseSale()

def loadConfig():
    global contracts, acct
    this_network = network.show_active()
    if this_network == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif this_network == "testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    contracts = json.load(configFile)
    acct = accounts.load("rskdeployer")
    #acct = accounts.load("jamie")
    #acct = accounts.load("danazix")



    
def readLendingFee():
    sovryn = Contract.from_abi("sovryn", address='0xBAC609F5C8bb796Fa5A31002f12aaF24B7c35818', abi=interface.ISovryn.abi, owner=acct)
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
    token.approve(loanToken, amount) 
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
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovryn.abi, owner=acct)
    print(sovryn.getLoan(loanId).dict())

def getTokenPrice(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    print("token price",loanToken.tokenPrice())
    
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
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
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
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    if(sendValue == 0 and testToken.allowance(acct, loanTokenAddress) < loanTokenSent):
        testToken.approve(loanToken, loanTokenSent)
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


def testBorrow(protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress):
    #read contract abis
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    testToken = Contract.from_abi("TestToken", address = collateralTokenAddress, abi = TestToken.abi, owner = acct)
    
    # determine borrowing parameter
    withdrawAmount = 10e18 #i want to borrow 10 USD
    # compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan 
    collateralTokenSent = sovryn.getRequiredCollateral(underlyingTokenAddress,collateralTokenAddress,withdrawAmount,50e18, True)
    print("collateral needed", collateralTokenSent)
    durationInSeconds = 60*60*24*10 #10 days
    
    #check requirements
    totalSupply = loanToken.totalSupply()
    totalBorrowed = loanToken.totalAssetBorrow()
    print('available supply:', totalSupply - totalBorrowed)
    assert(totalSupply - totalBorrowed >= withdrawAmount)
    interestRate = loanToken.nextBorrowInterestRate(withdrawAmount)
    print('interest rate (needs to be > 0):', interestRate)
    assert(interestRate > 0)
    
    
    #approve the transfer of the collateral if needed
    if(testToken.allowance(acct, loanToken.address) < collateralTokenSent):
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
        b''                             # bytes memory loanDataBytes
    )
    
    #assert the trade was processed as expected
    print(tx.info())
    
def setupTorqueLoanParams(loanTokenAddress, underlyingTokenAddress, collateralTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    setup = [
        b"0x0", ## id
        False, ## active
        str(accounts[0]), ## owner
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
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovryn.abi, owner=acct)
    tx = sovryn.rollover(loanId, b'')
    print(tx.info())
    
def replaceLoanClosings():
    sovryn = Contract.from_abi("sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovryn.abi, owner=acct)
    data = sovryn.replaceContract.encode_input(loanClosings.address)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(sovryn.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);
    
def transferOwner(contractAddress, newOwner):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=acct)
    contract.transferOwnership(newOwner)
    
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
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    tx = localLoanToken.setTransactionLimits(addresses,limits)

    
def readTransactionLimits(loanTokenAddress, SUSD, RBTC):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=accounts[0])
    limit = localLoanToken.transactionLimit(RBTC)
    print("RBTC limit, ",limit)
    limit = localLoanToken.transactionLimit(SUSD)
    print("USD limit, ",limit)
    
def readLiquidity():
    loanToken = Contract.from_abi("loanToken", address=contracts['iRBTC'], abi=LoanTokenLogicStandard.abi, owner=acct)
    tasRBTC = loanToken.totalAssetSupply()
    tabRBTC = loanToken.totalAssetBorrow()
    print("liquidity on iRBTC", (tasRBTC-tabRBTC)/1e18)
    
    loanToken = Contract.from_abi("loanToken", address=contracts['iDOC'], abi=LoanTokenLogicStandard.abi, owner=acct)
    tasIUSD = loanToken.totalAssetSupply()
    tabIUSD = loanToken.totalAssetBorrow()
    print("liquidity on iSUSD", (tasIUSD-tabIUSD)/1e18)
    
    tokenContract = Contract.from_abi("Token", address=contracts['DoC'], abi=TestToken.abi, owner=acct)
    bal = tokenContract.balanceOf(contracts['swap'])
    print("supply of DoC on swap", bal/1e18)
    
    tokenContract = Contract.from_abi("Token", address=contracts['WRBTC'], abi=TestToken.abi, owner=acct)
    bal = tokenContract.balanceOf(contracts['swap'])
    print("supply of rBTC on swap", bal/1e18)
    

def hasApproval(tokenContractAddr, sender, receiver):
    tokenContract = Contract.from_abi("Token", address=tokenContractAddr, abi=TestToken.abi, owner=sender)
    allowance = tokenContract.allowance(sender, receiver)
    print("allowance: ", allowance/1e18)
    
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
    medianizer = Contract.from_abi("Medianizer", address='0x26a00aF444928d689DDEC7b4D17c0E4a8c9D407d', abi=PriceFeedsMoCMockup.abi, owner=acct)
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

def governorAcceptAdmin(type):
    governor = Contract.from_abi("GovernorAlphaComp", address=contracts[type], abi=GovernorAlphaComp.abi, owner=acct)
    data = governor.__acceptAdmin.encode_input()
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(governor.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def prepareProposalData():
    # [proposal 1]
    # governorTokensHolder = Contract.from_abi("GovernorTokensHolder", address=contracts['GovernorTokensHolder'], abi=GovernorTokensHolder.abi, owner=acct)
    # data = governorTokensHolder.transfer.encode_input("0xad21b3040350e3f29864f95ec6401e52f83363a2", 5000000000000000000000000)
    # print(data)

    # [proposal 2]
    # multiSigKeyHolders = Contract.from_abi("MultiSigKeyHolders", address=contracts['MultiSigKeyHolders'], abi=MultiSigKeyHolders.abi, owner=acct)
    #
    # data = multiSigKeyHolders.changeEthereumRequirement.encode_input(3)
    # print(data)
    #
    # data = multiSigKeyHolders.changeBitcoinRequirement.encode_input(4)
    # print(data)
    #
    # data = multiSigKeyHolders.addEthereumAddress.encode_input("0x27d55f5668ef4438635bdce0adca083507e77752")
    # print(data)
    #
    # data = multiSigKeyHolders.addBitcoinAddress.encode_input("bc1q9gl8ddnkr0xr5d9vefnkwyd3g8fpjsp8z8l7zm")
    # print(data)

    # [proposal 3]
    # multiSigKeyHolders = Contract.from_abi("MultiSigKeyHolders", address=contracts['MultiSigKeyHolders'], abi=MultiSigKeyHolders.abi, owner=acct)
    #
    # data = multiSigKeyHolders.addEthereumAndBitcoinAddresses.encode_input(["0xad21b3040350e3f29864f95ec6401e52f83363a2", "0x08142bf7841d89dd1e6c12bc1a8bd972419db435"], ["37S6qsjzw14MH9SFt7PmsBchobkRE6SxNP", "37S6qsjzw14MH9SFt7PmsBchobkRE6SxN3"])
    # print(data)

    # [proposal 4]
    # multiSigKeyHolders = Contract.from_abi("MultiSigKeyHolders", address=contracts['MultiSigKeyHolders'], abi=MultiSigKeyHolders.abi, owner=acct)
    #
    # data = multiSigKeyHolders.changeEthereumRequirement.encode_input(3)
    # print(data)

    # [proposal 5]
    # multiSigKeyHolders = Contract.from_abi("MultiSigKeyHolders", address=contracts['MultiSigKeyHolders'], abi=MultiSigKeyHolders.abi, owner=acct)
    #
    # data = multiSigKeyHolders.changeEthereumRequirement.encode_input(4)
    # print(data)

    # [proposal 6]
    # multiSigKeyHolders = Contract.from_abi("MultiSigKeyHolders", address=contracts['MultiSigKeyHolders'], abi=MultiSigKeyHolders.abi, owner=acct)
    #
    # data = multiSigKeyHolders.addEthereumAndBitcoinAddresses.encode_input(["0xAdfDF3055136356a34256809c79a8cb0a99A7a86", "0x8a52CDB3e99634e2638a3DCe1A0388EDB7A32c11"], ["37S6qsjzw14MH9SFt7PmsBchobkRE6SxN4", "37S6qsjzw14MH9SFt7PmsBchobkRE6SxN5"])
    # print(data)

    # [proposal 7]
    # governorVault = Contract.from_abi("GovernorVault", address=contracts['governorVault'], abi=GovernorVault.abi, owner=acct)
    #
    # data = governorVault.transferTokens.encode_input("0x5603e46fb0bc18c5e77a769d06166ba0348ecc0b", "0xAdfDF3055136356a34256809c79a8cb0a99A7a86", 1000000000000000000000000)
    # print(data)

    # # [proposal 8]
    # governorVault = Contract.from_abi("GovernorVault", address=contracts['governorVault'], abi=GovernorVault.abi, owner=acct)
    #
    # data = governorVault.transferRbtc.encode_input("0x5603e46fb0bc18c5e77a769d06166ba0348ecc0b", 10000000000000000)
    # print(data)

    # # [proposal 9]
    # # Timelock SC call to CSOV SC (on 0x75071030A635D3073a76b9F4370B72763b2De0a3):
    # # setSaleAdmin("0x12f7140A8856F03816Dc934f9716483CE0a9C7eB")
    # governorVault = Contract.from_abi("GovernorVault", address=contracts['governorVault'], abi=GovernorVault.abi, owner=acct)
    #
    # data = governorVault.setSaleAdmin.encode_input("0x3c886dC89808dF2FFEd295c8d0AE6Bdb4fE38CC5")
    # print(data)

    # # [proposal 10]
    # # crowdsale.start(86400, 33333, 1000000000000000, 2000000000000000000000000);
    # # to crowdsale contract on: 0x12f7140A8856F03816Dc934f9716483CE0a9C7eB
    # governorVault = Contract.from_abi("GovernorVault", address=contracts['governorVault'], abi=GovernorVault.abi, owner=acct)
    #
    # data = governorVault.start.encode_input(86400, 33333, 1000000000000000, 2000000000000000000000000)
    # print(data)

    # [proposal 11]
    governor = Contract.from_abi("GovernorAlphaComp", address=contracts['governor'], abi=GovernorAlphaComp.abi, owner=acct)

    governor.propose(
        ["0x75bbf7f4d77777730eE35b94881B898113a93124","0x3c886dC89808dF2FFEd295c8d0AE6Bdb4fE38CC5"],
        [0,0],
        ["setSaleAdmin(address)", "start(uint256,uint256,uint256,uint256)"],
        ["0x0000000000000000000000003c886dc89808df2ffed295c8d0ae6bdb4fe38cc5","0x0000000000000000000000000000000000000000000000000000000000015180000000000000000000000000000000000000000000000000000000000000823500000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000001a784379d99db42000000"],
        "Set sale admin and start crowd sale (rate = 33333)")

def createProposalStartSale():

    cSOV = contracts['cSOV']
    crowdsale = contracts['crowdsale']

    # dummy contract, just for encoding function calls
    dummyAddress = contracts['governor']
    dummyContract = Contract.from_abi("CrowdSaleMethods", address=dummyAddress, abi=CrowdSaleMethods.abi, owner=acct)

    # first action
    target1 = cSOV
    signature1 = "setSaleAdmin(address)"
    data1 = dummyContract.setSaleAdmin.encode_input(crowdsale)
    data1 = "0x" + data1[10:]
    print(data1)

    # second action
    target2 = crowdsale
    signature2 = "start(uint256,uint256,uint256,uint256)"
    data2 = dummyContract.start.encode_input(86400, 33333, 1000000000000000, 2000000000000000000000000)
    data2 = "0x" + data2[10:]
    print(data2)

    # create proposal
    governor = Contract.from_abi("GovernorAlphaComp", address=contracts['governor'], abi=GovernorAlphaComp.abi, owner=acct)
    governor.propose(
        [target1, target2],
        [0, 0],
        [signature1, signature2],
        [data1, data2],
        "Set sale admin and start crowd sale")

# CrowdSale.saleClosure(true), CrowdSale.withdrawFunds()
def createProposalCloseSale():

    cSOV = contracts['cSOV']
    crowdsale = contracts['crowdsale']

    # dummy contract, just for encoding function calls
    dummyAddress = contracts['governor']
    dummyContract = Contract.from_abi("CrowdSaleMethods", address=dummyAddress, abi=CrowdSaleMethods.abi, owner=acct)

    # first action
    target1 = crowdsale
    signature1 = "saleClosure(bool)"
    data1 = dummyContract.saleClosure.encode_input(True)
    data1 = "0x" + data1[10:]
    print(data1)

    # second action
    target2 = crowdsale
    signature2 = "withdrawFunds()"
    data2 = dummyContract.withdrawFunds.encode_input()
    data2 = "0x" + data2[10:]
    # data2 = "" #second variant
    print(data2)

    # create proposal
    governor = Contract.from_abi("GovernorAlphaComp", address=contracts['governor'], abi=GovernorAlphaComp.abi, owner=acct)
    governor.propose(
        [target1, target2],
        [0, 0],
        [signature1, signature2],
        [data1, data2],
        "Close sale")
