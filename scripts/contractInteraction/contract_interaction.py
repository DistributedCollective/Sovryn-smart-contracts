
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
from scripts.contractInteraction.mynt_interaction import *
from array import *

def main():
    # brownie run scripts/contractInteraction/contract_interaction.py --network testnet
    # brownie run scripts/contractInteraction/contract_interaction.py --network rsk-mainnet
    
    #load the contracts and acct depending on the network
    conf.loadConfig()

    # acceptOwnershipWithMultisig("0x25B8D024B39174824424f032423E03dd7dcCF044")
    
    # -----------START OF MYNT PROCESSING---------------------
    amount = 25171327*10**15 #25171.327 SOV
    cBatchAmount = 4195221167*10**12 # 4195.221167 - 6 batch txs - not to mix up with Mynt MM batches
    # 1 approve SOV 
    approveSOVForMyntMM(amount)
    
    # 2 tx = MarketMaker.openBuyOrder(SOV.address, amount) and get batch id from 
    #for i in range(1, 11): # it processes the right boundary - 1
    #    myntOpenBuyOrder(cBatchAmount)
    
    # 3 wait 10 blocks and claim order
    #cBatch = array('i', [1,2,3,4,5,6,7,8,9,10]) #TODO: replace with batchIds from p.2

    #for i in range(1, 11): # it processes the right boundary - 1
    #    myntClaimBuyOrder(cBatch[i])

    # -----------END OF MYNT PROCESSING---------------------    
    
    
    # addAmmPoolTokenToLM("(WR)BTC/MYNT")

    # getPoolIdByName("(WR)BTC/MYNT")

    # addWhitelistConverterFeeSharingProxy("0x84953dAF0E7a9fFb8B4fDf7F948185e1cF85852e")
    
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
