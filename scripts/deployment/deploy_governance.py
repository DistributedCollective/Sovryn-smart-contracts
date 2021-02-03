from brownie import *

import time
import json

def main():
    thisNetwork = network.show_active()

    # TODO set correct variables
    ownerQuorumVotes = 50
    ownerMinPercentageVotes = 70

    adminQuorumVotes = 5
    adminMinPercentageVotes = 20


    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
        delay = 3*60*60
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
        delay = 3*60*60
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
        delay = 2*24*60*60
    else:
        raise Exception("network not supported")


    # load deployed contracts addresses
    contracts = json.load(configFile)
    staking = contracts['staking']
    if (thisNetwork == "testnet" or thisNetwork == "rsk-mainnet"):
        guardian = contracts['multisig']
    else:
        guardian = acct

    # [timelockOwner]
    #params: owner, delay
    timelockOwner = acct.deploy(Timelock, acct, delay)
    #params: timelockOwner. staking, guardian

    governorOwner = acct.deploy(GovernorAlpha, timelockOwner.address, staking, guardian, ownerQuorumVotes, ownerMinPercentageVotes)

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

    governorAdmin = acct.deploy(GovernorAlpha, timelockAdmin.address, staking, guardian, adminQuorumVotes, adminMinPercentageVotes)

    dataString = timelockAdmin.setPendingAdmin.encode_input(governorAdmin.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + delay + 300
    print("schedule ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelockAdmin.queueTransaction(timelockAdmin.address, 0, "setPendingAdmin(address)", dataString[10:], eta)
