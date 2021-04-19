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

    data = parseFile('./scripts/deployment/distribution/vestings-test.csv', 10**16)

    for teamVesting in data:
        tokenOwner = teamVesting
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
        balance = 0
        if (vestingAddress != "0x0000000000000000000000000000000000000000"):
            balance = staking.balanceOf(vestingAddress)

        print(tokenOwner + "," + vestingAddress + "," + str(balance / 10**18))

def parseFile(fileName, multiplier):
    print(fileName)
    teamVestingList = []
    with open(fileName, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[0].replace(" ", "")
            teamVestingList.append(tokenOwner)

    return teamVestingList
