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

    balanceBefore = acct.balance()

    TOKEN_PRICE = 9736

    # TODO VestingRegistry2
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)

    # == Vesting contracts ===============================================================================================================
    btcAmount = 0
    vestingList = []
    with open('./scripts/deployment/vesting/BTC to be returned(PA).csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            # tokenOwner = row[1].replace(" ", "")
            tokenOwner = row[1]
            amount = int(int(float(row[2]) * 10**8 * 10**18) / TOKEN_PRICE)
            btcAmount += float(row[2])
            vestingList.append([tokenOwner, amount])

    with open('./scripts/deployment/vesting/BTC to be returned(R&U).csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            # tokenOwner = row[1].replace(" ", "")
            tokenOwner = row[1]
            amount = int(int(float(row[2]) * 10**8 * 10**18) / TOKEN_PRICE)
            btcAmount += float(row[2])
            vestingList.append([tokenOwner, amount])

    print("vestingList:")
    print(vestingList)

    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    # TODO 4 weeks - deployment should be done before 12.03.2021
    cliff = FOUR_WEEKS
    duration = cliff

    # Vesting / OwnerVesting
    vestingAmount = 0
    for vesting in vestingList:
        vestingAmount += vesting[1]
    print("Vesting Amount:", vestingAmount)
    print("BTC Amount:", btcAmount)

    for vesting in vestingList:
        tokenOwner = vesting[0]
        amount = vesting[1]
        # vestingRegistry.createVesting(tokenOwner, amount, cliff, duration)
        # vestingAddress = vestingRegistry.getVesting(tokenOwner)

        # print("Vesting: ", vestingAddress)
        # print(tokenOwner)
        # print(amount)
        # print(cliff)
        # print(duration)
        # print((duration - cliff) / FOUR_WEEKS + 1)
        # vestingRegistry.stakeTokens(vestingAddress, amount)

        # stakes = staking.getStakes(vestingAddress)
        # print(stakes)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
