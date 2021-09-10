
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

    #call the function you want here
    #replaceLoanOpenings()
    #replaceLoanSettings()
    #replaceLoanTokenLogicOnAllContracts()

    #setSupportedToken(conf.contracts['SOV'])
    #setupTorqueLoanParams(conf.contracts['iXUSD'], conf.contracts['XUSD'], conf.contracts['SOV'], Wei("200 ether"))
    #setupTorqueLoanParams(conf.contracts['iRBTC'], conf.contracts['WRBTC'], conf.contracts['SOV'], Wei("200 ether"))

    #for i in range(655, 665):
    #    checkTx(i)

    #minInitialMargin('0xe6686993f04396fc9a653df98ff3c5bab41023f0f2b4b1ea33f38c2c2200a787')
    #getDepositAmountForBorrow(conf.contracts['iXUSD'], 1e18, 7*24*60*60, conf.contracts['SOV'])
    #readv1PoolOracleAddress(conf.contracts['SOV'])

    readPrice(conf.contracts['SOV'], conf.contracts['XUSD'])
    readPrice(conf.contracts['XUSD'],conf.contracts['SOV'])
    readPrice(conf.contracts['WRBTC'],conf.contracts['SOV'])
    #readPriceFromOracle(conf.contracts['WRBTCtoSOVOracle'])
    #readPriceFromOracle(conf.contracts['WRBTCtoXUSDOracle'])
    #readPriceFromOracle(conf.contracts['SOVPoolOracle'])
    #readPriceFromOracle('0x28A05da0939853F7Bc9D5A17C9550D2769eE93D3')
    #deployOracleV1Pool(conf.contracts['SOV'], conf.contracts["WRBTCtoSOVOracle"])