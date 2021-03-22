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
    SOVtoken = contracts['SOV']

    balanceBefore = acct.balance()

    # tokenSender = acct.deploy(TokenSender, SOVtoken)


    # amounts examples: 88.00, 8.88
    MULTIPLIER = 10**16

    totalAmount = 0
    transferList = []
    with open('./scripts/deployment/distribution/SCNC.csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[2].replace(" ", "")
            amount = row[3].replace(",", "").replace(".", "")
            amount = int(amount) * MULTIPLIER
            totalAmount += amount

            transferList.append([tokenOwner, amount])

            print("=======================================")
            print("'" + tokenOwner + "', ")
            print(amount)

    print("total amount:")
    print(totalAmount)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
