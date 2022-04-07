'''
Removes historically set lending pools limits  
'''
from scripts.contractInteraction.contract_interaction import *

def main():
    # to be executed for a year once per month according to SIP-0037 feb'22 - jan'23
    sendMYNTFromMultisigToFeeSharingProxy(36632.144056847e18) 