
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
    upgradeLiquidityMiningLogic()


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

def upgradeLiquidityMiningLogic():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    liquidityMiningProxy = Contract.from_abi("LiquidityMiningProxy", address = contracts['LiquidityMiningProxy'], abi = UpgradableProxy.abi, owner = acct)

    liquidityMiningLogic = acct.deploy(LiquidityMining)
    print("liquidityMiningLogic: ", liquidityMiningLogic.address)

    data = liquidityMiningProxy.setImplementation.encode_input(liquidityMiningLogic.address)
    print(data)

    tx = multisig.submitTransaction(liquidityMiningProxy.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)
