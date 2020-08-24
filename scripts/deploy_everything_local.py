#!/usr/bin/python3

from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract

import shared
from munch import Munch



def main():
    deployProtocol()
    deployLoanTokens()

def deployProtocol():
    global  sovryn, tokens, constants, addresses, thisNetwork, acct

    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
    
    constants = shared.Constants()

    tokens = Munch()

    print("Deploying sovrynProtocol.")
    sovrynproxy = acct.deploy(sovrynProtocol)
    sovryn = Contract.from_abi("sovryn", address=sovrynproxy.address, abi=interface.ISovryn.abi, owner=acct)
    _add_contract(sovryn)

    
    print("Deploying test tokens.")
    tokens.weth = acct.deploy(TestWeth) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87
    tokens.susd = acct.deploy(TestToken, "SUSD", "SUSD", 18, 1e50)
    tokens.rbtc = acct.deploy(TestToken, "RBTC", "RBTC", 18, 1e50)

    

    print("Deploying PriceFeeds.")
    feeds = acct.deploy(PriceFeedsLocal)
    
    print("Calling setRates.")
    feeds.setRates(
        tokens.rbtc.address,
        tokens.susd.address,
        1e22 #1btc = 10000 susd
    )
    

    print("Deploying Swaps.")
    swaps = acct.deploy(SwapsImplLocal)


    print("Deploying ProtocolSettings.")
    settings = acct.deploy(ProtocolSettings)
    print("Calling replaceContract.")
    sovryn.replaceContract(settings.address)

    print("Calling setPriceFeedContract.")
    sovryn.setPriceFeedContract(
        feeds.address # priceFeeds
    )

    print("Calling setSwapsImplContract.")
    sovryn.setSwapsImplContract(
        swaps.address  # swapsImpl
    )

    sovryn.setFeesController(acct.address)

    ## LoanSettings
    print("Deploying LoanSettings.")
    loanSettings = acct.deploy(LoanSettings)
    print("Calling replaceContract.")
    sovryn.replaceContract(loanSettings.address)

    ## LoanOpenings
    print("Deploying LoanOpenings.")
    loanOpenings = acct.deploy(LoanOpenings)
    print("Calling replaceContract.")
    sovryn.replaceContract(loanOpenings.address)

    ## LoanMaintenance
    print("Deploying LoanMaintenance.")
    loanMaintenance = acct.deploy(LoanMaintenance)
    print("Calling replaceContract.")
    sovryn.replaceContract(loanMaintenance.address)

    ## LoanClosings
    print("Deploying LoanClosings.")
    loanClosings = acct.deploy(LoanClosings)
    print("Calling replaceContract.")
    sovryn.replaceContract(loanClosings.address)


def deployLoanTokens():
    global sovryn, tokens
    print('\n DEPLOYING ISUSD')
    contractAddress = deployLoanToken(tokens.susd.address, "SUSD", "SUSD", tokens.rbtc.address)
    print("initializing the lending pool with some tokens, so we do not run out of funds")
    tokens.susd.mint(contractAddress,1e25) 
    testDeployment(contractAddress, tokens.susd, tokens.rbtc)
    
    print('\n DEPLOYING IRBTC')
    contractAddress = deployLoanToken(tokens.rbtc.address, "RBTC", "RBTC", tokens.susd.address)
    print("initializing the lending pool with some tokens, so we do not run out of funds")
    tokens.rbtc.mint(contractAddress,1e25) 
    testDeployment(contractAddress, tokens.rbtc, tokens.susd)

def deployLoanToken(loanTokenAddress, loanTokenSymbol, loanTokenName, collateralAddress):
    global sovryn, tokens
    
    print("Deploying LoanTokenLogicStandard")
    loanTokenLogic = acct.deploy(LoanTokenLogicStandard)
    _add_contract(loanTokenLogic)

    
    print("Deploying LoanTokenSettingsLowerAdmin for above loan token")
    loanTokenSettings = acct.deploy(LoanTokenSettingsLowerAdmin)
    _add_contract(loanTokenSettings)
    
    print("Deploying loan token using the loan logic as target for delegate calls")
    print('tokens.weth.address', tokens.weth.address)
    loanToken = acct.deploy(LoanToken, loanTokenLogic.address, sovryn.address, tokens.weth.address)
    _add_contract(loanToken)
    
    print("Initialize loanTokenAddress ")
    calldata = loanToken.initialize(loanTokenAddress, loanTokenName, loanTokenSymbol)#symbol and name might be mixed up
    # note: copied initialize  function from token settings to loan token - might cause problems later on
    loanTokenAddr = loanToken.loanTokenAddress()
    print(loanTokenAddr)
    
    #setting the logic ABI for the loan token contract
    #loanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)
    loanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    print("Setting up pool params on protocol.")
    
    sovryn.setLoanPool(
        [loanToken.address],
        [loanTokenAddress] 
    )
    
    print("Setting up margin pool params on loan token.")
    
    constants = shared.Constants()
    params = [];
    
    data = [
        b"0x0", ## id
        False, ## active
        str(acct), ## owner
        constants.ZERO_ADDRESS, ## loanToken -> will be overwritten
        collateralAddress, ## collateralToken.  
        Wei("20 ether"), ## minInitialMargin -> 20% (allows up to 5x leverage)
        Wei("15 ether"), ## maintenanceMargin -> 15%, below liquidation
        0 ## fixedLoanTerm -> will be overwritten with 28 days
    ]
    
    
    params.append(data)
    
    #configure the token settings
    calldata = loanTokenSettings.setupMarginLoanParams.encode_input(params)
    
    #print(calldata)
    
    #set the setting contract address at the loan token logic contract (need to load the logic ABI in line 171 to work)
    tx = loanToken.updateSettings(loanTokenSettings.address, calldata, { "from": acct })
    #print(tx.info())
    
    print("setting up interest rates")
    
    setupLoanTokenRates(acct, loanToken.address, loanTokenSettings.address, loanTokenLogic.address)
    
    return loanToken.address
    
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
    
    
def testDeployment(loanTokenAddress, underlyingToken, collateralToken):
    global sovryn
    print('\n TESTING THE DEPLOYMENT')
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    
    loanTokenSent = 100e18
    underlyingToken.mint(accounts[0],loanTokenSent)
    underlyingToken.approve(loanToken.address, loanTokenSent)
    
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        2e18, # leverageAmount
        loanTokenSent, #loanTokenSent
        0, # no collateral token sent
        collateralToken.address, #collateralTokenAddress
        accounts[0], #trader, 
        b'' #loanDataBytes (only required with ether)
    )
    
    sovrynAfterCollateralBalance = collateralToken.balanceOf(sovryn.address)

    assert(tx.events['Trade']['borrowedAmount'] > loanTokenSent)
    assert(tx.events['Trade']['positionSize'] <= sovrynAfterCollateralBalance)

    
    

