from brownie import *

import calendar
import time
import json
import csv
import math

def main():
    ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

    thisNetwork = network.show_active()
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

    registries = []
    registries.append(Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct))
    registries.append(Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry2'], abi=VestingRegistry.abi, owner=acct))
    registries.append(Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry3'], abi=VestingRegistry.abi, owner=acct))

    INPUT_FILE = "./scripts/staking/users.csv"
    OUTPUT_FILE = "./scripts/deployment/distribution/vestingmigrations.csv"

    csvFile = open(OUTPUT_FILE, "w")
    header = ['tokenOwner', 'vestingCreationType']
    writer = csv.writer(csvFile)
    writer.writerow(header)
    with open(INPUT_FILE, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            user = row[0]
            for index, registry in enumerate(registries, start=1):
                vesting = registry.getVesting(user)
                teamvesting = registry.getTeamVesting(user)
                if (vesting != ZERO_ADDRESS or teamvesting != ZERO_ADDRESS):
                    vestingData = [user,index]
                    writer.writerow(vestingData)
        csvFile.close()
        print("Processing Completed")