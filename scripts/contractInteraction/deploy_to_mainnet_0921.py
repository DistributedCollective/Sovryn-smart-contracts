
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

def main():
    # deploy to the mainnet of the following aggregated update
    # https://docs.google.com/document/d/1hG_DgsJq3XG4XFlSusgCoFFvHpkbmBxmjhwluNRp2aI/edit#
    '''
    NOTES:
     - no Staking contracts update is included (events added) as it requires SIP
    '''
    #load the contracts and acct depending on the network

    conf.loadConfig()

    #call the function you want here
# 5. Affiliates margin trading
    #TODO: might need to set affiliates fees to 0 if decided to deploy with affiliates disabled
    # in this case comment out deployAfiliate() and run deployAffiliateWithZeroFeesPercent()
    # deployAffiliateWithZeroFeesPercent()
    deployAffiliate() 

    '''
    will also execute:
        replaceLoanClosings()
        replaceLoanOpenings()
        replaceLoanMaintenance()
        redeploySwapsExternal()
        replaceLoanSettings()
        replaceLoanTokenLogicOnAllContracts()
    '''
# 1. Protocol Modules Pauser
# 2. Protocol Events
    # replaceAffiliates() - not needed as affiliates are deployed for the first time
    # replaceLoanClosings()
    # replaceLoanMaintenance()
    # replaceLoanOpenings()
    # replaceLoanSettings()
    replaceProtocolSettings()
    replaceSwapsExternal()

# 3. SOV Staking Rewards SIP-0024 - aready deployed to the mainnet
# 4. Events for backend
    '''
    contracts need to be upgraded:
    Staking - skipped for now - separately via SIP
    All below will be redeployed 
    LoanClosingsBase
    LoanClosingsWith
    LoanMaintenance
    LoanOpenings
    '''
# 6. Trading Rebates
    setDefaultRebatesPercentage(10 * 10**18) # might need to set to 0 to disable rebates till immplemented liquid
    # the rest redeployments below are done earlier
    # replaceLoanClosings()
    # LoanOpenings
    # replaceLoanOpenings()
    # LoanMaintenance
    # replaceLoanMaintenance()
    # SwapsExternal
    # redeploySwapsExternal()
    # LoanSettings
    # replaceLoanSettings() 
# 7. Slippage 
    '''
     these are executed earlier
     replaceSwapsExternal()
     replaceLoanTokenLogicOnAllContracts()
    '''
# 8. Release fixes
    # aren't relaited to any specific deployment scripts, just info for testing

# 9. Oracle v1pool
    '''
    Need to redeploy priceFeeds.sol and then re-register all of the assets. //Skippng this, not needed
    Then can use the deployOracleV1Pool() in contract_interaction.py to register asset and pointed out to oracleV1Pool
    '''
    deployOracleV1Pool('SOV') # now it deploys and registers only PriceFeedV1PoolOracle for SOV
    # TODO: refactor deployOracleV1Pool() to process an array (task #100 in taiga https://taiga.sovryn.app/project/sovryn-order/task/100)
    deployOracleV1Pool('SOV', 'WRBTCtoSOVOracle')
    #TODO: add relevant deployment scripts for all needed tokens

