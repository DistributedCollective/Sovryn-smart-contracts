from brownie import *

import time
import json
import csv
import math

originInvestorsClaimAddress = ''
totalAmountSatoshi = 0
totalAmountSOV = 0
totalCount = 0
chunkSize = 4  # TODO: 250
rowNumber = 0
chunksProcessed = 0
appendAddresses = []
appendAmounts = []
# https://github.com/DistributedCollective/SIPS/blob/main/SIP-0006(A1).md
EX_RATE = 9736
MULTIPLIER = 10**18


def main():

    if (originInvestorsClaimAddress == ''):
        print('please set originInvestorsClaimAddress and run again')
        return

    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
        ownerDelay = 3*60*60
        adminDelay = 3*60*60
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
        ownerDelay = 2*24*60*60
        adminDelay = 1*24*60*60
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
        ownerDelay = 2*24*60*60
        adminDelay = 1*24*60*60
    else:
        raise Exception("network not supported")

    global originInvestorsClaimAddress
    claimContract = Contract.from_abi(
        "OriginInvestorsClaim", address=originInvestorsClaimAddress, abi=originInvestorsClaimAddress.abi, owner=acct)

    global rowNumber, chunksSize
    with open('./scripts/deployment/origin_claim_list.csv', 'r') as file:
        #reader = csv.reader(file)
        reader = csv.DictReader(file)
        rowNumber = 0
        for row in reader:
            rowNumber += 1
            processRow(row)
            if (rowNumber % chunkSize == 0):
                appendInvestorsList()

        if (rowNumber % chunkSize != 0):
            appendInvestorsList()
        totalCount = rowNumber

    claimContract.setInvestorsAmountsListInitialized()

    totals = f'''
    totalCount: {totalCount}
    chunkSize: {chunkSize}
    chunksProcessed: {chunksProcessed}
    totalAmountSatoshi: {totalAmountSatoshi}
    totalAmountSOV: {totalAmountSOV}
    Notify origin investors that they can claim their tokens with the cliff == duration == Mar 26 2021
    '''
    print(totals)


def appendInvestorsList():
    global chunksProcessed, rowNumber, chunksProcessed
    global appendAddresses, appendAmounts
    claimContract.appendInvestorsAmountsList(
        appendAddresses, appendAmounts)
    chunksProcessed += 1
    print(f'appending at row: {rowNumber}, chunk: {chunksProcessed}')
    appendAddresses = []
    appendAmounts = []


def processRow(row):
    global satoshiAmount
    global appendAddresses, appendAmounts, totalAmountSatoshi, totalAmountSOV
    satoshiAmount = int(row['value'])
    SOVAmount = satoshiAmount / EX_RATE * MULTIPLIER
    appendAddresses.append(row['web3 address'])
    appendAmounts.append(SOVAmount)
    totalAmountSatoshi += satoshiAmount
    totalAmountSOV += SOVAmount
