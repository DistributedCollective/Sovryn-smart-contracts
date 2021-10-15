from brownie import *

import json

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

    INPUT_FILE = "./scripts/staking/vestings.json"

    vestingStakes = {}
    with open(INPUT_FILE) as file:
        lines = file.readlines()
    for line in lines:
        vestingData = json.loads(line)
        if (vestingData["vesting"]) != ZERO_ADDRESS:
            dates = vestingData["dates"]
            amounts = vestingData["amounts"]
            for id, date in enumerate(dates):
                amount = amounts[id]
                oldAmount = 0
                if date in vestingStakes:
                    oldAmount = int(vestingStakes[date])
                vestingStakes[date] = oldAmount + int(amount)

    print(vestingStakes)
    print("=====================================")

    dates = []
    amounts = []
    for key in vestingStakes:
        dates.append(key)
        amounts.append(vestingStakes[key])

    print(dates)
    print(amounts)

    # staking.setVestingStakes(dates, amounts, {'allow_revert':True})

    # data = staking.setVestingStakes.encode_input(dates, amounts)
    # multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    # tx = multisig.submitTransaction(staking.address,0,data)
    # txId = tx.events["Submission"]["transactionId"]
    # print("txid",txId);
