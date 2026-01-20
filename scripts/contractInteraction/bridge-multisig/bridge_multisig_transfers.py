
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
#from scripts.contractInteraction.token import * 
import json

def main():

    #load the contracts and acct depending on the network
    loadConfig()

    #call the function you want here
    #all remainders to BSC
    #sendAggregatedTokensFromExchequer(contracts['ETHbs'], contracts['Aggregator-ETH-RSK'], '0x8C9143221F2b72Fcef391893c3a02Cf0fE84f50b', 10.95 * 10 ** 18) #the remainder 10.95 to ETH - pending signature 
    #sendAggregatedTokensFromExchequer(contracts['ETHbs'], contracts['Aggregator-ETH-RSK'], '0x8C9143221F2b72Fcef391893c3a02Cf0fE84f50b', 29 * 10 ** 18) #the remainder 29 to BSC - done
    #sendTokensToBSCFromMultisig(contracts['ETHbs'], '0x8C9143221F2b72Fcef391893c3a02Cf0fE84f50b', 2.8 * 10 ** 18) #the remainder ETHbs 2.8 to BSC - done
    #sendTokensToBSCFromMultisig(contracts['BNBbs'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', 2.089 * 10 ** 18) #test 0.089 to BSC
    #sendAggregatedTokensFromExchequer(contracts['BNBbs'], contracts['Aggregator-BNB-RSK'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', 776639178690725711) #the remainder BNBs 0.7766391786907257 to BSC - done 

    #sendTokensToBSCFromMultisig(contracts['BNBbs'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', 50 * 10 ** 18) #the remainder 50 BNB to BSC - pending signatures



    #total 40077275650313137836 (40.0772...) ETHes to be sent over the bridge to ETH multisig
    #sendAggregatedTokensFromExchequer(contracts['ETHes'], contracts['Aggregator-ETH-RSK'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', 77275650313137836) #12 left after this - done
    #sendAggregatedTokensFromExchequer(contracts['ETHes'], contracts['Aggregator-ETH-RSK'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', 12*10**18) #12 ETHes to Ethereum - done
    
    #sendAggregatedTokensFromExchequer(contracts['ETHes'], contracts['Aggregator-ETH-RSK'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', 12077275650313137836)
   

    #sendTokensToETHFromMultisig(contracts['ETHes'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', 12 * 10 ** 18) #the remainder - done
    #sendTokensToETHFromMultisig(contracts['ETHes'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', 46010000000000000020) #stuck on the bridge

    # bal = getBalanceOf(contracts['USDCes'], acct2)
    # sendTokensFromWalletToETH(contracts['USDCes'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', bal, acct2)
    # bal = getBalanceOf(contracts['USDTes'], acct2)
    # sendTokensFromWalletToETH(contracts['USDTes'], '0xdd2311eceb6ec8a83c027fde4aa04ea455ee3fc4', bal, acct2)
    # bal = getBalanceOf(contracts['USDCbs'], acct2)
    # sendTokensFromWalletToBSC(contracts['USDCbs'], '0x8c9143221f2b72fcef391893c3a02cf0fe84f50b', bal, acct2)
    # bal = getBalanceOf(contracts['USDTbs'], acct2)
    # sendTokensFromWalletToBSC(contracts['USDTbs'], '0x8c9143221f2b72fcef391893c3a02cf0fe84f50b', bal, acct2)
    

    # RSK-USDTes 0.01
    #sendTokensToETHFromMultisig(contracts['RSK-USDTes'], 'receiver', 10**16)

    #sendTokensFromBridgeETHMultisig(contracts['ETH-USDT'], 10**16)
    #print(acct)
    #sendAggregatedTokensFromExchequer(contracts['BNBbs'], contracts['Aggregator-BNB-RSK'], '0x5092019A3E0334586273A21a701F1BD859ECAbD6', 764e18)
    #sendAggregatedTokensFromExchequer(contracts['ETHbs'], contracts['Aggregator-ETH-RSK'], acct, 39.5e18)
    #sendTokensToETHFromMultisig(contracts['SOV'], '0xdd0e3546eebf3f1cc4454a16b4dc5b677923bdc1', 50000e18)
    #bal = getBalance(conf.contracts['USDCes'], conf.contracts['multisig'])
    #sendTokensToETHFromMultisig(contracts['USDTes'], '0x9E0816a71B53ca67201a5088df960fE90910DE55', 2000e18)
    #sendTokensToETHFromMultisig(contracts['ETHes'], '0x5092019A3E0334586273A21a701F1BD859ECAbD6', 15e18)
    #sendAggregatedTokensFromWallet(contracts['ETHes'], contracts['Aggregator-ETH-RSK'], '0xf5972e2bcc10404367cbdca2a3319470fbea3ff7', 2e17)

    #send eSOV send eSOV over the bridge to our gate.io address
    #sendTokensToETHFromMultisig(contracts['SOV'], '0x5092019A3E0334586273A21a701F1BD859ECAbD6', 260000e18)
    #DLLR
    #setFeeAndMinPerToken(contracts['DLLR'], 60e18, 70e18)
    #allowToken('0xc1411567d2670e24d9C4DaAa7CdA95686e1250AA') #DLLR - one time whitelisting on bridge
    #sendTokensToETHFromMultisig(contracts['DLLR'], '0xdD0E3546EEBf3f1Cc4454a16b4DC5b677923bDC1', 100e18) #to be on the safe side sending 100 DLLR to our multisig on ethereum
    
    #sendTokensFromWalletFromSepolia(contracts['SEPUSD'], acct, 1000e18)

def loadConfig():
    global contracts, acct, acct2
    thisNetwork = network.show_active()
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        acct2 = accounts.load("rskdeployerdev")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif thisNetwork == "sepolia":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/sepolia_contracts.json')
    else:
        raise Exception("Network not supported.")
    contracts = json.load(configFile)

# function setFeeAndMinPerToken(address token, uint256 _feeConst, uint256 _minAmount)
def setFeeAndMinPerToken(token, feeConst, minAmount):
    abiFileBridge =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abiFileAllowTokens =  open('./scripts/contractInteraction/bridge-multisig/AllowTokens.json')
    abiBridge = json.load(abiFileBridge)
    abiAllowTokens = json.load(abiFileAllowTokens)
    bridgeRSK = Contract.from_abi("BridgeRSK", address=contracts['BridgeRSK'], abi=abiBridge, owner=acct)

    allowTokensAddress = bridgeRSK.allowTokens()
    allowTokens = Contract.from_abi("AllowTokens", address=allowTokensAddress, abi=abiAllowTokens, owner=acct)
    print(f"Configuring AllowTokens contract {allowTokens.address}: setting const fee and min amount")

    multiSigAddress = allowTokens.owner()
    print('Allow tokens owner address (multisig): ' + multiSigAddress)
    multiSig = Contract.from_abi("MultiSig", multiSigAddress, MultiSigWallet.abi, owner=acct)

    setFeeAndMinPerTokenData = allowTokens.setFeeAndMinPerToken.encode_input(token, feeConst, minAmount)
    print(setFeeAndMinPerTokenData)

    print(f'Setting fee and min amount for token {token}')
    tx = multiSig.submitTransaction(allowTokens.address, 0, setFeeAndMinPerTokenData)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def allowToken(token):
    abiFileBridge =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abiFileAllowTokens =  open('./scripts/contractInteraction/bridge-multisig/AllowTokens.json')
    abiBridge = json.load(abiFileBridge)
    abiAllowTokens = json.load(abiFileAllowTokens)
    #tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=acct)
    
    bridgeRSK = Contract.from_abi("BridgeRSK", address=contracts['BridgeRSK'], abi=abiBridge, owner=acct)
    
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)

    allowTokensAddress = bridgeRSK.allowTokens()
    allowTokens = Contract.from_abi("AllowTokens", address=allowTokensAddress, abi=abiAllowTokens, owner=acct)
    print(f"Configuring AllowTokens contract {allowTokens.address}")

    multiSigAddress = allowTokens.owner()
    print('multisig address: ' + multiSigAddress)
    multiSig = Contract.from_abi("MultiSig", multiSigAddress, MultiSigWallet.abi, owner=acct)

    addAllowTokenData = allowTokens.addAllowedToken.encode_input(token)
    print(addAllowTokenData)

    print(f'Allowing token {token}')
    tx = multiSig.submitTransaction(allowTokens.address, 0, addAllowTokenData)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
def sendTokensToETHFromMultisig(token, receiver, amount):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abi = json.load(abiFile)
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=acct)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    BridgeRSK = Contract.from_abi("BridgeRSK", address=contracts['BridgeRSK'], abi=abi, owner=acct)
    
    data = tokenContract.approve.encode_input(BridgeRSK.address, amount)
    print(data)
    tx = multisig.submitTransaction(token,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
    
    data = BridgeRSK.receiveTokensAt.encode_input(token, amount, receiver, b'')
    print(data)
    tx = multisig.submitTransaction(BridgeRSK.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def sendTokensToBSCFromMultisig(token, receiver, amount):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abi = json.load(abiFile)
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=acct)

    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    bscBridgeRSK = Contract.from_abi("BSCBridgeRSK", address=contracts['BSCBridgeRSK'], abi=abi, owner=acct)
    
    data = tokenContract.approve.encode_input(bscBridgeRSK.address, amount)
    print(data)
    tx = multisig.submitTransaction(token,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)
    
    data = bscBridgeRSK.receiveTokensAt.encode_input(token, amount, receiver, b'')
    print(data)
    tx = multisig.submitTransaction(bscBridgeRSK.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def sendTokensFromWalletToETH(token, receiver, amount, owner):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abi = json.load(abiFile)
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=owner)

    BridgeRSK = Contract.from_abi("BridgeRSK", address=contracts['BridgeRSK'], abi=abi, owner=owner)
    tokenContract.approve(BridgeRSK.address, amount)
    BridgeRSK.receiveTokensAt(token, amount, receiver, b'')

def sendTokensFromWalletToBSC(token, receiver, amount, owner):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abi = json.load(abiFile)
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=owner)

    BridgeRSK = Contract.from_abi("BridgeRSK", address=contracts['BSCBridgeRSK'], abi=abi, owner=owner)
    tokenContract.approve(BridgeRSK.address, amount)
    BridgeRSK.receiveTokensAt(token, amount, receiver, b'')

def sendTokensFromBridgeETHMultisig(token, amount):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abi = json.load(abiFile)
    bridgeETH = Contract.from_abi("BridgeETH", address=contracts['BridgeETH'], abi=abi, owner=acct)
    bridgeETHMultisig = Contract.from_abi("MultiSig", address=contracts['BridgeETHMultisig'], abi=MultiSigWallet.abi, owner=acct)

    aggregator = contracts['Aggregator-ETH-RSK']
    receiver = contracts['multisig']

    data = bridgeETH.receiveTokensAt.encode_input(token, amount, aggregator, receiver)
    print(data)
    tx = bridgeETHMultisig.submitTransaction(bridgeETH.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def sendTokensFromETHMultisigToRSKMultisig(token, amount):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abi = json.load(abiFile)
    bridgeETH = Contract.from_abi("BridgeETH", address=contracts['BridgeETH'], abi=abi, owner=acct)
    ethMultisig = Contract.from_abi("MultiSig", address=contracts['ethMultisig'], abi=MultiSigWallet.abi, owner=acct)
    receiver = contracts['multisig']

    data = bridgeETH.receiveTokensAt.encode_input(token, amount, receiver, b'')
    print(data)
    tx = ethMultisig.submitTransaction(bridgeETH.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def sendAggregatedTokensFromExchequer(basset, masset, receiver, amount):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Masset.json')
    abi = json.load(abiFile)
    masset = Contract.from_abi("Masset", address=masset, abi=abi, owner=acct)

    data = masset.redeemToBridge.encode_input(basset, amount, receiver)
    print(data)
    print(contracts['multisig'])
    multisig = Contract.from_abi("MultiSig", address=contracts['multisig'], abi=MultiSigWallet.abi, owner=acct)
    tx = multisig.submitTransaction(masset.address,0,data)
    txId = tx.events["Submission"]["transactionId"]
    print(txId)

def sendAggregatedTokensFromWallet(basset, masset, receiver, amount):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Masset.json')
    abi = json.load(abiFile)
    masset = Contract.from_abi("Masset", address=masset, abi=abi, owner=acct)

    masset.redeemToBridge(basset, amount, receiver)

def sendTokensFromWalletFromSepolia(token, receiver, amount):
    abiFile =  open('./scripts/contractInteraction/bridge-multisig/Bridge.json')
    abi = json.load(abiFile)
    tokenContract = Contract.from_abi("Token", address=token, abi=TestToken.abi, owner=acct)

    Bridge = Contract.from_abi("bridge", address=contracts['bridge'], abi=abi, owner=acct)
    tokenContract.approve(Bridge.address, amount)
    Bridge.receiveTokensAt(token, amount, receiver, b'')

def getBalanceOf(contractAddress, acct_of):
    balance = getBalanceNoPrintOf(contractAddress, acct_of)
    print(balance)
    return balance

def getBalanceNoPrintOf(contractAddress, acct_of):
    contract = Contract.from_abi("Token", address=contractAddress, abi=TestToken.abi, owner=acct_of)
    balance = contract.balanceOf(acct_of)
    return balance