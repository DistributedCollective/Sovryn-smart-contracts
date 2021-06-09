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

    stakingMockup = Contract.from_abi("StakingMockup", address="0xf0bd337474B63745a840C583B66808e2A0949459", abi=StakingMockup.abi, owner=acct)

    registryAddresses = [contracts['VestingRegistry'], contracts['VestingRegistry2'], contracts['VestingRegistry3']]
    registries = []
    for i in registryAddresses:
        registry = Contract.from_abi("VestingRegistry", address=i, abi=VestingRegistry.abi, owner=acct)
        registries.append(registry)

    data = parseFile('./scripts/deployment/distribution/token-owners-list.csv')

    ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

    for teamVesting in data:
        tokenOwner = teamVesting
        vestingAddress = ZERO_ADDRESS
        for registry in registries:
            if (vestingAddress == ZERO_ADDRESS):
                vestingAddress = registry.getTeamVesting(tokenOwner)
            if (vestingAddress == ZERO_ADDRESS):
                vestingAddress = registry.getVesting(tokenOwner)
        codeHash = stakingMockup.getCodeHash(vestingAddress)
        print("vesting: " + str(vestingAddress) + ", codeHash: " + str(codeHash))

def parseFile(fileName):
    print(fileName)
    teamVestingList = []
    with open(fileName, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[0].replace(" ", "")
            teamVestingList.append(tokenOwner)

    return teamVestingList
