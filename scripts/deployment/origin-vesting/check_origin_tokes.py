from brownie import *

import time
import json
import csv
import math
from datetime import date

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

    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    vestingRegistry = Contract.from_abi("VestingRegistry2", address=contracts['VestingRegistry2'], abi=VestingRegistry2.abi, owner=acct)

    totalBalance = 0
    totalStaked = 0
    totalVested = 0
    # parse data
    print("account,balance,staked,vested(Origin))")
    with open('./scripts/deployment/origin-vesting/origin_claim_list.csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            user = row[1]

            balance = SOVtoken.balanceOf(user)
            totalBalance += balance

            stakedTokens = staking.balanceOf(user)
            totalStaked += stakedTokens

            vestingAddress = vestingRegistry.getVesting(user)
            vestedTokens = staking.balanceOf(vestingAddress)
            totalVested += vestedTokens

            data = user + "," + str(balance / 10**18) + "," + str(stakedTokens / 10**18) + "," + str(vestedTokens / 10**18)
            if (stakedTokens > 0):
                stakes = staking.getStakes(user)
                ts = stakes[0][0]
                # data += "," + time.strftime("%Y-%m-%d %H:%M:%S", ts) +  "," + str(stakes[0])
                data += "," + str(date.fromtimestamp(ts)) +  "," + str(stakes[0])
            print(data)

    print("totalBalance: " + str(totalBalance / 10**18))
    print("totalStaked: " + str(totalStaked / 10**18))
    print("totalVested: " + str(totalVested / 10**18))
