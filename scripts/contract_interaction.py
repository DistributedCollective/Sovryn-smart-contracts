'''
This script serves the purpose of interacting with existing smart contracts on the testnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer


def main():
    acct = accounts.load("rskdeployer")
    iSUSD = '0xC6Aa9E9C18021Db79eDa87a8E58dD3c146A6b1E5'
    iRBTC = '0xc4F9857B4bb568C10aD68C092D058Fc8d36Ce4b0'
    iSUSDSettings = '0x588F22EaeEe37d9BD0174de8e76df9b69D3Ee4eC'
    iRBTCSettings = '0x99DcD929027a307D76d5ca912Eec1C0aE3FA6DDF'
    iSUSDLogic = '0x48f96e4e8adb8db5B70538b58DaDE4a89E2F9DF0'
    iRBTCLogic = '0xCA27bC90C76fc582406fBC4665832753f74A75F5'
    protocol = '0xBAC609F5C8bb796Fa5A31002f12aaF24B7c35818'
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
    readLoan(acct, protocol, '0xde1821f5678c33ca4007474735d910c0b6bb14f3fa0734447a9bd7b75eaf68ae')

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
    bzx = Contract.from_abi("bzx", address='0xBAC609F5C8bb796Fa5A31002f12aaF24B7c35818', abi=interface.IBZx.abi, owner=acct)
    lfp = bzx.lendingFeePercent()
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
    bzx = Contract.from_abi("bzx", address=protocolAddress, abi=interface.IBZx.abi, owner=acct)
    print(bzx.getLoan(loanId).dict())

