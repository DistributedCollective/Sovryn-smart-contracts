
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

def main():
    
    #load the contracts and acct depending on the network
    conf.loadConfig()

    #setupMarginLoanParams(conf.contracts['SOV'], conf.contracts['iXUSD'])
    #setupMarginLoanParams(conf.contracts['SOV'], conf.contracts['iRBTC'])
    #setupMarginLoanParams(conf.contracts['SOV'], conf.contracts['iBPro'])
    #setupMarginLoanParams(conf.contracts['SOV'], conf.contracts['iDOC'])
    # setSupportedToken(conf.contracts['BNBs'])

    #updateLockedSOV()

    #withdrawRBTCFromWatcher(20e18, conf.contracts['FastBTC'])

    #this needs to be tested first. for direct trasnfer to fastbtc use the fastbtc contract address as receiver
    #borrowRBTCWithMultisigUsingSOV(withdrawAmount, receiver)

    #withdrawTokensFromWatcher(conf.contracts['XUSD'], 100e18, '0x051B89f575fCd540F0a6a5B49c75f9a83BB2Cf07')
    #balance = getBalance(conf.contracts['XUSD'], conf.contracts['Watcher'])
    #print(balance)
    #withdrawTokensFromWatcher(conf.contracts['XUSD'], 100e18, conf.contracts['multisig'])

    balance = getBalance(conf.contracts['XUSD'], conf.contracts['multisig'])
    print(balance)
    if(balance > 0):
        sendTokensFromMultisig(conf.contracts['XUSD'], '0x051B89f575fCd540F0a6a5B49c75f9a83BB2Cf07', balance)
