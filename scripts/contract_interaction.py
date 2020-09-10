'''
This script serves the purpose of interacting with existing smart contracts on the testnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer


def main():
    acct = accounts.load("rskdeployer")
    iSUSD = '0xD1A979EDE2c17FCD31800Bed859e5EC3DA178Cb9'
    iRBTC = '0x08118a219a4e34E06176cD0861fcDDB865771111'
    iSUSDSettings = '0x588F22EaeEe37d9BD0174de8e76df9b69D3Ee4eC'
    iRBTCSettings = '0x99DcD929027a307D76d5ca912Eec1C0aE3FA6DDF'
    iSUSDLogic = '0x48f96e4e8adb8db5B70538b58DaDE4a89E2F9DF0'
    iRBTCLogic = '0xCA27bC90C76fc582406fBC4665832753f74A75F5'
    protocol = '0x74808B7a84327c66bA6C3013d06Ed3DD7664b0D4'
    testSUSD = '0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E'
    testRBTC ='0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F'
    #setPriceFeeds(acct)
    #mintTokens(acct, iSUSD, iRBTC)
    #burnTokens(acct, iSUSD, iRBTC)
    #readLendingFee(acct)
    #setupLoanTokenRates(acct, iSUSD, iSUSDSettings, iSUSDLogic)
    #setupLoanTokenRates(acct, iRBTC, iRBTCSettings, iRBTCLogic)
    #lendToPools(acct, iSUSD, iRBTC)
    #removeFromPool(acct, iSUSD, iRBTC)
    #readLoanTokenState(acct, iSUSD)
    #readLoanTokenState(acct, iRBTC)
    #readLoan(acct, protocol, '0xde1821f5678c33ca4007474735d910c0b6bb14f3fa0734447a9bd7b75eaf68ae')
    #getTokenPrice(acct, iRBTC)
    #testTokenBurning(acct, iRBTC, testRBTC)
    #liquidate(acct, protocol, '0x5f8d4599657b3d24eb4fee83974a43c62f411383a8b5750b51adca63058a0f59')
    #testTradeOpeningAndClosing(acct, protocol,iSUSD,testSUSD,testRBTC)
    #testBorrow(acct,protocol,iSUSD,testSUSD,testRBTC)
    #setupTorqueLoanParams(acct,iSUSD,iSUSDSettings,testSUSD,testRBTC)
    rollover(acct, protocol, '0xe87b69a7ce05978fa8822f412b7df567cd641e77dbd99a023baf5193950c7678')
    #replaceLoanClosings(acct, protocol)

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
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    localLoanToken.setTarget(settingsAddress)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)
    localLoanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier)
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
    print("interest rate", ir)
    
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
    calldata = loanTokenSettings.setupTorqueLoanParams.encode_input(params)
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