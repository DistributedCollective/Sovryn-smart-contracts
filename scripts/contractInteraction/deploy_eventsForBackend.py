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

def main():
    #load the contracts and acct depending on the network
    loadConfig()
    #call the function you want here
    deployEventsForBackend()

def loadConfig():
    global contracts, acct
    this_network = network.show_active()
    if this_network == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    elif this_network == "testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    contracts = json.load(configFile)
    acct = accounts.load("rskdeployer")

def replaceLoanOpenings():
    print("replacing loan openings")
    loanOpenings = conf.acct.deploy(LoanOpenings)
    sovryn = Contract.from_abi("sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(loanOpenings.address)
    sendWithMultisig(conf.contracts['multisig'], sovryn.address, data, conf.acct)

def replaceLoanClosings():
    sovryn = Contract.from_abi("sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)

    print('replacing loan closings base')
    loanClosingsBase = conf.acct.deploy(LoanClosingsBase)
    data = sovryn.replaceContract.encode_input(loanClosingsBase.address)
    sendWithMultisig(conf.contracts['multisig'], sovryn.address, data, conf.acct)

    print('replacing loan closings with')
    loanClosingsWith = conf.acct.deploy(LoanClosingsWith)
    data = sovryn.replaceContract.encode_input(loanClosingsWith.address)
    sendWithMultisig(conf.contracts['multisig'], sovryn.address, data, conf.acct)

def replaceLoanMaintenance():
    print("replacing loan maintenance")
    loanMaintenance = conf.acct.deploy(LoanMaintenance)
    sovryn = Contract.from_abi("sovryn", address=conf.contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=conf.acct)
    data = sovryn.replaceContract.encode_input(loanMaintenance.address)
    # print(data)
    sendWithMultisig(conf.contracts['multisig'], sovryn.address, data, conf.acct)

def upgradeStaking():
    print('Deploying account:', acct)
    print("Upgrading staking")

    # Deploy the staking logic contracts
    stakingLogic = conf.acct.deploy(Staking)

    print("New staking logic address:", stakingLogic.address)

    print('''
    next steps: 
    STEP 1: SIP
     - create governance SIP to execute staking proxy 
       staking.setImplementation(newStakingLogic.address)
     - vote on SIP
     - in 3 days after SIP executed (in 3 days ater voting) run deploy_orig_claiming ")

    STEP 2: DEPLOY ORIG CLAIMING
    - deploy_orig_claiming will deploy VestingRegistry2 contract (without exchangeAllCSOV to prevent backdoor 
      double claiming by VestingRegistry users) and OriginInvestorsClaim contract bound to the VestingRegistry2 
      implementation.
    
    STEP 3: FUND CLAIMING
    - transfer total SOV amount to distribute to the origin investors to the OriginInvestorsClaim address
    
    STEP 4: LOAD REGISTRY
    - load the registry investor -> amount: run OriginInvestorsClaim.appendInvestorsAmountsList() by chunks of 
      250 records a time until all the list. 
      Make sure that OriginInvestorsClaim.totalAmount() == SOV.balanceOf(OriginInvestorsClaim)
    
    STEP 5: run OriginInvestorsClaim.setInvestorsAmountsListInitialized() to let the contract know that 
    it can execute the liated investors claim
    ''')

def deployEventsForBackend():
    # -------------------------------- 1. Deploy Staking -----------------------------------------------
    upgradeStaking()


    # ---------------------------- 2. Redeploy modules which implement InterestUser -----------------------
    # LoanClosingsBase
    # LoanClosingsWith
    replaceLoanClosings()
    # LoanOpenings
    replaceLoanOpenings()
    # LoanMaintenance
    replaceLoanMaintenance()
