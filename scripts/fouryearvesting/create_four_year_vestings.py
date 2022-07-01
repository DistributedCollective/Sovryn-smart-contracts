from brownie import *

import time
import json
import csv
import math

def main():
    thisNetwork = network.show_active()

    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile = open(
            './scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)
    multisig = contracts['multisig']
    stakingAddress = contracts['Staking']
    feeSharingAddress = contracts['FeeSharingProxy']
    fourYearVestingLogic = contracts['FourYearVestingLogic']
    SOVtoken = Contract.from_abi("SOV", address=contracts['SOV'], abi=SOV.abi, owner=acct)
    staking = Contract.from_abi("Staking", address=stakingAddress, abi=Staking.abi, owner=acct)
    fourYearVestingFactory = Contract.from_abi("FourYearVestingFactory", address=contracts['FourYearVestingFactory'], abi=FourYearVestingFactory.abi, owner=acct)

    MULTIPLIER = 10**16 # Expecting two decimals
    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY
    cliff =  FOUR_WEEKS
    duration = 39 * FOUR_WEEKS

    balanceBefore = acct.balance()

    print("SOV Balance Before:")
    print(SOVtoken.balanceOf(acct) / 10**18)

    # == Vesting contracts creation and staking tokens ==============================================================================
    # TODO check fouryearvestinglist.csv
    dataFile = 'scripts/fouryearvesting/fouryearvestinglist.csv'
    with open(dataFile, 'r') as file:
        reader = csv.reader(file)
        for row in reader:
            tokenOwner = row[0].replace(" ", "")
            amount = row[1].replace(",", "").replace(".", "")
            amount = int(amount) * MULTIPLIER
            extendDurationFor = row[2].replace(" ", "")
            tx = fourYearVestingFactory.deployFourYearVesting(SOVtoken.address, stakingAddress, tokenOwner, feeSharingAddress, multisig, fourYearVestingLogic, extendDurationFor)
            event = tx.events["FourYearVestingCreated"]
            vestingAddress = event["vestingAddress"]
            print("=======================================")
            print("Token Owner: ", tokenOwner)
            print("Vesting Contract Address: ", vestingAddress)
            print("Staked Amount: ", amount)
            fourYearVesting = Contract.from_abi("FourYearVestingLogic", address=vestingAddress, abi=FourYearVestingLogic.abi, owner=acct)

            SOVtoken.approve(vestingAddress, amount)

            remainingAmount = amount
            lastSchedule = 0
            while remainingAmount > 0:
                fourYearVesting.stakeTokens(remainingAmount, lastSchedule)
                time.sleep(10)
                lastSchedule = fourYearVesting.lastStakingSchedule()
                print('lastSchedule:', lastSchedule)
                remainingAmount = fourYearVesting.remainingStakeAmount()
                print('remainingAmount:', remainingAmount)

            stakes = staking.getStakes(vestingAddress)
            print("Staking Details")
            print("=======================================")
            print(stakes)

    #  == Transfer ownership to multisig =============================================================================================
    #fourYearVestingFactory.transferOwnership(multisig)

    print("SOV Balance After:")
    print(SOVtoken.balanceOf(acct) / 10**18)

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
