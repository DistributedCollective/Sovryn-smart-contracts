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
    multisig = contracts['multisig']
    teamVestingOwner = multisig
    SOVAddress = contracts['SOV']
    stakingAddress = contracts['Staking']
    feeSharingAddress = contracts['FeeSharingProxy']

    balanceBefore = acct.balance()

    # == VestingRegistry ===================================================================================================================
    #deploy VestingFactory
    vestingLogic = acct.deploy(VestingLogic)
    vestingFactory = acct.deploy(VestingFactory, vestingLogic.address)

    #deploy VestingRegistry3
    vestingRegistry = acct.deploy(VestingRegistry3, vestingFactory.address, SOVAddress, stakingAddress, feeSharingAddress, teamVestingOwner)
    vestingFactory.transferOwnership(vestingRegistry.address)

    vestingRegistry.transferOwnership(multisig)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
