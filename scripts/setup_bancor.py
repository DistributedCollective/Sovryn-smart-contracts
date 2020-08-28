#!/usr/bin/python3

from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract

import shared
import json

with open('./scripts/setup_bancor_config.json') as config_file:
  data = json.load(config_file)

def main():
    global  sovryn, thisNetwork, acct

    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")

    sovrynproxy = data["sovrynProtocol"]
    contractRegistry = data["contractRegistry"]

    sovryn = Contract.from_abi("sovryn", address=sovrynproxy, abi=interface.ISovryn.abi, owner=acct)
    _add_contract(sovryn)

    print("Setting the bancor contract registry address")
    sovryn.setBancorContractRegistryAddress(contractRegistry)

