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

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    vestingRegistry = Contract.from_abi("VestingRegistry2", address=contracts['VestingRegistry2'], abi=VestingRegistry2.abi, owner=acct)

    DAY = 24 * 60 * 60
    TWO_WEEKS = 2 * 7 * DAY
    # parse data
    with open('./scripts/deployment/origin-vesting/origin_claim_list.csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            user = row[1]
            vestingAddress = vestingRegistry.getVesting(user)
            if (vestingAddress != "0x0000000000000000000000000000000000000000"):
                vesting = Contract.from_abi("VestingLogic", address=vestingAddress, abi=VestingLogic.abi, owner=acct)
                startDate = vesting.startDate()
                cliff = vesting.cliff()
                date = startDate + cliff # VestingLogic.sol#117 - for (uint256 i = startDate + cliff; i <= end; i += FOUR_WEEKS) {
                # WeightedStaking._adjustDateForOrigin
                adjustedDate = staking.timestampToLockDate(date)
                # //origin vesting contracts have different dates
                # //we need to add 2 weeks to get end of period (by default, it's start)
                if (date != adjustedDate):
                    date = adjustedDate + TWO_WEEKS
                #
                endDate = vesting.endDate()
                stakes = staking.getStakes(vesting)
                stakeDates = stakes[0]
                isEndOfInterval = False
                if (date == endDate and date == stakeDates[0]):
                    isEndOfInterval = True
                print(user + "," + vestingAddress + "," + str(startDate) + "," + str(cliff) + "," + str(endDate) + "," + str(date) + "," + str(isEndOfInterval) + "," + str(stakeDates))
