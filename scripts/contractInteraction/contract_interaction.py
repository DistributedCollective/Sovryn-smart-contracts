
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

    #sendTokensFromMultisig(conf.contracts['XUSD'], conf.contracts['Watcher'], 300000e18)
    #sendTokensFromMultisig(conf.contracts['DoC'], conf.contracts['Watcher'], 19000e18)
    #sendFromMultisig('0xD9ECB390a6a32ae651D5C614974c5570c50A5D89', 30e18)
    #sendFromMultisig('0xD3582f616059044c6289155433940b564bCB6476', 0.1e18)

    #sendMYNTFromMultisigToFeeSharingProxy(36632.144056847e18)
    #confirmWithBFMS(8)
    #checkTxOnBF(8)
    
    #for i in range (1007, 1008):
        #confirmWithMS(i)
        #checkTx(i)
    
    #confirmWithMS(956)
    #confirmWithMS(958)
    #missed = getMissedBalance()
    #transferSOVtoLM(missed)

    #transferRBTCFromFastBTCOffRampToOnRamp(7e18)

    #redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['USDT'], 1000000e18)
    #sendTokensFromMultisig(conf.contracts['USDT'], '0x4f3948816785e30c3378eD3b9F2de034e3AE2E97', 1000000e18)
    bal = getBalance(conf.contracts['(WR)BTC/ETH'], conf.contracts['multisig'])
    removeLiquidityV1toMultisigUsingWrapper(conf.contracts['RBTCWrapperProxyWithoutLM'], conf.contracts['ConverterBNBs'], bal, [conf.contracts['WRBTC'], conf.contracts['BNBs']], [1,1])

    #readMocOracleAddress()

    #bal = getBalance(conf.contracts['(WR)BTC/USDT2'], conf.contracts['multisig'])
    #removeLiquidityV2toMultisig(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], bal, 1)

    #getReturnForV2PoolToken(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], bal)

    #readAllVestingContractsForAddress('0xA6575f1D5Bd6545fBd34BE05259D9d6ae60641f2')
    #getStakes('0x750C49DD9928061Df2224AA81E08Bc4a3c334874')
    #governanceWithdrawVesting('0x750C49DD9928061Df2224AA81E08Bc4a3c334874', conf.contracts['multisig'])

    # # ---------- Transfer ownership to gov ----------
    # # core protocol
    # transferProtocolOwnershipToGovernance()

    # # loan token
    # transferBeaconOwnershipToGovernance()
    # transferLoanTokenAdminRoleToGovernance()
    # transferLoanTokenOwnershipToGovernance()

    # # oracles
    # transferOracleOwnershipToGovernance()

    # # LM
    # transferLiquidityMiningOwnershipToGovernance()

    # # Governance
    # # lockedSOV
    # transferLockedSOVOwnershipToGovernance()

    # # Staking
    # transferStakingOwnershipToGovernance()

    # # StakingRewards
    # transferStakingRewardsOwnershipToGovernance()

    # # VestingRegistry
    # transferVestingRegistryOwnershipToGovernance()

    
    
