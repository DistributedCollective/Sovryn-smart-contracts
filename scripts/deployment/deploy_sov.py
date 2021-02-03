from brownie import *

import time
import json

def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
        cSOV1 = acct.deploy(TestToken, "cSOV1", "cSOV1", 18, 1e26).address
        cSOV2 = acct.deploy(TestToken, "cSOV2", "cSOV2", 18, 1e26).address

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
    protocolAddress = contracts['sovrynProtocol']
    if (thisNetwork == "testnet" or thisNetwork == "rsk-mainnet"):
        vestingOwner = contracts['multisig']
    else:
        vestingOwner = acct

    #deploy SOV
    SOVtoken = acct.deploy(SOV, 1e26).address



    #deploy the staking contracts
    stakingLogic = acct.deploy(Staking)
    staking = acct.deploy(StakingProxy, SOVtoken)
    staking.setImplementation(stakingLogic.address)
    staking = Contract.from_abi("Staking", address=staking.address, abi=Staking.abi, owner=acct)

    #deploy fee sharing contract
    feeSharing = acct.deploy(FeeSharingProxy, protocolAddress, staking.address)

    # set fee sharing
    staking.setFeeSharing(feeSharing.address)



    #deploy VestingFactory
    vestingFactory = acct.deploy(VestingFactory).address

    #deploy VestingRegistry
    vestingRegistry = acct.deploy(VestingRegistry, vestingFactory, SOVtoken, [cSOV1, cSOV2], staking.address, feeSharing.address, vestingOwner)

    # TeamVesting
    

    # Vesting


    # Development fund


    # Adoption fund


    # TODO Ecosystem fund, Programmatic sale
