from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def initializeLiquidityMiningV1():
    liquidityMiningV1 = Contract.from_abi("LiquidityMiningV1", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMiningV1.abi, owner = conf.acct)

    data = liquidityMiningV1.initialize.encode_input(conf.contracts['LiquidityMiningProxyV2'])
    sendWithMultisig(conf.contracts['multisig'], liquidityMiningV1.address, data, conf.acct)

def initializeLiquidityMiningV2():
    wrapper = "0x0000000000000000000000000000000000000000"
    liquidityMiningV2 = Contract.from_abi("LiquidityMiningV2", address = conf.contracts['LiquidityMiningProxyV2'], abi = LiquidityMiningV2.abi, owner = conf.acct)

    data = liquidityMiningV2.initialize.encode_input(wrapper,conf.contracts['LMV1toLMV2Migrator'])
    sendWithMultisig(conf.contracts['multisig'], liquidityMiningV2.address, data, conf.acct)

def setMigratorAsAdmin():
    liquidityMiningV1 = Contract.from_abi("LiquidityMiningV1", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMiningV1.abi, owner = conf.acct)

    data = liquidityMiningV1.addAdmin.encode_input(conf.contracts['LMV1toLMV2Migrator'])
    sendWithMultisig(conf.contracts['multisig'], liquidityMiningV1.address, data, conf.acct)

    liquidityMiningV2 = Contract.from_abi("LiquidityMiningV2", address = conf.contracts['LiquidityMiningProxyV2'], abi = LiquidityMiningV2.abi, owner = conf.acct)

    data = liquidityMiningV2.addAdmin.encode_input(conf.contracts['LMV1toLMV2Migrator'])
    sendWithMultisig(conf.contracts['multisig'], liquidityMiningV2.address, data, conf.acct)


def startMigrationGracePeriod():
    liquidityMiningV1 = Contract.from_abi("LiquidityMiningV1", address = conf.contracts['LiquidityMiningProxy'], abi = LiquidityMiningV1.abi, owner = conf.acct)

    data = liquidityMiningV1.startMigrationGracePeriod.encode_input()
    sendWithMultisig(conf.contracts['multisig'], liquidityMiningV1.address, data, conf.acct)


def migratePools():
    lMV1toLMV2Migrator = Contract.from_abi("LMV1toLMV2Migrator", address = conf.contracts['LMV1toLMV2Migrator'], abi = LMV1toLMV2Migrator.abi, owner = conf.acct)

    data = lMV1toLMV2Migrator.migratePools.encode_input()
    sendWithMultisig(conf.contracts['multisig'], lMV1toLMV2Migrator.address, data, conf.acct)

def migrateUsers():
    lMV1toLMV2Migrator = Contract.from_abi("LMV1toLMV2Migrator", address = conf.contracts['LMV1toLMV2Migrator'], abi = LMV1toLMV2Migrator.abi, owner = conf.acct)
    configFile =  open('./scripts/contractInteraction/usersToMigrate.json')
    users = json.load(configFile)

    data = lMV1toLMV2Migrator.migrateUsers.encode_input(users['users'])
    sendWithMultisig(conf.contracts['multisig'], lMV1toLMV2Migrator.address, data, conf.acct)

def finishUsersMigration():
    lMV1toLMV2Migrator = Contract.from_abi("LMV1toLMV2Migrator", address = conf.contracts['LMV1toLMV2Migrator'], abi = LMV1toLMV2Migrator.abi, owner = conf.acct)

    data = lMV1toLMV2Migrator.finishUsersMigration.encode_input()
    sendWithMultisig(conf.contracts['multisig'], lMV1toLMV2Migrator.address, data, conf.acct)

def migrateFunds():
    lMV1toLMV2Migrator = Contract.from_abi("LMV1toLMV2Migrator", address = conf.contracts['LMV1toLMV2Migrator'], abi = LMV1toLMV2Migrator.abi, owner = conf.acct)

    data = lMV1toLMV2Migrator.migrateFunds.encode_input()
    sendWithMultisig(conf.contracts['multisig'], lMV1toLMV2Migrator.address, data, conf.acct)