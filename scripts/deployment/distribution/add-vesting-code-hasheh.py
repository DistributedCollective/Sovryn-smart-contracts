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

    balanceBefore = acct.balance()

    # vesting: 0xb77d1aB6a498cDFE3Da422c23A7d90b531865a1F, codeHash: 0x846dfde806e34011ccb73e59643fcaaa4543af5ed5350c12faeacd260422fc0c
    # vesting: 0xc96333eB5f715a0d813909Ed1083EF13424cffBF, codeHash: 0x4f2529e8f3c89a8fea3bc643e4b93cc67d468e6fcecdd151c72aa9c1e3f66d9e
    # vesting: 0xa8779dD47c77BDBc95437bf5dC1b885336F30D9C, codeHash: 0xef7099d548e62d7a31e6254baf6023ef0cdc40f1fd542e2a733819ed88dddfaf

    vestings = ["0xb77d1aB6a498cDFE3Da422c23A7d90b531865a1F", "0xc96333eB5f715a0d813909Ed1083EF13424cffBF", "0xa8779dD47c77BDBc95437bf5dC1b885336F30D9C"]
    staking = Contract.from_abi("Staking", address=contracts['Staking'], abi=Staking.abi, owner=acct)
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)

    for vesting in vestings:
        print(vesting)
        data = staking.addContractCodeHash.encode_input(vesting)
        print(data)
        tx = multisig.submitTransaction(staking.address,0,data)
        txId = tx.events["Submission"]["transactionId"]
        print("txid",txId);

    print("deployment cost:")
    print((balanceBefore - acct.balance()) / 10**18)
