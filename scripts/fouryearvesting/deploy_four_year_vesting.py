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
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)

    balanceBefore = acct.balance()

    #deploy VestingFactory
    fourYearVestingLogic = acct.deploy(FourYearVestingLogic)
    fourYearVestingFactory = acct.deploy(FourYearVestingFactory, fourYearVestingLogic.address)

    # Transfer ownership of VestingFactory to multisig after creating vesting contracts and staking tokens
    # Don't forget to add the contract addresses to json files before running the script

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
