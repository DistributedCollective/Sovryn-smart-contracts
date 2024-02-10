
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''
from scripts.contractInteraction.contract_interaction_imports import *

def main():
    # Transferring Ownership of AMM Contracts to Governance
    # === SovrynSwapNetwork ===
    print("Transfer ownership of sovrynSwapNetwork to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['swapNetwork'], conf.contracts['TimelockAdmin'], 'SovrynSwapNetwork')


    # === SwapSettings ===
    print("Transfer ownership of swapSettings to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ammSwapSettings'], conf.contracts['TimelockAdmin'], 'SwapSettings')
    

    # === Converters ===
    # DOC
    print("Transfer ownership of converter DoC to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterDOC'], conf.contracts['TimelockOwner'])

    #  USDT
    print("Transfer ownership of converter USDT to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterUSDT'], conf.contracts['TimelockOwner'])

    #  BPro
    print("Transfer ownership of converter BPro to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterBPRO'], conf.contracts['TimelockOwner'])

    # BNBs
    print("Transfer ownership of converter BNBs to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterBNBs'], conf.contracts['TimelockOwner'])

    # MoC
    print("Transfer ownership of converter MoC to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterMOC'], conf.contracts['TimelockOwner'])

    # XUSD
    print("Transfer ownership of converter XUSD to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterXUSD'], conf.contracts['TimelockOwner'])

    # SOV
    print("Transfer ownership of converter SOV to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterSOV'], conf.contracts['TimelockOwner'])

    # ETHs
    print("Transfer ownership of converter ETHs to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterETHs'], conf.contracts['TimelockOwner'])

    # FISH
    print("Transfer ownership of converter FISH to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterFISH'], conf.contracts['TimelockOwner'])

    # MYNT
    print("Transfer ownership of converter MYNT to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterMYNT'], conf.contracts['TimelockOwner'])

    # RIF
    print("Transfer ownership of converter RIF to timelockOwner: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterRIF'], conf.contracts['TimelockOwner'])


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
    transferOwnershipAMMContractsToGovernance(conf.contracts['ammContractRegistry'], conf.contracts['TimelockOwner'], 'ContractRegistry')


    # === Converter Factory ===
    print("Transfer ownership of Converter Factory to timelockOwner: ", conf.contracts['TimelockOwner'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterFactory'], conf.contracts['TimelockOwner'], 'ConverterFactory')


    # === Conversion Path Finder ===
    print("Transfer ownership of Conversion Path Finder to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConversionPathFinder'], conf.contracts['TimelockAdmin'], 'ConversionPathFinder')


    # ===  Converter Upgrader ===
    print("Transfer ownership of Converter Upgrader to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterUpgrader'], conf.contracts['TimelockAdmin'], 'SovrynSwapConverterUpgrader')


    # === Converter Registry Data ===
    print("Transfer ownership of Converter Registry Data to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ConverterRegistryData'], conf.contracts['TimelockAdmin'], 'SovrynSwapConverterRegistryData')


    # === Oracle Whitelist ===
    print("Transfer ownership of Oracle Whitelist to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['ammOracleWhitelist'], conf.contracts['TimelockAdmin'])


    # === RBTC Wrapper Proxy ===
    print("Transfer ownership of RBTC Wrapper Proxy to timelockAdmin: ", conf.contracts['TimelockAdmin'])
    transferOwnershipAMMContractsToGovernance(conf.contracts['RBTCWrapperProxy'], conf.contracts['TimelockAdmin'])
