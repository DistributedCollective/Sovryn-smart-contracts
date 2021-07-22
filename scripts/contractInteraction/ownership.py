from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def transferOwner(contractAddress, newOwner):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=conf.acct)
    tx= contract.transferOwnership(newOwner)
    tx.info()
    checkOwnerIsAddress(contractAddress, newOwner)

def acceptOwnershipWithMultisig(contractAddress):
    abiFile =  open('./scripts/contractInteraction/ABIs/Owned.json')
    abi = json.load(abiFile)
    ownedContract = Contract.from_abi("Owned", address=contractAddress, abi=abi, owner=conf.acct)
    data=ownedContract.acceptOwnership.encode_input()
    sendWithMultisig(conf.contracts['multisig'], contractAddress, data, conf.acct)

def readOwner(contractAddress):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=conf.acct)
    print('owner:',contract.owner())

def checkOwnerIsAddress(contractAddress, expectedOwner):
    contract = Contract.from_abi("loanToken", address=contractAddress, abi=LoanToken.abi, owner=conf.acct)
    owner = contract.owner()
    print("owner == expectedOwner?", owner == expectedOwner)



def readOwnersOfAllContracts():
    for contractName in contracts:
        #print(contractName)
        contract = Contract.from_abi("Ownable", address=conf.contracts[contractName], abi=LoanToken.abi, owner=conf.acct)
        if(contractName != 'multisig' and contractName != 'WRBTC' and contractName != 'og'  and contractName != 'USDT' and contractName != 'medianizer' and contractName != 'USDTtoUSDTOracleAMM' and contractName != 'GovernorOwner'  and contractName != 'GovernorAdmin' and contractName != 'SovrynSwapFormula' and contractName != 'MOCState' and contractName != 'USDTPriceFeed' and contractName != 'FeeSharingProxy'  and contractName != 'TimelockOwner'  and contractName != 'TimelockAdmin' and contractName != 'AdoptionFund' and contractName != 'DevelopmentFund'):
            owner = contract.owner()
            if(owner != conf.contracts['multisig']):
                print("owner of ", contractName, " is ", owner)