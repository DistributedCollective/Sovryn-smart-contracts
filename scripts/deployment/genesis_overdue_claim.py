from brownie import *

import time
import json
import csv
import math


def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # TODO check CSOV addresses in config files
    # load deployed contracts addresses
    contracts = json.load(configFile)
    multisig = contracts['multisig']
    teamVestingOwner = multisig

    print('deploying account:', acct)
    vestingRegistry2 = Contract.from_abi("VestingRegistry2", address=contracts["VestingRegistry2"], abi=VestingRegistry2.abi, owner=acct)
    #vestingRegistry2.addAdmin(contracts["OrigingVestingCreator"])
    
    #emergency vestingRegistry2.removeAdmin(contracts["OrigingVestingCreator"])

    #print("isAdmin 0xea173A078bA12673a8bef6DFa47A8E8f130B4939: ", vestingRegistry2.admins("0xea173A078bA12673a8bef6DFa47A8E8f130B4939"))
    
    #last step vestingRegistry.transferOwnership(multisig)