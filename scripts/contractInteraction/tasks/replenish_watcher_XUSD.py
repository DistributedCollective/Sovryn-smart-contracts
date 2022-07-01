from scripts.contractInteraction.contract_interaction_imports  import *

def main():
    '''
    Replenish XUSD balance of the watcher when running below threshold
    brownie run scripts/contractInteraction/tasks/replenish_watcher.py --network testnet
    brownie run scripts/contractInteraction/tasks/replenish_watcher.py --network rsk-mainnet
    '''
    sendTokensFromMultisig(conf.contracts['XUSD'], conf.contracts['Watcher'], 200000e18)
