#!/usr/bin/python3

from brownie import *
from scripts.deploy_protocol import deployProtocol
from scripts.deploy_loanToken import deployLoanTokens


import shared
import json
from munch import Munch


def main():
    global configData
    configData = {}

    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")

    (sovryn, tokens) = deployProtocol(acct)
    (loanTokenSUSD, loanTokenWRBTC, loanTokenSettingsSUSD,
     loanTokenSettingsWRBTC) = deployLoanTokens(acct, sovryn, tokens)

    configData["sovrynProtocol"] = sovryn.address
    configData["WRBTC"] = tokens.wrbtc.address
    configData["SUSD"] = tokens.susd.address
    configData["loanTokenSettingsSUSD"] = loanTokenSettingsSUSD.address
    configData["loanTokenSUSD"] = loanTokenSUSD.address
    configData["loanTokenSettingsWRBTC"] = loanTokenSettingsWRBTC.address
    configData["loanTokenRBTC"] = loanTokenWRBTC.address

    with open('./scripts/swap_test.json', 'w') as configFile:
        json.dump(configData, configFile)
