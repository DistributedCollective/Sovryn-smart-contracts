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
    protocolAddress = contracts['sovrynProtocol']

    balanceBefore = acct.balance()

    # ================================ SOV StakingTN Rewards - SIP-0024 ===================================

    # deploy VestingRegistryLogic
    stakingLogic = acct.deploy(StakingTN)
    stakingProxy = acct.deploy(StakingProxyTN, contracts['SOV'])
    stakingProxy.setImplementation(stakingLogic.address)
    staking = Contract.from_abi(
        "StakingTN",
        address=stakingProxy.address,
        abi=StakingTN.abi,
        owner=acct)

    #deploy fee sharing contract
    feeSharing = acct.deploy(FeeSharingProxy, protocolAddress, staking.address)

    # set fee sharing
    staking.setFeeSharing(feeSharing.address)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
