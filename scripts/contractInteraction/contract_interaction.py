
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()
    #call the function you want here
    #setupMarginLoanParams(contracts['WRBTC'], contracts['iDOCSettings'], contracts['iDOC'])
    #testTradeOpeningAndClosing(contracts['protocol'], contracts['iDOC'], contracts['DoC'], contracts['WRBTC'], 1e18, 5e18, False, 0)
    #setupMarginLoanParams(contracts['DoC'], contracts['iRBTCSettings'], contracts['iRBTC'])
    #testTradeOpeningAndClosing(contracts['protocol'], contracts['iRBTC'], contracts['WRBTC'], contracts['DoC'], 1e14, 5e18, True, 1e14)
    
    #swapTokens(0.02e18,200e18, contracts['swapNetwork'], contracts['WRBTC'], contracts['DoC'])
    #swapTokens(300e18, 0.02e18, contracts['swapNetwork'], contracts['DoC'], contracts['WRBTC'])
    #liquidate(contracts['protocol'], '0xc9b8227bcf953e45f16d5d9a8a74cad92f403b90d0daf00900bb02e4a35c542c')
    #readLiquidity()
    #getBalance(contracts['WRBTC'], '0xE5646fEAf7f728C12EcB34D14b4396Ab94174827')
    #getBalance(contracts['WRBTC'], '0x7BE508451Cd748Ba55dcBE75c8067f9420909b49')
    #readLoan('0x7a1a62ab774c288a231d9bb3ed524d2a5c665c848d8db56b6e97d3dac503b9a3')
    #replaceLoanClosings()
    #getExpectedReturn(50e18,  contracts['swapNetwork'], contracts['DoC'], contracts['WRBTC'])
    
    #logicContract = acct.deploy(LoanTokenLogicStandard)
    #print('new LoanTokenLogicStandard contract for iDoC:' + logicContract.address)
    #replaceLoanTokenLogic(contracts['iDOC'],logicContract.address)
    #logicContract = acct.deploy(LoanTokenLogicWrbtc)
    #print('new LoanTokenLogicStandard contract for iWRBTC:' + logicContract.address)
    #replaceLoanTokenLogic(contracts['iRBTC'], logicContract.address)
    #setupLoanTokenRates(contracts['iRBTC'], contracts['iRBTCSettings'], contracts['iRBTCLogic'])
    #setupLoanTokenRates(contracts['iDOC'], contracts['iDOCSettings'], contracts['iDOCLogic'])
    
    #getBalance('0xC5452Dbb2E3956C1161cB9C2d6DB53C2b60E7805', acct)
    #getAllowance('0x7F433CC76298bB5099c15C1C7C8f2e89A8370111',acct ,'0xbFDB5fc90b960bcc2e7be2D8E347F8A7E5146077')
    #print('iRBTC')
    #readLoanTokenState(contracts['iRBTC'])
    #print('iDOC')
    #readLoanTokenState(contracts['iDOC'])
    #for i in range(8):
    #    setProtocolTokenAddressWithMultisig()
    #extendDuration()
    #stake('0x55310E0bC1A85bB24Ec7798a673a69Ba254B6Bbf')
    #readPriorVotes(acct)
    #makeGovernanceProposal()
    #confirmMultisigTransaction(0)
    #transferTokens(contracts['SOV'], '0x2bD2201bfe156a71EB0d02837172FFc237218505', 500000e18)
    changeMultisigOwner('0x33EC0Bc1Bc29fdC868e0918983227637Da654c4C')

    
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
    
def setupLoanTokenRates(loanTokenAddress, settingsAddress, logicAddress):
    baseRate = 1e18
    rateMultiplier = 10e18
    targetLevel=0
    kinkLevel=90*10**18
    maxScaleRate=100*10**18
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    localLoanToken.setTarget(settingsAddress)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)
    localLoanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier, targetLevel, kinkLevel, maxScaleRate)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    localLoanToken.setTarget(logicAddress)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
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
    sovryn = Contract.from_abi("sovryn", address=contracts['protocol'], abi=interface.ISovryn.abi, owner=acct)
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
    
def setupTorqueLoanParams(loanTokenAddress, loanTokenSettingsAddress, underlyingTokenAddress, collateralTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    loanTokenSettings = Contract.from_abi("loanTokenSettings", address=loanTokenSettingsAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)
    params = [];
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
    calldata = loanTokenSettings.setupLoanParams.encode_input(params, True)
    tx = loanToken.updateSettings(loanTokenSettings.address, calldata)
    assert('LoanParamsSetup' in tx.events)
    assert('LoanParamsIdSetup' in tx.events)
    print(tx.info())
    
def rollover(loanId):
    sovryn = Contract.from_abi("sovryn", address=contracts['protocol'], abi=interface.ISovryn.abi, owner=acct)
    tx = sovryn.rollover(loanId, b'')
    print(tx.info())
    
def replaceLoanClosings():
    sovryn = Contract.from_abi("sovryn", address=contracts['protocol'], abi=interface.ISovryn.abi, owner=acct)
    loanClosings = acct.deploy(LoanClosings)
    sovryn.replaceContract(loanClosings.address)
    
def transferOwner(contractAddress, newOwner):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=acct)
    contract.transferOwnership(newOwner)
    
def getBalance(contractAddress, acct):
    contract = Contract.from_abi("Token", address=contractAddress, abi=LoanToken.abi, owner=acct)
    print(contract.balanceOf(acct))
    
def buyWRBTC(contractAddress):
    contract = Contract.from_abi("WRBTC", address=contractAddress, abi=WRBTC.abi, owner=acct)
    tx = contract.deposit({'value':1e17})
    tx.info()
    getBalance(acct, contractAddress)
    
def mintEarlyAccessTokens(contractAddress, userAddress):
    contract = Contract.from_abi("EarlyAccessToken", address=contractAddress, abi=EarlyAccessToken.abi, owner=acct)
    tx = contract.mint(userAddress)
    tx.info()
    
def setTransactionLimits(loanTokenAddress, settingsAddress, logicAddress, addresses, limits):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(settingsAddress)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    tx = localLoanToken.setTransactionLimits(addresses,limits)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(logicAddress)
    
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
    
def setupMarginLoanParams(collateralTokenAddress, loanTokenSettingsAddress, loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    loanTokenSettings = Contract.from_abi("loanTokenSettings", address=loanTokenSettingsAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)

    params = [];
    setup = [
        b"0x0", ## id
        False, ## active
        acct, ## owner
        "0x0000000000000000000000000000000000000000", ## loanToken -> will be overwritten
        collateralTokenAddress, ## collateralToken.
        Wei("8.001 ether"), ## minInitialMargin
        Wei("8 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm -> will be overwritten
    ]
    params.append(setup)
    calldata = loanTokenSettings.setupLoanParams.encode_input(params, False)
    tx = loanToken.updateSettings(loanTokenSettings.address, calldata)
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
    
def getExpectedReturn(amount, swapNetworkAddress, sourceTokenAddress, destTokenAddress):
    abiFile =  open('./scripts/contractInteraction/SovrynSwapNetwork.json')
    abi = json.load(abiFile)
    swapNetwork = Contract.from_abi("SovrynSwapNetwork", address=swapNetworkAddress, abi=abi, owner=acct)
    path = swapNetwork.conversionPath(sourceTokenAddress,destTokenAddress)
    print("path", path)
    expectedReturn = swapNetwork.getReturnByPath(path, amount)
    print("expected return on AMM", expectedReturn)
    
    #priceFeed = Contract.from_abi("PriceFeeds", address=priceAddress, abi=PriceFeeds.abi, owner=acct)
    #priceFeed.queryReturn(sourceTokenAddress, destTokenAddress, amount)
    
def getAllowance(contractAddress, fromAddress, toAddress):
    contract = Contract.from_abi("Token", address=contractAddress, abi=TestToken.abi, owner=acct)
    print(contract.allowance(fromAddress,toAddress))
    
def setProtocolTokenAddressWithMultisig():
    sovryn = Contract.from_abi("sovryn", address=contracts['protocol'], abi=interface.ISovryn.abi, owner=acct)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)

    dest = sovryn.address
    val = 0
    data = sovryn.setProtocolTokenAddress.encode_input(sovryn.address)
    
    tx = multisig.submitTransaction(dest,val,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId);
    
def confirmMultisigTransaction(txId):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.confirmTransaction(txId)

def changeMultisigOwner(newOwner):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    
    
def stake(stakeFor):
    governor = Contract.from_abi("Governor", address=contracts['governor'], abi=GovernorAlpha.abi, owner=acct)
    staking = Contract.from_abi("Staking", address=contracts['staking'], abi=Staking.abi, owner=acct)
    SOV = Contract.from_abi("SOV", address=contracts['SOV'], abi=TestToken.abi, owner=acct)
    quorom = governor.quorumVotes()
    #SOV.approve(staking.address, quorom)
    staking.stake(quorom, 52*14*24*60*60, stakeFor, acct)

    
def increaseStake(amount):
    staking = Contract.from_abi("Staking", address=contracts['staking'], abi=Staking.abi, owner=acct)
    SOV = Contract.from_abi("SOV", address=contracts['SOV'], abi=TestToken.abi, owner=acct)
    SOV.approve(staking.address, amount)
    staking.increaseStake(amount, acct)
    
def extendDuration():
    staking = Contract.from_abi("Staking", address=contracts['staking'], abi=Staking.abi, owner=acct)
    staking.extendStakingDuration(1605189273+14*24*60*60*52)
    
def makeGovernanceProposal():
    governor = Contract.from_abi("Governor", address=contracts['governor'], abi=GovernorAlpha.abi, owner=acct)
    SOV = Contract.from_abi("SOV", address=contracts['SOV'], abi=TestToken.abi, owner=acct)
    
    targets = [contracts['SOV']];
    values = ["0"];
    signatures = ["getBalanceOf(address)"];
    dataString = SOV.balanceOf.encode_input(acct)
    callDatas = [dataString[10:]];
    print(callDatas)
    print(len(callDatas[0]))
    
    governor.propose(targets, values, signatures, callDatas, "do nothing")
    
def readPriorVotes(staker):
    staking = Contract.from_abi("Staking", address=contracts['staking'], abi=Staking.abi, owner=acct)
    blocknumber = 1345568
    time = 1605190732
    print(staking.getPriorVotes(staker, blocknumber, time))
    
def transferTokens(tokenAddress, receiver, amount):
    token = Contract.from_abi("token", address=tokenAddress, abi=TestToken.abi, owner=acct)
    token.transfer(receiver, amount)

