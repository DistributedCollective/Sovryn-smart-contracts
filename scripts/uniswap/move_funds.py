from brownie import *
from brownie.network.contract import InterfaceContainer
import time
import json
import sys

def main():
    loadConfig()

    balanceBefore = getContractBTCBalance(contracts['ethMultisig'])
    # Function Call
    # tokenTransfer(contracts['multisig'], eSOVAmount) # Change eSOVAmount with the amount of eSOV to be transferred.
    withdrawAllFundsFromV2Pool()
    # confirmTransaction() # Need to add a transaction ID as parameter.
    # executeOnMultisig() # Need to add a transaction ID as parameter.
    balanceAfter = getContractBTCBalance(contracts['ethMultisig'])

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
    elif thisNetwork == "ropsten":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/uniswap/eth_testnet_contracts.json')
    elif thisNetwork == "mainnet":
        acct = accounts.load("rskdeployerdev")
        configFile =  open('./scripts/uniswap/eth_mainnet_contracts.json')
    else:
        raise Exception("Network not supported.")

    # Load deployed contracts addresses
    contracts = json.load(configFile)

def getContractBTCBalance(contractAddress):
     contract = Contract.from_abi("Token", address=contractAddress, abi=LoanToken.abi, owner=conf.acct)
     return contract.balance()

# == Uniswap Pool Withdraw Funds ==================================
def withdrawAllFundsFromV2Pool():

    eSOV = Contract.from_abi("SOV", address = contracts['eSOV'], abi = SOV.abi, owner = acct)
    ethMultisig = Contract.from_abi("MultiSig", address=contracts['ethMultisig'], abi=MultiSigWallet.abi, owner=acct)
    uniswapV2Router02 = Contract.from_abi("IUniswapV2Router02", address=contracts['UniswapV2Router02'], abi=interface.IUniswapV2Router02.abi, owner=acct)
    uniswapV2eSovPool = Contract.from_abi("IUniswapV2Pair", address=contracts['UniswapV2eSOVPool'], abi=interface.IUniswapV2Pair.abi, owner=acct)

    sixtyMinutes = 60 * 60
    currentTimestamp = int(time.time())
    deadline = currentTimestamp + sixtyMinutes

    liquidityBalance = uniswapV2Router02.balanceOf(contracts['ethMultisig'], contracts['UniswapV2eSOVPool'])
    totalSupply = uniswapV2eSovPool.totalSupply()
    multisigShare = liquidityBalance / totalSupply
    reserves = uniswapV2eSovPool.getReserves()
    minAmountTokenA = reserves[0] * multisigShare - 1e18
    minAmountTokenB = reserves[1] * multisigShare - 0.1e18


    # Encode input for transaction
    data = uniswapV2Router02.removeLiquidityETH.encode_input(
        contracts['eSOV'],        #token
        liquidityBalance,         #liquidity
        minAmountTokenA,          #amountTokenMin
        minAmountTokenB,          #amountETHMin
        contracts['ethMultisig'], #to
        deadline                  #deadline
    )

    print("=============================================================")
    print("Interaction Parameters (Pool Withdrawal)")
    print("=============================================================")
    print("eSOV Token:                  ", contracts['eSOV'])
    print("liquidity:                   ", liquidityBalance)
    print("amountTokenMin:              ", minAmountTokenA)
    print("amountETHMin:                ", minAmountTokenB)
    print("to:                          ", contracts['ethMultisig'])
    print("deadline:                    ", deadline)
    print("Encoded Data:                ", data)
    print("=============================================================")

    submitTransaction(uniswapV2eSovPool.address, 0, data)

# def depositFundsToV3Pool(token, amount):
#     multisigApproveToken(contracts['eSOV'], contracts['UniswapV3eSOVPool'], contracts['UniswapV2eSOVPool'].balanceOf(contracts['ethMultisig']))

#     # initial params at contract creation
#     # params.tickLower	int24	-46000
#     # params.tickUpper	int24	-41000

   

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
def multisigApproveToken(token, spender, amount):
    if(token.allowance(contracts['ethMultisig'], spender) < amount):
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
