from brownie import *
import json
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def getBalance(contractAddress, acct):
    contract = Contract.from_abi("Token", address=contractAddress, abi=LoanToken.abi, owner=conf.acct)
    balance = contract.balanceOf(acct)
    print(balance/1e18)
    return balance

def getContractBTCBalance(contractAddress):
     contract = Contract.from_abi("Token", address=contractAddress, abi=LoanToken.abi, owner=conf.acct)
     return contract.balance()
    
def buyWRBTC(amount):
    contract = Contract.from_abi("WRBTC", address=conf.contracts["WRBTC"], abi=WRBTC.abi, owner=conf.acct)
    tx = contract.deposit({'value':amount})
    tx.info()
    print("New balance: ", contract.balanceOf(conf.acct))

def buyWRBTCWithMS(amount):
    contract = Contract.from_abi("WRBTC", address=conf.contracts["WRBTC"], abi=WRBTC.abi, owner=conf.acct)
    data = contract.deposit.encode_input()
    sendWithMultisig(conf.contracts['multisig'], contract, data, conf.acct, amount)


def hasApproval(tokenContractAddr, sender, receiver):
    tokenContract = Contract.from_abi("Token", address=tokenContractAddr, abi=TestToken.abi, owner=sender)
    allowance = tokenContract.allowance(sender, receiver)
    print("allowance: ", allowance/1e18)
    return allowance

def mintNFT(contractAddress, receiver):
    abiFile =  open('./scripts/contractInteraction/ABIs/SovrynNft.json')
    abi = json.load(abiFile)
    nft = Contract.from_abi("NFT", address=contractAddress, abi=abi, owner=conf.acct)
    nft.mint(receiver)

def transferTokensFromWallet(tokenContract, receiver, amount):
    token = Contract.from_abi("Token", address=tokenContract, abi = TestToken.abi, owner=conf.acct)
    token.transfer(receiver, amount)

def sendToWatcher(tokenAddress, amount):
    if(tokenAddress == conf.contracts['WRBTC']):
       buyWRBTC(amount)
    transferTokensFromWallet(conf.contracts['WRBTC'], conf.contracts['WatcherContract'], amount)
    
def tokenApproveFromMS(tokenContract, receiver, amount):
    token = Contract.from_abi("Token", address= tokenContract, abi = TestToken.abi, owner=conf.acct)
    data = token.approve.encode_input(receiver, amount)
    sendWithMultisig(conf.contracts['multisig'], tokenContract, data, conf.acct)

def increaseAllowanceFromMS(tokenContractAddress, receiver, amount):
    token = Contract.from_abi("Token", address= tokenContractAddress, abi = TestToken.abi, owner=conf.acct)
    data = token.increaseAllowance.encode_input(receiver, amount)
    sendWithMultisig(conf.contracts['multisig'], tokenContractAddress, data, conf.acct)

def sendMYNTFromMultisigToFeeSharingCollectorProxy(amount):
    feeSharingCollectorProxy = Contract.from_abi("FeeSharingCollector", address=conf.contracts['FeeSharingCollectorProxy'], abi=FeeSharingCollector.abi, owner=conf.acct)
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    token = Contract.from_abi("MYNT", address=conf.contracts['MYNT'], abi=ERC20.abi, owner=conf.acct)
    if(token.allowance(multisig.address, feeSharingCollectorProxy.address) < amount):
        myntBalance = getBalanceOf(conf.contracts['MYNT'], conf.contracts['multisig'])
        if(myntBalance < amount):
            print('⚠️ ALERT! Multisig does not have enough MYNT balance to transfer to FeeSharingCollectorProxy: need ', amount - myntBalance)
        print('Approving MYNT for FeeSharingCollectorProxy: ', amount)
        tokenApproveFromMS(conf.contracts["MYNT"], feeSharingCollectorProxy, amount)
    data = feeSharingCollectorProxy.transferTokens.encode_input(conf.contracts['MYNT'], amount)
    print('Calling feeSharingCollectorProxy.transferTokens(multisig, mynt, amount): ', conf.contracts['multisig'], conf.contracts['MYNT'], amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['FeeSharingCollectorProxy'], data, conf.acct)

def getBalanceOf(contractAddress, acct):
    balance = getBalanceNoPrintOf(contractAddress, acct)
    print(balance)
    return balance

def getBalanceNoPrintOf(contractAddress, acct):
    contract = Contract.from_abi("Token", address=contractAddress, abi=TestToken.abi, owner=conf.acct)
    balance = contract.balanceOf(acct)
    return balance

def getTotalSupply(contractAddress):
    contract = Contract.from_abi("Token", address=contractAddress, abi=TestToken.abi, owner=conf.acct)
    balance = contract.totalSupply()
    print(balance)
    return balance

def deployTestTokenLimited(name, symbol):
    token = conf.acct.deploy(TestTokenLimited, name, symbol, 18, 100000e18)

def printLendingPoolData(iTokenName, tokenName):
    loanToken = Contract.from_abi("loanToken", address=conf.contracts[iTokenName], abi=LoanTokenLogicStandard.abi, owner=conf.acct)    
    print(iTokenName)
    print("    - totalSupply():","   ", loanToken.totalSupply()/1e18)
    print("    - marketLiquidity():", loanToken.marketLiquidity()/1e18)
    print("    - tokenPrice():","    ", loanToken.tokenPrice()/1e18)
    print("    - balance:","         ", getBalanceNoPrintOf(conf.contracts[tokenName], loanToken.address)/1e18, tokenName)


def printLendingPoolsData():
    printLendingPoolData("iRBTC", "WRBTC")
    printLendingPoolData("iUSDT", "USDT")
    printLendingPoolData("iXUSD", "XUSD")
    printLendingPoolData("iBPro", "BPro")
    printLendingPoolData("iDOC", "DoC")
