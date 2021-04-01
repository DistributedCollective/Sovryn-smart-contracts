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

    tokenSender = Contract.from_abi("TokenSender", address=contracts['TokenSender'], abi=TokenSender.abi, owner=acct)

    balanceBefore = acct.balance()

    # amounts examples: 269.231, 18.578
    MULTIPLIER = 10**15

    totalAmount = 0
    receivers = []
    amounts = []
    with open('./scripts/deployment/distribution/SCNC.csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[3].replace(" ", "")
            amount = row[1].replace(",", "").replace(".", "")
            amount = int(amount) * MULTIPLIER
            totalAmount += amount

            receivers.append(tokenOwner)
            amounts.append(amount)

            print("=======================================")
            print("'" + tokenOwner + "', ")
            print(amount)

    print("total amount:")
    print(totalAmount / 10**18)
    # 1058.715

    print(receivers)
    print(amounts)

    # tokenSender.transferSOVusingList(receivers, amounts)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
