from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def setLiquidityMiningAddressOnAllContracts():
    print("setting LM address")
    setLiquidityMiningAddress(conf.contracts['iDOC'])
    setLiquidityMiningAddress(conf.contracts['iUSDT'])
    setLiquidityMiningAddress(conf.contracts['iBPro'])
    setLiquidityMiningAddress(conf.contracts['iXUSD'])
    setLiquidityMiningAddress(conf.contracts['iRBTC'])

def getLiquidityMiningAddress(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicLM.abi, owner=conf.acct)
    print(loanToken.liquidityMiningAddress())
    print(loanToken.target_())

def setLiquidityMiningAddress(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicLM.abi, owner=conf.acct)
    data = loanToken.setLiquidityMiningAddress.encode_input(conf.contracts['LiquidityMiningProxy'])

    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def getLiquidityMiningAddressOnAllContracts():
    print("setting LM address")
    getLiquidityMiningAddress(conf.contracts['iDOC'])
    getLiquidityMiningAddress(conf.contracts['iUSDT'])
    getLiquidityMiningAddress(conf.contracts['iBPro'])
    getLiquidityMiningAddress(conf.contracts['iRBTC'])

def setWrapperOnLM():
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    data = lm.setWrapper.encode_input(conf.contracts['RBTCWrapperProxy'])
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)


def getPoolId(poolToken):
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    print(lm.getPoolId(poolToken))


def getLMInfo():
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    print(lm.getPoolLength())
    print(lm.getPoolInfoList())
    print(lm.wrapper())

def setLockedSOV(newLockedSOV):
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    data = lm.setLockedSOV.encode_input(newLockedSOV)
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)

def addPoolsToLM():
    liquidityMining = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    # TODO prepare pool tokens list
    poolTokens = [conf.contracts['(WR)BTC/USDT1'], conf.contracts['(WR)BTC/USDT2'], conf.contracts['(WR)BTC/DOC1'], conf.contracts['(WR)BTC/DOC2'], conf.contracts['(WR)BTC/BPRO1'], conf.contracts['(WR)BTC/BPRO2']]
    allocationPoints = [1, 1, 1, 1, 1, 1]
    # token weight = allocationPoint / SUM of allocationPoints for all pool tokens
    withUpdate = False # can be False if we adding pool tokens before mining started
    for i in range(0,len(poolTokens)):
        print('adding pool', i)
        data = liquidityMining.add.encode_input(poolTokens[i], allocationPoints[i], withUpdate)
        print(data)
        sendWithMultisig(conf.contracts['multisig'], liquidityMining.address, data, conf.acct)
    data = liquidityMining.updateAllPools.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], liquidityMining.address, data, conf.acct)

def addMOCPoolToken():
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    MAX_ALLOCATION_POINT = 100000 * 1000 # 100 M
    ALLOCATION_POINT_BTC_SOV = 30000 # (WR)BTC/SOV
    ALLOCATION_POINT_BTC_ETH = 35000 # or 30000 (WR)BTC/ETH
    ALLOCATION_POINT_DEFAULT = 1 # (WR)BTC/USDT1 | (WR)BTC/USDT2 | (WR)BTC/DOC1 | (WR)BTC/DOC2 | (WR)BTC/BPRO1 | (WR)BTC/BPRO2 | (WR)BTC/MOC
    ALLOCATION_POINT_CONFIG_TOKEN = MAX_ALLOCATION_POINT - ALLOCATION_POINT_BTC_SOV - ALLOCATION_POINT_BTC_ETH - ALLOCATION_POINT_DEFAULT * 7
    print("ALLOCATION_POINT_CONFIG_TOKEN: ", ALLOCATION_POINT_CONFIG_TOKEN)
    data = lm.add.encode_input(conf.contracts['(WR)BTC/MOC'],1,False)
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)
    data = lm.update.encode_input(conf.contracts['LiquidityMiningConfigToken'],ALLOCATION_POINT_CONFIG_TOKEN,True)
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)

def transferSOVtoLM(amount):
    liquidityMining = conf.contracts['LiquidityMiningProxy']
    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    data = SOVtoken.transfer.encode_input(liquidityMining, amount)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], SOVtoken.address, data, conf.acct)
 
def addAmmPoolTokenToLM(ptName):
    # ptName - pool token name from testnet_contracts.json e.g.:
    # "XUSD/BRZ"
    # "(WR)BTC/MYNT"
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)

    data = lm.add.encode_input(conf.contracts[ptName],1,False)
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)

def getUserInfo(poolToken, user):
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)

    res = lm.getUserInfo(poolToken, user)

    print('pool tokens: ', res[0]/1e18)
    print('debt: ', res[1]/1e18)
    print('accumulated reward: ', res[2]/1e18)

def getMissedBalance():
    lm = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)
    res = lm.getMissedBalance()
    print(res/1e18)
    return res