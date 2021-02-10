from brownie import *

import time
import json
import csv

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
        cSOV1 = contracts['cSOV1']
        cSOV2 = contracts['cSOV2']
        guardian = contracts['multisig']
    else:
        cSOV1 = acct.deploy(TestToken, "cSOV1", "cSOV1", 18, 1e26).address
        cSOV2 = acct.deploy(TestToken, "cSOV2", "cSOV2", 18, 1e26).address
        guardian = acct

    balanceBefore = acct.balance()
    # == SOV ===============================================================================================================================
    #deploy SOV
    SOVtoken = acct.deploy(SOV, 1e26)
    print("balance:")
    print(SOVtoken.balanceOf(acct))

    MULTIPLIER = 10000000000000000

    # == Staking ===========================================================================================================================
    #deploy the staking contracts
    stakingLogic = acct.deploy(Staking)
    staking = acct.deploy(StakingProxy, SOVtoken.address)
    staking.setImplementation(stakingLogic.address)
    staking = Contract.from_abi("Staking", address=staking.address, abi=Staking.abi, owner=acct)

    #deploy fee sharing contract
    feeSharing = acct.deploy(FeeSharingProxy, protocolAddress, staking.address)

    # set fee sharing
    staking.setFeeSharing(feeSharing.address)

    # == Governor Owner ====================================================================================================================
    # [timelockOwner]
    #params: owner, delay
    timelockOwner = acct.deploy(Timelock, acct, ownerDelay)
    #params: timelockOwner. staking, guardian

    governorOwner = acct.deploy(GovernorAlpha, timelockOwner.address, staking.address, guardian, ownerQuorumVotes, ownerMajorityPercentageVotes)

    dataString = timelockOwner.setPendingAdmin.encode_input(governorOwner.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + ownerDelay + 300
    print("schedule ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockOwner.queueTransaction(timelockOwner.address, 0, "setPendingAdmin(address)", dataString[10:], eta)

    # GovernorVault Owner
    governorVaultOwner = acct.deploy(GovernorVault)
    governorVaultOwner.transferOwnership(timelockOwner.address)

    # == Governor Admin ====================================================================================================================
    # [timelockAdmin]
    #params: admin, delay
    timelockAdmin = acct.deploy(Timelock, acct, adminDelay)
    #params: timelockAdmin. staking, guardian

    governorAdmin = acct.deploy(GovernorAlpha, timelockAdmin.address, staking.address, guardian, adminQuorumVotes, adminMajorityPercentageVotes)

    dataString = timelockAdmin.setPendingAdmin.encode_input(governorAdmin.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + adminDelay + 300
    print("schedule ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockAdmin.queueTransaction(timelockAdmin.address, 0, "setPendingAdmin(address)", dataString[10:], eta)

    # GovernorVault Admin
    governorVaultAdmin = acct.deploy(GovernorVault)
    governorVaultAdmin.transferOwnership(timelockAdmin.address)

    # == VestingRegistry ===================================================================================================================
    #deploy VestingFactory
    vestingFactory = acct.deploy(VestingFactory)

    #deploy VestingRegistry
    PRICE_SATS = 2500
    vestingRegistry = acct.deploy(VestingRegistry, vestingFactory.address, SOVtoken.address, [cSOV1, cSOV2], PRICE_SATS, staking.address, feeSharing.address, teamVestingOwner)
    vestingFactory.transferOwnership(vestingRegistry.address)

    #  == Development and Adoption fund ====================================================================================================
    # line 72
    # TeamMultisig
    SOVtoken.transfer(multisig, 55311210 * MULTIPLIER)

    # line 73
    # GovAdmin
    SOVtoken.transfer(governorVaultAdmin, 80000000 * MULTIPLIER)

    # TODO duration = 30 days ?
    FUND_RELEASE_INTERVAL = 30 * 24 * 60 * 60

    developmentFundAmounts = []
    developmentFundReleaseDurations = []
    adoptionFundAmounts = []
    adoptionFundReleaseDurations = []

    # TODO check funds.csv
    # parse data
    with open('./scripts/deployment/funds.csv', 'r') as file:
        reader = csv.reader(file)
        rowNumber = 1
        for row in reader:
            if (rowNumber == 6): # Development Fund
                print("Development Fund")
                cellNumber = 1
                i = 1
                for cell in row:
                    if (cellNumber >= 4):
                        cell = cell.replace(",", "").replace(".", "")
                        cell = int(cell)
                        print(str(i) + "-" + str(cell))
                        developmentFundAmounts.append(cell * MULTIPLIER)
                        developmentFundReleaseDurations.append(FUND_RELEASE_INTERVAL)
                        i += 1
                    cellNumber += 1
            if (rowNumber == 9): # Adoption Fund
                print("Adoption Fund")
                cellNumber = 1
                i = 1
                for cell in row:
                    if (cellNumber >= 4):
                        cell = cell.replace(",", "").replace(".", "")
                        cell = int(cell) * 100
                        print(str(i) + "-" + str(cell))
                        adoptionFundAmounts.append(cell * MULTIPLIER)
                        adoptionFundReleaseDurations.append(FUND_RELEASE_INTERVAL)
                        i += 1
                    cellNumber += 1
            rowNumber += 1

    # line 74
    # Adoption Fund Vesting
    # TODO governorVaultOwner ?
    adoptionAmount = 3697104000 * MULTIPLIER
    adoptiontFund = acct.deploy(DevelopmentFund, SOVtoken.address, acct, governorVaultOwner, acct)
    SOVtoken.approve(adoptiontFund.address, adoptionAmount)
    adoptiontFund.depositTokens(adoptionAmount)
    print(adoptionFundReleaseDurations)
    print(adoptionFundAmounts)
    adoptiontFund.changeTokenReleaseSchedule(0, adoptionFundReleaseDurations, adoptionFundAmounts)
    adoptiontFund.updateLockedTokenOwner(timelockOwner.address)
    adoptiontFund.approveLockedTokenOwner()
    # TODO - onlyLockedTokenOwner - timelockOwner.address
    # adoptiontFund.updateUnlockedTokenOwner(timelockOwner.address)

    # line 75
    # Development Fund Vesting
    # TODO governorVaultOwner ?
    developmentAmount = 861859788 * MULTIPLIER
    developmentFund = acct.deploy(DevelopmentFund, SOVtoken.address, acct, governorVaultOwner, acct)
    SOVtoken.approve(developmentFund.address, developmentAmount)
    developmentFund.depositTokens(developmentAmount)
    print(developmentFundReleaseDurations)
    print(developmentFundAmounts)
    developmentFund.changeTokenReleaseSchedule(0, developmentFundReleaseDurations, developmentFundAmounts)
    developmentFund.updateLockedTokenOwner(multisig)
    developmentFund.approveLockedTokenOwner()
    # TODO - onlyLockedTokenOwner - multisig
    # developmentFund.updateUnlockedTokenOwner(timelockOwner.address)

    # line 76
    # Public Sale
    # OwnerGovernor
    SOVtoken.transfer(governorVaultOwner, 415925381 * MULTIPLIER)

    # line 77
    # Genesis Sale
    # GovAdmin
    SOVtoken.transfer(governorVaultAdmin, 264194619 * MULTIPLIER)

    # == Vesting contracts ===============================================================================================================
    # TODO check vestings.csv
    teamVestingList = []
    vestingList = []
    with open('./scripts/deployment/vestings.csv', 'r') as file:
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
        duration = cliff + int(teamVesting[3]) * FOUR_WEEKS
        vestingRegistry.createTeamVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
        vestingRegistry.stakeTokens(vestingAddress, amount)

        print("TeamVesting: ", vestingAddress)
        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)

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
        duration = cliff + int(vesting[3]) * FOUR_WEEKS
        vestingRegistry.createVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getVesting(tokenOwner)
        vestingRegistry.stakeTokens(vestingAddress, amount)

        print("Vesting: ", vestingAddress)
        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)

    #  == Transfer ownership to owner governor =============================================================================================
    # TODO transfer ownership of all these contracts to timelockOwner
    SOVtoken.transferOwnership(timelockOwner.address)
    staking.transferOwnership(timelockOwner.address)
    stakingProxy = Contract.from_abi("Proxy", address=staking.address, abi=Proxy.abi, owner=acct)
    stakingProxy.setProxyOwner(timelockOwner.address)
    # vestingRegistry.transferOwnership(timelockOwner.address)

    print("balance:")
    print(SOVtoken.balanceOf(acct))

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 1e18)
