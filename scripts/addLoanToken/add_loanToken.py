from brownie import *
from scripts.deployment.deploy_loanToken import deployLoanToken, testDeployment

import shared
import json
from munch import Munch

def addLoanToken(tokenName, tokenSymbol, tokenDecimals, tokenInitialAmount, loanTokenSymbol, loanTokenName, loanTokenWRBTCAmount, loanTokenUnderlyingTokenAmount, loanTokenAllowance, loanTokenSent, PriceFeed, *oracleAddress):
    global configData, tokens

    configData = {}
    
    loadConfig()

    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    
    tokens = Munch()

    if this_network == "development":
        tokens.token = acct.deploy(TestToken, tokenName, tokenSymbol, tokenDecimals, tokenInitialAmount)
        #on development network the owner of the sovryn protocol is the wallet deploying it
        sovryn.setSupportedTokens([tokens.token.address],[True])
        
    elif this_network == "testnet" or this_network == "rsk-mainnet":
        tokens.token = Contract.from_abi("Token", address=contracts[tokenSymbol], abi=IERC20.abi, owner=acct)
        #on testnet and mainnet, the owner is currently a multisig
        multisig = Contract.from_abi("MultiSig", address=contracts["multisig"], abi=MultiSigWallet.abi, owner=acct)
        data = sovryn.setSupportedTokens.encode_input([tokens.token.address],[True])
        tx = multisig.submitTransaction(sovryn.address,0,data)
        txId = tx.events["Submission"]["transactionId"]
        print('confirm following txId to set supported token:', txId)
        
    
    tokens.wrbtc = Contract.from_abi("WRBTC", address = wrbtcAddress, abi = WRBTC.abi, owner = acct)
    
    feeds = Contract.from_abi("PriceFeeds", address=priceFeedsAddress, abi=PriceFeeds.abi, owner=acct)

    (loanToken, loanTokenSettings) = deployLoanToken(acct, sovryn, tokens.token.address, loanTokenSymbol, loanTokenName, [tokens.wrbtc.address], tokens.wrbtc.address)

    tokens.token.approve(loanToken.address, loanTokenAllowance+loanTokenUnderlyingTokenAmount)
    loanToken.mint(acct, loanTokenUnderlyingTokenAmount)

    if len(oracleAddress) == 0:
        priceFeed = acct.deploy(PriceFeed)
    elif len(oracleAddress) == 1:
        priceFeed = acct.deploy(PriceFeed, oracleAddress[0])

    feeds.setPriceFeed([tokens.token.address], [priceFeed.address])
    
    writeConfig(loanToken, loanTokenSettings, feeds, tokenSymbol)
    
    
    #for other networks the test fails, because the AMM needs to be set up first
    if this_network == "development":
        testDeployment(acct, sovryn, loanToken.address, tokens.token, tokens.wrbtc, loanTokenSent, 0)



def loadConfig():
    global contracts, this_network, acct, wrbtcAddress, protocolAddress, priceFeedsAddress
    this_network = network.show_active()
    
    if this_network == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
        acct = accounts.load("rskdeployer")
    elif this_network == "testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
        acct = accounts.load("rskdeployer")
    elif this_network == "development":
        configFile =  open('./scripts/swapTest/swap_test.json')
        acct = accounts[0]
    else:
        raise Exception("network not supported")
    contracts = json.load(configFile)
    
    wrbtcAddress = contracts["WRBTC"]
    protocolAddress = contracts["sovrynProtocol"]
    priceFeedsAddress = contracts["PriceFeeds"]
    
def writeConfig(loanToken, loanTokenSettings, feeds, tokenSymbol):
    configData["sovrynProtocol"] = protocolAddress
    configData["WRBTC"] = wrbtcAddress
    configData["UnderlyingToken"] = tokens.token.address
    configData["loanTokenSettings"] = loanTokenSettings.address
    configData["loanToken"] = loanToken.address
    if this_network == "development":
        configData["loanTokenSettingsWRBTC"] = contracts["loanTokenSettingsWRBTC"]
        configData["loanTokenRBTC"] = contracts["loanTokenRBTC"]
    else:
        configData["loanTokenSettingsWRBTC"] = contracts["iRBTCSettings"]
        configData["loanTokenRBTC"] = contracts["iRBTC"]
    configData["UnderlyingTokenPriceFeed"] = feeds.pricesFeeds(tokens.token.address)
    configData["WRBTCPriceFeed"] = feeds.pricesFeeds(tokens.wrbtc.address)

    with open('./scripts/swapTest/swap_test_{token}.json'.format(token=tokenSymbol.lower()), 'w') as configFile:
        json.dump(configData, configFile)