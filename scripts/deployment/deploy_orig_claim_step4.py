from brownie import *

import time
import json
import csv
import math

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

    originInvestorsClaimAddress = contracts['OriginInvestorsClaim']
    if (originInvestorsClaimAddress == ''):
        print('please set originInvestorsClaimAddress and run again')
        return

    claimContract = Contract.from_abi(
        "OriginInvestorsClaim", address=originInvestorsClaimAddress, abi=OriginInvestorsClaim.abi, owner=acct)
    
    multisig = contracts['multisig']
    сlaimContract.transferOwnership(multisig)

    print(
        '''
        That's all folks! Tell origin investors to claim their tokens!
        '''
    )
