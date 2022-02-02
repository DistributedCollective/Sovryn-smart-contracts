from brownie import *
from brownie.network.contract import InterfaceContainer
import json
from os import environ

def loadConfig():
    global contracts, acct
    thisNetwork = network.show_active()
    if thisNetwork == "development":
        acct = accounts[0]
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet-ws":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    #  Adds a conditional for the cron job , it will check id the
    #  script is executed as part of the feeWithdrawal/setBlock cron job
    elif thisNetwork == "rsk-testnet" and environ.get('REWARDS_CRON') == "1":
        print("Running cron job")
        acct = accounts.add(
            environ.get('FEE_CLAIMER'))
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet" and environ.get('REWARDS_CRON') == "1":
        acct = accounts.add(
            environ.get('FEE_CLAIMER'))
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "bsc-testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/bsc_testnet_contracts.json')
    else:
        raise Exception("Network not supported.")
    contracts = json.load(configFile)


loadConfig()