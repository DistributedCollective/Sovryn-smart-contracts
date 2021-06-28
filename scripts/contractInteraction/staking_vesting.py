from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf

def sendSOVFromVestingRegistry():
    amount = 307470805 * 10**14
    vestingRegistry = Contract.from_abi("VestingRegistry", address=conf.contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=conf.acct)
    data = vestingRegistry.transferSOV.encode_input(conf.contracts['multisig'], amount)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], vestingRegistry.address, data, conf.acct)

def addAdmin(admin, vestingRegistryAddress):
    multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    vestingRegistry = Contract.from_abi("VestingRegistry", address=vestingRegistryAddress, abi=VestingRegistry.abi, owner=conf.acct)
    data = vestingRegistry.addAdmin.encode_input(admin)
    sendWithMultisig(conf.contracts['multisig'], vestingRegistry.address, data, conf.acct)

def isVestingAdmin(admin, vestingRegistryAddress):
    vestingRegistry = Contract.from_abi("VestingRegistry", address=vestingRegistryAddress, abi=VestingRegistry.abi, owner=conf.acct)
    print(vestingRegistry.admins(admin))

def readVestingContractForAddress(userAddress):
    vestingRegistry = Contract.from_abi("VestingRegistry", address=conf.contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=conf.acct)
    address = vestingRegistry.getVesting(userAddress)
    if(address == '0x0000000000000000000000000000000000000000'):
        vestingRegistry = Contract.from_abi("VestingRegistry", address=conf.contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=conf.acct)
        address = vestingRegistry.getVesting(userAddress)

    print(address)

def readLMVestingContractForAddress(userAddress):
    vestingRegistry = Contract.from_abi("VestingRegistry", address=conf.contracts['VestingRegistry3'], abi=VestingRegistry.abi, owner=conf.acct)
    address = vestingRegistry.getVesting(userAddress)
    print(address)

def readStakingKickOff():
    staking = Contract.from_abi("Staking", address=conf.contracts['Staking'], abi=Staking.abi, owner=conf.acct)
    print(staking.kickoffTS())

def stake80KTokens():
    # another address of the investor (addInvestorToBlacklist)
    tokenOwner = "0x21e1AaCb6aadF9c6F28896329EF9423aE5c67416"
    # 80K SOV
    amount = 80000 * 10**18

    vestingRegistry = Contract.from_abi("VestingRegistry", address=conf.contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=conf.acct)
    vestingAddress = vestingRegistry.getVesting(tokenOwner)
    print("vestingAddress: " + vestingAddress)
    data = vestingRegistry.stakeTokens.encode_input(vestingAddress, amount)
    print(data)

    # multisig = Contract.from_abi("MultiSig", address=conf.contracts['multisig'], abi=MultiSigWallet.abi, owner=conf.acct)
    # tx = multisig.submitTransaction(vestingRegistry.address,0,data)
    # txId = tx.events["Submission"]["transactionId"]
    # print(txId)

def createVesting():
    DAY = 24 * 60 * 60
    FOUR_WEEKS = 4 * 7 * DAY

    tokenOwner = "0x21e1AaCb6aadF9c6F28896329EF9423aE5c67416"
    amount = 27186538 * 10**16
    # TODO cliff 4 weeks or less ?
    # cliff = CLIFF_DELAY + int(vesting[2]) * FOUR_WEEKS
    # duration = cliff + (int(vesting[3]) - 1) * FOUR_WEEKS

    # i think we don't need the delay anymore
    # because 2 weeks after TGE passed already
    # we keep the 4 weeks (26th of march first payout)

    cliff = 1 * FOUR_WEEKS
    duration = cliff + (10 - 1) * FOUR_WEEKS

    vestingRegistry = Contract.from_abi("VestingRegistry", address=conf.contracts['VestingRegistry'], abi=VestingRegistry.abi, owner=conf.acct)
    data = vestingRegistry.createVesting.encode_input(tokenOwner, amount, cliff, duration)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], vestingRegistry.address, data, conf.acct)

def transferSOVtoVestingRegistry(vestingRegistryAddress, amount):

    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    data = SOVtoken.transfer.encode_input(vestingRegistryAddress, amount)
    print(data)

    sendWithMultisig(conf.contracts['multisig'], SOVtoken.address, data, conf.acct)