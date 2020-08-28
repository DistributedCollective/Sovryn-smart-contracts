#!/usr/bin/python3

from brownie import *
from scripts.deploy_protocol import deployProtocol
from scripts.deploy_loanToken import deployLoanTokens


import shared
from munch import Munch



def main():
    
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
        
    (sovryn, tokens) = deployProtocol(acct)
    deployLoanTokens(acct, sovryn, tokens)


