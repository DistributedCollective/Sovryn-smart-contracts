
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    #call the function you want here
    # addTestETHPoolToken()
    # addETHPoolToken()
    updatePoolToken()


def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("Network not supported.")
    contracts = json.load(configFile)

def addTestETHPoolToken():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)
    data = lm.add.encode_input(contracts['(WR)BTC/ETH'],1,False)

    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

def addETHPoolToken():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)

    MAX_ALLOCATION_POINT = 100000 * 1000 # 100 M
    ALLOCATION_POINT_BTC_SOV = 40000 # (WR)BTC/SOV
    ALLOCATION_POINT_BTC_ETH = 1 # or 30000 (WR)BTC/ETH
    ALLOCATION_POINT_DEFAULT = 1 # (WR)BTC/USDT1 | (WR)BTC/USDT2 | (WR)BTC/DOC1 | (WR)BTC/DOC2 | (WR)BTC/BPRO1 | (WR)BTC/BPRO2
    ALLOCATION_POINT_CONFIG_TOKEN = MAX_ALLOCATION_POINT - ALLOCATION_POINT_BTC_SOV - ALLOCATION_POINT_BTC_ETH - ALLOCATION_POINT_DEFAULT * 6

    print("ALLOCATION_POINT_CONFIG_TOKEN: ", ALLOCATION_POINT_CONFIG_TOKEN)

    data = lm.add.encode_input(contracts['(WR)BTC/ETH'],ALLOCATION_POINT_BTC_ETH,False)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

    data = lm.update.encode_input(contracts['LiquidityMiningConfigToken'],ALLOCATION_POINT_CONFIG_TOKEN,True)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

def updatePoolToken():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)

    MAX_ALLOCATION_POINT = 100000 * 1000 # 100 M
    ALLOCATION_POINT_BTC_SOV = 30000 # (WR)BTC/SOV
    ALLOCATION_POINT_BTC_ETH = 35000 # (WR)BTC/ETH
    ALLOCATION_POINT_DEFAULT = 1 # (WR)BTC/USDT1 | (WR)BTC/USDT2 | (WR)BTC/DOC1 | (WR)BTC/DOC2 | (WR)BTC/BPRO1 | (WR)BTC/BPRO2
    ALLOCATION_POINT_CONFIG_TOKEN = MAX_ALLOCATION_POINT - ALLOCATION_POINT_BTC_SOV - ALLOCATION_POINT_BTC_ETH - ALLOCATION_POINT_DEFAULT * 6

    print("ALLOCATION_POINT_CONFIG_TOKEN: ", ALLOCATION_POINT_CONFIG_TOKEN)

    data = lm.update.encode_input(contracts['(WR)BTC/SOV'],ALLOCATION_POINT_BTC_SOV,False)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

    data = lm.update.encode_input(contracts['LiquidityMiningConfigToken'],ALLOCATION_POINT_CONFIG_TOKEN,True)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)
