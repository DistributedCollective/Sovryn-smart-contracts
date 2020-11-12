#!/usr/bin/python3
from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
import shared
from munch import Munch

def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet" or thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
    
    sovryn = Contract.from_abi("sovryn", address="0x25380305f223B32FDB844152abD2E82BC5Ad99c3", abi=interface.ISovryn.abi, owner=acct)
    owners = ['0x55310E0bC1a85Bb24Ec7798a673a69BA254B6BBf', acct, '0xEaBB83a1cEFc5f50C83BC4252C618d3294152A86']
    requiredConf=2
    deployMultisig(sovryn, acct, owners, requiredConf)

'''
Deploy multisig wallet contract and make it the owner of the Sovryn protocol
'''
def deployMultisig(sovryn, acct, owners, requiredConf):
    multisig= acct.deploy(MultiSigWallet, owners, requiredConf)
    sovryn.transferOwnership(multisig.address, {"from": acct})    
    return multisig