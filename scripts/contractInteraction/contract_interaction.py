
'''
This script serves the purpose of interacting with existing smart contracts on the testnet or mainnet.
'''

from brownie import *
from brownie.network.contract import InterfaceContainer
import json
import time;
import copy
from scripts.utils import * 
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.loan_tokens import *
from scripts.contractInteraction.protocol import *
from scripts.contractInteraction.staking_vesting import *
from scripts.contractInteraction.multisig import *
from scripts.contractInteraction.governance import *
from scripts.contractInteraction.liquidity_mining import *
from scripts.contractInteraction.amm import *
from scripts.contractInteraction.token import *
from scripts.contractInteraction.ownership import *
from scripts.contractInteraction.misc import *
from scripts.contractInteraction.prices import *
from scripts.contractInteraction.run_test_after_deployments import *

def main():
    
    #load the contracts and acct depending on the network
    conf.loadConfig()

    #call the function you want here
    
    
    # Can use  & uncomment this function after deployment related to the core function (swap, trading, lending, borrowing, etc)
    # This function will print will revert if any transaction failed OR
    # Will print any invalid balance / state after each test transaction
    # wrappedIntegrationTest(
    #   conf.contracts['iUSDT'], # loan token address
    #   conf.contracts["USDT"], # underlying token address
    #   conf.contracts['DoC'], # collateral token address
    #   1e18, # total underlying token that will be used for each test
    #   1e18 # total collateral token that will be used for each test
    # )