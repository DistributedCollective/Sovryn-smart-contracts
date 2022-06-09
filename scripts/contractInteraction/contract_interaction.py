
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.loan_tokens import *
from scripts.contractInteraction.protocol import *
from scripts.contractInteraction.staking_vesting import *
from scripts.contractInteraction.multisig import *
from scripts.contractInteraction.governance import *
from scripts.contractInteraction.liquidity_mining import *
from scripts.contractInteraction.amm import *
from scripts.contractInteraction.token import *
from scripts.contractInteraction.ownership import *
from scripts.contractInteraction.misc import *
from scripts.contractInteraction.prices import *
from scripts.contractInteraction.fastbtc import *

def main():
    '''
    run from CLI:
    brownie run scripts/contractInteraction/contract_interaction.py --network testnet
    brownie run scripts/contractInteraction/contract_interaction.py --network rsk-mainnet
    '''
    
    # call the function you want here

    #used often:

    #withdrawRBTCFromWatcher(40e18, conf.contracts['FastBTC'])
    #bal = getBalance(conf.contracts['SOV'], conf.contracts['Watcher'])
    #withdrawTokensFromWatcher(conf.contracts['DoC'], 170000e18, conf.contracts['multisig'])
    #print(conf.acct)
    #sendTokensFromMultisig(conf.contracts['SOV'], conf.acct, 2336448e18)
    #sendFromMultisig('0xD9ECB390a6a32ae651D5C614974c5570c50A5D89', 30e18)

    #sendMYNTFromMultisigToFeeSharingProxy(36632.144056847e18)
    
    '''
    for i in range (922, 928):
        #confirmWithMS(i)
        checkTx(i)
    '''
    #missed = getMissedBalance()
    #transferSOVtoLM(missed)

    #transferRBTCFromFastBTCOffRampToOnRamp(15e18)

    #missed = getMissedBalance()
    #transferSOVtoLM(missed)

    #redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['USDT'], 100000e18)
    #sendTokensFromMultisig(conf.contracts['USDT'], conf.contracts['Watcher'], 100000e18)
    '''
    vestingAddress = "0x9768eF9F59b030E98f12B2B4C859E5eCbC016633"
    fourYearVesting = Contract.from_abi("FourYearVestingLogic", address=vestingAddress, abi=FourYearVestingLogic.abi, owner=conf.acct)

    
    stakingAddress = conf.contracts['Staking']
    staking = Contract.from_abi("Staking", address=stakingAddress, abi=Staking.abi, owner=conf.acct)
    stakes = staking.getStakes(vestingAddress)
    print("Staking Details")
    print("=======================================")
    print(stakes)
    
    print(fourYearVesting.lastStakingSchedule())
    print(fourYearVesting.remainingStakeAmount())
    print(fourYearVesting.owner())
    print(fourYearVesting.tokenOwner())
    print(fourYearVesting.startDate())

    fourYearVestingFactory = Contract.from_abi("FourYearVestingFactory", address=conf.contracts['FourYearVestingFactory'], abi=FourYearVestingFactory.abi, owner=conf.acct)
    print(fourYearVestingFactory.owner())
    data = fourYearVestingFactory.transferOwnership.encode_input("0x511893483DCc1A9A98f153ec8298b63BE010A99f")
    #sendWithMultisig(conf.contracts['multisig'], fourYearVestingFactory.address, data, conf.acct)
    
    
    SOVtoken = Contract.from_abi("SOV", address=conf.contracts['SOV'], abi=SOV.abi, owner=conf.acct)
    remainingAmount = 78*10**18
    #SOVtoken.approve(vestingAddress, remainingAmount)
    lastSchedule = 0
    while remainingAmount > 0:
        fourYearVesting.stakeTokens(remainingAmount, lastSchedule)
        lastSchedule = fourYearVesting.lastStakingSchedule()
        remainingAmount = fourYearVesting.remainingStakeAmount()
        time.sleep(10)
 
    stakes = staking.getStakes(vestingAddress)
    print("Staking Details")
    print("=======================================")
    print(stakes)
    
    
    lastSchedule = fourYearVesting.lastStakingSchedule()
    print(lastSchedule)
    remainingAmount = fourYearVesting.remainingStakeAmount()
    print(remainingAmount)
    if remainingAmount > 0:
        fourYearVesting.stakeTokens(remainingAmount, lastSchedule)
    '''

    #upgradeVesting()

    #addVestingAdmin(conf.acct)
    #isVestingAdmin(conf.acct)

    readAllVestingContractsForAddress('0x945F5A36998abfC3450d9108f8C1D34Aa18fa48E')

   
