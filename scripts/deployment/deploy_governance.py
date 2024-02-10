from brownie import *

import time
import json

# TODO DEPRECATED
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
        ownerDelay = 3*60*60 #ownerDelay = 2*24*60*60
        adminDelay = 3*60*60 #adminDelay = 1*24*60*60
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
        ownerDelay = 2*24*60*60
        adminDelay = 1*24*60*60
    else:
        raise Exception("network not supported")


    # load deployed contracts addresses
    contracts = json.load(configFile)
    staking = contracts['Staking']
    if (thisNetwork == "testnet" or thisNetwork == "rsk-mainnet"):
        guardian = contracts['multisig']
    else:
        guardian = acct

    # == Governor Owner ====================================================================================================================
    # [timelockOwner]
    #params: owner, delay
    timelockOwner = acct.deploy(Timelock, acct, ownerDelay)
    #params: timelockOwner. staking, guardian

    governorOwner = acct.deploy(GovernorAlpha, timelockOwner.address, staking, guardian, ownerQuorumVotes, ownerMajorityPercentageVotes)

    dataString = timelockOwner.setPendingAdmin.encode_input(governorOwner.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + ownerDelay + 300
    print("schedule ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockOwner.queueTransaction(timelockOwner.address, 0, "setPendingAdmin(address)", dataString[10:], eta)

    # == Governor Admin ====================================================================================================================
    # [timelockAdmin]
    #params: admin, delay
    timelockAdmin = acct.deploy(Timelock, acct, adminDelay)
    #params: timelockAdmin. staking, guardian

    governorAdmin = acct.deploy(GovernorAlpha, timelockAdmin.address, staking, guardian, adminQuorumVotes, adminMajorityPercentageVotes)

    dataString = timelockAdmin.setPendingAdmin.encode_input(governorAdmin.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + adminDelay + 300
    print("schedule ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockAdmin.queueTransaction(timelockAdmin.address, 0, "setPendingAdmin(address)", dataString[10:], eta)

    # THE NEXT STEPS
    # 1) EXECUTE QUEUED TRANSACTIONS AFTER ETA (SHOULD BE NOTED AT THE QUEUEING)
    '''
    timelockOwner =  Contract.from_abi("Timelock", address=conf.contracts["TimelockOwner"], abi=Timelock.abi, owner=conf.acct)
    governorOwner =  Contract.from_abi("GovernorAlpha", address=conf.contracts["GovernorOwner"], abi=GovernorAlpha.abi, owner=conf.acct)
    dataString = timelockOwner.setPendingAdmin.encode_input(governorOwner.address)
    eta = 1695947000 # taken from queueing tx 
    print("executing TimelockOwner ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockOwner.executeTransaction(timelockOwner.address, 0, "setPendingAdmin(address)", dataString[10:], eta)
    '''

    '''
    timelockAdmin =  Contract.from_abi("Timelock", address=conf.contracts["TimelockAdmin"], abi=Timelock.abi, owner=conf.acct)
    governorAdmin =  Contract.from_abi("GovernorAlpha", address=conf.contracts["GovernorAdmin"], abi=GovernorAlpha.abi, owner=conf.acct)
    dataString = timelockAdmin.setPendingAdmin.encode_input(governorAdmin.address)
    eta = 1695947113 # taken from queueing tx
    print("executing TimelockAdmin ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockAdmin.executeTransaction(timelockAdmin.address, 0, "setPendingAdmin(address)", dataString[10:], eta)
    '''
    
    # 2) OWNERSHIP SHOULD BE ACCEPTED BY MULTISIG
    '''
    governorAcceptAdmin("GovernorOwner")
    governorAcceptAdmin("GovernorAdmin")
    '''

