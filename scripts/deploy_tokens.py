from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
import shared
from munch import Munch

def deployTokens(acct):
    print("Deploying test tokens.")
    tokens = Munch()
    tokens.wrbtc = acct.deploy(TestWrbtc) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87
    tokens.wrbtc.deposit({'value':2e18})#needed because of local swap impl or sovryn swap simulator
    tokens.susd = acct.deploy(TestToken, "SUSD", "SUSD", 18, 1e50)
    return tokens
    
def readTokens(owner, wrbtcAddress, susdAddress):
    print("Reading test tokens.")
    tokens = Munch()
    tokens.wrbtc = Contract.from_abi("TestWrbtc", address=wrbtcAddress, abi=TestWrbtc.abi, owner=owner)
    tokens.susd = Contract.from_abi("TestSUSD", address=susdAddress, abi=TestToken.abi, owner=owner)
    return tokens