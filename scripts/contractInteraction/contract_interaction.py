
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
    #withdrawRBTCFromFastBTCBiDi(5e18, conf.contracts['Watcher'])
    #bal = getBalance(conf.contracts['SOV'], conf.contracts['Watcher'])
    #bal = getBalance(conf.contracts['FastBTCBiDi'], conf.contracts['Watcher'])
    #withdrawTokensFromWatcher(conf.contracts['XUSD'], 750000e18, conf.contracts['multisig'])
    #withdrawTokensFromWatcher(conf.contracts['USDT'], 150000e18, conf.contracts['multisig'])

    #sendTokensFromMultisig(conf.contracts['XUSD'], conf.contracts['Watcher'], 300000e18)
    #sendTokensFromMultisig(conf.contracts['DoC'], conf.contracts['Watcher'], 19000e18)
    #sendFromMultisig('0xD9ECB390a6a32ae651D5C614974c5570c50A5D89', 30e18)
    #sendFromMultisig(conf.contracts['FastBTC'], 25e18)
    #sendFromMultisig(conf.contracts['Watcher'], 5e18)

    #withdrawRBTCFromIWRBTC('0x9BD6759F6D9eA15D33076e55d4CBba7cf85877A7', 1.6e18)
    #sendMYNTFromMultisigToFeeSharingProxy(36632.144056847e18)
    #confirmWithBFMS(8)
    #checkTxOnBF(8)
    
    #executeOnMultisig(1071)
   
    #confirmWithMS(1064)
    #checkTx(1077)
    
    #MULTIPLE TXS CONFIRM & CHECK - the range is exact tx ids boundaries numbers
    #confirmMultipleTxsWithMS(960, 963)

    #mintAggregatedToken(conf.contracts['XUSDAggregatorProxy'], conf.contracts['USDT'], 1e18)

    #setupMarginLoanParams(conf.contracts['SOV'], conf.contracts['iXUSD'])
    #readOwner(conf.contracts['iXUSD'])
    
    #missed = getMissedBalance()
    #transferSOVtoLM(missed)
    #sendTokensFromMultisig(conf.contracts['SOV'], conf.contracts['StakingRewardsProxy'], 200000e18)
    #revokeConfirmation(1075)

    #withdrawFees()
    #readFeesController()
    #setFeesController(conf.contracts['FeeSharingProxy1DayStaking'])

    #transferRBTCFromFastBTCOffRampToOnRamp(5.7e18)
    #withdrawRBTCFromWatcher(6e18, conf.contracts['FastBTC'])

    #redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['USDT'], 100000e18)
    #sendTokensFromMultisig(conf.contracts['USDT'], '0x4f3948816785e30c3378eD3b9F2de034e3AE2E97', 1000000e18)
    #bal = getBalance(conf.contracts['(WR)BTC/ETH'], conf.contracts['multisig'])
    #removeLiquidityV1toMultisigUsingWrapper(conf.contracts['RBTCWrapperProxyWithoutLM'], conf.contracts['ConverterBNBs'], 1e18, [conf.contracts['WRBTC'], conf.contracts['BNBs']], [1,1])

    #readMocOracleAddress()

    #bal = getBalance(conf.contracts['(WR)BTC/USDT2'], conf.contracts['multisig'])
    #removeLiquidityV2toMultisig(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], bal, 1)

    #getReturnForV2PoolToken(conf.contracts['ConverterUSDT'], conf.contracts['(WR)BTC/USDT2'], bal)

    #readAllVestingContractsForAddress('0xA6575f1D5Bd6545fBd34BE05259D9d6ae60641f2')
    #getStakes('0x750C49DD9928061Df2224AA81E08Bc4a3c334874')
    #governanceWithdrawVesting('0x750C49DD9928061Df2224AA81E08Bc4a3c334874', conf.contracts['multisig'])

    #addOwnerToMultisig('0x832E1bd30d037d0327F2A0447eD44FB952A9a043')
    #removeOwnerFromMultisig('0x832E1bd30d037d0327F2A0447eD44FB952A9a043')

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

    # getLMInfo()

    # Transferring Ownership of AMM Contracts to Governance
    # === SovrynSwapNetwork ===
    print("Transfer ownership of sovrynSwapNetwork to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['swapNetwork'], conf.contracts['TimelockAdmin'])


    # === SwapSettings ===
    print("Transfer ownership of swapSettings to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ammSwapSettings'], conf.contracts['TimelockAdmin'])
    

    # === Converters ===
    # DOC
    print("Transfer ownership of converter DoC to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterDOC'], conf.contracts['TimelockAdmin'])

    #  USDT
    print("Transfer ownership of converter USDT to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterUSDT'], conf.contracts['TimelockAdmin'])

    #  BPro
    print("Transfer ownership of converter BPro to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterBPRO'], conf.contracts['TimelockAdmin'])

    # BNBs
    print("Transfer ownership of converter BNBs to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterBNBs'], conf.contracts['TimelockAdmin'])

    # MoC
    print("Transfer ownership of converter MoC to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterMOC'], conf.contracts['TimelockAdmin'])

    # XUSD
    print("Transfer ownership of converter XUSD to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterXUSD'], conf.contracts['TimelockAdmin'])

    # SOV
    print("Transfer ownership of converter SOV to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterSOV'], conf.contracts['TimelockAdmin'])

    # ETHs
    print("Transfer ownership of converter ETHs to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterETHs'], conf.contracts['TimelockAdmin'])

    # FISH
    print("Transfer ownership of converter FISH to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterFISH'], conf.contracts['TimelockAdmin'])

    # MYNT
    print("Transfer ownership of converter MYNT to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterMYNT'], conf.contracts['TimelockAdmin'])

    # RIF
    print("Transfer ownership of converter RIF to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterRIF'], conf.contracts['TimelockAdmin'])


    # === Oracles ===
    print("Transfer ownership of oracle BPro to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['BProOracle'], conf.contracts['TimelockAdmin'])

    print("Transfer ownership of oracle MOC to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['MOCPoolOracle'], conf.contracts['TimelockAdmin'])

    print("Transfer ownership of oracle SOV to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['SOVPoolOracle'], conf.contracts['TimelockAdmin'])

    print("Transfer ownership of oracle ETHs to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ETHPoolOracle'], conf.contracts['TimelockAdmin'])

    print("Transfer ownership of oracle BNBs to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['BNBPoolOracle'], conf.contracts['TimelockAdmin'])

    print("Transfer ownership of oracle XUSD to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['XUSDPoolOracle'], conf.contracts['TimelockAdmin'])

    print("Transfer ownership of oracle FISH to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['FishPoolOracle'], conf.contracts['TimelockAdmin'])

    print("Transfer ownership of oracle RIF to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['RIFPoolOracle'], conf.contracts['TimelockAdmin'])

    print("Transfer ownership of oracle MYNT to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['MYNTPoolOracle'], conf.contracts['TimelockAdmin'])


    # === AMM Contract Registry ===
    print("Transfer ownership of Contract Registry to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ammContractRegistry'], conf.contracts['TimelockOwner'])


    # === Converter Factory ===
    print("Transfer ownership of Converter Factory to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterFactory'], conf.contracts['TimelockAdmin'])


    # === Conversion Path Finder ===
    print("Transfer ownership of Conversion Path Finder to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConversionPathFinder'], conf.contracts['TimelockAdmin'])


    # ===  Converter Upgrader ===
    print("Transfer ownership of Converter Upgrader to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterUpgrader'], conf.contracts['TimelockAdmin'])


    # === Converter Registry Data ===
    print("Transfer ownership of Converter Registry Data to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterRegistryData'], conf.contracts['TimelockAdmin'])


    # === Oracle Whitelist ===
    print("Transfer ownership of Oracle Whitelist to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ammOracleWhitelist'], conf.contracts['TimelockAdmin'])


    # === RBTC Wrapper Proxy ===
    print("Transfer ownership of RBTC Wrapper Proxy to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['RBTCWrapperProxy'], conf.contracts['TimelockAdmin'])
