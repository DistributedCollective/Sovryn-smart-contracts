from brownie import *

import time
import json

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

    # TODO add CSOV addresses to config files
    # load deployed contracts addresses
    contracts = json.load(configFile)
    protocolAddress = contracts['sovrynProtocol']
    # TODO do we need another multisig ?
    multisig = contracts['multisig']
    teamVestingOwner = multisig
    if (thisNetwork == "testnet" or thisNetwork == "rsk-mainnet"):
        cSOV1 = contracts['cSOV1']
        cSOV2 = contracts['cSOV2']
    else:
        cSOV1 = acct.deploy(TestToken, "cSOV1", "cSOV1", 18, 1e26).address
        cSOV2 = acct.deploy(TestToken, "cSOV2", "cSOV2", 18, 1e26).address

    # == SOV ===============================================================================================================================
    #deploy SOV
    SOVtoken = acct.deploy(SOV, 1e26)

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

    # == VestingRegistry ===================================================================================================================
    #deploy VestingFactory
    vestingFactory = acct.deploy(VestingFactory)

    #deploy VestingRegistry
    PRICE_SATS = 2500
    vestingRegistry = acct.deploy(VestingRegistry, vestingFactory.address, SOVtoken.address, [cSOV1, cSOV2], PRICE_SATS, staking.address, feeSharing.address, teamVestingOwner)
    vestingFactory.transferOwnership(vestingRegistry.address)

    # == GovernorVault =====================================================================================================================
    # TODO Do we need to deploy new Vault ? Governance 1.0 is an owner of already deployed Vault
    # GovernorVault
    governorVault = acct.deploy(GovernorVault)
    governorVault.transferOwnership(multisig)

    # == Vesting contracts =================================================================================================================
    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY
    TWO_WEEKS = 2 * 7 * DAY

    # TODO add real data
    # TeamVesting / MultisigVesting
    cliff = 13 * TWO_WEEKS
    duration = 1092 * DAY
    teamVestingList = [
        [
            acct,
            100000000e18
        ]
    ]
    teamVestingAmount = 0
    for teamVesting in teamVestingList:
        amount = teamVesting[1]
        teamVestingAmount += amount
    print("Team Vesting Amount: ", teamVestingAmount)
    SOVtoken.transfer(vestingRegistry.address, teamVestingAmount)

    for teamVesting in teamVestingList:
        tokenOwner = teamVesting[0]
        amount = teamVesting[1]
        vestingRegistry.createTeamVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
        vestingRegistry.stakeTokens(vestingAddress, amount)

        print("TeamVesting: ", vestingAddress)
        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)

    # TODO add real data
    # Vesting / OwnerVesting
    vestingList = [
        [
            acct,
            100000000e18,
            6 * FOUR_WEEKS,
            13 * FOUR_WEEKS
        ]
    ]
    print()
    vestingAmount = 0
    for vesting in vestingList:
        amount = vesting[1]
        vestingAmount += amount
    print("Vesting Amount: ", vestingAmount)
    SOVtoken.transfer(vestingRegistry.address, vestingAmount)

    for vesting in vestingList:
        tokenOwner = vesting[0]
        amount = vesting[1]
        cliff = vesting[2]
        duration = vesting[3]
        vestingRegistry.createVesting(tokenOwner, amount, cliff, duration)
        vestingAddress = vestingRegistry.getVesting(tokenOwner)
        vestingRegistry.stakeTokens(vestingAddress, amount)

        print("Vesting: ", vestingAddress)
        print(tokenOwner)
        print(amount)
        print(cliff)
        print(duration)

    #  == Development and Adoption fund ====================================================================================================
    # Development fund
    # TODO initially multisig for both owners
    # developmentFund = acct.deploy(DevelopmentFund, SOVtoken.address, multisig, governorVault, multisig)
    # developmentFund.depositTokens(10000000e18)

    # Adoption fund
    # TODO initially multisig for both owners
    # adoptiontFund = acct.deploy(DevelopmentFund, SOVtoken.address, multisig, governorVault, multisig)
    # adoptiontFund.depositTokens(38100000e18)

    # TODO where to move rest of the tokens ?
