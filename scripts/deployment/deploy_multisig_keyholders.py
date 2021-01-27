from brownie import *
import json

def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        # configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet" or thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
        
    if thisNetwork == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    contracts = json.load(configFile)
    timelockOwnerAddress = contracts['timelockOwner']

    multiSigKeyHolders= acct.deploy(MultiSigKeyHolders)
    multiSigKeyHolders.transferOwnership(timelockOwnerAddress)
