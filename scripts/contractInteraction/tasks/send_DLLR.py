from scripts.contractInteraction.contract_interaction_imports  import *

def main():
    '''
    Redeem ZUSD from XUSD, mint DLLR by ZUSD, send DLLR to a receiver
    brownie run scripts/contractInteraction/tasks/send_DLLR.py --network testnet
    brownie run scripts/contractInteraction/tasks/send_DLLR.py --network rsk-mainnet
    '''    
    #amount = 200000e18
    #receiver = '0x2064242b697830535A2d76BE352e82Cf85E0EC2c'
    redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['ZUSD'], amount)
    mintAggregatedTokenWithMS(conf.contracts['DLLRAggregatorProxy'], conf.contracts['ZUSD'], amount)
    sendTokensFromMultisig(conf.contracts['DLLR'], receiver, amount)