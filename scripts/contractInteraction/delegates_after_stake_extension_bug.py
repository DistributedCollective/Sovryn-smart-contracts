
'''
This script serves the purpose of performing a forensic analysis
checking the delegatee status of the around 300 potentially
affected users by the stake extension bug reported on 2021-10-23.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json, os, time, copy, csv
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def readStakingDelegates(userAddress, timeLockDate):
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=Staking.abi, owner=conf.acct)
    return staking.delegates(userAddress, timeLockDate)

def readLockDate(timestamp):
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=Staking.abi, owner=conf.acct)
    return staking.timestampToLockDate(timestamp)

def readBalanceOf(userAddress):
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=Staking.abi, owner=conf.acct)
    return staking.balanceOf(userAddress)

def readStakesOf(userAddress):
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=Staking.abi, owner=conf.acct)
    return staking.getStakes(userAddress)

def main():
    # Set timezone to UTC. Input dates are specified on GMT +0
    os.environ['TZ'] = 'UTC'

    # Init output CSV
    csvOutput = []
    # CSV Headers
    csvOutput.append(["userAddress", "stakeTimeLockDate", "delegate"])
    
    # Load the contracts and acct depending on the network
    conf.loadConfig()

    print('Loading data:')

    csv_file = open("../stakers.csv", "r")
    dict_reader = csv.DictReader(csv_file)
    # ordered_dict_from_csv = list(dict_reader)[0]
    # dict_from_csv = dict(ordered_dict_from_csv)
    # print(dict_from_csv)

    for line in dict_reader:
        # print(line['staker'])
        print(" ")
    # line = list(dict_reader)[1]
        userAddress = line['staker']
        maxOfNewDate = line['Max of new_date']

        # userAddress = "0x0019cf2D5476d5006260b582Ee973f0dE6212DF3"
        print("userAddress:  ", userAddress)

        print("maxOfNewDate: ", maxOfNewDate)

        # maxOfNewDate = "6/4/2021 10:28" # mm/dd/yyyy hh:mm
        # Epoch timestamp: 1622802480
        timestamp = time.mktime(time.strptime(maxOfNewDate, '%m/%d/%Y %H:%M'))
        print("timestamp:    ", timestamp)

        timeLockDate =readLockDate(timestamp)
        print("timeLockDate: ", timeLockDate)

        balance = readBalanceOf(userAddress)
        print("balance: ", balance)

        stakes = readStakesOf(userAddress)
        print("stakes: ", stakes)

        # print('Checking delegates:')
        for stakeTimeLockDate in stakes[0]:
            delegate = readStakingDelegates(userAddress, stakeTimeLockDate)
            print("staking.delegates(", userAddress, ", ", stakeTimeLockDate, "): ", delegate)

            # Append CSV data
            csvOutput.append([userAddress, stakeTimeLockDate, delegate])
    
    # Export CSV
    with open('../stakingDelegates.csv', 'w', newline='') as file:
        writer = csv.writer(file, delimiter='\t')
        writer.writerows(csvOutput)
