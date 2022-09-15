
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''
from scripts.contractInteraction.contract_interaction_imports import *

def main():
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
