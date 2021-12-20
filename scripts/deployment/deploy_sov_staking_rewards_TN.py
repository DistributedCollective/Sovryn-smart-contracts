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
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet-ws":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)
    multisig = contracts['multisig']
    SOVAddress = contracts['SOV']
    stakingAddress = contracts['StakingTN']

    balanceBefore = acct.balance()

    # ================================ SOV StakingTN Rewards - SIP-0024 ===================================

    # deploy VestingRegistryLogic
    stakingRewardsLogic = acct.deploy(StakingRewardsTN)
    stakingRewardsProxy = acct.deploy(StakingRewardsProxyTN)
    stakingRewardsProxy.setImplementation(stakingRewardsLogic.address)
    stakingRewards = Contract.from_abi(
        "StakingRewardsTN",
        address=stakingRewardsProxy.address,
        abi=StakingRewardsTN.abi,
        owner=acct)

    stakingRewards.initialize(SOVAddress, stakingAddress)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
