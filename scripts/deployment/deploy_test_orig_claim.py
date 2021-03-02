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

    balanceBefore = acct.balance()
    
    print('deploying acct:', acct)

    #sov = acct.deploy(SOV, 10**26)
    #print("SOV deployed; balance of acct: ", sov.balanceOf(acct))

    #print('VestingRegistry: ', contracts['VestingRegistry'])
   
    #claimContract = acct.deploy(OriginInvestorsClaim, contracts["VestingRegistry"])

    #vestingRegistry = Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct)

    # need to be owner to transfer or mint
    sov = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)

    #deploy the staking contracts
    stakingLogic = acct.deploy(Staking)
    staking = acct.deploy(StakingProxy, contracts['SOV'])
    staking.setImplementation(stakingLogic.address)
    staking = Contract.from_abi("Staking", address=staking.address, abi=Staking.abi, owner=acct)

    #deploy fee sharing contract
    #feeSharing = acct.deploy(FeeSharingProxy, contracts["sovrynProtocol"], staking.address)

    # set fee sharing
    staking.setFeeSharing(feeSharing.address)

    #staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    feeSharingAddress = staking.feeSharing()

    print('feeSharingAddress: ', feeSharingAddress)

    #this is one-time vesting registry for origin sales investors claim exclusively
    #deploy VestingFactory
    
    vestingLogic = acct.deploy(VestingLogic)
    vestingFactory = acct.deploy(VestingFactory, vestingLogic.address)
    PRICE_SATS = 2500
    vestingRegistry = acct.deploy(VestingRegistry2, vestingFactory.address, contracts['SOV'], [contracts["CSOV1"], contracts["CSOV2"]], PRICE_SATS, staking.address, feeSharingAddress, teamVestingOwner)
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

    if sov.balanceOf(acct) < 100000 * 10 ** 18:
        sov.mint(acct, 100000 * 10 ** 18)

    if sov.balanceOf(claimContract.address) < 50000 * 10 ** 18:
        sov.transfer(claimContract.address, 50000 * 10 ** 18)
    
   # print('sov.balance: ', sov.balance())
    
   # print('sov.balanceOf(claimContract.address): ', sov.balanceOf(claimContract.address))


    claimContract.appendInvestorsAmountsList(['0x88530bbfC00A149A51D6D72F7FA54c97C5ff363C', '0x2bD2201bfe156a71EB0d02837172FFc237218505', '0x7BE508451Cd748Ba55dcBE75c8067f9420909b49',
'0x96b6e7DC48066655E0388a1b6351e6719eDB7d52',
'0x6Df0d206431905C8D262DDB56c7928a8e4C4c040','0xA987a709f4A93eC25738FeC0F8d6189260459ed7'],[1500 * 10 ** 18, 5000 * 10 ** 18, 1000 * 10 ** 18, 500 * 10 ** 18, 2000 * 10 ** 18, 7000 * 10 ** 18])

    claimContract.setInvestorsAmountsListIntilized()
