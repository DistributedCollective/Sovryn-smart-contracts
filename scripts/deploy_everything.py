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

    owners = [accounts[0], accounts[1], accounts[2]]
    requiredConf=2
    configData = {} # deploy new tokens
    '''
    configData = {
        'WRBTC': '0xA8621C444E97F0074EfCDff8a2fDafD866662c67',
        'SUSD': '0x0589C9f0632CbCF4BBCedbCE63e004653788A3Fd'
    }
    '''

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
    sovryn = deployProtocol(acct, tokens)
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
