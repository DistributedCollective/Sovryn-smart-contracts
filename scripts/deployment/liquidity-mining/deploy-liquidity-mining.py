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

    balanceBefore = acct.balance()

    # == LiquidityMining ===================================================================================================================
    SVRtoken = acct.deploy(SVR, contracts['SOV'], contracts['Staking'])

    liquidityMiningLogic = acct.deploy(LiquidityMining)
    liquidityMiningProxy = acct.deploy(LiquidityMiningProxy)
    liquidityMiningProxy.setImplementation(liquidityMiningLogic.address)
    liquidityMining = Contract.from_abi("LiquidityMining", address=liquidityMiningProxy.address, abi=LiquidityMining.abi, owner=acct)

    # TODO define values
    rewardTokensPerBlock = 100 # 100 / 10**18
    startDelayBlocks = 2880 # ~1 day in blocks (assuming 30s blocks)
    numberOfBonusBlocks = 2880 # ~1 day in blocks (assuming 30s blocks)
    wrapper = "0x0000000000000000000000000000000000000000" # can be updated later using setWrapper
    liquidityMining.initialize(SVRtoken.address, rewardTokensPerBlock, startDelayBlocks, numberOfBonusBlocks, wrapper)

    # TODO prepare pool tokens list
    poolToken1 = contracts['iDOC']
    allocationPoint = 1 # token weight = allocationPoint / SUM of allocationPoints for all pool tokens
    withUpdate = False # can be False if we adding pool tokens before mining started
    liquidityMining.add(poolToken1, allocationPoint, withUpdate)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
