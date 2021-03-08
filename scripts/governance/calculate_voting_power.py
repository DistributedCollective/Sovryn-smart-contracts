from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    calculateVotingPower(values['SOV_Amount_To_Stake'], values['Time_To_Stake'])

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

def calculateVotingPower(sovAmount, stakeTime):

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    
    weight = staking.computeWeightByDate(stakeTime, 0)
    votingPower = int(sovAmount) * weight

    print('======================================')
    print('SOV Token Amount:            '+str(sovAmount))
    print('Staking Time (in seconds):   '+str(stakeTime))
    print('Calculated Voting Power:     '+str(votingPower))
    print('======================================')
