
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

    # balance = getBalance(conf.contracts['XUSD'], conf.contracts['multisig'])
    # print(balance)
    # if(balance > 0):
    #     sendTokensFromMultisig(conf.contracts['XUSD'], '0x051B89f575fCd540F0a6a5B49c75f9a83BB2Cf07', balance)

    # balance = getBalance(conf.contracts['XUSD'], conf.contracts['multisig'])
    # print(balance)
    #sendTokensFromMultisig(conf.contracts['XUSD'], conf.contracts['Watcher'], 25e18)

    # readPrice(conf.contracts['WRBTC'], conf.contracts['XUSD'])
    # readPrice(conf.contracts['XUSD'], conf.contracts['WRBTC'])

    # removeLiquidityV1toMultisigUsingWrapper(contracts["WRBTCtoSOVConverter"], 2957 * 10**18, [contracts['WRBTC'], contracts['SOV']])
    # def removeLiquidityV1toMultisigUsingWrapper(wrapper, converter, amount, tokens, minReturn):

    # removeLiquidityV1toMultisigUsingWrapper(conf.contracts["RBTCWrapperProxyWithoutLM"], conf.contracts["ConverterXUSD"], 2000 * 10**18, [conf.contracts['WRBTC'], conf.contracts['XUSD']], [1,1])
    #readLiquidity()
    #addOwnerToMultisig('0x13Be55487D37FE3C66EE7305e1e9C1ac85de75Ae')

    #swapTokensWithMultisig(5e18, 1, conf.contracts['WRBTC'], conf.contracts['SOV'])

    #sendFromMultisig('0xD9ECB390a6a32ae651D5C614974c5570c50A5D89', 25e18)

    #checkTx(560)
    #checkTx(561)
    #checkTx(562)
    #confirmWithMS(564)
    #setV1PoolOracleAddress('0xF3c356E720958100ff3F2335D288da069Aa83ce8')

    #for i in range(566, 578):
    #    checkTx(i)

    
    #for i in range(572, 578):
    #    confirmWithMS(i)

    #transferOwner('0x46EBC03EF2277308BdB106a73d11c65109C4B89B', conf.contracts['multisig'])
    #transferOwner('0x8e75774Ef928cE730255AB594dD1b9F0a725a56b', conf.contracts['multisig'])


    #acceptOwnershipWithMultisig('0x8e75774Ef928cE730255AB594dD1b9F0a725a56b')
    #acceptOwnershipWithMultisig('0x73eef416cb8B63dBfcc66719F0b74Bb7baEa48Fe')


    #removeOwnerFromMultisig('0x13Be55487D37FE3C66EE7305e1e9C1ac85de75Ae')

    #swapTokens(1e18, 1, conf.contracts['swapNetwork'], conf.contracts['XUSD'], conf.contracts['MOC'])

    #readOracleFromV1Converter(conf.contracts['ConverterSOV'])
    #readOracleFromV1Converter('0x88a67a0e79e311fe93c6e2101d55d6d2ae3a7e94')
    #setOracleOnV1Converter('0x88a67a0e79e311fe93c6e2101d55d6d2ae3a7e94', '0x756d751d09B67d8Fc98be892431926Ff3F70a991')

    #sendWithMultisig(conf.contracts['multisig'], '0x3aB00BEFDd7Bfc0667DE6483D2D3b2F9A74AF2da', '0xaa9f76280000000000000000000000000000000000000000000000000000000000000000', conf.acct)
    
    #replaceOwnerOnMultisig(conf.contracts['multisig'], '0x13Be55487D37FE3C66EE7305e1e9C1ac85de75Ae', '0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E')


    # sendFromMultisig(conf.contracts['FastBTC'], 10**16)
    checkTx(655)
