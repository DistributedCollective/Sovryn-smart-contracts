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
    totalAmount = 0

    # amounts examples: 308.135, 441.555
    data = parseFile('./scripts/deployment/distribution/team-origin.csv', 10**15)
    totalAmount += data["totalAmount"]
    # tokenSender.transferSOVusingList(data["receivers"], data["amounts"])

    # 875.39
    print("=======================================")
    print("SOV amount:")
    print(totalAmount / 10**18)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)


def parseFile(fileName, multiplier):
    print(fileName)
    totalAmount = 0
    receivers = []
    amounts = []
    with open(fileName, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[3].replace(" ", "")
            amount = row[1].replace(",", "").replace(".", "")
            amount = int(amount) * multiplier
            totalAmount += amount

            receivers.append(tokenOwner)
            amounts.append(amount)

            # print("=======================================")
            # print("'" + tokenOwner + "', ")
            # print(amount)

    # print(receivers)
    # print(amounts)

    return {
               "totalAmount": totalAmount,
               "receivers": receivers,
                "amounts": amounts
            }
