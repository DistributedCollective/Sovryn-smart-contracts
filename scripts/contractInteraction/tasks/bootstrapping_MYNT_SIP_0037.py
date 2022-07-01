from scripts.contractInteraction.contract_interaction_imports  import *

def main():
    '''
    Removes historically set lending pools limits  
    brownie run scripts/contractInteraction/tasks/bootstrapping_MYNT_SIP_0037.py --network testnet
    brownie run scripts/contractInteraction/tasks/bootstrapping_MYNT_SIP_0037.py --network rsk-mainnet
    '''
    # to be executed for a year once per month according to SIP-0037 feb'22 - jan'23
    sendMYNTFromMultisigToFeeSharingProxy(36632.144056847 * 10**18) 