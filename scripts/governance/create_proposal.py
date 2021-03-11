from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    createProposalSIP000(values['Proposal_Target'], values['Proposal_Signature'], values['Proposal_Data'], values['Proposal_Description'])

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

def createProposalSIP000(target, signature, data, description):
    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acct)

    print('======================================')
    print('Governor Address:    '+governor.address)
    print('Target:              '+str([target]))
    print('Values:              '+str([0]))
    print('Signature:           '+str([signature]))
    print('Data:                '+str([data]))
    print('Description:         '+str(description))
    print('======================================')

    # create proposal
    governor.propose([target],[0],[signature],[data],description)
