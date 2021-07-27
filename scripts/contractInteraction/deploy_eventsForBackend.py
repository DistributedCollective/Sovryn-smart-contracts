'''
This script redeploys updated smart contracts by eventsForBackend branch on the testnet or mainnet.

How to launch on RSK Testnet:
  1.- Follow scripts/deployment/setting_and_running
  2.- brownie run scripts/contractInteraction/deploy_eventsForBackend.py --network testnet
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

def main():
    #load the contracts and acct depending on the network
    conf.loadConfig()

    # Deployments required by eventsForBackend branch
    upgradeStaking()
    
    # LoanClosingsBase
    # LoanClosingsWith
    replaceLoanClosings()
    # LoanOpenings
    replaceLoanOpenings()
    # LoanMaintenance
    replaceLoanMaintenance()