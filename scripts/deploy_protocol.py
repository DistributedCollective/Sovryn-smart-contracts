from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
import shared
from munch import Munch

'''
script to deploy the protocol. can be used to deploy the protocol alone, but is also used by deploy_everything

'''
def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
        
    deployProtocol(acct)

def deployProtocol(acct):
   
    constants = shared.Constants()

    tokens = Munch()

    print("Deploying sovrynProtocol.")
    sovrynproxy = acct.deploy(sovrynProtocol)
    sovryn = Contract.from_abi("sovryn", address=sovrynproxy.address, abi=interface.ISovryn.abi, owner=acct)
    _add_contract(sovryn)

    
    print("Deploying test tokens.")
    tokens.wrbtc = acct.deploy(TestWrbtc) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87
    tokens.susd = acct.deploy(TestToken, "SUSD", "SUSD", 18, 1e50)
    tokens.rbtc = acct.deploy(TestToken, "RBTC", "RBTC", 18, 1e50)

    

    print("Deploying PriceFeeds.")
    feeds = acct.deploy(PriceFeedsLocal, tokens.wrbtc.address, sovryn.address)

    print("Calling setRates.")
    feeds.setRates(
        tokens.rbtc.address,
        tokens.susd.address,
        1e22 #1btc = 10000 susd
    )
    feeds.setRates(
        tokens.wrbtc.address,
        tokens.rbtc.address,
        1e18
    )
    feeds.setRates(
        tokens.wrbtc.address,
        tokens.susd.address,
        1e22
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

    sovryn.setWrbtcToken(tokens.wrbtc.address)
    sovryn.setProtocolTokenAddress(sovryn.address)

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
    
    return (sovryn, tokens)