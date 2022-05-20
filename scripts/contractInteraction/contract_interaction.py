
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

    #sendTokensFromMultisig(conf.contracts['SOV'], '0xEd09C97b91e8fC6d34FDe6503f64A01a6b8684c6', 77065e18)
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

    #redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['USDT'], 100000e18)
    #sendTokensFromMultisig(conf.contracts['USDT'], conf.contracts['Watcher'], 100000e18)

   
