from brownie import *

import time
import json

def main():
    thisNetwork = network.show_active()

    #@todo put correct variables
    ownerQuorumVotes = 70
    ownerMinPercentageVotes = 50

    adminQuorumVotes = 4
    adminMinPercentageVotes = 50

    if thisNetwork == "development":
        acct = accounts[0]
        # configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
        guardian = acct
        SOV = acct.deploy(TestToken, "SOV", "SOV", 18, 1e26).address
        delay = 2*24*60*60
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
        SOV = '0x04fa98E97A376a086e3BcAB99c076CB249e5740D'
        delay = 3*60*60
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
        delay = 2*24*60*60
        raise Exception("set guardian and SOV token!")
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)
    protocolAddress = contracts['sovrynProtocol']
    if (thisNetwork == "testnet" or thisNetwork == "rsk-mainnet"):
        guardian = contracts['multisig']

    #deploy the staking contracts
    stakingLogic = acct.deploy(Staking)
    staking = acct.deploy(StakingProxy, SOV)
    staking.setImplementation(stakingLogic.address)
    staking = Contract.from_abi("Staking", address=staking.address, abi=Staking.abi, owner=acct)

    #deploy fee sharing contract
    feeSharing = acct.deploy(FeeSharingProxy, protocolAddress, staking.address)

    # set fee sharing
    staking.setFeeSharing(feeSharing.address)

    # [timelockOwner]
    #params: owner, delay
    timelockOwner = acct.deploy(Timelock, acct, delay)
    #params: timelockOwner. staking, guardian

    governorOwner = acct.deploy(GovernorAlpha, timelockOwner.address, staking.address, guardian, ownerQuorumVotes, ownerMinPercentageVotes)

    dataString = timelockOwner.setPendingAdmin.encode_input(governorOwner.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + delay + 300
    print("schedule ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockOwner.queueTransaction(timelockOwner.address, 0, "setPendingAdmin(address)", dataString[10:], eta)

    # [timelockAdmin]
    #params: admin, delay
    timelockAdmin = acct.deploy(Timelock, acct, delay)
    #params: timelockAdmin. staking, guardian

    governorAdmin = acct.deploy(GovernorAlpha, timelockAdmin.address, staking.address, guardian, adminQuorumVotes, adminMinPercentageVotes)

    dataString = timelockAdmin.setPendingAdmin.encode_input(governorAdmin.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + delay + 300
    print("schedule ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockAdmin.queueTransaction(timelockAdmin.address, 0, "setPendingAdmin(address)", dataString[10:], eta)
