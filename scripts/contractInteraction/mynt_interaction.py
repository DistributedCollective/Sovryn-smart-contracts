from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.multisig import *

def myntOpenBuyOrder(amount):
    abiFile =  open('./scripts/contractInteraction/ABIs/MyntController.json')
    abi = json.load(abiFile)
    mmc = Contract.from_abi("myntController", address=conf.contracts['MyntController'], abi=abi, owner=conf.acct)
    data = mmc.openBuyOrder.encode_input(conf.contracts['SOV'], amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['MyntController'], data, conf.acct)

def myntClaimBuyOrder(batchId):
    abiFile =  open('./scripts/contractInteraction/ABIs/MyntController.json')
    abi = json.load(abiFile)
    mmc = Contract.from_abi("myntController", address=conf.contracts['MyntController'], abi=abi, owner=conf.acct)
    data = mmc.claimBuyOrder.encode_input(conf.contracts['multisig'], batchId, conf.contracts['SOV'])
    print(data)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['MyntController'], data, conf.acct)

def approveSOVForMyntMM(amount):
    print('Approving ',Wei(amount).to("ether"), 'of SOV for MYNT MarketMaker')
    myntMarketMaker = conf.contracts['MyntMarketMaker']
    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    data = SOVtoken.approve.encode_input(myntMarketMaker, amount)
    print(data)
    sendWithMultisig(conf.contracts['multisig'], conf.contracts['SOV'], data, conf.acct)