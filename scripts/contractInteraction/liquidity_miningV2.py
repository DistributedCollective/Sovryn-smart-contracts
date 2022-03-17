from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def setLiquidityMiningV2AddressOnAllContracts():
    print("setting LM address")
    setLiquidityMiningV2Address(conf.contracts['iDOC'])
    setLiquidityMiningV2Address(conf.contracts['iUSDT'])
    setLiquidityMiningV2Address(conf.contracts['iBPro'])
    setLiquidityMiningV2Address(conf.contracts['iXUSD'])
    setLiquidityMiningV2Address(conf.contracts['iRBTC'])

def getLiquidityMiningV2Address(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicLM.abi, owner=conf.acct)
    print(loanToken.liquidityMiningAddress())
    print(loanToken.target_())

def setLiquidityMiningV2Address(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicLM.abi, owner=conf.acct)
    data = loanToken.setLiquidityMiningAddress.encode_input(conf.contracts['LiquidityMiningProxyV2'])

    sendWithMultisig(conf.contracts['multisig'], loanToken.address, data, conf.acct)

def getLiquidityMiningV2AddressOnAllContracts():
    print("setting LM address")
    getLiquidityMiningV2Address(conf.contracts['iDOC'])
    getLiquidityMiningV2Address(conf.contracts['iUSDT'])
    getLiquidityMiningV2Address(conf.contracts['iBPro'])
    getLiquidityMiningV2Address(conf.contracts['iRBTC'])

def setWrapperOnLMV2():
    lm = Contract.from_abi("LiquidityMiningV2", address = conf.contracts['LiquidityMiningProxyV2'], abi = LiquidityMiningV2.abi, owner = conf.acct)

    data = lm.setWrapper.encode_input(conf.contracts['RBTCWrapperProxy'])
    sendWithMultisig(conf.contracts['multisig'], lm.address, data, conf.acct)


def getPoolIdOnLMV2(poolToken):
    lm = Contract.from_abi("LiquidityMiningV2", address = conf.contracts['LiquidityMiningProxyV2'], abi = LiquidityMiningV2.abi, owner = conf.acct)
    print(lm.getPoolId(poolToken))


def getLMV2Info():
    lm = Contract.from_abi("LiquidityMiningV2", address = conf.contracts['LiquidityMiningProxyV2'], abi = LiquidityMiningV2.abi, owner = conf.acct)
    print(lm.getPoolLength())
    print(lm.getPoolInfoList())
    print(lm.wrapper())


def transferSOVtoLMV2(amount):
    lm = conf.contracts['LiquidityMiningProxyV2']
    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    data = SOVtoken.transfer.encode_input(lm, amount)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], SOVtoken.address, data, conf.acct)
