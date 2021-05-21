'''
Steps for deploying liquidity mining
 
1. Run this deployment script
2. Deploy the wrapper proxy
3. Set wrapper proxy on LMcontract
4. Set lockedSOV as admin of VestingRegistry3
5. If on mainnet: transfer SOV from adoption pool
'''

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
    SOVToken = Contract.from_abi("SOV", address = contracts['SOV'], abi=TestToken.abi, owner = acct)
    
    lockedSOV = acct.deploy(LockedSOV, contracts['SOV'], contracts['VestingRegistry3'], 1, 10, [contracts['multisig']])

    liquidityMiningLogic = acct.deploy(LiquidityMining)
    liquidityMiningProxy = acct.deploy(LiquidityMiningProxy)
    liquidityMiningProxy.setImplementation(liquidityMiningLogic.address)
    liquidityMining = Contract.from_abi("LiquidityMining", address=liquidityMiningProxy.address, abi=LiquidityMining.abi, owner=acct)
    
    # TODO define values
    # Maximum reward per week: 100M SOV
    # Maximum reward per block: 4.9604 SOV (4.9604 * 2880 * 7 = 100001.664)

    # we need to multiply by 1000 to have 100 M
    rewardTokensPerBlock = 49604 * 10**14 * 1000 #100M per week

    # ~1 day in blocks (assuming 30s blocks)
    BLOCKS_PER_DAY = 2880
    BLOCKS_PER_HOUR = 120
    startDelayBlocks = 3 * BLOCKS_PER_DAY - 0 * BLOCKS_PER_HOUR
    numberOfBonusBlocks = 1 # ~1 day in blocks (assuming 30s blocks)
    wrapper = "0x0000000000000000000000000000000000000000" # can be updated later using setWrapper
    # The % (in Basis Point) which determines how much will be unlocked immediately.
    # 10000 is 100%
    unlockedImmediatelyPercent = 0 # 0%
    liquidityMining.initialize(contracts['SOV'], rewardTokensPerBlock, startDelayBlocks, numberOfBonusBlocks, wrapper, lockedSOV.address, unlockedImmediatelyPercent)

    # TODO Dummy pool token should be ERC20
    liquidityMiningConfigToken = acct.deploy(LiquidityMiningConfigToken)

    # TODO prepare pool tokens list
    poolTokens = [contracts['(WR)BTC/SOV'], liquidityMiningConfigToken.address]
    # we need to multiply by 1000 to have 100 M
    MAX_ALLOCATION_POINT = 100000 * 1000 # 100 M
    # we don't need 10**18 here, it's just a proportion between tokens
    ALLOCATION_POINT_SOV_BTC = 40000 # 40 K
    allocationPoints = [ALLOCATION_POINT_SOV_BTC, MAX_ALLOCATION_POINT - ALLOCATION_POINT_SOV_BTC]
    # token weight = allocationPoint / SUM of allocationPoints for all pool tokens
    withUpdate = False # can be False if we adding pool tokens before mining started
    for i in range(0,len(poolTokens)):
        print('adding pool', i)
        liquidityMining.add(poolTokens[i], allocationPoints[i], withUpdate)

    liquidityMiningProxy.addAdmin(multisig)
    liquidityMiningProxy.setProxyOwner(multisig)
    liquidityMining.transferOwnership(multisig)

    if thisNetwork == "testnet":
        print('transferring SOV')
        SOVToken.transfer(liquidityMiningProxy.address, 50000e18)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
