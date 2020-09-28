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

def deployProtocol(acct, tokens, medianizerAddress):

    constants = shared.Constants()

    print("Deploying sovrynProtocol.")
    sovrynproxy = acct.deploy(sovrynProtocol)
    sovryn = Contract.from_abi("sovryn", address=sovrynproxy.address, abi=interface.ISovryn.abi, owner=acct)
    _add_contract(sovryn)

    print("Deploying PriceFeeds.")
    #feeds = acct.deploy(PriceFeedsLocal, tokens.wrbtc.address, sovryn.address)
    priceFeedMoC = acct.deploy(PriceFeedsMoC, medianizerAddress)
    #2nd address should actually be the protocol token address, not the protocol address
    feeds = acct.deploy(PriceFeeds, tokens.wrbtc.address, sovryn.address, tokens.susd.address)
    feeds.setPriceFeed([tokens.wrbtc.address], [priceFeedMoC.address])
    
    '''
    print("Calling setRates.")

    feeds.setRates(
        tokens.wrbtc.address,
        tokens.susd.address,
        1e22
    )
    '''

    print("Deploying ProtocolSettings.")
    settings = acct.deploy(ProtocolSettings)
    print("Calling replaceContract.")
    sovryn.replaceContract(settings.address)
    
    print("Deploying Swaps.")
    swaps = acct.deploy(SwapsImplSovrynSwap)
    sovrynSwapSimulator = acct.deploy(TestSovrynSwap, feeds.address)
    sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address)
    sovryn.setSupportedTokens([tokens.susd.address, tokens.wrbtc.address],[True, True])

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

    return sovryn