from brownie import *

import time
import json
import csv
import math

def main():
    loadConfig()

    balanceBefore = acct.balance()
    # 36 because, 30 days holding and 6 days for depositing. If undecided, should make it zero.
    deployEscrow(36, 75000)
    balanceAfter = acct.balance()

    print("=============================================================")
    print("RSK Before Balance:  ", balanceBefore)
    print("RSK After Balance:   ", balanceAfter)
    print("Gas Used:            ", balanceBefore - balanceAfter)
    print("=============================================================")

def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()

    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)

# == Escrow Deployment ====================================================================================================================
def deployEscrow(timeInDays, depositLimit):
    multisig = contracts['multisig']
    sov = contracts['SOV']
    lockedSOV = contracts['LockedSOV']
    releaseTime = math.floor(time.time()) + (timeInDays * 24 * 60 * 60)
    depositLimit = depositLimit * (10 ** 18)
    print("=============================================================")
    print("Deployment Parameters")
    print("=============================================================")
    print("Locked SOV:   ", rewardToken)
    print("SOV Token:      ", sov)
    print("MultiSig:       ", multisig)
    print("Release Time:   ", releaseTime)
    print("Deposit Limit:  ", depositLimit)
    print("=============================================================")
    escrowReward = acct.deploy(EscrowReward, rewardToken, sov, multisig, releaseTime, depositLimit)
