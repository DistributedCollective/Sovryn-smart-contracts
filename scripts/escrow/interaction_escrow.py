from brownie import *

import time
import json
import csv
import math

def main():
    loadConfig()

    balanceBefore = acct.balance()

    # initEscrow()
    # checkEscrowStatus()
    # getTotalDeposit()
    # getUserBalance("0x9Cf4CC7185E957C63f0BA6a4D793F594c702AD66")
    # getReward("0x9Cf4CC7185E957C63f0BA6a4D793F594c702AD66")

    balanceAfter = acct.balance()

    print("=============================================================")
    print("RSK Before Balance:  ", balanceBefore)
    print("RSK After Balance:   ", balanceAfter)
    print("Gas Used:            ", balanceBefore - balanceAfter)
    print("=============================================================")

def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()

    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)

# == Initialize the function for starting deposit ===========================================================================================
def initEscrow():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    data = escrowReward.init.encode_input()
    tx = multisig.submitTransaction(contracts['EscrowReward'],0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("Tx ID:", txId)

def checkEscrowStatus():
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    contractStatus = escrowReward.status()
    status = "Error"
    if(contractStatus == 0):
        status = "Contract Deployed"
    elif(contractStatus == 1):
        status = "Deposit Period Started"
    elif(contractStatus == 2):
        status = "Holding Period Started"
    elif(contractStatus == 3):
        status = "Withdraw Period Started"
    elif(contractStatus == 4):
        status = "Contract Expired"
    print("=============================================================")
    print("Status:", status)
    print("=============================================================")

def updateReleaseTimestamp(newReleaseTimestamp):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    data = escrowReward.updateReleaseTimestamp.encode_input(newReleaseTimestamp)
    tx = multisig.submitTransaction(contracts['EscrowReward'],0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("=============================================================")
    print("Tx ID:", txId)
    print("=============================================================")

def updateDepositLimit(newDepositLimit):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    data = escrowReward.updateDepositLimit.encode_input(newDepositLimit)
    tx = multisig.submitTransaction(contracts['EscrowReward'],0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("=============================================================")
    print("Tx ID:", txId)
    print("=============================================================")

def updateLockedSOV(newRewardTokenContract):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    data = escrowReward.updateLockedSOV.encode_input(newDepositLimit)
    tx = multisig.submitTransaction(contracts['EscrowReward'],0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("=============================================================")
    print("Tx ID:", txId)
    print("=============================================================")

def depositToken(amount):
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    sovToken = Contract.from_abi("TestToken", address = contracts['SOV'], abi = TestToken.abi, owner = acct)
    if(sovToken.allowance(acct, escrowReward.address) < amount):
        token.approve(escrowReward.address, amount)    
    tx = escrowReward.depositTokens(amount)
    print("=============================================================")
    print("Tx:", tx)
    print("=============================================================")

def changeStateToHolding():
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    data = escrowReward.changeStateToHolding.encode_input()
    tx = multisig.submitTransaction(contracts['EscrowReward'],0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("=============================================================")
    print("Tx ID:", txId)
    print("=============================================================")

def withdrawTokensByMultisig(receiverAddress):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    data = escrowReward.withdrawTokensByMultisig.encode_input(receiverAddress)
    tx = multisig.submitTransaction(contracts['EscrowReward'],0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("=============================================================")
    print("Tx ID:", txId)
    print("=============================================================")

def approveTokensByMultisig(amount):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = contracts['EscrowReward']
    sovToken = Contract.from_abi("TestToken", address = contracts['SOV'], abi = TestToken.abi, owner = acct)
    data = sovToken.approve.encode_input(escrowReward.address, amount)
    tx = multisig.submitTransaction(sovToken.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print("=============================================================")
    print("Tx ID:", txId)
    print("=============================================================")

def depositRewardByMultisig(amount):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    sovToken = Contract.from_abi("TestToken", address = contracts['SOV'], abi = TestToken.abi, owner = acct)
    if(sovToken.allowance(acct, escrowReward.address) < amount):
        print("Multisig has not approved token transfers to Escrow Contract. Use approveTokensByMultisig()")
    elif:
        data = escrowReward.depositRewardByMultisig.encode_input(amount)
        tx = multisig.submitTransaction(contracts['EscrowReward'],0,data)
        txId = tx.events["Submission"]["transactionId"]
        print("=============================================================")
        print("Tx ID:", txId)
        print("=============================================================")

def depositTokensByMultisig(amount):
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    sovToken = Contract.from_abi("TestToken", address = contracts['SOV'], abi = TestToken.abi, owner = acct)
    if(sovToken.allowance(acct, escrowReward.address) < amount):
        print("Multisig has not approved token transfers to Escrow Contract. Use approveTokensByMultisig()")
    elif:
        data = escrowReward.depositTokensByMultisig.encode_input(amount)
        tx = multisig.submitTransaction(contracts['EscrowReward'],0,data)
        txId = tx.events["Submission"]["transactionId"]
        print("=============================================================")
        print("Tx ID:", txId)
        print("=============================================================")

def withdrawTokensAndReward():
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    tx = escrowReward.withdrawTokens()
    print("=============================================================")
    print("Tx:", tx)
    print("=============================================================")

def getTotalDeposit():
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    totalDeposit = escrowReward.totalDeposit()
    totalDeposit = totalDeposit / 10 ** 18
    print("=============================================================")
    print("Total Deposit:", totalDeposit)
    print("=============================================================")

def getUserBalance(addr):
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    userBalance = escrowReward.getUserBalance(addr)
    userBalance = userBalance / 10 ** 18
    print("=============================================================")
    print("User Deposit:", userBalance)
    print("=============================================================")

def getReward(addr):
    escrowReward = Contract.from_abi("EscrowReward", address=contracts['EscrowReward'], abi=EscrowReward.abi, owner=acct)
    userReward = escrowReward.getReward(addr)
    userReward = userReward / 10 ** 18
    print("=============================================================")
    print("User Reward:", userReward)
    print("=============================================================")
