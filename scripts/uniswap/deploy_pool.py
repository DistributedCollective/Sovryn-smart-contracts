from brownie import *
from brownie.network.contract import InterfaceContainer
import time
import json
import sys

def main():
    loadConfig()

    balanceBefore = acct.balance()
    # Function Call
    # tokenTransfer(contracts['multisig'], eSOVAmount) # Change eSOVAmount with the amount of eSOV to be transferred.
    deployPoolFromMultisig(10e18, 500e18)
    # confirmTransaction() # Need to add a transaction ID as parameter.
    # executeOnMultisig() # Need to add a transaction ID as parameter.
    balanceAfter = acct.balance()

    print("=============================================================")
    print("ETH Before Balance:  ", balanceBefore)
    print("ETH After Balance:   ", balanceAfter)
    print("Gas Used:            ", balanceBefore - balanceAfter)
    print("=============================================================")

def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()

    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/uniswap/eth_testnet_contracts.json')
    elif thisNetwork == "rinkeby":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/uniswap/eth_testnet_contracts.json')
    elif thisNetwork == "mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/uniswap/eth_mainnet_contracts.json')
    else:
        raise Exception("Network not supported.")

    # Load deployed contracts addresses
    contracts = json.load(configFile)

# == Uniswap Pool Deployment ==================================
def deployPoolFromMultisig(ethAmount, eSOVAmount):
    eSOV = Contract.from_abi("SOV", address = contracts['eSOV'], abi = SOV.abi, owner = acct)
    ethMultisig = Contract.from_abi("MultiSig", address=contracts['ethMultisig'], abi=MultiSigWallet.abi, owner=acct)
    uniswapV2Router02 = Contract.from_abi("IUniswapV2Router02", address=contracts['UniswapV2Router02'], abi=interface.IUniswapV2Router02.abi, owner=acct)

    # Checks if multisig has enough eth balance. If not enough, will transfer in case of test network.
    checkETHBalanceAndTransfer(ethMultisig, ethAmount)

    # Checks if multisig has enough token balance. If not enough, will transfer in case of test network.
    checkTokenBalanceAndTransfer(eSOV, ethMultisig.address, eSOVAmount)

    # Checks if multisig has approved Uniswap for transfer. If not, will do the transfer.
    checkTokenApprovalInMultisig(eSOV, ethMultisig.address, uniswapV2Router02.address, eSOVAmount)
    
    # Creating Uniswap Pool
    thirtyMinutes = 30 * 60
    currentTimestamp = int(time.time())
    deadline = currentTimestamp + thirtyMinutes
    data = uniswapV2Router02.addLiquidityETH.encode_input(eSOV.address, eSOVAmount, eSOVAmount, ethAmount, ethMultisig.address, deadline)
    # https://uniswap.org/docs/v2/smart-contracts/router02/#addliquidityeth
    print("=============================================================")
    print("Interaction Parameters (Pool Creation)")
    print("=============================================================")
    print("eSOV Token:                  ", eSOV.address)
    print("amountTokenDesired:          ", eSOVAmount)
    print("amountTokenMin:              ", eSOVAmount)
    print("amountETHMin:                ", ethAmount)
    print("to:                          ", ethMultisig.address)
    print("deadline:                    ", deadline)
    print("Encoded Data:                ", data)
    print("=============================================================")
    print("Current Timestamp:           ", currentTimestamp)
    print("=============================================================")
    submitTransaction(uniswapV2Router02.address, ethAmount, data)

# Checks if enough balance is there in a receiver, if not, will transfer the difference.
def checkETHBalanceAndTransfer(receiver, ethAmount):
    bal = receiver.balance()
    if(bal < ethAmount):
        if network.show_active() == "rinkeby":
            acct.transfer(receiver.address, ethAmount - bal)
        else:
            print("Not enough eth balance in address.")
            sys.exit()

# Just a function to take out eth from multisig.
def ethTransferOutFromMultisig(receiver, ethAmount):
    submitTransaction(receiver, ethAmount, '0x')

# Checks user token balance, and if not enough balance, will either quit the program (mainnet) or replenish (testnet)
def checkTokenBalanceAndTransfer(token, addr, amount):
    addrBalance = token.balanceOf(addr)
    if(addrBalance < amount):
        if network.show_active() == "rinkeby":
            tokenTransfer(addr, amount)
        else:
            print("Not enough token balance in address.")
            sys.exit()

# Makes the token transfer to `receiver` for the amount of `eSOVAmount`.
def tokenTransfer(receiver, eSOVAmount):
    eSOV = Contract.from_abi("SOV", address = contracts['eSOV'], abi = SOV.abi, owner = acct)
    print("=============================================================")
    print("Interaction Parameters (Token Transfer)")
    print("=============================================================")
    print("Receiver:                ", receiver)
    print("eSOV Amount:             ", eSOVAmount)
    print("=============================================================")
    tx = eSOV.transfer(receiver, eSOVAmount)
    tx.info()

# Checks if enough token approval is there in spender from owner. If not, it will make the allowance. This one is made for multisig.
def checkTokenApprovalInMultisig(token, owner, spender, amount):
    if(token.allowance(owner, spender) < amount):
        # Approving token transfer.
        data = token.approve.encode_input(spender, amount)
        print("=============================================================")
        print("Interaction Parameters (Token Transfer Approval)")
        print("=============================================================")
        print("Spender Address:             ", spender)
        print("Amount approved:             ", amount)
        print("Encoded Data:                ", data)
        print("=============================================================")
        submitTransaction(token.address, 0, data)

# Submits the transaction in multisig.
def submitTransaction(target, value, data):
    ethMultisig = Contract.from_abi("MultiSig", address=contracts['ethMultisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = ethMultisig.submitTransaction(target, value, data)
    txId = tx.events["Submission"]["transactionId"]
    print("=============================================================")
    print("Return Parameters (Multisig Submission)")
    print("=============================================================")
    print("Transaction ID:          ", txId)
    print("=============================================================")
    tx.info()

# Confirm the transaction in multisig.
def confirmTransaction(transactionId):
    ethMultisig = Contract.from_abi("MultiSig", address=contracts['ethMultisig'], abi=MultiSigWallet.abi, owner=acct)
    print("=============================================================")
    print("Interaction Parameters (Multisig Confirmation)")
    print("=============================================================")
    print("Transaction ID:          ", transactionId)
    print("=============================================================")
    tx = ethMultisig.confirmTransaction(transactionId)
    tx.info()

# Execute the transaction in multisig.
def executeOnMultisig(transactionId):
    multisig = Contract.from_abi("MultiSig", address=contracts['ethMultisig'], abi=MultiSigWallet.abi, owner=acct)
    print("=============================================================")
    print("Interaction Parameters (Multisig Execution)")
    print("=============================================================")
    print("Transaction ID:          ", transactionId)
    print("=============================================================")
    tx = multisig.executeTransaction(transactionId)
    tx.info()
