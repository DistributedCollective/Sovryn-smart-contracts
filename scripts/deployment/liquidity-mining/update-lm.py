
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
    # updateLMConfig()
    addXUSDtoken()

    # check()
    # updateAllPools()

    # lend()
    # checkTxns()
    # checkUserBalance()

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

def addXUSDtoken():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)

    data = lm.add.encode_input(contracts['iXUSD'],1,False)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

def updateLMConfig():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)

    # SOV/rBTC - 15k SOV
    # ETH/rBTC - 15k SOV
    # xUSD/rBTC - 15k SOV
    # BNB/rBTC - 15k SOV

    MAX_ALLOCATION_POINT = 100000 * 1000 # 100 M
    # SOV/rBTC - 25k SOV
    ALLOCATION_POINT_BTC_SOV = 15000 # (WR)BTC/SOV
    # ETH/rBTC - 20k SOV
    ALLOCATION_POINT_BTC_ETH = 15000 # (WR)BTC/ETH
    # xUSD/rBTC - 20k SOV
    ALLOCATION_POINT_BTC_XUSD = 15000 # (WR)BTC/XUSD
    # BNB/rBTC - 35k SOV
    ALLOCATION_POINT_BTC_BNB = 15000 # (WR)BTC/BNB
    ALLOCATION_POINT_DEFAULT = 1 # (WR)BTC/USDT1 | (WR)BTC/USDT2 | (WR)BTC/DOC1 | (WR)BTC/DOC2 | (WR)BTC/BPRO1 | (WR)BTC/BPRO2 | (WR)BTC/MOC
    ALLOCATION_POINT_CONFIG_TOKEN = MAX_ALLOCATION_POINT - ALLOCATION_POINT_BTC_SOV - ALLOCATION_POINT_BTC_ETH - ALLOCATION_POINT_BTC_XUSD - ALLOCATION_POINT_BTC_BNB - ALLOCATION_POINT_DEFAULT * 7

    print("ALLOCATION_POINT_CONFIG_TOKEN: ", ALLOCATION_POINT_CONFIG_TOKEN)

    data = lm.update.encode_input(contracts['(WR)BTC/SOV'],ALLOCATION_POINT_BTC_SOV,True)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

    data = lm.update.encode_input(contracts['(WR)BTC/ETH'],ALLOCATION_POINT_BTC_ETH,True)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

    data = lm.update.encode_input(contracts['(WR)BTC/XUSD'],ALLOCATION_POINT_BTC_XUSD,True)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

    data = lm.update.encode_input(contracts['(WR)BTC/BNB'],ALLOCATION_POINT_BTC_BNB,True)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

    data = lm.update.encode_input(contracts['LiquidityMiningConfigToken'],ALLOCATION_POINT_CONFIG_TOKEN,True)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

def check():
    liquidityMining = Contract.from_abi("LiquidityMining", address=contracts['LiquidityMiningProxy'], abi=LiquidityMining.abi, owner=acct)
    print("MissedBalance: ", liquidityMining.getMissedBalance() / 10**18)
    print("TotalUsersBalance: ", liquidityMining.totalUsersBalance() / 10**18)

    print("Pool info list:")
    print(liquidityMining.getPoolInfoList())

def updateAllPools():
    liquidityMining = Contract.from_abi("LiquidityMining", address=contracts['LiquidityMiningProxy'], abi=LiquidityMining.abi, owner=acct)
    data = liquidityMining.updateAllPools.encode_input()
    print(data)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(liquidityMining.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def lend():
    token = Contract.from_abi("TestToken", address=contracts['DoC'], abi=TestToken.abi, owner=acct)
    loanToken = Contract.from_abi("LoanTokenLogicLM", address=contracts['iDOC'], abi=LoanTokenLogicLM.abi, owner=acct)

    print(acct)
    token.approve(loanToken.address, 4 * 10**18)
    loanToken.mint(acct, 2 * 10**18, False, {'allow_revert': True})
    loanToken.mint(acct, 2 * 10**18, True, {'allow_revert': True})

def checkTxns():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)

    # for i in range(229, 238):
    #     print(i)
    #     multisig.confirmTransaction(i)

    for i in range(166, 174):
        print(i)
        print(multisig.transactions(i))

def checkUserBalance():
    liquidityMining = Contract.from_abi("LiquidityMining", address=contracts['LiquidityMiningProxy'], abi=LiquidityMining.abi, owner=acct)
    poolId = liquidityMining.getUserPoolTokenBalance(contracts['iDOC'], acct)
    print(poolId / 10**18)
