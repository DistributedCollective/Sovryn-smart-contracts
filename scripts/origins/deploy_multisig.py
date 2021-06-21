from brownie import *
import json

def main():
    loadConfig()

    balanceBefore = acct.balance()
    deployMultisig()
    balanceAfter = acct.balance()

    print("=============================================================")
    print("ETH Before Balance:  ", balanceBefore)
    print("ETH After Balance:   ", balanceAfter)
    print("Gas Used:            ", balanceBefore - balanceAfter)
    print("=============================================================")

# =========================================================================================================================================
def loadConfig():
    global values, acct, thisNetwork
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
        configFile = open('./scripts/origins/values/development.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open('./scripts/origins/values/testnet.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile = open('./scripts/origins/values/testnet.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open('./scripts/origins/values/mainnet.json')
    else:
        raise Exception("Network not supported")

    # Load values & deployed contracts addresses.
    values = json.load(configFile)

# =========================================================================================================================================
def deployMultisig():
    owners = values["multisigOwners"]
    requiredConf = 1
    if network.show_active() == "mainnet":
        requiredConf = int(len(owners)/2 + 1)
    print("=============================================================")
    print("Deployment Parameters")
    print("=============================================================")
    print("Multisig Owners:         ", owners)
    print("Required Confirmations:  ", requiredConf)
    print("=============================================================")

    multisig = acct.deploy(MultiSigWallet, owners, requiredConf)
    print("=============================================================")
    print("Deployed Details")
    print("=============================================================")
    print("Multisig Address:        ", multisig)
    print("=============================================================")
    values["multisig"] = str(multisig)
    writeToJSON()

# =========================================================================================================================================
def writeToJSON():
    if thisNetwork == "development":
        fileHandle = open('./scripts/origins/values/development.json', "w")
    elif thisNetwork == "testnet" or thisNetwork == "rsk-testnet":
        fileHandle = open('./scripts/origins/values/testnet.json', "w")
    elif thisNetwork == "rsk-mainnet":
        fileHandle = open('./scripts/origins/values/mainnet.json', "w")
    json.dump(values, fileHandle, indent=4)
