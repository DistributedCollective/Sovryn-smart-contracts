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

    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    balanceBefore = acct.balance()
    totalAmount = 0

    # amounts examples: 641.0, 1218.0, 177.6
    data = parseFile('./scripts/deployment/distribution/vestings3.csv', 10**17)
    totalAmount += data["totalAmount"]

    for teamVesting in data["teamVestingList"]:
        tokenOwner = teamVesting[0]
        amount = int(teamVesting[1])
        cliff = int(teamVesting[2]) * FOUR_WEEKS
        duration = int(teamVesting[3]) * FOUR_WEEKS
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
        if (vestingAddress != "0x0000000000000000000000000000000000000000"):
            vestingLogic = Contract.from_abi("VestingLogic", address=vestingAddress, abi=VestingLogic.abi, owner=acct)
            if (cliff != vestingLogic.cliff() or duration != vestingLogic.duration()):
                raise Exception("Address already has team vesting contract with different schedule")
        # vestingRegistry.createTeamVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
        print("TeamVesting: ", vestingAddress)

        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)
        print((duration - cliff) / FOUR_WEEKS + 1)
        # SOVtoken.approve(vestingAddress, amount)
        # vestingLogic = Contract.from_abi("VestingLogic", address=vestingAddress, abi=VestingLogic.abi, owner=acct)
        # vestingLogic.stakeTokens(amount)

        # stakes = staking.getStakes(vestingAddress)
        # print(stakes)

    # 44123.4
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
            tokenOwner = row[1].replace(" ", "")
            amount = row[0].replace(",", "").replace(".", "")
            amount = int(amount) * multiplier
            cliff = int(row[3])
            duration = int(row[4])
            totalAmount += amount

            teamVestingList.append([tokenOwner, amount, cliff, duration])

            # print("=======================================")
            # print("'" + tokenOwner + "', ")
            # print(amount)
    return {
               "totalAmount": totalAmount,
               "teamVestingList": teamVestingList,
            }
