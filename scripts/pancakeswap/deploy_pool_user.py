from brownie import *
from brownie.network.contract import InterfaceContainer
import time
import json
import sys

def main():
    loadConfig()

    balanceBefore = acct.balance()
    # Function Call
    deployPoolFromMultisig(10e18, 500e18)
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
        configFile =  open('./scripts/pancakeswap/eth_testnet_contracts.json')
    elif thisNetwork == "rinkeby":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/pancakeswap/eth_testnet_contracts.json')
    elif thisNetwork == "mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/pancakeswap/eth_mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # Load deployed contracts addresses
    contracts = json.load(configFile)

# == PancakeSwap Pool Deployment ==================================
def deployPoolFromMultisig(ethAmount, eSOVAmount):
    eSOV = Contract.from_abi("SOV", address = contracts['eSOV'], abi = SOV.abi, owner = acct)    
    pancakeRouter02 = Contract.from_abi("IPancakeRouter02", address=contracts['PancakeRouter02'], abi=interface.IPancakeRouter02.abi, owner=acct)

    # Checks if user has approved PancakeSwap for transfer. If not, will do the transfer.
    checkTokenApproval(eSOV, acct, pancakeRouter02.address, eSOVAmount)
    
    # Creating PancakeSwap Pool
    thirtyMinutes = 30 * 60
    currentTimestamp = int(time.time())
    deadline = currentTimestamp + thirtyMinutes
    # https://github.com/pancakeswap/pancake-swap-periphery/blob/master/contracts/PancakeRouter.sol#L61
    print("=============================================================")
    print("Interaction Parameters (Pool Creation)")
    print("=============================================================")
    print("eSOV Token:                  ", eSOV.address)
    print("amountTokenDesired:          ", eSOVAmount)
    print("amountTokenMin:              ", eSOVAmount)
    print("amountETHMin:                ", ethAmount)
    print("to:                          ", acct)
    print("deadline:                    ", deadline)
    print("=============================================================")
    print("Current Timestamp:           ", currentTimestamp)
    print("=============================================================")
    tx = pancakeRouter02.addLiquidityETH(eSOV.address, eSOVAmount, eSOVAmount, ethAmount, acct, deadline, { 'value': ethAmount })
    tx.info()

def checkTokenApproval(token, owner, spender, amount):
    if(token.allowance(owner, spender) < amount):
        # Approving token transfer.
        print("=============================================================")
        print("Interaction Parameters (Token Transfer Approval)")
        print("=============================================================")
        print("Spender Address:             ", spender)
        print("Amount approved:             ", amount)
        print("=============================================================")
        tx = token.approve(spender, amount)
        tx.info()
