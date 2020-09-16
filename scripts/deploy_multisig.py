#!/usr/bin/python3
from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
import shared
from munch import Munch


'''
Deploy multisig wallet contract and make it the owner of the Sovryn protocol
'''
def deployMultisig(sovryn, acct, owners, requiredConf):
    
    multisig= acct.deploy(MultiSigWallet, owners, requiredConf)
    sovryn.transferOwnership(multisig.address, {"from": acct})    
    return multisig