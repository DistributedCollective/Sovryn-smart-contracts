from brownie import *

import calendar
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

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)

    DAY = 24 * 60 * 60
    TWO_WEEKS = 2 * 7 * DAY
    # parse data

    ts = calendar.timegm(time.gmtime())
    totalLockedAmount = 0
    with open('./scripts/staking/processed-list.csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            user = row[0]

            stakes = staking.getStakes(user)
            stakeDates = stakes[0]
            stakeAmounts = stakes[1]

            userLockedAmount = 0
            for index, value in enumerate(stakeDates):
                if (int(value) > ts):
                    userLockedAmount += stakeAmounts[index]

            totalLockedAmount += userLockedAmount
            print(user + ", " + str(userLockedAmount) + ", " + str(stakeDates) + ", " + str(stakeAmounts))
