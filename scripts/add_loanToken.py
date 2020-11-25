from brownie import *
from scripts.deploy_loanToken import deployLoanToken, testDeployment

import shared
import json
from munch import Munch

def addLoanToken(tokenName, tokenSymbol, tokenDecimals, tokenInitialAmount, loanTokenSymbol, loanTokenName, loanTokenWRBTCAmount, loanTokenUnderlyingTokenAmount, loanTokenAllowance, loanTokenSent, PriceFeed, *oracleAddress):
    global configData

    #owners = [accounts[0], accounts[1], accounts[2]]
    requiredConf=2
    configData = {} # deploy new tokens

    with open('./scripts/swap_test.json') as config_file:
        swapTestData = json.load(config_file)

    wrbtcAddress = swapTestData["WRBTC"]
    protocolAddress = swapTestData["sovrynProtocol"]
    priceFeedsAddress = swapTestData["PriceFeeds"]

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
        tokens.token = acct.deploy(TestToken, tokenName, tokenSymbol, tokenDecimals, tokenInitialAmount)
    else:
        tokens.wrbtc = Contract.from_abi("WRBTC", address = wrbtcAddress, abi = WRBTC.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    sovryn.setSupportedTokens([tokens.token.address],[True])
    feeds = Contract.from_abi("PriceFeeds", address=priceFeedsAddress, abi=PriceFeeds.abi, owner=acct)

    (loanToken, loanTokenSettings) = deployLoanToken(acct, sovryn, tokens.token.address, loanTokenSymbol, loanTokenName, [tokens.wrbtc.address], tokens.wrbtc.address)

    tokens.wrbtc.mint(loanToken.address, loanTokenWRBTCAmount)
    tokens.token.mint(loanToken.address, loanTokenUnderlyingTokenAmount)
    tokens.token.approve(loanToken.address, loanTokenAllowance)

    if len(oracleAddress) == 0:
        priceFeed = acct.deploy(PriceFeed)
    elif len(oracleAddress) == 1:
        priceFeed = acct.deploy(PriceFeed, oracleAddress[0])

    feeds.setPriceFeed([tokens.token.address], [priceFeed.address])

    configData["sovrynProtocol"] = protocolAddress
    configData["WRBTC"] = wrbtcAddress
    configData["UnderlyingToken"] = tokens.token.address
    configData["loanTokenSettings"] = loanTokenSettings.address
    configData["loanToken"] = loanToken.address
    configData["loanTokenSettingsWRBTC"] = swapTestData["loanTokenSettingsWRBTC"]
    configData["loanTokenRBTC"] = swapTestData["loanTokenRBTC"]
    configData["UnderlyingTokenPriceFeed"] = feeds.pricesFeeds(tokens.token.address)
    configData["WRBTCPriceFeed"] = feeds.pricesFeeds(tokens.wrbtc.address)

    with open('./scripts/swap_test_{token}.json'.format(token=tokenSymbol.lower()), 'w') as configFile:
        json.dump(configData, configFile)

    testDeployment(acct, sovryn, loanToken.address, tokens.token, tokens.wrbtc, loanTokenSent, 0)



