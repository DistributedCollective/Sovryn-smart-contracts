from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def redeemFromAggregator(aggregatorAddress, tokenAddress, amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/aggregator.json')
    abi = json.load(abiFile)
    aggregator = Contract.from_abi("Aggregator", address=aggregatorAddress, abi=abi, owner=conf.acct)
    aggregator.redeem(tokenAddress, amount)

def redeemFromAggregatorWithMS(aggregatorAddress, tokenAddress, amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/aggregator.json')
    abi = json.load(abiFile)
    aggregator = Contract.from_abi("Aggregator", address=aggregatorAddress, abi=abi, owner=conf.acct)
    data = aggregator.redeem.encode_input(tokenAddress, amount)
    sendWithMultisig(conf.contracts['multisig'], aggregator.address, data, conf.acct)

def mintAggregatedToken(aggregatorAddress, tokenAddress, amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/aggregator.json')
    abi = json.load(abiFile)
    aggregator = Contract.from_abi("Aggregator", address=aggregatorAddress, abi=abi, owner=conf.acct)
    token = Contract.from_abi("Token", address= tokenAddress, abi = TestToken.abi, owner=conf.acct)
    data = token.approve(aggregatorAddress, amount)
    tx = aggregator.mint(tokenAddress, amount)
    tx.info()

def mintAggregatedTokenWithMS(aggregatorAddress, tokenAddress, amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/aggregator.json')
    abi = json.load(abiFile)
    aggregator = Contract.from_abi("Aggregator", address=aggregatorAddress, abi=abi, owner=conf.acct)
    data = aggregator.mint.encode_input(tokenAddress, amount)
    sendWithMultisig(conf.contracts['multisig'], aggregator.address, data, conf.acct)


def upgradeAggregator(multisig, newImpl):
    abiFile =  open('./scripts/contractInteraction/ABIs/AggregatorProxy.json')
    abi = json.load(abiFile)
    proxy = Contract.from_abi("ETHAggregatorProxy", address = conf.contracts['ETHAggregatorProxy'], abi = abi, owner = conf.acct)
    data = proxy.upgradeTo(newImpl)
    sendWithMultisig(multisig, proxy.address, data, conf.acct)
    print(txId)

def readClaimBalanceOrigin(address):
    originClaimContract = Contract.from_abi("originClaim", address=conf.contracts['OriginInvestorsClaim'], abi=OriginInvestorsClaim.abi, owner=conf.acct)
    amount = originClaimContract.investorsAmountsList(address)
    print(amount)

def determineFundsAtRisk():
    sovryn = Contract.from_abi("sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    borrowedPositions = []
    sum = 0
    possible = 0
    for i in range (0, 10000, 10):
        loans = sovryn.getActiveLoans(i, i+10, False)
        if(len(loans) == 0):
            break
        for loan in loans:
            if loan[11] == 0 and loan[10] > 150e18:
                print(loan[1])
                sum += loan[3]
                possible += loan[3] * (loan[10] / 150e18)
                borrowedPositions.append(loan)

    print(borrowedPositions)
    print(len(borrowedPositions))
    print('total height of affected loans: ', sum/1e18)
    print('total potential borrowed: ', possible/1e18)
    print('could have been stolen: ', (possible - sum)/1e18)


def lookupCurrentPoolReserveBalances(userAddress):
    wrbtc = Contract.from_abi("TestToken", address = conf.contracts['WRBTC'], abi = TestToken.abi, owner = conf.acct)
    sov = Contract.from_abi("TestToken", address = conf.contracts['SOV'], abi = TestToken.abi, owner = conf.acct)
    poolToken = Contract.from_abi("TestToken", address = conf.contracts['(WR)BTC/SOV'], abi = TestToken.abi, owner = conf.acct)
    liquidityMining = Contract.from_abi("LiquidityMining", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMining.abi, owner = conf.acct)

    wrbtcBal = wrbtc.balanceOf(conf.contracts['WRBTCtoSOVConverter']) / 1e18
    sovBal = sov.balanceOf(conf.contracts['WRBTCtoSOVConverter']) / 1e18
    poolSupply = poolToken.totalSupply() / 1e18
    userBal = liquidityMining.getUserPoolTokenBalance(poolToken.address, userAddress) / 1e18
    print('total sov balance ', sovBal)
    print('total wrbtc balance ', wrbtcBal)
    print('pool supply ', poolSupply)
    print('user balance ', userBal)
    
    print('user has in SOV', userBal/poolSupply * sovBal)
    print('user has in BTC', userBal/poolSupply * wrbtcBal)