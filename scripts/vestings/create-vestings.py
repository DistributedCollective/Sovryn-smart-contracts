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
        # configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)
    multisig = contracts['multisig']

    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)

    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    cliff = FOUR_WEEKS
    duration = 6 * FOUR_WEEKS

    tokenOwner = "0x715F62e75f09FD2a097a48640c269C3A0C50D2a0"
    amount = 4000 * 10**18
    SOVtoken.transfer(contracts['VestingRegistry'], amount)
    vestingRegistry.createVesting(tokenOwner, amount, cliff, duration)
    vestingAddress = vestingRegistry.getVesting(tokenOwner)
    vestingRegistry.stakeTokens(vestingAddress, amount)

    tokenOwner = "0x715F62e75f09FD2a097a48640c269C3A0C50D2a0"
    amount = 5000 * 10**18
    SOVtoken.transfer(contracts['VestingRegistry'], amount)
    vestingRegistry.createTeamVesting(tokenOwner, amount, cliff, duration)
    vestingAddress = vestingRegistry.getTeamVesting(tokenOwner)
    vestingRegistry.stakeTokens(vestingAddress, amount)
