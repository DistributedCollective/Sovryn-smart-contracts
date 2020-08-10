#!/usr/bin/python3

from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract

import shared
from munch import Munch




def main():
    deployProtocol()

def deployProtocol():
   
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    else : ## thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")

    mockup = acct.deploy(LoanTokenLogicStandardMockup)
    
   