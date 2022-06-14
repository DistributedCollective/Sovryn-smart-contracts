
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''
from scripts.contractInteraction.contract_interaction_imports import *

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

    #withdrawRBTCFromIWRBTC('0x9BD6759F6D9eA15D33076e55d4CBba7cf85877A7', 1.6e18)
    #sendMYNTFromMultisigToFeeSharingProxy(36632.144056847e18)
    
    #confirmMultipleTxsWithMS(960, 963)
    #missed = getMissedBalance()
    #transferSOVtoLM(missed)

    #transferRBTCFromFastBTCOffRampToOnRamp(9.6e18)

    # pauseOrUnpauseStaking(True)
    # isStakingPaused()
    
    
    #missed = getMissedBalance()
    #transferSOVtoLM(missed)
    #redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['DoC'], 30000e18)
    #sendTokensFromMultisig(conf.contracts['DoC'], conf.contracts['Watcher'], 30000e18)

    #readMocOracleAddress()

    #bal = getBalance(conf.contracts['(WR)BTC/USDT2'], conf.contracts['multisig'])
    #removeLiquidityV2toMultisig(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], bal, 1)

    #getReturnForV2PoolToken(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], bal)

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

   
