
from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def governorAcceptAdmin(type):
    governor = Contract.from_abi("GovernorAlpha", address=conf.contracts[type], abi=GovernorAlpha.abi, owner=conf.acct)
    data = governor.__acceptAdmin.encode_input()
    sendWithMultisig(conf.contracts['multisig'], governor.address, data, conf.acct)

def queueProposal(id):
    governor = Contract.from_abi("GovernorAlpha", address=conf.contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=conf.acct)
    tx = governor.queue(id)
    tx.info()

def queueProposalAdmin(id):
    governor = Contract.from_abi("GovernorAlpha", address=conf.contracts['GovernorAdmin'], abi=GovernorAlpha.abi, owner=conf.acct)
    governor.queue(id)

def executeProposal(id):
    governor = Contract.from_abi("GovernorAlpha", address=conf.contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=conf.acct)
    tx = governor.execute(id)
    tx.info()

def cancelProposal(type, proposalId): 
    # type == 'GovernorOwner' or 'GovernorAdmin'; proposalId - proposal ordered number
    governor = Contract.from_abi("GovernorAlpha", address=conf.contracts[type], abi=GovernorAlpha.abi, owner=conf.acct)
    data = governor.cancel.encode_input(proposalId)
    if governor.guardian() == conf.contracts['multisig']:
        sendWithMultisig(conf.contracts['multisig'], governor.address, data, conf.acct)
    else:
        raise Exception("Guardian address is not multisig")

def removeExchequerFromLockedSOVAdmin():
    print("Remove LockedSOVaddress admin for exchequer multisig: ", conf.contracts['multisig'])
    lockedSOV = Contract.from_abi("LockedSOV", address=conf.contracts["LockedSOV"], abi=LockedSOV.abi, owner=conf.acct)
    data = lockedSOV.removeAdmin.encode_input(conf.contracts['multisig'])
    sendWithMultisig(conf.contracts['multisig'], lockedSOV.address, data, conf.acct)

def transferLockedSOVOwnershipToGovernance():
    print("Add LockedSOV admin for address: ", conf.contracts['TimelockAdmin'])
    lockedSOV = Contract.from_abi("LockedSOV", address=conf.contracts["LockedSOV"], abi=LockedSOV.abi, owner=conf.acct)
    data = lockedSOV.addAdmin.encode_input(conf.contracts['TimelockAdmin'])
    sendWithMultisig(conf.contracts['multisig'], lockedSOV.address, data, conf.acct)
   
def proposalState(type, proposalId):
    governor = Contract.from_abi("GovernorAlpha", address=conf.contracts[type], abi=GovernorAlpha.abi, owner=conf.acct)
    print(governor.state(proposalId))

def timelockAdmin(type):
    timelock =  Contract.from_abi("Timelock", address=conf.contracts[type], abi=Timelock.abi, owner=conf.acct)
    print(timelock.admin())
    print(timelock.pendingAdmin())

def simulateVeto():
    governor = Contract.from_abi("GovernorAlpha", address=conf.contracts['GovernorOwner'], abi=GovernorAlpha.abi, owner=conf.acct)
    governor.cancel(20,{"from":conf.contracts['multisig']}).call(block_identifier=5113690)