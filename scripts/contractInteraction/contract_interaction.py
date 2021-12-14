
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
    # brownie run scripts/contractInteraction/contract_interaction.py --network testnet
    # brownie run scripts/contractInteraction/contract_interaction.py --network rsk-mainnet
    
    #load the contracts and acct depending on the network
    conf.loadConfig()
    
    # confirmMultipleTxsWithMS(774, 775)
    # checkTx(808)
    # confirmWithMS(808)

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

    # balance = getBalance(conf.contracts['XUSD'], conf.contracts['multisig'])
    # print(balance)
    # if(balance > 0):
    #     sendTokensFromMultisig(conf.contracts['XUSD'], '0x051B89f575fCd540F0a6a5B49c75f9a83BB2Cf07', balance)

    # balance = getBalance(conf.contracts['XUSD'], conf.contracts['multisig'])
    # print(balance)
    # sendTokensFromMultisig(conf.contracts['XUSD'], conf.contracts['Watcher'], balance)

    # readPrice(conf.contracts['WRBTC'], conf.contracts['XUSD'])
    # readPrice(conf.contracts['XUSD'], conf.contracts['WRBTC'])

    # removeLiquidityV1toMultisigUsingWrapper(contracts["WRBTCtoSOVConverter"], 2957 * 10**18, [contracts['WRBTC'], contracts['SOV']])
    # def removeLiquidityV1toMultisigUsingWrapper(wrapper, converter, amount, tokens, minReturn):

    # removeLiquidityV1toMultisigUsingWrapper(conf.contracts["RBTCWrapperProxyWithoutLM"], conf.contracts["ConverterXUSD"], 2000 * 10**18, [conf.contracts['WRBTC'], conf.contracts['XUSD']], [1,1])
