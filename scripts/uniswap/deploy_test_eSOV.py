from brownie import *

import json

def main():
    loadConfig()

    balanceBefore = acct.balance()
    # Function Call
    deploy_eSOV()
    balanceAfter = acct.balance()

    print("=============================================================")
    print("ETH Before Balance:  ", balanceBefore)
    print("ETH After Balance:   ", balanceAfter)
    print("Gas Used:            ", balanceBefore - balanceAfter)
    print("=============================================================")

def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()

    # == Load config ==============================================
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

# == eSOV Deployment ==========================================
def deploy_eSOV():
    tokenAmount = 10**26 # 100 Million Equivalent
    print("=============================================================")
    print("Deployment Parameters")
    print("=============================================================")
    print("Token Balance:   ", tokenAmount)
    print("=============================================================")

    eSOVtoken = acct.deploy(SOV, tokenAmount)
    tokenAmount = eSOVtoken.balanceOf(acct)
    print("=============================================================")
    print("Deployed Details")
    print("=============================================================")
    print("eSOV Address:  ", eSOVtoken)
    print("Token Balance: ", tokenAmount)
    print("=============================================================")