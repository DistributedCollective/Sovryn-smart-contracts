from scripts.contractInteraction.contract_interaction_imports  import *

def main():
    '''
    Replenish XUSD balance of the watcher when running below threshold
    brownie run scripts/contractInteraction/tasks/remove_lending_pools_tx_limits.py --network testnet
    brownie run scripts/contractInteraction/tasks/remove_lending_pools_tx_limits.py --network rsk-mainnet
    '''
    sendTokensFromMultisig(conf.contracts['XUSD'], conf.contracts['Watcher'], 200000e18)