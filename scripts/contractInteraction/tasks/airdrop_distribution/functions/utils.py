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