from brownie import *

import time
import json
import csv
import math

def main():
    loadConfig()

    balanceBefore = acct.balance()
    # 1 * 4 Weeks Cliff
    # 11 * 4 Weeks Duration
    deployLockedSOV(1,11)
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

# == Locked SOV Deployment ================================================================================================================
def deployLockedSOV(cliff, duration):
    sov = contracts['SOV']
    vestingRegistry = contracts['VestingRegistry3']
    adminList = [contracts['multisig']]
    print("=============================================================")
    print("Deployment Parameters")
    print("=============================================================")
    print("SOV Token:           ", sov)
    print("Vesting Registry:    ", vestingRegistry)
    print("Cliff (in weeks):    ", cliff * 4)
    print("Duration (in weeks): ", duration * 4)
    print("Admin List:          ", adminList)
    print("=============================================================")
    lockedSOV = acct.deploy(LockedSOV, sov, vestingRegistry, cliff, duration, adminList)
