from brownie import *

import json

def main():
    thisNetwork = network.show_active()

    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)
    multisig = contracts['multisig']

    balanceBefore = acct.balance()
    
    # == migrator ===================================================================================================================
    migrator = acct.deploy(LMV1toLMV2Migrator)

    migrator.initialize(contracts['SOV'],contracts['LiquidityMiningProxy'],contracts['LiquidityMiningProxyV2'])

    migrator.addAdmin(multisig)
    migrator.transferOwnership(multisig)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)