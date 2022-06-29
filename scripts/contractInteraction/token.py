from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def getBalance(contractAddress, acct):
    contract = Contract.from_abi("Token", address=contractAddress, abi=LoanToken.abi, owner=conf.acct)
    balance = contract.balanceOf(acct)
    print(balance)
    return balance
    
def buyWRBTC(amount):
    contract = Contract.from_abi("WRBTC", address=conf.contracts["WRBTC"], abi=WRBTC.abi, owner=conf.acct)
    tx = contract.deposit({'value':amount})
    tx.info()
    print("New balance: ", contract.balanceOf(conf.acct))

def hasApproval(tokenContractAddr, sender, receiver):
    tokenContract = Contract.from_abi("Token", address=tokenContractAddr, abi=TestToken.abi, owner=sender)
    allowance = tokenContract.allowance(sender, receiver)
    print("allowance: ", allowance/1e18)
    return allowance

def mintNFT(contractAddress, receiver):
    abiFile =  open('./scripts/contractInteraction/ABIs/SovrynNft.json')
    abi = json.load(abiFile)
    nft = Contract.from_abi("NFT", address=contractAddress, abi=abi, owner=conf.acct)
    nft.mint(receiver)

def transferTokensFromWallet(tokenContract, receiver, amount):
    token = Contract.from_abi("Token", address=tokenContract, abi = TestToken.abi, owner=conf.acct)
    token.transfer(receiver, amount)

def sendToWatcher(tokenAddress, amount):
    if(tokenAddress == conf.contracts['WRBTC']):
       buyWRBTC(amount)
    transferTokensFromWallet(conf.contracts['WRBTC'], conf.contracts['WatcherContract'], amount)
    
def tokenApproveFromMS(tokenContract, receiver, amount):
    token = Contract.from_abi("Token", address= tokenContract, abi = TestToken.abi, owner=conf.acct)
    data = token.approve.encode_input(receiver, amount)
    sendWithMultisig(conf.contracts['multisig'], tokenContract, data, conf.acct)

def increaseAllowanceFromMS(tokenContractAddress, receiver, amount):
    token = Contract.from_abi("Token", address= tokenContractAddress, abi = TestToken.abi, owner=conf.acct)
    data = token.increaseAllowance.encode_input(receiver, amount)
    sendWithMultisig(conf.contracts['multisig'], tokenContractAddress, data, conf.acct)

def sendMYNTFromMultisigToFeeSharingProxy(amount):
    feeSharingProxy = Contract.from_abi("FeeSharingLogic", address=conf.contracts['FeeSharingProxy'], abi=FeeSharingLogic.abi, owner=conf.acct)
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    token = Contract.from_abi("MYNT", address=conf.contracts['MYNT'], abi=ERC20.abi, owner=conf.acct)
    if(token.allowance(multisig.address, feeSharingProxy.address) < amount):
        myntBalance = getBalanceOf(conf.contracts['MYNT'], conf.contracts['multisig'])
        if(myntBalance < amount):
            print('⚠️ ALERT! Multisig does not have enough MYNT balance to transfer to FeeSharingProxy: need ', amount - myntBalance)
        print('Approving MYNT for FeeSharingProxy: ', amount)
        tokenApproveFromMS(conf.contracts["MYNT"], feeSharingProxy, amount)
    data = feeSharingProxy.transferTokens.encode_input(conf.contracts['MYNT'], amount)
    print('Calling feeSharingProxy.transferTokens(multisig, mynt, amount): ', conf.contracts['multisig'], conf.contracts['MYNT'], amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['FeeSharingProxy'], data, conf.acct)

def getBalanceOf(contractAddress, acct):
    contract = Contract.from_abi("Token", address=contractAddress, abi=TestToken.abi, owner=conf.acct)
    balance = contract.balanceOf(acct)
    print(balance)
    return balance
