#!/usr/bin/python3

from brownie import *
from scripts.deploy_loanToken import deployLoanToken, testDeployment

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
    priceFeedsAddress = "0x7a3d735ee6873f17Dbdcab1d51B604928dc10d92"

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
        tokens.usdt = acct.deploy(TestToken, "USDT", "USDT", 18, 1e50)
        tokens.usdt.mint(acct, 10000e18)
    else:
        tokens.wrbtc = Contract.from_abi("WRBTC", address = wrbtcAddress, abi = WRBTC.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    sovryn.setSupportedTokens([tokens.usdt.address],[True])
    feeds = Contract.from_abi("PriceFeeds", address=priceFeedsAddress, abi=PriceFeeds.abi, owner=acct)


    (iUSDT, iUSDTSettings) = deployLoanToken(acct, sovryn, tokens.usdt.address, "iUSDT", "iUSDT", [tokens.wrbtc.address], tokens.wrbtc.address)

    priceFeed = acct.deploy(USDTPriceFeed)
    feeds.setPriceFeed([tokens.usdt.address], [priceFeed.address])

    tokens.wrbtc.mint(iUSDT.address, 1e17)
    tokens.usdt.mint(iUSDT.address, 1000e18)
    tokens.usdt.approve(iUSDT.address, 1000e18)

    configData["sovrynProtocol"] = protocolAddress
    configData["WRBTC"] = wrbtcAddress
    configData["USDT"] = tokens.usdt.address
    configData["loanTokenSettingsUSDT"] = iUSDTSettings.address
    configData["loanTokenUSDT"] = iUSDT.address
    configData["loanTokenSettingsWRBTC"] = swapTestData["loanTokenSettingsWRBTC"]
    configData["loanTokenRBTC"] = swapTestData["loanTokenRBTC"]
    configData["USDTPriceFeed"] = feeds.pricesFeeds(tokens.usdt.address)
    configData["WRBTCPriceFeed"] = feeds.pricesFeeds(tokens.wrbtc.address)

    with open('./scripts/swap_test_usdt.json', 'w') as configFile:
        json.dump(configData, configFile)


    testDeployment(acct, sovryn, iUSDT.address, tokens.usdt, tokens.wrbtc, 1e18, 0)
    
