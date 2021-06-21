from brownie import *
import json
import time

def main():
    loadConfig()

    balanceBefore = acct.balance()
    choice()
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
def choice():
    repeat = True
    while(repeat):
        print("Options:")
        print("1 for Deploying Token.")
        print("2 for Transfering Token Ownership to multisig.")
        print("3 to exit.")
        selection = int(input("Enter the choice: "))
        if(selection == 1):
            deployFISH()
        elif(selection == 2):
            transferTokenOwnership()
        elif(selection == 3):
            repeat = False
        else:
            print("Smarter people have written this, enter valid selection ;)\n")

# =========================================================================================================================================
def deployFISH():
    decimal = int(values["FISH_Token_Decimal"])
    tokenAmount = int(values["FISH_Token_Amount"]) * (10 ** decimal)
    print("=============================================================")
    print("Deployment Parameters")
    print("=============================================================")
    print("Token Balance with Decimal:      ", tokenAmount/(10 ** decimal))
    print("Token Balance without Decimal:   ", tokenAmount)
    print("=============================================================")

    print("Deploying the Token with the above parameters...")
    FISHToken = acct.deploy(FISH, tokenAmount)
    waitTime()
    tokenAmount = FISHToken.balanceOf(acct)
    print("=============================================================")
    print("Deployed Details")
    print("=============================================================")
    print("FISH Address:                    ", FISHToken)
    print("Token Balance with Decimal:      ", tokenAmount/(10 ** decimal))
    print("Token Balance without Decimal:   ", tokenAmount)
    print("=============================================================")
    values["FISH_Token"] = str(FISHToken)
    writeToJSON()

# =========================================================================================================================================
def transferTokenOwnership():
    tokenAddress = values["FISH_Token"]
    multisig = values["multisig"]
    FISHToken = Contract.from_abi("Staking", address=tokenAddress, abi=FISH.abi, owner=acct)
    print("Current Token Owner of:", tokenAddress, "is", FISHToken.owner())
    FISHToken.transferOwnership(multisig)
    waitTime()
    print("New Token Owner of:", tokenAddress, "is", FISHToken.owner())

# =========================================================================================================================================
def writeToJSON():
    if thisNetwork == "development":
        fileHandle = open('./scripts/origins/values/development.json', "w")
    elif thisNetwork == "testnet" or thisNetwork == "rsk-testnet":
        fileHandle = open('./scripts/origins/values/testnet.json', "w")
    elif thisNetwork == "rsk-mainnet":
        fileHandle = open('./scripts/origins/values/mainnet.json', "w")
    json.dump(values, fileHandle, indent=4)

# =========================================================================================================================================
def waitTime():
    if(thisNetwork != "development"):
        print("\nWaiting for 30 seconds for the node to propogate correctly...\n")
        time.sleep(15)
        print("Just 15 more seconds...\n")
        time.sleep(10)
        print("5 more seconds I promise...\n")
        time.sleep(5)
