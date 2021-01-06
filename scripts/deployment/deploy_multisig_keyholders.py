from brownie import *

import time
import json

def main():
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        guardian = acct
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet" or thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        guardian = acct
    else:
        raise Exception("network not supported")
        
    if thisNetwork == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    contracts = json.load(configFile)
    # TODO use MultiSig for main network
    if (thisNetwork == "testnet" or thisNetwork == "rsk-mainnet"):
        guardian = contracts['multisig']

    # NTSOV
    tokensOwner = acct
    token = acct.deploy(Comp, tokensOwner)

    # governance
    #params: owner, delay
    delay = 5*60
    timelock = acct.deploy(TimelockComp, acct, delay)

    # TODO we don't need it for Genesis Sale
    # GovernorTokensHolder
    # governorTokensHolder = acct.deploy(GovernorTokensHolder, token.address)
    # make governance an owner of GovernorTokensHolder
    # governorTokensHolder.transferOwnership(timelock.address)

    governor = acct.deploy(GovernorAlphaComp, timelock.address, token.address, guardian)

    dataString = timelock.setPendingAdmin.encode_input(governor.address)
    #2 days and 5 minutes from now
    eta = round(time.time()) + delay + 300
    print("schedule ownership(admin) transfer for ", eta)
    print(dataString[10:])
    timelock.queueTransaction(timelock.address, 0, "setPendingAdmin(address)", dataString[10:], eta)

    # MultiSigKeyHolders
    multiSigKeyHolders = acct.deploy(MultiSigKeyHolders)
    multiSigKeyHolders.transferOwnership(timelock.address)
