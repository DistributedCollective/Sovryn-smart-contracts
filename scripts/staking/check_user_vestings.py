from brownie import *

import json
import csv

def main():
    ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

    thisNetwork = network.show_active()
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)

    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    '''
    registries = []
    registries.append(Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=acct))
    registries.append(Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry2'], abi=VestingRegistry.abi, owner=acct))
    registries.append(Contract.from_abi("VestingRegistry", address=contracts['VestingRegistry3'], abi=VestingRegistry.abi, owner=acct))
    '''

    vestingRegistry = Contract.from_abi("VestingRegistryLogic", address=contracts['VestingRegistryProxy'], abi=VestingRegistryLogic.abi, owner=acct)


    INPUT_FILE = "./scripts/staking/users.csv"
    OUTPUT_FILE = "./scripts/staking/vestings.json"

    users = getUsers(OUTPUT_FILE)

    usersSet = set()

    currentTS = 1636182187

    jsonFile = open(OUTPUT_FILE, "a")
    with open(INPUT_FILE, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            user = row[0]
            usersSet.add(user)
            print(user)
            if user in users:
                continue
            vestings = getUserVestings(vestingRegistry, user)
            vestingDataList = []
            if (len(vestings) == 0):
                vestingData = {
                    "user": user,
                    "vesting": ZERO_ADDRESS,
                    "dates": [],
                    "amounts": []
                }
                vestingDataList.append(vestingData)
            for vesting in vestings:
                stakes = staking.getStakes(vesting)
                amount = 0
                dates = stakes[0]
                amounts = stakes[1]
                if (len(dates) > 0):
                    for idx, lockDate in enumerate(dates):
                        if (currentTS > lockDate):
                            amount += amounts[idx]
                            print(lockDate)
                    amount /= 10**18
                    vestingData = {
                        "user": user,
                        "vesting": vesting,
                        "amount": amount,
                        "dates": stakes[0],
                        "amounts": stakes[1]
                    }
                    vestingDataList.append(vestingData)
            for data in vestingDataList:
                jsonFile.write(json.dumps(data) + "\n")

    # usersSetFile = open("./scripts/staking/users2.csv", "a")
    # for user in usersSet:
    #     usersSetFile.write(user + "\n")
    # print("len(usersSet) =", len(usersSet))

def getUsers(fileName):
    with open(fileName) as file:
        lines = file.readlines()
    users = []
    for line in lines:
        vestingData = json.loads(line)
        users.append(vestingData["user"])
    return users

def getUserVestings(vestingRegistry, user):
    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY
    MONTHS_10 = 10 * FOUR_WEEKS
    MONTHS_26 = 26 * FOUR_WEEKS # 2 year: 4 weeks * 10 * 2 = 
    WEEKS_156 = 156 * 7 * DAY # 4 year: 4 weeks * 10 (10 months - 1 year) * 4 == 160, 160 - 4 (cliff) = 156
    LOCKEDSOV_DURATION = 24192000
    cliff = FOUR_WEEKS
    vestings = []
    durationTypes = [[LOCKEDSOV_DURATION, 0], [MONTHS_10, 3], [MONTHS_26, 1], [WEEKS_156, 4]]
    for durationType in durationTypes:
        vesting = vestingRegistry.getVestingAddr(user, cliff, durationType[0], durationType[1]) 
        if (vesting != ZERO_ADDRESS):
            vestings.append(vesting)
        vesting = vestingRegistry.getTeamVesting(user, cliff, durationType[0], durationType[1]) 
        if (vesting != ZERO_ADDRESS):
            vestings.append(vesting)
    
    return vestings
