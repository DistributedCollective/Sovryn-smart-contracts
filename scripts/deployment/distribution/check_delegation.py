from brownie import *

import time
import json
import csv
import math

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

    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)

    vesting = vestingRegistry.getTeamVesting(acct)
    print(vesting)

    vestingLogic = Contract.from_abi("VestingLogic", address=vesting, abi=VestingLogic.abi, owner=acct)
    vestingLogic.delegate("0xe4a6B1aD1Ad5a963739400cdf218544b732a482e")
