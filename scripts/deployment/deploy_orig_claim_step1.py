from brownie import *

import time
import json
import csv
import math


def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
        ownerDelay = 3*60*60
        adminDelay = 3*60*60
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
        ownerDelay = 2*24*60*60
        adminDelay = 1*24*60*60
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
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

    vestingLogic = acct.deploy(VestingLogic)
    vestingFactory = acct.deploy(VestingFactory, vestingLogic.address)

    PRICE_SATS = 2500
    vestingRegistry = acct.deploy(VestingRegistry2, vestingFactory.address, contracts["SOV"], [
                                  contracts["CSOV1"], contracts["CSOV2"]], PRICE_SATS, contracts["Staking"], contracts["FeeSharingProxy"], teamVestingOwner)
    vestingFactory.transferOwnership(vestingRegistry.address)

    claimContract = acct.deploy(OriginInvestorsClaim, vestingRegistry.address)
    vestingRegistry.addAdmin(claimContract.address)
    claimContract.transferOwnership(multisig)

    print(
        '''
        Next steps:
        1. Set OriginInvestorsClaim address in the relevant config: testnet_contracts.js or mainnet_contracts.js
        2. Run deploy_orig_claim_step2.py to load investors list by chunks of 250 records
        3. Fund OriginInvestorsClaim with SOV = 9073250102711580000000 (DECIMALS == 18). Should equal to OriginInvestorsClaim.totalAmount()
        4. Run deploy_orig_claim_step2.py to notify the claim contract that users can claim their SOV
        5. Notify origin investors that they can claim their tokens with the cliff == duration == Mar 26 2021
        '''
    )
