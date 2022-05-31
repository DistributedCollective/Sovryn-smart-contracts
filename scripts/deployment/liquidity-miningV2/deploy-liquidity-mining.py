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

    liquidityMiningLogicV2 = acct.deploy(LiquidityMiningV2)
    liquidityMiningProxyV2 = acct.deploy(LiquidityMiningProxyV2)
    liquidityMiningProxyV2.setImplementation(liquidityMiningLogicV2.address)
    liquidityMiningV2 = Contract.from_abi("LiquidityMiningV2", address=liquidityMiningProxyV2.address, abi=LiquidityMiningV2.abi, owner=acct)
    
    # TODO define values
    # Maximum reward per week: 100M SOV
    # Maximum reward per block: 4.9604 SOV (4.9604 * 2880 * 7 = 100001.664)

    # we need to multiply by 1000 to have 100 M
    rewardTokensPerBlock = 49604 * 10**14 * 1000 #100M per week

    # ~1 day in blocks (assuming 30s blocks)
    BLOCKS_PER_DAY = 2740
    BLOCKS_PER_HOUR = 114
    startDelayBlocks = 3 * BLOCKS_PER_DAY - 2 * BLOCKS_PER_HOUR
    numberOfBonusBlocks = 1 # ~1 day in blocks (assuming 30s blocks)
    wrapper = "0x0000000000000000000000000000000000000000" # can be updated later using setWrapper
    # The % (in Basis Point) which determines how much will be unlocked immediately.
    # 10000 is 100%
    unlockedImmediatelyPercent = 0 # 0%

    #Reward transfer logic

    SOVRewardTransferLogic = acct.deploy(LockedSOVRewardTransferLogic)
    SOVRewardTransferLogic.initialize(contracts['LockedSOV'],unlockedImmediatelyPercent)
    
    #add reward tokens
    liquidityMiningV2.addRewardToken(contracts['SOV'],rewardTokensPerBlock,startDelayBlocks,SOVRewardTransferLogic.address)

    liquidityMiningProxyV2.addAdmin(multisig)
    liquidityMiningProxyV2.setProxyOwner(multisig)
    liquidityMiningV2.transferOwnership(multisig)


    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
