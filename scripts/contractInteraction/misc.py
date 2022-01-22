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

#used to exchange XUSD -> USDT on the aggregator
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

#used to exchange USDT -> XUSD on the aggregator
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

def withdrawRBTCFromWatcher(amount, recipient):
    abiFile =  open('./scripts/contractInteraction/ABIs/Watcher.json')
    abi = json.load(abiFile)
    watcher = Contract.from_abi("Watcher", address = conf.contracts['Watcher'], abi = abi, owner = conf.acct)
    data = watcher.withdrawTokens.encode_input('0x0000000000000000000000000000000000000000', amount, recipient)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], watcher.address, data, conf.acct)

def withdrawTokensFromWatcher(token, amount, recipient):
    abiFile =  open('./scripts/contractInteraction/ABIs/Watcher.json')
    abi = json.load(abiFile)
    watcher = Contract.from_abi("Watcher", address = conf.contracts['Watcher'], abi = abi, owner = conf.acct)
    #watcher = Contract.from_abi("Watcher", address = '0x051B89f575fCd540F0a6a5B49c75f9a83BB2Cf07', abi = abi, owner = conf.acct)
    data = watcher.withdrawTokens.encode_input(token, amount, recipient)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], watcher.address, data, conf.acct)

def depositToLockedSOV(amount, recipient):
    token = Contract.from_abi("Token", address= conf.contracts['SOV'], abi = TestToken.abi, owner=conf.acct)
    data = token.approve.encode_input(conf.contracts["LockedSOV"], amount)
    sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)

    lockedSOV = Contract.from_abi("LockedSOV", address=conf.contracts["LockedSOV"], abi=LockedSOV.abi, owner=conf.acct)
    data = lockedSOV.depositSOV.encode_input(recipient, amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], lockedSOV.address, data, conf.acct)
    
def deployFeeSharingLogic():
    # Redeploy feeSharingLogic
    feeSharing = conf.acct.deploy(FeeSharingLogic)
    print("Fee sharing logic redeployed at: ", feeSharing.address)
    print("Setting implementation for FeeSharingProxy")
    feeSharingProxy = Contract.from_abi("FeeSharingProxy", address=conf.contracts['FeeSharingProxy'], abi=FeeSharingProxy.abi, owner=conf.acct)
    data = feeSharingProxy.setImplementation.encode_input(feeSharing.address)
    sendWithMultisig(conf.contracts['multisig'], feeSharingProxy.address, data, conf.acct)

def repalceTx(txStr, newGas):
    txReceipt = chain.get_transaction(txStr)
    txReceipt.replace(None, newGas)
