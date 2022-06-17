from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
#import scripts.contractInteraction.config as conf

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    totalVotingPower()

def loadConfig():
    global contracts, acct, values
    this_network = network.show_active()
    if this_network == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    if this_network == "rsk-mainnet-websocket":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif this_network == "rsk-testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    else:
        raise Exception("Network not supported.")
    contracts = json.load(configFile)
    acct = accounts.load("rskdeployer")

def totalVotingPower():

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    #len(chain) returns latest block + 1
    lastBlock = len(chain) - 2
    votingPower = staking.getPriorTotalVotingPower(lastBlock, time.time())
    print(votingPower/1e18)

