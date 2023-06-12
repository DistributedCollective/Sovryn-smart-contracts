from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import *
from scripts.contractInteraction.token import * 
import scripts.contractInteraction.config as conf

def loadAggregator(aggregatorAddress):
    abiFile =  open('./scripts/contractInteraction/ABIs/aggregator.json')
    abi = json.load(abiFile)
    return Contract.from_abi("Aggregator", address=aggregatorAddress, abi=abi, owner=conf.acct)

def redeemFromAggregator(aggregatorAddress, tokenAddress, amount):
    aggregator = loadAggregator(aggregatorAddress)
    aggregator.redeem(tokenAddress, amount)

#used to exchange XUSD -> USDT on the aggregator
def redeemFromAggregatorWithMS(aggregatorAddress, tokenAddress, amount):
    aggregator = loadAggregator(aggregatorAddress)
    data = aggregator.redeem.encode_input(tokenAddress, amount)
    sendWithMultisig(conf.contracts['multisig'], aggregator.address, data, conf.acct)

def redeemBTCWithXUSD(amountOfXUSD):
    redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['DoC'], amountOfXUSD)
    tokenApproveFromMS(conf.contracts['DoC'], conf.contracts['MoneyOnChain'], amountOfXUSD)
    redeemFreeDocWithMS(amountOfXUSD)

def redeemFreeDocWithMS(amountOfXUSD):
    abiFile =  open('./scripts/contractInteraction/ABIs/MoneyOnChain.json')
    abi = json.load(abiFile)
    moc = Contract.from_abi("moc", address = conf.contracts['MoneyOnChain'], abi = abi, owner = conf.acct)
    data = moc.redeemFreeDoc.encode_input(amountOfXUSD)
    sendWithMultisig(conf.contracts['multisig'], moc.address, data, conf.acct)

def mintAggregatedToken(aggregatorAddress, tokenAddress, amount):
    aggregator = loadAggregator(aggregatorAddress)
    token = Contract.from_abi("Token", address= tokenAddress, abi = TestToken.abi, owner=conf.acct)
    data = token.approve(aggregatorAddress, amount)
    tx = aggregator.mint(tokenAddress, amount)
    tx.info()

#used to exchange USDT -> XUSD on the aggregator
def mintAggregatedTokenWithMS(aggregatorAddress, tokenAddress, amount):
    aggregator = loadAggregator(aggregatorAddress)
    token = Contract.from_abi("Token", address= tokenAddress, abi = TestToken.abi, owner=conf.acct)
    if(token.allowance(conf.contracts['multisig'], aggregatorAddress) < amount):
        data = token.approve.encode_input(aggregatorAddress, amount)
        sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)
    data = aggregator.mint.encode_input(tokenAddress, amount)
    sendWithMultisig(conf.contracts['multisig'], aggregator.address, data, conf.acct)


def upgradeAggregator(multisig, newImpl):
    abiFile =  open('./scripts/contractInteraction/ABIs/AggregatorProxy.json')
    abi = json.load(abiFile)
    proxy = Contract.from_abi("ETHAggregatorProxy", address = conf.contracts['ETHAggregatorProxy'], abi = abi, owner = conf.acct)
    data = proxy.upgradeTo(newImpl)
    sendWithMultisig(multisig, proxy.address, data, conf.acct)
    print(txId)