from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def sendFromMultisig(receiver, amount):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    tx = multisig.submitTransaction(receiver,amount,'')
    txId = tx.events["Submission"]["transactionId"]
    print(txId);

def sendTokensFromMultisig(token, receiver, amount):
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=conf.acct)
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    data = tokenContract.transfer.encode_input(receiver, amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], token, data, conf.acct)

def executeOnMultisig(transactionId):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)

    multisig.executeTransaction(transactionId)

def deployMultisig(owners, requiredConf):
     multisig = conf.acct.deploy(MultiSigWallet, owners, requiredConf)
     print("multisig:", multisig)

    
def printMultisigOwners():
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    print(multisig.getOwners())

def replaceOwnerOnMultisig(multisig, oldOwner, newOwner):
    data = multisig.replaceOwner.encode_input(oldOwner, newOwner)
    sendWithMultisig(multisig, multisig, data, conf.acct)

def confirmWithMS(txId):
    multisig = Contract.from_abi("MultiSig", address = conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    multisig.confirmTransaction(txId)

def confirmMultipleTxsWithMS(txIdFrom, txIdTo)
    for i in range(txIdFrom, txIdTo + 1): # the right boundary processed to the value-1, so adding 1
        confirmWithMS(i)

def checkTx():
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    print(multisig.transactions(216))

    print(multisig.getConfirmationCount(216))
    print(multisig.getConfirmations(216))

def transferSOVtoTokenSender():
    # 875.39 SOV
    amount = 87539 * 10**16

    tokenSenderAddress = conf.contracts['TokenSender']
    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    data = SOVtoken.transfer.encode_input(tokenSenderAddress, amount)
    print(data)

    sendWithMultisig(conf.contracts['multisig'],SOVtoken.address, data, conf.acct)

def addOwnerToMultisig(newOwner):
    data = multisig.addOwner.encode_input(newOwner)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['multisig'], data, conf.acct)
