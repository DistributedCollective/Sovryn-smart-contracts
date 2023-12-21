from brownie import *
import json
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def withdrawRBTCFromFastBTCBiDi(amount, recipient):
    fastBTCOffRamp = loadBiDiFastBTC()
    data = fastBTCOffRamp.withdrawRbtc.encode_input(amount, recipient)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTCOffRamp.address, data, conf.acct)

def transferRBTCFromFastBTCOffRampToOnRamp(amount):
    fastBTCOffRamp = loadBiDiFastBTC()
    data = fastBTCOffRamp.withdrawRbtc.encode_input(amount, conf.contracts['FastBTC'])
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTCOffRamp.address, data, conf.acct)

def setMaxTransferSatoshi(newMaxSatoshi):
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.setMaxTransferSatoshi.encode_input(newMaxSatoshi)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def readMaxTransferSatoshi():
    fastBTC = loadBiDiFastBTC()
    print(fastBTC.maxTransferSatoshi())

def loadBiDiFastBTC():
    abiFile =  open('./scripts/contractInteraction/ABIs/FastBTCBiDi.json')
    abi = json.load(abiFile)
    return Contract.from_abi("FastBTC", address = conf.contracts['FastBTCBiDi'], abi = abi, owner = conf.acct)

def loadFastBTC():
    abiFile =  open('./scripts/contractInteraction/ABIs/FastBTC.json')
    abi = json.load(abiFile)
    return Contract.from_abi("FastBTC", address = conf.contracts['FastBTC'], abi = abi, owner = conf.acct)

def loadFastBTCAccessControl():
    abiFile =  open('./scripts/contractInteraction/ABIs/FastBTCAccessControl.json')
    abi = json.load(abiFile)
    return Contract.from_abi("FastBTC", address = conf.contracts['FastBTCAccessControl'], abi = abi, owner = conf.acct)

def loadBTCAddressValidator():
    abiFile =  open('./scripts/contractInteraction/ABIs/BTCAddressValidator.json')
    abi = json.load(abiFile)
    return Contract.from_abi("FastBTC", address = conf.contracts['BTCAddressValidator'], abi = abi, owner = conf.acct)
 

def addFastBTCPauser(address):
    fastBTC = loadFastBTCAccessControl()
    data = fastBTC.addPauser.encode_input(address)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def removeFastBTCPauser(address):
    fastBTC = loadFastBTCAccessControl()
    data = fastBTC.removePauser.encode_input(address)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def addGuard(address):
    fastBTC = loadFastBTCAccessControl()    
    data = fastBTC.addGuard.encode_input(address)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def checkAdmin(address):
    fastBTC = loadFastBTCAccessControl()
    print(fastBTC.checkAdmin(address))

def revokeAdmin(account):
    fastBTC = loadFastBTCAccessControl()
    data = fastBTC.revokeRole.encode_input('0x0000000000000000000000000000000000000000000000000000000000000000', account)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)
    
def isBiDiFastBTCPaused():
    fastBTC = loadBiDiFastBTC()
    print('FastBTCBiDi paused:', fastBTC.paused())

def pauseBiDiFastBTC():
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.pause.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def unpauseBiDiFastBTC():
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.unpause.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def isBiDiFastBTCFrozen():
    fastBTC = loadBiDiFastBTC()
    print('FastBTCBiDi frozen:', fastBTC.frozen())

def freezeBiDiFastBTC():
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.freeze.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def unfreezeBiDiFastBTC():
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.unfreeze.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def addFeeStructure(feeStructureIndex, newBaseFeeSatoshi, newDynamicFee):
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.addFeeStructure.encode_input(feeStructureIndex, newBaseFeeSatoshi, newDynamicFee)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def setCurrentFeeStructure(feeStructureIndex):
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.setCurrentFeeStructure.encode_input(feeStructureIndex)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def setNonBech32Prefixes():
    fastBTC = loadBTCAddressValidator()
    data = fastBTC.setNonBech32Prefixes.encode_input(["1", "3"])
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

