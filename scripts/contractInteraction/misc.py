from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import *
from scripts.contractInteraction.token import * 
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.loan_tokens import getTokenPrice, setPauser
from scripts.contractInteraction.staking_vesting import addStakingPauser, removeStakingPauser
from scripts.contractInteraction.fastbtc import addFastBTCPauser, removeFastBTCPauser


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
    
def deployFeeSharingCollector():
    # Redeploy feeSharingCollector
    feeSharingCollector = conf.acct.deploy(FeeSharingCollector)
    print("Fee sharing collector redeployed at: ", feeSharingCollector.address)
    print("Setting implementation for FeeSharingCollectorProxy")
    feeSharingCollectorProxy = Contract.from_abi("FeeSharingCollectorProxy", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollectorProxy.abi, owner=conf.acct)
    data = feeSharingCollectorProxy.setImplementation.encode_input(feeSharingCollector.address)
    sendWithMultisig(conf.contracts['multisig'], feeSharingCollectorProxy.address, data, conf.acct)

def replaceTx(txStr, newGas):
    txReceipt = chain.get_transaction(txStr)
    txReceipt.replace(None, newGas)

#gets the logic contract for a proxy
def getImplementation(proxyContract):
    proxy = Contract.from_abi("FeeSharingCollectorProxy", address=proxyContract, abi=FeeSharingCollectorProxy.abi, owner=conf.acct)
    print(proxy.getImplementation())
    
def setNewContractGuardian():
    newGuardian = conf.contracts['ContractsGuardian']
    #loan tokens
    setPauser(conf.contracts['iXUSD'], newGuardian)
    setPauser(conf.contracts['iUSDT'], newGuardian)
    setPauser(conf.contracts['iRBTC'], newGuardian)
    setPauser(conf.contracts['iDOC'], newGuardian)
    setPauser(conf.contracts['iBPro'], newGuardian)
    setPauser(conf.contracts['iDLLR'], newGuardian)

    #loan token logic beacon - using the loan token abi because the function is the same
    setPauser(conf.contracts['LoanTokenLogicBeaconLM'], newGuardian)
    setPauser(conf.contracts['LoanTokenLogicBeaconWrbtc'], newGuardian)

    #protocol - using the loan token abi because the function is the same
    setPauser(conf.contracts['sovrynProtocol'], newGuardian)

    #staking - on the mainnet needs to be done with a SIP. check sip_interaction
    this_network = network.show_active()
    
    if this_network == "testnet" or this_network == "testnet-dev":
        addStakingPauser(newGuardian)
        removeStakingPauser(conf.contracts['multisig'])

    addFastBTCPauser(newGuardian)
    removeFastBTCPauser(conf.contracts['multisig'])


def openTrove(_maxFeePercentage, _ZUSDAmount, _upperHint, _lowerHint, coll):
    abiFile =  open('./scripts/contractInteraction/ABIs/BorrowerOperations.json')
    abi = json.load(abiFile)
    borrowerOperations = Contract.from_abi("bo", address=conf.contracts['borrowerOperations'], abi=abi, owner=conf.acct)
    borrowerOperations.openTrove(_maxFeePercentage, _ZUSDAmount, _upperHint, _lowerHint, {'value':coll})

def distributeMissedFees():
    Total_iWRBTC = 0.7473876932797053 
    Total_SOV = 6275.898259771202 
    Total_ZUSD = 16658.600400155126 
    Total_WRBTC = 0.11341026623965539 
    Total_RBTC_DUMMY = 0.004887638144724727 
    Total_RBTC = Total_RBTC_DUMMY + Total_WRBTC + Total_iWRBTC * (getTokenPrice(conf.contracts['iRBTC'])/(10**18))
    print(Total_RBTC)
    
    feeSharingCollector = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)

    token = Contract.from_abi("Token", address= conf.contracts['SOV'], abi = TestToken.abi, owner=conf.acct)
    data = token.approve.encode_input(feeSharingCollector.address, Total_SOV * 10**18)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['SOV'] , data, conf.acct)
    data = feeSharingCollector.transferTokens.encode_input(conf.contracts['SOV'], Total_SOV * 10**18)
    sendWithMultisig(conf.contracts['multisig'], feeSharingCollector.address , data, conf.acct)

    token = Contract.from_abi("Token", address= conf.contracts['ZUSD'], abi = TestToken.abi, owner=conf.acct)
    data = token.approve.encode_input(feeSharingCollector.address, Total_ZUSD * 10**18)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['ZUSD'] , data, conf.acct)
    data = feeSharingCollector.transferTokens.encode_input(conf.contracts['ZUSD'], Total_ZUSD * 10**18)
    sendWithMultisig(conf.contracts['multisig'], feeSharingCollector.address , data, conf.acct)

    data = feeSharingCollector.transferRBTC.encode_input()
    sendWithMultisig(conf.contracts['multisig'], feeSharingCollector.address , data, conf.acct, Total_RBTC * 10**18)
    

def getFeeSharingState(tokenAddress):
    feeSharingCollector = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)
    numCheckpoints = feeSharingCollector.numTokenCheckpoints(tokenAddress)
    print("num checkpoints:", numCheckpoints)
    lastCheckpoint = feeSharingCollector.tokenCheckpoints(tokenAddress, numCheckpoints-1)
    print("latest checkpoint:", lastCheckpoint)
    unprocessed = feeSharingCollector.unprocessedAmount(tokenAddress)
    print("unprocessed amount:", unprocessed)

def RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT():
    feeSharingCollector = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)
    return feeSharingCollector.RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT()

def transferTokens(tokenAddress, amount):
    feeSharingCollector = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)
    token = Contract.from_abi("Token", address= tokenAddress, abi = TestToken.abi, owner=conf.acct)
    data = token.approve.encode_input(feeSharingCollector.address, amount)
    sendWithMultisig(conf.contracts['multisig'], tokenAddress , data, conf.acct)
    data = feeSharingCollector.transferTokens.encode_input(tokenAddress, amount)
    sendWithMultisig(conf.contracts['multisig'], feeSharingCollector.address , data, conf.acct)


