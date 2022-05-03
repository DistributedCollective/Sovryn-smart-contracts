'''
common functionality for tokens airdrop & distribution
'''

import scripts.contractInteraction.config as conf
from brownie import *

def GenericTokenSenderAddAdmin(admin):
    tokenSender = Contract.from_abi("GenericTokenSender", address=conf.contracts['GenericTokenSender'], abi=GenericTokenSender.abi, owner=conf.acct)
    tokenSender.addAdmin(admin)
    print(admin, "is added to GenericTokenSender admins")

def GenericTokenSenderRemoveAdmin(admin):
    tokenSender = Contract.from_abi("GenericTokenSender", address=conf.contracts['GenericTokenSender'], abi=GenericTokenSender.abi, owner=conf.acct)
    tokenSender.removeAdmin(admin)

def getGenericTokenSenderInfo():
     tokenSender = Contract.from_abi("GenericTokenSender", address=conf.contracts['GenericTokenSender'], abi=GenericTokenSender.abi, owner=conf.acct)
     print('Network:', network.chain.id)
     print('GenericTokenSenderAddress: ', tokenSender.address)
     print('Owner:', tokenSender.owner())
     print("IsAdmin: ", conf.acct, tokenSender.admins(conf.acct))