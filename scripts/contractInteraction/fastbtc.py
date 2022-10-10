from brownie import *
import json
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def withdrawRBTCFromFastBTCBiDi(amount, recipient):
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.withdrawRbtc.encode_input(amount, recipient)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def transferRBTCFromFastBTCOffRampToOnRamp(amount):
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.withdrawRbtc.encode_input(amount, conf.contracts['FastBTC'])
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

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

def fastBTCBiDiPause():
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.pause.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def fastBTCBiDiUnpause():
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.unpause.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def fastBTCBiDiFreeze():
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.freeze.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

def fastBTCBiDiUnfreeze():
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.unfreeze.encode_input()
    print(data)
    sendWithMultisig(conf.contracts['multisig'], fastBTC.address, data, conf.acct)

