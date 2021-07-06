from brownie import *

import calendar
import time
import json

def main():
    thisNetwork = network.show_active()

    DAY = 24 * 60 * 60
    TWO_WEEKS = 2 * 7 * DAY

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

    ts = calendar.timegm(time.gmtime())
    lockedTS = staking.timestampToLockDate(ts)

    totalAmount = 0
    for i in range(1, 79):
        lockedTS += TWO_WEEKS
        amount = staking.getCurrentStakedUntil(lockedTS)
        totalAmount += amount
        print(amount / 10**18)

    print("totalAmount: ", totalAmount / 10**18)
