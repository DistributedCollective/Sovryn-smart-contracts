from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def withdrawRBTCFromFastBTCBiDi(amount, recipient):
    fastBTC = loadBiDiFastBTC()
    data = fastBTC.withdrawRbtc.encode_input(amount, recipient)
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