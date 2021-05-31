from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
import shared
from munch import Munch
#todo only deploy one token, read the other
def deployTokens(acct):
    print("Deploying test tokens.")
    tokens = Munch()
    tokens.susd = acct.deploy(TestToken, "SUSD", "SUSD", 18, 1e50)
    if network.show_active() == "development" or network.show_active() == "arb-testnet":
        tokens.wrbtc = acct.deploy(TestWrbtc) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87
        tokens.wrbtc.deposit({'value':10e18})#needed because of local swap impl or sovryn swap simulator
        tokens.susd.mint(acct, 10000e18)
    else:
        tokens.wrbtc = acct.deploy(WRBTC)
    
    return tokens
    
def deployWRBTC(acct, susdAddress):
    tokens = Munch()
    if network.show_active() == "development" or network.show_active() == "arb-testnet":
        tokens.wrbtc = acct.deploy(TestWrbtc) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87
        tokens.wrbtc.deposit({'value':10e18})#needed because of local swap impl or sovryn swap simulator
    else:
        tokens.wrbtc = acct.deploy(WRBTC)
        tokens.wrbtc.deposit({'value':1e17})#needed not for the sovry protocol, but for later swap deployment
    tokens.susd = Contract.from_abi("SUSD", address=susdAddress, abi=TestToken.abi, owner=acct)
    
def readTokens(owner, wrbtcAddress, susdAddress):
    print("Reading test tokens.")
    tokens = Munch()
    if network.show_active() == "development" or network.show_active() == "arb-testnet":
        tokens.wrbtc = Contract.from_abi("TestWrbtc", address=wrbtcAddress, abi=TestWrbtc.abi, owner=owner)
    else:
        tokens.wrbtc = Contract.from_abi("WRBTC", address=wrbtcAddress, abi=WRBTC.abi, owner=owner)
    tokens.susd = Contract.from_abi("TestSUSD", address=susdAddress, abi=TestToken.abi, owner=owner)
    return tokens