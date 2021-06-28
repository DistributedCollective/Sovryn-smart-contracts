from brownie import *

def sendWithMultisig(multisigAddress, contractAddress, data, sender):
    multisig = Contract.from_abi("MultiSig", address=multisigAddress, abi=MultiSigWallet.abi, owner=multisigAddress)
    tx = multisig.submitTransaction(contractAddress,0,data, {'from': sender})
    txId = tx.events["Submission"]["transactionId"]
    print("tx id: ", txId)

