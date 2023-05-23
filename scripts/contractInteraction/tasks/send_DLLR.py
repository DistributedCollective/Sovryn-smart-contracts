from scripts.contractInteraction.contract_interaction_imports  import *

def main():
    '''
    Redeem ZUSD from XUSD, mint DLLR by ZUSD, send DLLR to a receiver
    brownie run scripts/contractInteraction/tasks/send_DLLR.py --network testnet
    brownie run scripts/contractInteraction/tasks/send_DLLR.py --network rsk-mainnet
    '''    
    redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['ZUSD'], 9900e18)
    mintAggregatedTokenWithMS(conf.contracts['DLLRAggregatorProxy'], conf.contracts['ZUSD'], 9900e18)
    sendTokensFromMultisig(conf.contracts['DLLR'], '0x4f3948816785e30c3378eD3b9F2de034e3AE2E97', 9900e18)