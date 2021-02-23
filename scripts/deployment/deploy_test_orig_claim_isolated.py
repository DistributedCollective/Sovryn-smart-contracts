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
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
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
    protocolAddress = contracts['sovrynProtocol']
    multisig = contracts['multisig']
    teamVestingOwner = multisig
    if (thisNetwork == "testnet" or thisNetwork == "rsk-mainnet"):
        cSOV1 = contracts['CSOV1']
        cSOV2 = contracts['CSOV2']
        guardian = contracts['multisig']
    else:
        cSOV1 = acct.deploy(TestToken, "cSOV1", "cSOV1", 18, 1e26).address
        cSOV2 = acct.deploy(TestToken, "cSOV2", "cSOV2", 18, 1e26).address
        guardian = acct

    balanceBefore = acct.balance()
    # == SOV ===============================================================================================================================
    #deploy SOV
    SOVtoken = acct.deploy(SOV, 10**26)
    print("balance:")
    print(SOVtoken.balanceOf(acct))

    MULTIPLIER = 10**16

    # == VestingRegistry ===================================================================================================================
    #deploy VestingFactory
    print('acct:', acct)
    vestingLogic = acct.deploy(VestingLogic)
    vestingFactory = acct.deploy(VestingFactory, vestingLogic.address)

    #deploy VestingRegistry
    PRICE_SATS = 2500

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    #Contract.from_abi("OriginInvestorsClaim", address=contracts['OriginInvestorsClaim'], abi=OriginInvestorsClaim.abi, owner=acct)
    vestingRegistry=acct.deploy(VestingRegistry, vestingFactory.address, SOVtoken.address, [cSOV1, cSOV2], PRICE_SATS, contracts['Staking'], staking.feeSharing(), teamVestingOwner)
    print("Vesting registry: ", vestingRegistry.address)

    claimContract=acct.deploy(OriginInvestorsClaim, vestingRegistry.address)

    print("OriginInvestorsClaim contract: ", claimContract.address)
    
    vestingRegistry.addAdmin(claimContract.address)

    vestingFactory.transferOwnership(vestingRegistry.address)

    # this address got 400 too much
    # MULTIPLIER = 10^16
    vestingRegistry.setLockedAmount("0x0EE55aE961521fefcc8F7368e1f72ceF1190f2C9", 400 * 100 * MULTIPLIER)

    # this is the one who's tx got reverted
    vestingRegistry.setBlacklistFlag("0xd970fF09681a05e644cD28980B94a22c32c9526B", True)

    # == Vesting contracts ===============================================================================================================
    # TODO check vestings.csv
    teamVestingList = []
    vestingList = []
    with open('./scripts/deployment/vestings_test.csv', 'r') as file:
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
    SOVtoken.transfer(vestingRegistry.address, teamVestingAmount)

    for teamVesting in teamVestingList:
        tokenOwner = teamVesting[0]
        amount = int(teamVesting[1])
        cliff = CLIFF_DELAY + int(teamVesting[2]) * FOUR_WEEKS
        duration = cliff + (int(teamVesting[3]) - 1) * FOUR_WEEKS
        vestingRegistry.createTeamVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)

        print("TeamVesting: ", vestingAddress)
        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)
        print((duration - cliff) / FOUR_WEEKS + 1)
        vestingRegistry.stakeTokens(vestingAddress, amount)

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

        print("Vesting: ", vestingAddress)
        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)
        print((duration - cliff) / FOUR_WEEKS + 1)
        vestingRegistry.stakeTokens(vestingAddress, amount)

        # stakes = staking.getStakes(vestingAddress)
        # print(stakes)

    #  == Transfer ownership to owner governor =============================================================================================
    # TODO transfer ownership of all these contracts to timelockOwner
    # SOVtoken.transferOwnership(timelockOwner.address)
    # staking.transferOwnership(timelockOwner.address)
    # stakingProxy = Contract.from_abi("UpgradableProxy", address=staking.address, abi=UpgradableProxy.abi, owner=acct)
    # stakingProxy.setProxyOwner(timelockOwner.address)
    # vestingRegistry.transferOwnership(multisig)

    print("balance:")
    print(SOVtoken.balanceOf(acct) / 10**18)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
