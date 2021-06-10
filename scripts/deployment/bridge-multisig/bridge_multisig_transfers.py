
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
import json

def main():

    #load the contracts and acct depending on the network
    loadConfig()

    #call the function you want here

    # RSK-USDTes 0.01
    # sendTokensFromBridgeRSKMultisig(contracts['RSK-USDTes'], 10**16)

    sendTokensFromBridgeETHMultisig(contracts['ETH-USDT'], 10**16)



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

def sendTokensFromBridgeRSKMultisig(token, amount):
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=acct)

    bridgeRSKMultisig = Contract.from_abi("MultiSig", address=contracts['BridgeRSKMultisig'], abi=MultiSigWallet.abi, owner=acct)

    receiver = contracts['multisig']
    data = tokenContract.transfer.encode_input(receiver, amount)
    print(data)
    tx = bridgeRSKMultisig.submitTransaction(token,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def sendTokensFromBridgeETHMultisig(token, amount):
    abiFile =  open('./scripts/deployment/bridge-multisig/Bridge.json')
    abi = json.load(abiFile)
    bridgeETH = Contract.from_abi("BridgeETH", address=contracts['BridgeETH'], abi=abi, owner=acct)
    bridgeETHMultisig = Contract.from_abi("MultiSig", address=contracts['BridgeETHMultisig'], abi=MultiSigWallet.abi, owner=acct)

    aggregator = contracts['Aggregator-ETH-RSK']
    receiver = contracts['multisig']

    data = bridgeETH.receiveTokensAt.encode_input(token, amount, aggregator, receiver)
    print(data)
    tx = bridgeETHMultisig.submitTransaction(bridgeETH.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
