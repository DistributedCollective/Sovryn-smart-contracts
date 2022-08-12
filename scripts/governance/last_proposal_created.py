from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    checkLastProposalCreated('0x27D55f5668ef4438635bdce0ADCA083507E77752')

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

    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorAdmin'], abi=GovernorAlpha.abi, owner=acctAddress)

    latestProposalID = governor.latestProposalIds(acctAddress)
    proposal = governor.getActions(latestProposalID)

    print('======================================')
    print('Last Proposal ID: '+str(latestProposalID))
    print('======================================')
    print('Last Proposal Parameters: '+str(proposal))
    print('======================================')
