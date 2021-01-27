#!/usr/bin/python3
from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
import shared
import json
from munch import Munch

def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet" or thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
        
    if thisNetwork == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    contracts = json.load(configFile)
    
    sovryn = Contract.from_abi("sovryn", address=contracts["protocol"], abi=interface.ISovryn.abi, owner=acct)
    owners = ['0x52e8f03e7c9c1Ef320ff7C31dB78EAead18E5F85', acct, '0xEaBB83a1cEFc5f50C83BC4252C618d3294152A86']
    requiredConf=2
    deployMultisig(sovryn, acct, owners, requiredConf)

'''
Deploy multisig wallet contract and make it the owner of the Sovryn protocol
'''
def deployMultisig(sovryn, acct, owners, requiredConf):
    multisig= acct.deploy(MultiSigWallet, owners, requiredConf)
    sovryn.transferOwnership(multisig.address, {"from": acct})    
    return multisig