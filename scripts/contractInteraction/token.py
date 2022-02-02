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
    
def approveFromMS(tokenContract, receiver, amount):
    token = Contract.from_abi("Token", address= tokenContract, abi = TestToken.abi, owner=conf.acct)
    data = token.approve.encode_input(receiver, amount)
    sendWithMultisig(conf.contracts['multisig'], tokenContract, data, conf.acct)
