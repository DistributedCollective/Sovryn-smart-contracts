from brownie import *
import csv

def sendWithMultisig(multisigAddress, contractAddress, data, sender, value = 0):
    multisig = Contract.from_abi("MultiSig", address=multisigAddress, abi=MultiSigWallet.abi, owner=multisigAddress)
    tx = multisig.submitTransaction(contractAddress,value,data, {'from': sender})
    txId = tx.events["Submission"]["transactionId"]
    print("tx id: ", txId)

def printToCSV(fileName, rows):
    with open(fileName, 'w', newline='') as file:
        writer = csv.writer(file)

        for i in range(0,len(rows)):
            writer.writerow(rows[i])
        
     
