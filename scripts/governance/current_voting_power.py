from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    #currentVotingPower(values['account'])
    currentVotingPower('0x5426beDCE76FD991da29339E3d72021e57794079')

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

def currentVotingPower(acctAddress):

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acctAddress)
    governor = Contract.from_abi("GovernorAlpha", address=contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=acctAddress)
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acctAddress)
    balance = SOVtoken.balanceOf(acctAddress)

    votingPower = staking.getCurrentVotes(acctAddress)
    proposalThreshold = governor.proposalThreshold()

    print('======================================')
    print('Your Address:        '+str(acctAddress))
    print('Your Token Balance:  '+str(balance))
    print('Your Voting Power:   '+str(votingPower))
    print('Proposal Threshold:  '+str(proposalThreshold))
    print('======================================')
