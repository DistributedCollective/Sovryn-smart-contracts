#!/usr/bin/python3

from brownie import *
from scripts.deploy_protocol import deployProtocol
from scripts.deploy_loanToken import deployLoanTokens
from scripts.deploy_tokens import deployTokens, readTokens
from scripts.deploy_multisig import deployMultisig

import shared
import json
from munch import Munch

'''
Deploys all of the contracts.
1. deploys the tokens or reads exsiting token contracts.
    if configData contains token addresses, use the given addresses
    else, deploy new tokens
2. deploys the base protocol contracts.
3. deploys, configures and tests the loan token contracts.
4. writes the relevant contract addresses into swap_test.json.
'''
def main():
    global configData

    #owners = [accounts[0], accounts[1], accounts[2]]
    requiredConf=2
    configData = {} # deploy new tokens
    
    configData = {
        'WRBTC': '0x69FE5cEC81D5eF92600c1A0dB1F11986AB3758Ab',
        'SUSD': '0xCb46C0DdC60d18eFEB0e586c17AF6Ea36452DaE0',
        'medianizer': '0x667bd3d048FaEBb85bAa0E9f9D87cF4c8CDFE849'
    }
    

    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
    
    if('WRBTC' in configData and 'SUSD' in configData):
        tokens = readTokens(acct, configData['WRBTC'], configData['SUSD'])
    else:
        tokens = deployTokens(acct)
        
    if(not 'medianizer' in configData):
        medianizer = deployMoCMockup(acct)
        configData['medianizer'] = medianizer.address
        
    sovryn = deployProtocol(acct, tokens, configData['medianizer'])
    (loanTokenSUSD, loanTokenWRBTC, loanTokenSettingsSUSD,
     loanTokenSettingsWRBTC) = deployLoanTokens(acct, sovryn, tokens)

    #deployMultisig(sovryn, acct, owners, requiredConf)
    
    configData["sovrynProtocol"] = sovryn.address
    configData["WRBTC"] = tokens.wrbtc.address
    configData["SUSD"] = tokens.susd.address
    configData["loanTokenSettingsSUSD"] = loanTokenSettingsSUSD.address
    configData["loanTokenSUSD"] = loanTokenSUSD.address
    configData["loanTokenSettingsWRBTC"] = loanTokenSettingsWRBTC.address
    configData["loanTokenRBTC"] = loanTokenWRBTC.address

    with open('./scripts/swap_test.json', 'w') as configFile:
        json.dump(configData, configFile)

def deployMoCMockup(acct):
    priceFeedMockup = acct.deploy(PriceFeedsMoCMockup)
    priceFeedMockup.setHas(True)
    priceFeedMockup.setValue(11653e18)
    return priceFeedMockup