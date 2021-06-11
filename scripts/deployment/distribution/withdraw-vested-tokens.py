from brownie import *

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

    # load deployed contracts addresses
    contracts = json.load(configFile)

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)

    vesting = vestingRegistry.getTeamVesting(acct)
    print(vesting)

    stakes = staking.getStakes(vesting)
    print(stakes)

    vestingLogic = Contract.from_abi("VestingLogic", address=vesting, abi=VestingLogic.abi, owner=acct)
    vestingLogic.withdrawTokens(acct)

    stakes = staking.getStakes(vesting)
    print(stakes)
