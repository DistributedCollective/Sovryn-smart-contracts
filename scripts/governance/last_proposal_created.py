from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    checkLastProposalCreated(values['account'])

def loadConfig():
    global contracts, acct, values
    this_network = network.show_active()
    if this_network == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif this_network == "rsk-testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    contracts = json.load(configFile)
    values = json.load(open('./scripts/governance/values.json'))
    acct = accounts.load("rskdeployer")

def checkLastProposalCreated(acctAddress):

    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acctAddress)

    latestProposalID = governor.latestProposalIds(acctAddress)
    proposal = governor.getActions(latestProposalID)

    print('======================================')
    print('Last Proposal ID: '+str(latestProposalID))
    print('======================================')
    print('Last Proposal Parameters: '+str(proposal))
    print('======================================')
