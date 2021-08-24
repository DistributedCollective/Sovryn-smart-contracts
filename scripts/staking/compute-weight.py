from brownie import *

import calendar
import time
import json
from datetime import datetime

def main():
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

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)

    ts = calendar.timegm(time.gmtime())
    lockedTS = staking.timestampToLockDate(ts)

    DAY = 24 * 60 * 60
    TWO_WEEKS = 2 * 7 * DAY
    WEIGHT_FACTOR = staking.WEIGHT_FACTOR()

    for i in range(1, 79):
        lockedDate = lockedTS + i*TWO_WEEKS
        weight = staking.computeWeightByDate(lockedDate, ts) / WEIGHT_FACTOR
        lockedDate = datetime.utcfromtimestamp(lockedDate).strftime('%Y-%m-%d')
        print(lockedDate, "-", weight)
