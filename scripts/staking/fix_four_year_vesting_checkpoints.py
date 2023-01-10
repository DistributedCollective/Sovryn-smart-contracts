from brownie import *
from brownie.network.contract import InterfaceContainer

import json
import csv
import time
import math
from os import environ

def main():
    global contracts, acct
    thisNetwork = network.show_active()

    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet" and environ.get('REWARDS_CRON') == "1":
        acct = accounts.add(environ.get('FEE_CLAIMER'))
        configFile = open('./scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # load deployed contracts addresses
    contracts = json.load(configFile)

    # Read last staking timestamp
    def readLockDate(timestamp):
        staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=interface.IStaking.abi, owner=acct)
        return staking.timestampToLockDate(timestamp)

    # open the file in universal line ending mode 
    with open('./scripts/fouryearvesting/addfouryearvestingstoregistry.csv', 'rU') as infile:
        #read the file as a dictionary for each row ({header : value})
        reader = csv.DictReader(infile)
        data = {}
        for row in reader:
            for header, value in row.items():
                try:
                    data[header].append(value)
                except KeyError:
                    data[header] = [value]

    # extract the variables you want
    tokenOwners = data['tokenOwner']
    vestingAddresses = data['vestingAddress']
    totalStakeByLockDates = {}
    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    for i in vestingAddresses:
        staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=interface.IStaking.abi, owner=acct)

        print('vestingAddress:', i)
        fourYearVestingLogic = Contract.from_abi(
            "FourYearVestingLogic",
            address=i,
            abi=FourYearVestingLogic.abi,
            owner=acct)
        startDate = fourYearVestingLogic.startDate()
        endDate = fourYearVestingLogic.endDate()
        for lockDate in range(startDate, endDate+1, FOUR_WEEKS):
          numVestingStakeCheckpoints = staking.numUserStakingCheckpoints(i,lockDate)
          if numVestingStakeCheckpoints > 0:
            vestingStakeCheckpoints = staking.userStakingCheckpoints(i,lockDate,0)
            totalStake = vestingStakeCheckpoints[1]
            # print(totalStake)
            if lockDate not in totalStakeByLockDates:
              totalStakeByLockDates[lockDate] = totalStake
            else:
              totalStakeByLockDates[lockDate] += totalStake
    
    print('list total stake by lock dates')
    print(json.dumps(totalStakeByLockDates, indent=2))
    for lockDate in totalStakeByLockDates:
      currentTotalVestingStake = 0;
      print(lockDate, ' -> ', totalStakeByLockDates[lockDate])
      print('set to vesting stake...')
      currentNumVestingStakeCheckpoints = staking.numVestingCheckpoints(lockDate)

      # If vesting stake for this lock date exist, we need to add it.
      if currentNumVestingStakeCheckpoints > 0:
        currentVestingStakeCheckpoints = staking.vestingCheckpoints(lockDate, currentNumVestingStakeCheckpoints-1)
        currentTotalVestingStake = currentVestingStakeCheckpoints[1]

      print('current total vesting stake for date: ', lockDate, ':', currentTotalVestingStake)

      vestingStakeAmount = totalStakeByLockDates[lockDate]+currentTotalVestingStake
      print('new vesting stake amount: ', vestingStakeAmount)
      data = staking.setVestingStakes.encode_input(lockDate, vestingStakeAmount)
      multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
      tx = multisig.submitTransaction(staking.address,0,data)
      txId = tx.events["Submission"]["transactionId"]
      print("txid",txId);
