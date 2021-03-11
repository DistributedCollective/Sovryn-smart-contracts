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

    TOKEN_PRICE = 9736

    if thisNetwork == "development":
        SOVtoken = acct.deploy(SOV, 10**26)
        protocolAddress = contracts['sovrynProtocol']
        stakingLogic = acct.deploy(Staking)
        staking = acct.deploy(StakingProxy, SOVtoken.address)
        staking.setImplementation(stakingLogic.address)
        staking = Contract.from_abi("Staking", address=staking.address, abi=Staking.abi, owner=acct)

        feeSharing = acct.deploy(FeeSharingProxy, protocolAddress, staking.address)
        staking.setFeeSharing(feeSharing.address)

        vestingLogic = acct.deploy(VestingLogic)
        vestingFactory = acct.deploy(VestingFactory, vestingLogic.address)
        vestingRegistry2 = acct.deploy(VestingRegistry, vestingFactory.address, SOVtoken.address, [], 1, staking.address, feeSharing.address, multisig)
        vestingFactory.transferOwnership(vestingRegistry2.address)

        balanceBefore = acct.balance()
        vestingCreator = acct.deploy(OrigingVestingCreator, vestingRegistry2)
        vestingRegistry2.addAdmin(vestingCreator.address)

        # TODO transfer from multisig
        SOVtoken.transfer(vestingRegistry2.address, 20751256676253082407040)
    else:
        balanceBefore = acct.balance()
        vestingCreator = Contract.from_abi("OrigingVestingCreator", address=contracts['OrigingVestingCreator'], abi=OrigingVestingCreator.abi, owner=acct)

    # == Vesting contracts =================================================================================================================
    btcAmount = 0
    vestingList = []
    with open('./scripts/deployment/vesting/BTC to be returned(PA).csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            # tokenOwner = row[1].replace(" ", "")
            tokenOwner = row[1]
            amount = int(int(float(row[2]) * 10**8 * 10**18) / TOKEN_PRICE)
            btcAmount += float(row[2])
            vestingList.append([tokenOwner, amount])

    with open('./scripts/deployment/vesting/BTC to be returned(R&U).csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            # tokenOwner = row[1].replace(" ", "")
            tokenOwner = row[1]
            amount = int(int(float(row[2]) * 10**8 * 10**18) / TOKEN_PRICE)
            btcAmount += float(row[2])
            vestingList.append([tokenOwner, amount])

    print("vestingList:")
    print(vestingList)

    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    # TODO 4 weeks - deployment should be done before 12.03.2021
    cliff = FOUR_WEEKS
    duration = cliff

    # Vesting / OwnerVesting
    vestingAmount = 0
    for vesting in vestingList:
        vestingAmount += vesting[1]
    print("Vesting Amount:", vestingAmount)
    print("BTC Amount:", btcAmount)

    for vesting in vestingList:
        tokenOwner = vesting[0]
        amount = vesting[1]

        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)
        print((duration - cliff) / FOUR_WEEKS + 1)

        vestingCreator.createVesting(tokenOwner, amount, cliff, duration)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
