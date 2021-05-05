from brownie import *

import time
import json
import csv
import math
import os

totalAmountSatoshi = 0
totalAmountSOV = 0
totalCount = 0
chunkSize = 250
rowNumber = 0
chunksProcessed = 0
appendAddresses = []
appendAmounts = []
# https://github.com/DistributedCollective/SIPS/blob/main/SIP-0006(A1).md
EX_RATE = 9736
MULTIPLIER = 10**18


def main():
    
    '''
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
    '''
    global rowNumber, chunkSize
    #dataFile = './scripts/deployment/origin_claim_list.csv' if thisNetwork == 'rsk-mainnet' else './scripts/deployment/origin_claim_test_list_3238.csv'
    dataFile = './scripts/deployment/origin_claim_list.csv'
    with open(dataFile, 'r') as file:
        # reader = csv.reader(file)
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

    print(f'totalCount: {totalCount}')
    print(f'chunkSize: {chunkSize}')
    print(f'chunksProcessed: {chunksProcessed}')
    print(f'totalAmountSatoshi: {totalAmountSatoshi}')
    print(f'totalAmountSOV: {totalAmountSOV}')

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
    # claimContract.appendInvestorsAmountsList(
    #    appendAddresses, appendAmounts)
    chunksProcessed += 1
    print(f'appending at row: {rowNumber}, chunk: {chunksProcessed}')
    #print(f'appendAddresses: {appendAddresses}')
    #print(f'appendAmounts: {appendAmounts}')
    appendAddresses = []
    appendAmounts = []


def processRow(row):
    global satoshiAmount
    global appendAddresses, appendAmounts, totalAmountSatoshi, totalAmountSOV
    satoshiAmount = int(row['value'])
    SOVAmount = satoshiAmount * MULTIPLIER / EX_RATE
    appendAddresses.append(row['web3 address'])
    appendAmounts.append(SOVAmount)
    totalAmountSatoshi += satoshiAmount
    totalAmountSOV += SOVAmount

# brownie run /d/Projects/sovryn/Sovryn-smart-contracts/scripts/deployment/deploy_orig_claim_read_file.py --network testnet
