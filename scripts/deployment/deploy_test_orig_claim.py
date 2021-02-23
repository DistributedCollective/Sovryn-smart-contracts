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

    balanceBefore = acct.balance()
    
    print('acct:', acct)
   
    claimContract=acct.deploy(OriginInvestorsClaim, contracts["VestingRegistry"])

    vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)
    
    vestingRegistry.addAdmin(claimContract.address)
    
    sov=Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    
    sov.mint(claimContract.address, 100000*10**18)

    claimContract.setInvestorsAmountsList(['0x88530bbfC00A149A51D6D72F7FA54c97C5ff363C', '0x2bD2201bfe156a71EB0d02837172FFc237218505', '0x7BE508451Cd748Ba55dcBE75c8067f9420909b49',
'0x96b6e7DC48066655E0388a1b6351e6719eDB7d52',
'0x6Df0d206431905C8D262DDB56c7928a8e4C4c040','0xA987a709f4A93eC25738FeC0F8d6189260459ed7'],[1500*10**18, 5000*10**18, 1000*10**18, 500*10**18, 2000*10**18, 7000*10**18])

    claimContract.setInvestorsAmountsListIntilized()
