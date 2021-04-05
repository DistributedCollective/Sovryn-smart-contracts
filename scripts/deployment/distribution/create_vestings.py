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

    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    cliff = FOUR_WEEKS
    duration = 26 * FOUR_WEEKS

    balanceBefore = acct.balance()
    totalAmount = 0

    # amounts examples: 3205.128, 641.026
    data = parseFile('./scripts/deployment/distribution/vestings2.csv', 10**15)
    totalAmount += data["totalAmount"]

    for teamVesting in data["teamVestingList"]:
        tokenOwner = teamVesting[0]
        amount = int(teamVesting[1])
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
        if (vestingAddress != "0x0000000000000000000000000000000000000000"):
            raise Exception("Address already has team vesting contract")
        # vestingRegistry.createTeamVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
        print("TeamVesting: ", vestingAddress)

        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)
        print((duration - cliff) / FOUR_WEEKS + 1)
        # vestingRegistry.stakeTokens(vestingAddress, amount)

        # stakes = staking.getStakes(vestingAddress)
        # print(stakes)

    # 9348.337
    print("=======================================")
    print("SOV amount:")
    print(totalAmount / 10**18)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)


def parseFile(fileName, multiplier):
    print(fileName)
    totalAmount = 0
    teamVestingList = []
    with open(fileName, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[3].replace(" ", "")
            amount = row[1].replace(",", "").replace(".", "")
            amount = int(amount) * multiplier
            totalAmount += amount

            teamVestingList.append([tokenOwner, amount])

            # print("=======================================")
            # print("'" + tokenOwner + "', ")
            # print(amount)
    return {
               "totalAmount": totalAmount,
               "teamVestingList": teamVestingList,
            }
