from brownie import *

import scripts.contractInteraction.config as conf

def main():
    conf.loadConfig()

    balanceBefore = conf.acct.balance()

    tokenSender = conf.acct.deploy(GenericTokenSender)
    tokenSender.addAdmin(conf.acct)
    tokenSender.transferOwnership(conf.contracts['multisig'])

    print("isAdmin =", tokenSender.admins(conf.acct))
    print("owner =", tokenSender.owner())

    print("deployment cost:")
    print((balanceBefore - conf.acct.balance()) / 10**18)
