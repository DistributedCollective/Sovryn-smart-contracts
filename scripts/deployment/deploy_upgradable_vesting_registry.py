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
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)
    multisig = contracts['multisig']
    teamVestingOwner = multisig
    SOVAddress = contracts['SOV']
    stakingAddress = contracts['Staking']
    feeSharingAddress = contracts['FeeSharingProxy']
    lockedSOVAddress = contracts['LockedSOV']
    vestingFactoryAddress = contracts['VestingFactory']
    vestingRegistryAddress = contracts['VestingRegistry']
    vestingRegistry2Address = contracts['VestingRegistry2']
    vestingRegistry3Address = contracts['VestingRegistry3']

    balanceBefore = acct.balance()

    # == VestingRegistry ===================================================================================================================

    # deploy VestingRegistryLogic
    vestingRegistryLogic = acct.deploy(VestingRegistryLogic)
    vestingRegistryProxy = acct.deploy(VestingRegistryProxy)
    vestingRegistryProxy.setImplementation(vestingRegistryLogic.address)
    vestingRegistry = Contract.from_abi(
        "VestingRegistryLogic",
        address=vestingRegistryProxy.address,
        abi=VestingRegistryLogic.abi,
        owner=acct)

    vestingRegistry.initialize(
        vestingFactoryAddress, SOVAddress, stakingAddress, feeSharingAddress, teamVestingOwner, vestingRegistryAddress, vestingRegistry2Address, vestingRegistry3Address
    )

    vestingRegistryProxy.addAdmin(multisig)
    vestingRegistryProxy.setProxyOwner(multisig)
    vestingRegistry.transferOwnership(multisig)

    # deploy VestingCreator
    vestingCreator = acct.deploy(vestingCreator, SOVAddress, vestingRegistry)

    vestingCreator.transferOwnership(multisig)
    vestingRegistry.addAdmin(vestingCreator)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
