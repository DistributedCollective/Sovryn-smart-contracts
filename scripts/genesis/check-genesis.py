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

    CSOV1token = Contract.from_abi("CSOV1", address=contracts['CSOV1'], abi=ERC20.abi, owner=acct)
    CSOV2token = Contract.from_abi("CSOV2", address=contracts['CSOV2'], abi=ERC20.abi, owner=acct)
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)

    # https://explorer.rsk.co/address/0x0106f2ffbf6a4f5dece323d20e16e2037e732790?__tab=accounts&page__accounts=1
    # https://explorer.rsk.co/address/0x7f7dcf9df951c4a332740e9a125720da242a34ff?__tab=accounts&page__accounts=1

    with open('./scripts/genesis/genesis-list.csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            account = row[0].replace(" ", "")
            isProcessed = vestingRegistry.processedList(account)
            isBlacklisted = vestingRegistry.blacklist(account)
            if (not isProcessed and not isBlacklisted):
                balance = CSOV1token.balanceOf(account) + CSOV2token.balanceOf(account) -  vestingRegistry.lockedAmount(account)
                print(account + "," + str(isProcessed) + "," + str(isBlacklisted) + "," + str(balance / 10**18))
