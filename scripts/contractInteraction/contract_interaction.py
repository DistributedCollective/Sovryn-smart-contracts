
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
    
    #load the contracts and acct depending on the network
    conf.loadConfig()

    #call the function you want here

    # queueProposal(15)
    executeProposal(15)
    pauseOrUnpauseStaking(False)
    
    #txId = 862
    #revokeConfirmationMS(txId)
    # checkTx(txId)
    #executeOnMultisig(txId)

 

    # confirmWithMS(981)

    #SIP-0043

    # [x] pre - execute SIP-0042 to replace logic and enable pausing/freezing
    # executeProposal(14)
    # getStakingLogicAddess() #should be 0xe31A938F5cf1C41747B5F20f9dD5d509B2ACd49c
    
    # [x] 0 - pause Staking contract
    # --------------------------
    # txId = 862
    # confirmWithMS(txId)
    # isStakingPausedOrUnpaused()

    # [x] 1. Create PR  
    # [x] 1.1. set the PR link to the SIP text


    # [x] 2 - deploy the new logic
    # [x] 2.1. on the testnet - deploy logic and  set new implementation - MS (sign using --network testnet-dev) - SHOULD PUSH TO DEVELOPMENT BRANCH BEFORE!!!
    # upgradeStaking()
    # confirmWithMS(txId) # to replace logic on the testnet sign using --network testnet-dev
    # [x] 2.2. ask Stan to try to extend staking to the same date - see bug
    # [x] 2.3. on the mainnet
    # deployStakingLogic() # deploy and get staking logic address
    # add as StakingLogic6 to mainnet_contracts.json
    # ask julio to verify the contract
    
    # [x] 3. Complete SIP-0043 - set new logic contract address, calc SIP hash, commit, create PR, merge PR
    # [x] 3.1. Notify @The Gimp that SIP-0043 is ready to be published to the blog
    
    # [x] 4. Set SIP-0043 data to the def createProposalSIP0043(): in scripts/sip/sip_interaction.py

    # [x] 5. Launch SIP-0043 on the testnet - uncomment createProposal(...) and brownie run scripts/sip/sip_interaction.py --network testnet
    # [x] 5.1. Verify the data is correct on the test governance page
    
    # [x] 6. Launch voting on the mainnet - brownie run scripts/sip/sip_interaction.py --network rsk-mainnet
    # [x] 6.1. Check the proposal data on the mainnet page
    
    # [x] 7. Set alarm in 24 hours after launching to queue proposal

    # [x] 8. Queue proposal
    
    # [x] 9. Execute proposal 48 hours after Queueing
    
    # [ ] 10. Unpause the Staking contract after executed