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
    multisig = contracts['multisig']
    teamVestingOwner = multisig
    
    print('deploying account:', acct)

    sov = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)

    #CRITICAL by the time of running this script the new staking logic should be deployed and implemented
    # see deploy_staking_logic.py
    
    staking = Contract.from_abi("Staking", address=staking.address, abi=Staking.abi, owner=acct)
    
    vestingFactory = acct.deploy(VestingFactory, contracts['VestingLogic'])
    #vestingRegistryBase = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)

    PRICE_SATS = 2500
    vestingRegistry = acct.deploy(VestingRegistry2, vestingFactory.address, contracts['SOV'], [contracts["CSOV1"], contracts["CSOV2"]], PRICE_SATS, staking.address, feeSharing.address, teamVestingOwner)
    vestingFactory.transferOwnership(vestingRegistry.address)

    # this address got 400 too much
    MULTIPLIER = 10 ** 16
    vestingRegistry.setLockedAmount("0x0EE55aE961521fefcc8F7368e1f72ceF1190f2C9", 400 * 100 * MULTIPLIER)

    # this is the one who's tx got reverted
    vestingRegistry.setBlacklistFlag("0xd970fF09681a05e644cD28980B94a22c32c9526B", True)
    
    claimContract = acct.deploy(OriginInvestorsClaim, vestingRegistry.address)

    vestingRegistry.addAdmin(claimContract.address)

    #print('sov.balanceOf(acct)', sov.balanceOf(acct))
    #print('sov.totalSupply(): ', sov.totalSupply())

    #if sov.balanceOf(acct) < 100000 * 10 ** 18:
    #    sov.mint(acct, 100000 * 10 ** 18)

    #if sov.balanceOf(claimContract.address) < 50000 * 10 ** 18:
    #    sov.transfer(claimContract.address, 50000 * 10 ** 18)