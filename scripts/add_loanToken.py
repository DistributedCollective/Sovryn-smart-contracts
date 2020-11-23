#!/usr/bin/python3

from brownie import *
from scripts.deploy_loanToken import deployLoanToken, testDeployment
from scripts.deploy_tokens import deployTokens

import shared
import json
from munch import Munch

def main():
    global configData

    #owners = [accounts[0], accounts[1], accounts[2]]
    requiredConf=2
    configData = {} # deploy new tokens

    with open('./scripts/swap_test.json') as config_file:
        swapTestData = json.load(config_file)

    wrbtcAddress = swapTestData["WRBTC"]
    protocolAddress = swapTestData["sovrynProtocol"]
    priceFeedsAddress = "0xC0FB6B7230C2f58c88AaAba054f0AA3FfB9De533"
    mocStateAddress = swapTestData["mocState"]

    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet" or thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")

    tokens = Munch()
    if thisNetwork == "development":
        tokens.wrbtc = Contract.from_abi("TestWrbtc", address = wrbtcAddress, abi = TestWrbtc.abi, owner = acct)
        tokens.bpro = acct.deploy(TestToken, "BPro", "BPro", 18, 1e50)
        tokens.bpro.mint(acct, 10000e18)
    else:
        tokens.wrbtc = Contract.from_abi("WRBTC", address = wrbtcAddress, abi = WRBTC.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    sovryn.setSupportedTokens([tokens.bpro.address],[True])
    feeds = Contract.from_abi("PriceFeeds", address=priceFeedsAddress, abi=PriceFeeds.abi, owner=acct)

    (iBPro, iBProSettings) = addLoanToken(acct, sovryn, tokens, tokens.bpro.address, "iBPro", "iBPro", [tokens.wrbtc.address], tokens.wrbtc.address, feeds, BProPriceFeed, mocStateAddress)

    configData["medianizer"] = swapTestData["medianizer"]
    configData["mocState"] = mocStateAddress
    configData["sovrynProtocol"] = protocolAddress
    configData["WRBTC"] = wrbtcAddress
    configData["BPro"] = tokens.bpro.address
    configData["loanTokenSettingsBPro"] = iBProSettings.address
    configData["loanTokenBPro"] = iBPro.address
    configData["loanTokenSettingsWRBTC"] = swapTestData["loanTokenSettingsWRBTC"]
    configData["loanTokenRBTC"] = swapTestData["loanTokenRBTC"]
    configData["BProPriceFeed"] = feeds.pricesFeeds(tokens.bpro.address)
    configData["WRBTCPriceFeed"] = feeds.pricesFeeds(tokens.wrbtc.address)

    with open('./scripts/swap_test_bpro.json', 'w') as configFile:
        json.dump(configData, configFile)

    tokens.bpro.mint(iBPro.address, 6e16)
    tokens.bpro.approve(iBPro.address, 1e16)
    testDeployment(acct, sovryn, iBPro.address, tokens.bpro, tokens.wrbtc, 1e16, 0)
    
def addLoanToken(acct, sovryn, tokens, loanTokenAddress, loanTokenSymbol, loanTokenName, collateralAddresses, wrbtcAddress, feeds, PriceFeed, oracleAddress):
    if not collateralAddresses:
        collateralAddresses = []

    (loanToken, loanTokenSettings) = deployLoanToken(acct, sovryn, loanTokenAddress, loanTokenSymbol, loanTokenName, collateralAddresses, wrbtcAddress)

    priceFeed = acct.deploy(PriceFeed, oracleAddress)
    feeds.setPriceFeed([loanTokenAddress], [priceFeed.address])

    return (loanToken, loanTokenSettings)