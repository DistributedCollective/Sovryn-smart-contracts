'''
How much fees protocol has burn?
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time
import copy

def main():
    # Load the contracts and acct depending on the network.
    loadConfig()

    # Call the function you want here.
    getFeesGlobal()
    # "USDT":"0xEf213441a85DF4d7acBdAe0Cf78004E1e486BB96",
    getFeesPerToken("USDT")
    # "DoC" : "0xe700691da7b9851f2f35f8b8182c69c53ccad9db",
    getFeesPerToken("DoC")
    # "MOCState": "0xb9C42EFc8ec54490a37cA91c423F7285Fa01e257",
    getFeesPerToken("MOCState")
    # "BPro": "0x440cd83c160de5c96ddb20246815ea44c7abbca8",
    getFeesPerToken("BPro")
    # "SOV": "0xEFc78fc7d48b64958315949279Ba181c2114ABBd",
    getFeesPerToken("SOV")
    # "WRBTC" : "0x542fda317318ebf1d3deaf76e0b632741a7e677d",
    getFeesPerToken("WRBTC")
    # "rBTC" : "0x",
    getFeesPerToken("rBTC")


def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("Network not supported.")
    contracts = json.load(configFile)
    acct = accounts.load("rskdeployer")
    
def getFeesGlobal():
    # "sovrynProtocol" : "0x5A0D867e0D70Fcc6Ade25C3F1B89d618b5B4Eaa7",
    contractAddress = contracts['sovrynProtocol']
    print("Querying sovrynProtocol at address: ", contractAddress)
    
    contract = Contract.from_abi("State", address=contractAddress, abi=State.abi)

    print("  tradingFeePercent: ", contract.tradingFeePercent()/1e18)
    print("  borrowingFeePercent: ", contract.borrowingFeePercent()/1e18)
    print("  protocolTokenHeld: ", contract.protocolTokenHeld()/1e18)
    print("  protocolTokenPaid: ", contract.protocolTokenPaid()/1e18)

def getFeesPerToken(tokenName):
    # "sovrynProtocol" : "0x5A0D867e0D70Fcc6Ade25C3F1B89d618b5B4Eaa7",
    contractAddress = contracts['sovrynProtocol']
    print("")
    
    contract = Contract.from_abi("State", address=contractAddress, abi=State.abi)

    if tokenName == 'rBTC':
        acct = '0x0000000000000000000000000000000000000000'
    else:
        acct = contracts[tokenName]
    print("  On token ", tokenName, " at address ", acct)

    print("    lendingFeeTokensHeld: ", contract.lendingFeeTokensHeld(acct)/1e18)
    print("    lendingFeeTokensPaid: ", contract.lendingFeeTokensPaid(acct)/1e18)
    print("    tradingFeeTokensHeld: ", contract.tradingFeeTokensHeld(acct)/1e18)
    print("    tradingFeeTokensPaid: ", contract.tradingFeeTokensPaid(acct)/1e18)
    print("    borrowingFeeTokensHeld: ", contract.borrowingFeeTokensHeld(acct)/1e18)
    print("    borrowingFeeTokensPaid: ", contract.borrowingFeeTokensPaid(acct)/1e18)
    
    
