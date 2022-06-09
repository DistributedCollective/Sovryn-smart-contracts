
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

    #withdrawRBTCFromWatcher(30e18, conf.contracts['multisig'])
    #withdrawRBTCFromFastBTCBiDi(19e18, conf.contracts['multisig'])
    #bal = getBalance(conf.contracts['SOV'], conf.contracts['Watcher'])
    #withdrawTokensFromWatcher(conf.contracts['DoC'], 170000e18, conf.contracts['multisig'])

    #sendTokensFromMultisig(conf.contracts['XUSD'], conf.contracts['Watcher'], 200000e18)
    #sendFromMultisig('0xD9ECB390a6a32ae651D5C614974c5570c50A5D89', 30e18)

    #sendMYNTFromMultisigToFeeSharingProxy(36632.144056847e18)
    
    '''
    for i in range (961, 963):
        confirmWithMS(i)
        checkTx(i)
    '''
    #confirmWithMS(956)
    #confirmWithMS(958)
    #missed = getMissedBalance()
    #transferSOVtoLM(missed)

    #transferRBTCFromFastBTCOffRampToOnRamp(9.6e18)

    #redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['DoC'], 30000e18)
    #sendTokensFromMultisig(conf.contracts['DoC'], conf.contracts['Watcher'], 30000e18)

    #readMocOracleAddress()

    #bal = getBalance(conf.contracts['(WR)BTC/USDT2'], conf.contracts['multisig'])
    #removeLiquidityV2toMultisig(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], bal, 1)

    #getReturnForV2PoolToken(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], bal)
