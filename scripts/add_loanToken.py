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

    wrbtcAddress = '0x602C71e4DAC47a042Ee7f46E0aee17F94A3bA0B6'
    susdAddress = '0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87'
    protocolAddress = '0xa3B53dDCd2E3fC28e8E130288F2aBD8d5EE37472'
    priceFeedsAddress = '0x7a3d735ee6873f17Dbdcab1d51B604928dc10d92'
    mocStateAddress = '0xcCB53c9429d32594F404d01fbe9E65ED1DCda8D9'
    medianizerAddress = '0xe0aA552A10d7EC8760Fc6c246D391E698a82dDf9'
    priceFeedMoCAddress = '0xc87E1400E0e70aa82bC881006e08Caddc6d15d07'

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
    tokens.susd = Contract.from_abi("TestToken", address = susdAddress, abi = TestToken.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)

    (iBPro, iBProSettings) = addLoanToken(acct, sovryn, tokens, tokens.bpro.address, "iBPro", "iBPro", [tokens.wrbtc.address], tokens.wrbtc.address, priceFeedsAddress, mocStateAddress, BProPriceFeed)

    configData["BPro"] = tokens.bpro.address
    configData["iBPro"] = iBPro.address
    with open('./scripts/tokens.json', 'w') as configFile:
        json.dump(configData, configFile)

    tokens.bpro.approve(iBPro.address, 100e18)
    iBPro.mint(acct, 1e18)
    testDeployment(acct, sovryn, iBPro.address, tokens.bpro, tokens.wrbtc, 100, 0)
    
def addLoanToken(acct, sovryn, tokens, loanTokenAddress, loanTokenSymbol, loanTokenName, collateralAddresses, wrbtcAddress, priceFeedsAddress, oracleAddress, PriceFeed):
    if not collateralAddresses:
        collateralAddresses = []

    (loanToken, loanTokenSettings) = deployLoanToken(acct, sovryn, loanTokenAddress, loanTokenSymbol, loanTokenName, collateralAddresses, wrbtcAddress)

    priceFeed = acct.deploy(PriceFeed, oracleAddress)
    feeds = Contract.from_abi("PriceFeeds", address=priceFeedsAddress, abi=PriceFeeds.abi, owner=acct)
    feeds.setPriceFeed([loanTokenAddress], [priceFeed.address])

    return (loanToken, loanTokenSettings)