from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.token import *

def readRolesFromController():
    controller  = loadController()
    print("REMOVE_COLLATERAL_TOKEN_ROLE  ", controller.REMOVE_COLLATERAL_TOKEN_ROLE())

def readRolesFromMarketMaker():
    mm  = loadMarketMaker()
    print("REMOVE_COLLATERAL_TOKEN_ROLE  ", mm.REMOVE_COLLATERAL_TOKEN_ROLE())
    kernel = loadKernel()
    acl = kernel.acl()
    print("acl", acl)

def stopBondingCurve():
    acl = loadACL()
    ANY = "0xffffffffffffffffffffffffffffffffffffffff"
    data = acl.revokePermission.encode_input(ANY,conf.contracts['MyntController'],'0xd68ba2b769fa37a2a7bd4bed9241b448bc99eca41f519ef037406386a8f291c0')
    sendWithMultisig(conf.contracts['multisig'], acl.address, data, conf.acct)
    data = acl.revokePermission.encode_input(ANY,conf.contracts['MyntController'],'0xa589c8f284b76fc8d510d9d553485c47dbef1b0745ae00e0f3fd4e28fcd77ea7')
    sendWithMultisig(conf.contracts['multisig'], acl.address, data, conf.acct)

def canPerform():
    mm  = loadController()
    print(mm.canPerform(conf.contracts['multisig'], mm.REMOVE_COLLATERAL_TOKEN_ROLE(), []))
    print(mm.canPerform(conf.contracts['multisig'], mm.UPDATE_BENEFICIARY_ROLE(), []))
    print(mm.canPerform(conf.contracts['multisig'], mm.UPDATE_FEES_ROLE(), []))
    print(mm.canPerform(conf.contracts['multisig'], mm.UPDATE_COLLATERAL_TOKEN_ROLE(), []))

def openSellOrder():
    controller = loadController()
    MYNT = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=TestToken.abi, owner=conf.acct)
    #MYNT.approve(conf.contracts['MyntMarketMaker'], 0.1e18)
    controller.openSellOrder(conf.contracts['SOV'],0.1e18)

def openBuyOrder():  
    controller = loadController()
    SOV = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=TestToken.abi, owner=conf.acct)
    #SOV.approve(conf.contracts['MyntMarketMaker'], 0.001e18)
    controller.openBuyOrder(conf.contracts['SOV'],0.001e18)

def loadController():
    abiFile =  open('./scripts/contractInteraction/ABIs/mynt_bonding_curve/fundraising.json')
    abi = json.load(abiFile)
    controller = Contract.from_abi("Fundraising", address=conf.contracts['MyntController'], abi=abi, owner=conf.acct)
    return controller

def loadMarketMaker():
    abiFile =  open('./scripts/contractInteraction/ABIs/mynt_bonding_curve/marketmaker.json')
    abi = json.load(abiFile)
    mm = Contract.from_abi("MarketMaker", address=conf.contracts['MyntMarketMaker'], abi=abi, owner=conf.acct)
    return mm

def loadKernel():
    abiFile =  open('./scripts/contractInteraction/ABIs/mynt_bonding_curve/kernel.json')
    abi = json.load(abiFile)
    kernel = Contract.from_abi("Kernel", address=conf.contracts['MyntKernel'], abi=abi, owner=conf.acct)
    return kernel

def loadACL():
    abiFile =  open('./scripts/contractInteraction/ABIs/mynt_bonding_curve/acl.json')
    abi = json.load(abiFile)

    kernel = loadKernel()
    aclAddress = kernel.acl()

    acl = Contract.from_abi("ACL", address=aclAddress, abi=abi, owner=conf.acct)
    return acl

