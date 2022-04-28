
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

    #withdrawRBTCFromWatcher(30e18, conf.contracts['FastBTC'])
    #bal = getBalance(conf.contracts['SOV'], conf.contracts['Watcher'])
    #withdrawTokensFromWatcher(conf.contracts['SOV'], bal, conf.contracts['multisig'])

    #sendTokensFromMultisig(conf.contracts['SOV'], '0xd1c42e0ace7a80efc191835dac102043bcfbbbe6', 4500e18)
    #sendFromMultisig('0xD9ECB390a6a32ae651D5C614974c5570c50A5D89', 25e18)

    #withdrawRBTCFromIWRBTC('0x9BD6759F6D9eA15D33076e55d4CBba7cf85877A7', 1.6e18)

    #for i in range (885, 887):
    #    checkTx(i)
    #    confirmWithMS(i)

    # pauseOrUnpauseStaking(True)
    # isStakingPaused()
    
    
    #missed = getMissedBalance()
    #transferSOVtoLM(missed)
    
    #checkTx(895)
    # checkTx(897)
    # confirmWithMS(897)
    # confirmMultipleTxsWithMS(895, 896)
    printV1ConverterData('0xe76Ea314b32fCf641C6c57f14110c5Baa1e45ff4') 
    #,'0x542fda317318ebf1d3deaf76e0b632741a7e677d','0xEFc78fc7d48b64958315949279Ba181c2114ABBd')