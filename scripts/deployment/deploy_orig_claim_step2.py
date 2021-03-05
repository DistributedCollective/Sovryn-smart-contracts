from brownie import *

import time
import json
import csv
import math

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
MULTIPLIER = 10 ** 18


def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    contracts = json.load(configFile)
    multisig = contracts['multisig']
    teamVestingOwner = multisig

    originInvestorsClaimAddress = contracts['OriginInvestorsClaim']
    if (originInvestorsClaimAddress == ''):
        print('Please set originInvestorsClaimAddress and run again')
        return

    claimContract = Contract.from_abi(
        "OriginInvestorsClaim", address=originInvestorsClaimAddress, abi=OriginInvestorsClaim.abi, owner=acct)

    global rowNumber, chunksSize
    dataFile = './scripts/deployment/origin_claim_list.csv' if thisNetwork == 'rsk-mainnet' else './scripts/deployment/origin_claim_test_list_3237.csv'
    with open(dataFile, 'r') as file:
        reader = csv.DictReader(file)
        rowNumber = 0
        for row in reader:
            rowNumber += 1
            processRow(row)
            if (rowNumber % chunkSize == 0):
                appendInvestorsList(claimContract)

        if (rowNumber % chunkSize != 0):
            appendInvestorsList(claimContract)
        totalCount = rowNumber

    #fund the contract on the testnet, should be done separately manually by using multisig on mainnet
    if thisNetwork != "rsk-mainnet": 
        sov = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
        if sov.balanceOf(acct) < totalAmountSOV:
            sov.mint(acct, totalAmountSOV)
        if sov.balanceOf(claimContract.address) < totalAmountSOV:
            sov.transfer(claimContract.address, totalAmountSOV)
        

    totals = f'''
    totalCount: {totalCount}
    chunkSize: {chunkSize}
    chunksProcessed: {chunksProcessed}
    totalAmountSatoshi: {totalAmountSatoshi}
    totalAmountSOV: {totalAmountSOV}
    Verify the numbers and call claimContract.setInvestorsAmountsListInitialized()
    '''
    print(totals)


def appendInvestorsList(claimContract):
    global chunksProcessed, rowNumber, chunksProcessed
    global appendAddresses, appendAmounts
    chunksProcessed += 1
    print(f'appending at row: {rowNumber}, chunk: {chunksProcessed}')
    claimContract.appendInvestorsAmountsList(
        appendAddresses, appendAmounts)
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
