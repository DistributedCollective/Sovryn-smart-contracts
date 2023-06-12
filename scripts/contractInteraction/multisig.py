from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def sendFromMultisig(receiver, amount):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    tx = multisig.submitTransaction(receiver,amount,b'')
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def sendTokensFromMultisig(token, receiver, amount):
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=conf.acct)
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    data = tokenContract.transfer.encode_input(receiver, amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], token, data, conf.acct)

def executeOnMultisig(transactionId):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)

    multisig.executeTransaction(transactionId)

def revokeConfirmation(transactionId):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)

    multisig.revokeConfirmation(transactionId)


def deployMultisig(owners, requiredConf):
     multisig = conf.acct.deploy(MultiSigWallet, owners, requiredConf)
     print("multisig:", multisig)

    
def printMultisigOwners():
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    print(multisig.getOwners())

def isMultisigOwner(address):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    print(multisig.isOwner(address))

def printMultisigOwnersOnAny(multisigAddress):
    multisig = Contract.from_abi("MultiSig", address=multisigAddress, abi=MultiSigWallet.abi, owner=conf.acct)
    print(multisig.getOwners())

def replaceOwnerOnMultisig(multisig, oldOwner, newOwner):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    data = multisig.replaceOwner.encode_input(oldOwner, newOwner)
    sendWithMultisig(multisig, multisig, data, conf.acct)

def confirmWithMS(txId):
    multisig = Contract.from_abi("MultiSig", address = conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    multisig.confirmTransaction(txId)

def confirmWithBFMS(txId):
    multisig = Contract.from_abi("MultiSig", address = conf.contracts['BFmultisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    multisig.confirmTransaction(txId)

def confirmWithAnyMS(txId, multisigaddress):
    multisig = Contract.from_abi("MultiSig", address = multisigaddress, abi=MultiSigWallet.abi, owner=conf.acct)
    multisig.confirmTransaction(txId)

def revokeConfirmationMS(txId):
    multisig = Contract.from_abi("MultiSig", address = conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    multisig.revokeConfirmation(txId)

def confirmMultipleTxsWithMS(txIdFrom, txIdTo):
    for i in range(txIdFrom, txIdTo + 1): # the right boundary processed to the value-1, so adding 1
        confirmWithMS(i)
        checkTx(i)

def checkTx(txId):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    print("TX ID: ",txId,"confirmations: ", multisig.getConfirmationCount(txId), " Executed:", multisig.transactions(txId)[3], " Confirmed by: ", multisig.getConfirmations(txId))
    print("TX:", multisig.transactions(txId))

def checkTxOnBF(txId):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['BFmultisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    print("TX ID: ",txId,"confirmations: ", multisig.getConfirmationCount(txId), " Executed:", multisig.transactions(txId)[3], " Confirmed by: ", multisig.getConfirmations(txId))
    print(multisig.transactions(txId))

def checkTxOnAny(txId, multisigAddress):
    multisig = Contract.from_abi("MultiSig", address=multisigAddress, abi=MultiSigWallet.abi, owner=conf.acct)
    print("TX ID: ",txId,"confirmations: ", multisig.getConfirmationCount(txId), " Executed:", multisig.transactions(txId)[3], " Confirmed by: ", multisig.getConfirmations(txId))
    print(multisig.transactions(txId))

def transferSOVtoTokenSender(amount):
    '''
    GenericTokenSender is used for tokens direct distribution
    '''
    # example: 875.39 SOV => amount = 87539 * 10**16
    if(amount <= 0):
        raise Exception("Invalid amount")

    tokenSenderAddress = conf.contracts['GenericTokenSender']
    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    data = SOVtoken.transfer.encode_input(tokenSenderAddress, amount)
    print("Transfer",amount, "SOV from Multisig:", conf.contracts['multisig']," to GenericTokenSender:",tokenSenderAddress)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], SOVtoken.address, data, conf.acct)

def transferXUSDtoTokenSender(amount):
    '''
    direct liquid xUSD distribution
    '''
    # 47397.00 xUSD
    # amount = 4739700 * 10**16

    tokenSenderAddress = conf.contracts['GenericTokenSender']
    token = Contract.from_abi("TestToken", address=conf.contracts['XUSD'], abi=TestToken.abi, owner=conf.acct)
    data = token.transfer.encode_input(tokenSenderAddress, amount)
    print("Transfer",amount, "xUSD from Multisig:", conf.contracts['multisig']," to GenericTokenSender:",tokenSenderAddress)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)

def transferToTokenSender(currency, amount):
    '''
    direct liquid currency distribution
    '''
    # amount = 4739700 * 10**16

    tokenSenderAddress = conf.contracts['GenericTokenSender']
    token = Contract.from_abi("TestToken", address=conf.contracts[currency], abi=TestToken.abi, owner=conf.acct)
    data = token.transfer.encode_input(tokenSenderAddress, amount)
    print("Transfer",amount,currency, "from Multisig:", conf.contracts['multisig']," to GenericTokenSender:",tokenSenderAddress)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], token.address, data, conf.acct)

def transferSOVtoAccount(receiver, amount):
    '''
    creates multisig tx 
    to send amount to the vesting creation script executor address (receiver)
    '''
    if (receiver == ""):
        raise Exception("Invalid address")
    if(amount <= 0):
        raise Exception("Invalid amount")

    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    data = SOVtoken.transfer.encode_input(receiver, amount)
    print("Transferring SOV from multisig to the distribution script runner address:")
    print(data)
    sendWithMultisig(conf.contracts['multisig'], SOVtoken.address, data, conf.acct)

def addOwnerToMultisig(newOwner):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    data = multisig.addOwner.encode_input(newOwner)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['multisig'], data, conf.acct)

def removeOwnerFromMultisig(newOwner):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    data = multisig.removeOwner.encode_input(newOwner)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['multisig'], data, conf.acct)

def requiredConfirmations(multisigAddress):
    multisig = Contract.from_abi("MultiSig", address=multisigAddress, abi=MultiSigWallet.abi, owner=conf.acct)
    print(multisig.required())