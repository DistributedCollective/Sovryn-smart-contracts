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
    multisig = contracts['multisig']
    SOVAddress = contracts['SOV']
    stakingAddress = contracts['Staking']
    feeSharingAddress = contracts['FeeSharingProxy']
    fourYearVestingFactory = Contract.from_abi("FourYearVestingFactory", address=contracts['FourYearVestingFactory'], abi=FourYearVestingFactory.abi, owner=acct)

    MULTIPLIER = 10**16 # Expecting two decimals
    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY
    CLIFF =  FOUR_WEEKS
    DURATION = 39 * FOUR_WEEKS

    # == Vesting contracts creation and staking tokens ==============================================================================
    # TODO check fouryearvestinglist.csv
    with open('./fouryearvestinglist.csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[0].replace(" ", "")
            amount = row[1].replace(",", "").replace(".", "")
            amount = int(amount) * MULTIPLIER

            vestingAddress = fourYearVestingFactory.deployFourYearVesting(SOVAddress, stakingAddress, tokenOwner, CLIFF, DURATION, feeSharingAddress, multisig)

            remainingAmount = amount
            lastSchedule = 0
            while remainingAmount > 0:
                (lastSchedule, remainingAmount) = vestingAddress.stakeTokens(remainingAmount, lastSchedule)
            
            print("=======================================")
            print(vestingAddress)
            print("'" + tokenOwner + "', ")
            print(amount)
            print(cliff)
            print(duration)

    #  == Transfer ownership to multisig =============================================================================================
    fourYearVestingFactory.transferOwnership(multisig)

    print("balance:")
    print(SOVtoken.balanceOf(acct) / 10**18)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
