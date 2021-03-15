from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    stakeTokens(values['SOV_Amount_To_Stake'], values['Time_To_Stake'], values['account'], values['delegatee'])

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

def stakeTokens(sovAmount, stakeTime, acctAddress, delegateeAddress):
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acctAddress)
    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acctAddress)

    until = int(time.time()) + int(stakeTime)
    amount = int(sovAmount) * (10 ** 18)

    SOVtoken.approve(staking.address, amount)
    tx = staking.stake(amount, until, acctAddress, delegateeAddress)
