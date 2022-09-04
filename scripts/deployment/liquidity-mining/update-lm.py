
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.

brownie run scripts/deployment/liquidity-mining/update-lm.py --network testnet
brownie run scripts/deployment/liquidity-mining/update-lm.py --network rsk-mainnet
'''

from brownie import *
import json

def main():
    
    #load the contracts and acct depending on the network
    loadConfig()

    #call the function you want here
    # addTestETHPoolToken()
    # addETHPoolToken()
    updateLMConfig()
    # addFISHtoken()
    # addBRZtoken()

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

def addFISHtoken():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)

    data = lm.add.encode_input(contracts['(WR)BTC/FISH'],1,False)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

def addBRZtoken():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)

    data = lm.add.encode_input(contracts['XUSD/BRZ'],1,False)
    tx = multisig.submitTransaction(lm.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("txid",txId)

# step 1: update the allocation points. any pool which should not get rewards is set to 1
# step 2: adjust the input for the update call to contain the allocation points which change. this always includes the Liqudity Mining Config Token
def updateLMConfig():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    lm = Contract.from_abi("LiquidityMining", address = contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = acct)

    MAX_ALLOCATION_POINT = 100000 * 1000 # 100 M
    # SOV/rBTC - 25k SOV
    ALLOCATION_POINT_BTC_SOV = 25000 # (WR)BTC/SOV

    # xUSD/rBTC - 25k SOV
    ALLOCATION_POINT_BTC_XUSD = 25000 # (WR)BTC/XUSD

    ALLOCATION_POINT_I_XUSD =  1 # iXUSD

    ALLOCATION_POINT_DEFAULT = 1 # 12 tokens with 1 alloc point to account: (WR)BTC/USDT1 | (WR)BTC/USDT2 | (WR)BTC/DOC1 | (WR)BTC/DOC2 | (WR)BTC/BPRO1 | (WR)BTC/BPRO2 | (WR)BTC/MOC | (WR)BTC/FISH | (WR)BTC/RIF | (WR)BTC/MYNT | (WR)BTC/BNB | (WR)BTC/ETH
    ALLOCATION_POINT_CONFIG_TOKEN = MAX_ALLOCATION_POINT - ALLOCATION_POINT_BTC_SOV - ALLOCATION_POINT_BTC_XUSD \
                                     - ALLOCATION_POINT_I_XUSD - ALLOCATION_POINT_DEFAULT * 12

    print("ALLOCATION_POINT_CONFIG_TOKEN: ", ALLOCATION_POINT_CONFIG_TOKEN)

    print('LiquidityMiningConfigToken:', lm.getPoolInfo(contracts['LiquidityMiningConfigToken']))
    print('iXUSD:',lm.getPoolInfo(contracts['iXUSD']))

    #update this before executing
    data = lm.updateTokens.encode_input(
        [contracts['iXUSD'], contracts['LiquidityMiningConfigToken']],
        [ALLOCATION_POINT_I_XUSD, ALLOCATION_POINT_CONFIG_TOKEN],
        True
    )
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
