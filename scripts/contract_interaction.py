
'''
This script serves the purpose of interacting with existing smart contracts on the testnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer


def main():
    acct = accounts.load("rskdeployer")
    iSUSD = '0xd8D25f03EBbA94E15Df2eD4d6D38276B595593c1'
    iRBTC = '0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A'
    iSUSDSettings = '0x63995507b895129CfFd8974Cd3441fFf9d189E9C'
    iRBTCSettings = '0x0E0E9F3AbCCa53D62d1721470B9dA8C89709960E'
    iSUSDLogic = '0x2D67011e11f5aF05B1ffA5D1F91E3494D42c60bB'
    iRBTCLogic = '0x1BDF90374B20ed4690c577656EC00F09f25EFe79'
    protocol = '0x6E2fb26a60dA535732F8149b25018C9c0823a715'
    SUSD = '0xe700691da7b9851f2f35f8b8182c69c53ccad9db'
    RBTC ='0x542fDA317318eBF1d3DEAf76E0b632741A7e677d'
    swap = '0xd715192612F03D20BaE53a5054aF530C9Bb0fA3f'
    eat = '0x81d25201D044f178883599Be1934FF53FDA98acD'
    #setPriceFeeds(acct)
    #mintTokens(acct, iSUSD, iRBTC)
    #burnTokens(acct, iSUSD, iRBTC)
    #readLendingFee(acct)
    #setupLoanTokenRates(acct, iSUSD, iSUSDSettings, iSUSDLogic)
    #setupLoanTokenRates(acct, iRBTC, iRBTCSettings, iRBTCLogic)
    #lendToPools(acct, iSUSD, iRBTC)
    #removeFromPool(acct, iSUSD, iRBTC)
    #print('iSUSD:')
    #readLoanTokenState(acct, iSUSD)
    #print('iRBTC:')
    #readLoanTokenState(acct, iRBTC)
    #readLoan(acct, protocol, '0xde1821f5678c33ca4007474735d910c0b6bb14f3fa0734447a9bd7b75eaf68ae')
    #getTokenPrice(acct, iRBTC)
    #testTokenBurning(acct, iRBTC, testRBTC)
    #liquidate(acct, protocol, '0x5f8d4599657b3d24eb4fee83974a43c62f411383a8b5750b51adca63058a0f59')
    #testTradeOpeningAndClosing(acct, protocol,iSUSD,testSUSD,testRBTC)
    #testBorrow(acct,protocol,iSUSD,testSUSD,testRBTC)
    #setupTorqueLoanParams(acct,iSUSD,iSUSDSettings,testSUSD,testRBTC)
    #rollover(acct, protocol, '0xe87b69a7ce05978fa8822f412b7df567cd641e77dbd99a023baf5193950c7678')
    #replaceLoanClosings(acct, protocol)
    #transferOwner(acct, iRBTC, '0x55310E0bC1A85bB24Ec7798a673a69Ba254B6Bbf')
    #transferOwner(acct, '0xf61F1AefAd2a6642fd7B234974B4E15E0Db608d9', '0x417621fC0035893FDcD5dd09CaF2f081345bfB5C')
    #print('WRBTC balannce')
    #getBalance(acct, testRBTC)
    #buyWRBTC(acct, testRBTC)
    #mintEarlyAccessTokens(acct, '0xC5452Dbb2E3956C1161cB9C2d6DB53C2b60E7805', '0xea2E5564Ef5489d7BC5d82cb45249fefFA947E70')
    #mintEarlyAccessTokens(acct, '0xf61F1AefAd2a6642fd7B234974B4E15E0Db608d9', '0x65299AddC002DD792797288eE6599772D20970Da')
    #setTransactionLimits(acct, iSUSD, iSUSDSettings, iSUSDLogic, [SUSD, RBTC],[21e18, 0.0021e18])
    #setTransactionLimits(acct, iRBTC, iRBTCSettings, iRBTCLogic, [SUSD, RBTC],[21e18, 0.0021e18])
    #readTransactionLimits(acct, '0x74e00A8CeDdC752074aad367785bFae7034ed89f', '0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0', '0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab')
    #setTransactionLimits(acct, '0x74e00A8CeDdC752074aad367785bFae7034ed89f', '0x4a1083Fd25e5341C26a0fd3E074D840D90d542aB', '0xb149a12667e65E3b71a7928c5D5fc5689a7539Be', ['0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0', '0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab'],[0, 0])
    #setTransactionLimits(acct, '0xe67Fe227e0504e8e96A34C3594795756dC26e14B', '0x22A632aEF3687eC41D2e4522c975D666839AFDF7', '0x032d333201F9DdE42505798350deB19E6c796acd', ['0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0', '0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab'],[21e18, 0.0021e18])

    #readTransactionLimits(acct, '0x74e00A8CeDdC752074aad367785bFae7034ed89f', '0xCB46c0ddc60D18eFEB0E586C17Af6ea36452Dae0', '0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab')
    #readLiquidity(acct, iRBTC, iSUSD, SUSD, RBTC, swap)
    #readTransactionLimits(acct, iSUSD, SUSD, RBTC)
    #readTransactionLimits(acct, iRBTC, SUSD, RBTC)
    #hasApproval(SUSD, '0x7E56e5039f32Af2a4A8aC2804f1E808944AD9857', iRBTC)
    #checkIfUserHasToken(eat, '0x7E56e5039f32Af2a4A8aC2804f1E808944AD9857')
    #readLendingBalanceForUser(iSUSD, acct)
    #readLendingBalanceForUser(iRBTC, acct)
    #replaceLoanTokenLogic(acct, '0xe67Fe227e0504e8e96A34C3594795756dC26e14B', '0x032d333201F9DdE42505798350deB19E6c796acd')
    #replaceLoanTokenLogic(acct, '0x74e00A8CeDdC752074aad367785bFae7034ed89f', '0xb149a12667e65E3b71a7928c5D5fc5689a7539Be')
    
    readOwner(acct, '0xd715192612F03D20BaE53a5054aF530C9Bb0fA3f')

def setPriceFeeds(acct):
    priceFeedContract = '0xf2e9fD37912aB53D0FEC1eaCE86d6A14346Fb6dD'
    wethAddress = '0x602C71e4DAC47a042Ee7f46E0aee17F94A3bA0B6'
    rbtcAddress ='0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F'
    susdAddress = '0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E'
    feeds = Contract.from_abi("PriceFeedsLocal", address=priceFeedContract, abi=PriceFeedsLocal.abi, owner=acct)
    feeds.setRates(
        wethAddress,
        rbtcAddress,
        0.34e18
    )
    feeds.setRates(
        wethAddress,
        susdAddress,
        382e18
    )
    
def mintTokens(acct, iSUSD, iRBTC):
    susd = Contract.from_abi("TestToken", address = '0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E', abi = TestToken.abi, owner = acct)
    rbtc = Contract.from_abi("TestToken", address = '0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F', abi = TestToken.abi, owner = acct)
    susd.mint(iSUSD,1e50) 
    rbtc.mint(iRBTC,1e50) 
    
def burnTokens(acct, iSUSD, iRBTC):
    susd = Contract.from_abi("TestToken", address = '0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E', abi = TestToken.abi, owner = acct)
    rbtc = Contract.from_abi("TestToken", address = '0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F', abi = TestToken.abi, owner = acct)
    #susd.burn(iSUSD,1e50) 
    rbtc.burn(iRBTC,1e50) 
    
def readLendingFee(acct):
    sovryn = Contract.from_abi("sovryn", address='0xBAC609F5C8bb796Fa5A31002f12aaF24B7c35818', abi=interface.ISovryn.abi, owner=acct)
    lfp = sovryn.lendingFeePercent()
    print(lfp/1e18)
    
def setupLoanTokenRates(acct, loanTokenAddress, settingsAddress, logicAddress):
    baseRate = 1e18
    rateMultiplier = 20.25e18
    targetLevel=80*10**18
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
    
def lendToPools(acct, iSUSDaddress, iRBTCaddress):
    susd = Contract.from_abi("TestToken", address = '0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E', abi = TestToken.abi, owner = acct)
    rbtc = Contract.from_abi("TestToken", address = '0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F', abi = TestToken.abi, owner = acct)
    iSUSD = Contract.from_abi("loanToken", address=iSUSDaddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    iRBTC = Contract.from_abi("loanToken", address=iRBTCaddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    susd.approve(iSUSD,1e40) 
    rbtc.approve(iRBTC,1e40)
    iSUSD.mint(acct, 1e30)
    iRBTC.mint(acct, 1e30)
    
def removeFromPool(acct, iSUSDaddress, iRBTCaddress):
    susd = Contract.from_abi("TestToken", address = '0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E', abi = TestToken.abi, owner = acct)
    rbtc = Contract.from_abi("TestToken", address = '0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F', abi = TestToken.abi, owner = acct)
    iSUSD = Contract.from_abi("loanToken", address=iSUSDaddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    iRBTC = Contract.from_abi("loanToken", address=iRBTCaddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    iSUSD.burn(acct, 99e28)
    iRBTC.burn(acct, 99e28)
    
def readLoanTokenState(acct, loanTokenAddress):
    '''
    susd = Contract.from_abi("TestToken", address = '0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E', abi = TestToken.abi, owner = acct)
    balance = susd.balanceOf(loanTokenAddress)
    print("contract susd balance", balance/1e18)
    '''
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
    
def readLoan(acct, protocolAddress, loanId):
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    print(sovryn.getLoan(loanId).dict())

def getTokenPrice(acct, loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    print("token price",loanToken.tokenPrice())
    
def testTokenBurning(acct, loanTokenAddress, testTokenAddress):
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
    
def liquidate(acct, protocolAddress, loanId):
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    loan = sovryn.getLoan(loanId).dict()
    print(loan)
    if(loan['maintenanceMargin'] > loan['currentMargin']):
        testToken = Contract.from_abi("TestToken", address = loan['loanToken'], abi = TestToken.abi, owner = acct)
        testToken.mint(acct, loan['maxLiquidatable'])
        testToken.approve(sovryn, loan['maxLiquidatable'])
        sovryn.liquidate(loanId, acct, loan['maxLiquidatable'])
    else:
        print("can't liquidate because the loan is healthy")
    
def testTradeOpeningAndClosing(acct, protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    testToken = Contract.from_abi("TestToken", address = underlyingTokenAddress, abi = TestToken.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    loan_token_sent = 100e18
    testToken.mint(acct, loan_token_sent)
    testToken.approve(loanToken, loan_token_sent)
    tx = loanToken.marginTrade(
        "0",  # loanId  (0 for new loans)
        2e18,  # leverageAmount
        loan_token_sent,  # loanTokenSent
        0,  # no collateral token sent
        collateralTokenAddress,  # collateralTokenAddress
        acct,  # trader,
        b''  # loanDataBytes (only required with ether)
    )
    loanId = tx.events['Trade']['loanId']
    collateral = tx.events['Trade']['positionSize']
    print("closing loan with id", loanId)
    print("position size is ", collateral)
    loan = sovryn.getLoan(loanId)
    print("found the loan in storage with position size", loan['collateral'])
    tx = sovryn.closeWithSwap(loanId, acct, collateral, True, b'')


def testBorrow(acct, protocolAddress, loanTokenAddress, underlyingTokenAddress, collateralTokenAddress):
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
    
def setupTorqueLoanParams(acct, loanTokenAddress, loanTokenSettingsAddress, underlyingTokenAddress, collateralTokenAddress):
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
    
def rollover(acct, protocolAddress, loanId):
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    tx = sovryn.rollover(loanId, b'')
    print(tx.info())
    
def replaceLoanClosings(acct, protocolAddress):
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    loanClosings = acct.deploy(LoanClosings)
    sovryn.replaceContract(loanClosings.address)
    
def transferOwner(acct, contractAddress, newOwner):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=acct)
    contract.transferOwnership(newOwner)
    
def getBalance(acct, contractAddress):
    contract = Contract.from_abi("Token", address=contractAddress, abi=LoanToken.abi, owner=acct)
    print(contract.balanceOf(acct))
    
def buyWRBTC(acct, contractAddress):
    contract = Contract.from_abi("WRBTC", address=contractAddress, abi=WRBTC.abi, owner=acct)
    tx = contract.deposit({'value':1e17})
    tx.info()
    getBalance(acct, contractAddress)
    
def mintEarlyAccessTokens(acct, contractAddress, userAddress):
    contract = Contract.from_abi("EarlyAccessToken", address=contractAddress, abi=EarlyAccessToken.abi, owner=acct)
    tx = contract.mint(userAddress)
    tx.info()
    
def setTransactionLimits(acct, loanTokenAddress, settingsAddress, logicAddress, addresses, limits):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(settingsAddress)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=accounts[0])
    tx = localLoanToken.setTransactionLimits(addresses,limits)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(logicAddress)
    
def readTransactionLimits(acct, loanTokenAddress, SUSD, RBTC):
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=accounts[0])
    limit = localLoanToken.transactionLimit(RBTC)
    print("RBTC limit, ",limit)
    limit = localLoanToken.transactionLimit(SUSD)
    print("USD limit, ",limit)
    
def readLiquidity(acct, iRBTC, iSUSD, SUSD, RBTC, swap):
    loanToken = Contract.from_abi("loanToken", address=iRBTC, abi=LoanTokenLogicStandard.abi, owner=acct)
    tasRBTC = loanToken.totalAssetSupply()
    print("suppy on iRBTC", tasRBTC/1e18)
    
    loanToken = Contract.from_abi("loanToken", address=iSUSD, abi=LoanTokenLogicStandard.abi, owner=acct)
    tasIUSD = loanToken.totalAssetSupply()
    print("suppy on iSUSD", tasIUSD/1e18)
    
    tokenContract = Contract.from_abi("Token", address=SUSD, abi=TestToken.abi, owner=acct)
    bal = tokenContract.balanceOf(swap)
    print("supply of DoC on swap", bal/1e18)
    
    tokenContract = Contract.from_abi("Token", address=RBTC, abi=TestToken.abi, owner=acct)
    bal = tokenContract.balanceOf(swap)
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
    
def replaceLoanTokenLogic(acct, loanTokenAddress, logicAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    loanToken.setTarget(logicAddress)
    
def readOwner(acct, contractAddress):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=acct)
    print('owner:',contract.owner())