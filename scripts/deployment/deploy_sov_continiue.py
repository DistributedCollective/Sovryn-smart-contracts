from brownie import *

import time
import json
import csv
import math

def main():
    thisNetwork = network.show_active()

    # == Governance Params =================================================================================================================
    # TODO set correct variables
    ownerQuorumVotes = 20
    ownerMajorityPercentageVotes = 70

    adminQuorumVotes = 5
    adminMajorityPercentageVotes = 50

    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
        ownerDelay = 3*60*60
        adminDelay = 3*60*60
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
        ownerDelay = 2*24*60*60
        adminDelay = 1*24*60*60
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
        ownerDelay = 2*24*60*60
        adminDelay = 1*24*60*60
    else:
        raise Exception("network not supported")

    # TODO check CSOV addresses in config files
    # load deployed contracts addresses
    contracts = json.load(configFile)
    multisig = contracts['multisig']
    timelockOwner = contracts['TimelockOwner']

    # TODO read from config
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    staking = Contract.from_abi("Staking", address=contracts['StakingProxy'], abi=Staking.abi, owner=acct)
    stakingProxy = Contract.from_abi("UpgradableProxy", address=contracts['StakingProxy'], abi=UpgradableProxy.abi, owner=acct)
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)

    MULTIPLIER = 10**16

    # == Vesting contracts ===============================================================================================================
    # TODO check vestings.csv
    teamVestingList = []
    vestingList = []
    with open('./scripts/deployment/vestings_continue.csv', 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[1].replace(" ", "")
            amount = row[2].replace(",", "").replace(".", "")
            amount = int(amount) * MULTIPLIER
            vestingData = row[4].split(" ")
            vestingType = vestingData[0]
            cliffAndDuration = vestingData[1].split("+")
            cliff = cliffAndDuration[0]
            duration = cliffAndDuration[1]
            if (vestingType == "MultisigVesting"):
                teamVestingList.append([tokenOwner, amount, cliff, duration])
            if (vestingType == "OwnerVesting"):
                vestingList.append([tokenOwner, amount, cliff, duration])
            # print("=======================================")
            # print(vestingType)
            # print("'" + tokenOwner + "', ")
            # print(amount)
            # print(cliff)
            # print(duration)

    print("teamVestingList:")
    print(teamVestingList)
    print("vestingList:")
    print(vestingList)

    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    # TODO 2 weeks delay ?
    CLIFF_DELAY = 2 * 7 * DAY

    # TeamVesting / MultisigVesting
    teamVestingAmount = 0
    for teamVesting in teamVestingList:
        teamVestingAmount += int(teamVesting[1])
    print("Team Vesting Amount: ", teamVestingAmount)
    # TODO SOV tokens already transferre
    # SOVtoken.transfer(vestingRegistry.address, teamVestingAmount)

    for teamVesting in teamVestingList:
        tokenOwner = teamVesting[0]
        amount = int(teamVesting[1])
        cliff = CLIFF_DELAY + int(teamVesting[2]) * FOUR_WEEKS
        duration = cliff + (int(teamVesting[3]) - 1) * FOUR_WEEKS
        vestingRegistry.createTeamVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
        vestingRegistry.stakeTokens(vestingAddress, amount)

        print("TeamVesting: ", vestingAddress)
        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)
        print((duration - cliff) / FOUR_WEEKS + 1)
        # stakes = staking.getStakes(vestingAddress)
        # print(stakes)

    # Vesting / OwnerVesting
    vestingAmount = 0
    for vesting in vestingList:
        vestingAmount += int(vesting[1])
    print("Vesting Amount: ", vestingAmount)
    SOVtoken.transfer(vestingRegistry.address, vestingAmount)

    for vesting in vestingList:
        tokenOwner = vesting[0]
        amount = int(vesting[1])
        cliff = CLIFF_DELAY + int(vesting[2]) * FOUR_WEEKS
        duration = cliff + (int(vesting[3]) - 1) * FOUR_WEEKS
        vestingRegistry.createVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getVesting(tokenOwner)
        vestingRegistry.stakeTokens(vestingAddress, amount)

        print("Vesting: ", vestingAddress)
        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)
        print((duration - cliff) / FOUR_WEEKS + 1)
        # stakes = staking.getStakes(vestingAddress)
        # print(stakes)

    #  == Transfer ownership to owner governor =============================================================================================
    # TODO transfer ownership of all these contracts to timelockOwner
    # SOVtoken.transferOwnership(timelockOwner)
    # staking.transferOwnership(timelockOwner)
    # stakingProxy.setProxyOwner(timelockOwner)
    # vestingRegistry.transferOwnership(multisig)

    print("balance:")
    print(SOVtoken.balanceOf(acct) / 10**18)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
