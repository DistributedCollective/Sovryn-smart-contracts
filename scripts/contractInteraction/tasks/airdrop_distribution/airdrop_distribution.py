import csv
from scripts.contractInteraction.contract_interaction_imports  import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.send_direct import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.send_direct_XUSD import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.send_direct_SOV import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.create_vestings import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.utils import *

def main():
    '''
    Implements 
    - direct distribution of SOV and XUSD
    - distribution SOV via vesting
    brownie run scripts/contractInteraction/tasks/airdrop_distribution/airdrop_distribution.py --network testnet
    brownie run scripts/contractInteraction/tasks/airdrop_distribution/airdrop_distribution.py --network rsk-mainnet
    '''
    
    # GenericTokenSenderAddAdmin("0x27d55f5668ef4438635bdce0adca083507e77752")
    # GenericTokenSenderAddAdmin("0x9E0816a71B53ca67201a5088df960fE90910DE55")
    
    # - LIQUID DISTRIBUTION - 

    #
    # - Distribute RBTC -
    # 

    #RBTCAmount = 1 * 10**16 # 1.00
    # 0.
    #print("RBTC balance of exchequer multisig: \n", getContractBTCBalance(conf.contracts['multisig'])/10**18) # check multisig is funded with XUSD
    # 1.
    '''
    print("GenericTokenSender Owner is: ")
    readOwner(conf.contracts['GenericTokenSender']) # check the token sender owner address
    print("Script executor address is: ",conf.acct) # check the token sender owner address
    '''
    #sendFromMultisig(conf.contracts["GenericTokenSender"], RBTCAmount) # direct liquid RBTC distribution 
    
    # 2.
    # print("RBTC balance of Generic Token: \n", getContractBTCBalance(conf.contracts['GenericTokenSender'])/10**18) # check multisig is funded
    
    '''
    rbtcDistributionPath = './scripts/contractInteraction/tasks/airdrop_distribution/data/direct-RBTC-YY-MM.csv'
    dryRun = False # false to execute, true to verify the file structure
    multiplier = 1 # NO DECIMALS! AMOUNTS SHOULD BE IN WEI (satoshi)!
    '''
    # sendDirect('RBTC', rbtcDistributionPath, dryRun, multiplier)



    # TODO:
    # 1. verify amounts format - should be 2 decimals strictly: 1000.01,"1000.00", "1,000.01" 
    # 2. trim address field to remove leading and trailing spaces
    # 3. set relevant path
    # 4. dry-run, the uncomment actual tx
    # 5. try small amount
    # 6. run full distribution 
    
    # 
    # - Distribute SOV -
    # 
    # SOVAmount = 1563050 * 10**16 #15,630.50
    # 0. 
    # print(getBalance(conf.contracts['SOV'], conf.contracts['multisig'])/10**18) # check multisig is funded with SOV
    # 1.
    '''
    print("GenericTokenSender Owner is: ")
    readOwner(conf.contracts['GenericTokenSender']) # check the token sender owner address
    print("Script executor address is: ",conf.acct) # check the token sender owner address
    transferSOVtoTokenSender(SOVAmount) # direct liquid SOV distribution
    '''
    # 2. 
    # print("SOV balance of Generic Token: ", getBalance(conf.contracts['SOV'], conf.contracts['GenericTokenSender'])/10**18) # check GenericTokenSender is funded with SOV
    '''
    sovDistributionPath = './scripts/contractInteraction/tasks/airdrop_distribution/data/direct-SOV-23-04.csv'
    dryRun = False # False to execute, true to verify the file structure
    multiplier = 10**16 # usually 10**16 <- amounts must have 2 decimals
    sendDirectSOV(sovDistributionPath, dryRun, multiplier)
    '''

    #
    # - Distribute XUSD -
    # 
    # XUSDAmount = 1475600 * 10**16 # 14,756.00
    # 0.
    # print("XUSD balance of exchequer multisig: \n", getBalance(conf.contracts['XUSD'], conf.contracts['multisig'])/10**18) # check multisig is funded with XUSD
    # 1.
    '''
    print("GenericTokenSender Owner is: ")
    readOwner(conf.contracts['GenericTokenSender']) # check the token sender owner address
    print("Script executor address is: ",conf.acct) # check the token sender owner address
    '''
    # transferToTokenSender('XUSD', XUSDAmount) # direct liquid XUSD distribution 
    
    # 2.
    # print("XUSD balance of Generic Token: \n", getBalance(conf.contracts['XUSD'], conf.contracts['GenericTokenSender'])/10**18) # check multisig is funded with XUSD
    
    '''
    xusdDistributionPath = './scripts/contractInteraction/tasks/airdrop_distribution/data/direct-XUSD-23-09.csv'
    dryRun = False # false to execute, true to verify the file structure
    multiplier = 10**16 # usually 10**16 <- amounts must with 2 decimals
    sendDirect('XUSD', xusdDistributionPath, dryRun, multiplier)
    '''

    #
    # - Distribute DLLR -
    # currency = 'DLLR'
    # amount = 42500 * 10**16 # 425.00
    # 0.
    #print(currency, "balance of exchequer multisig: \n", getBalance(conf.contracts[currency], conf.contracts['multisig'])/10**18) # check multisig is funded with currency
    # redeemFromAggregatorWithMS(conf.contracts['XUSDAggregatorProxy'], conf.contracts['DLLR'], amount)
    # 1.
    '''
    print("GenericTokenSender Owner is: ")
    readOwner(conf.contracts['GenericTokenSender']) # check the token sender owner address
    print("Script executor address is: ",conf.acct) # check the token sender owner address
    transferToTokenSender('DLLR', amount) # direct liquid currency distribution 
    '''
    # 2.
    # print(currency, "balance of Generic Token: \n", getBalance(conf.contracts[currency], conf.contracts['GenericTokenSender'])/10**18) # check multisig is funded with DLLR
    
    '''
    dllrDistributionPath = './scripts/contractInteraction/tasks/airdrop_distribution/data/direct-DLLR-23-04.csv'
    dryRun = False # false to execute, true to verify the file structure
    multiplier = 10**16 # usually 10**16 <- amounts must with 2 decimals
    sendDirect('DLLR', dllrDistributionPath, dryRun, multiplier)
    '''
    
    #
    # - VESTED DISTRIBUTION -
    # -----------------------
    #print("SOV balance of exchequer multisig: \n", getBalance(conf.contracts['SOV'], conf.contracts['multisig'])/10**18) # check multisig is funded with SOV
    #print("SOV balance of executing account: \n", getBalance(conf.contracts['SOV'], conf.acct)/10**18) # check that the script running address is funded
    
    #'''
    #vestedSOVAmount = 3941667 * 10**16 #39,416.67
    #transferSOVtoAccount(conf.acct, vestedSOVAmount) # vesting SOV distribution
    #'''
    
    # ------------------------
    # check, add and remove in the end the script execution address to admins
    receiver = conf.acct
    
    '''
    if(not isVestingRegistryProxyAdmin(receiver)):
          print('Adding Vesting Registry Admin')
          vestingRegistryProxyAddAdmin(receiver)
    '''
    # 
    # TODO:
    # 1. set relevant vestingDistributionPath
    # 2. set dryRun = True, run, verify
    # 3. set dryRun = False, run
    # 4. run full distribution 
    # 
    '''
    brownie run scripts/contractInteraction/tasks/airdrop_distribution/airdrop_distribution.py --network testnet
    brownie run scripts/contractInteraction/tasks/airdrop_distribution/airdrop_distribution.py --network rsk-mainnet
    '''

    '''
    vestingDistributionPath = './scripts/contractInteraction/tasks/airdrop_distribution/data/vestings-**-**.csv'
    dryRun = True # False to execute, True to verify the file structure
    multiplier = 10**16 # multiplier == 10**(18 - decimals) e.g. 16 <- amounts must with 2 decimals
    createVestings(vestingDistributionPath, dryRun, multiplier)
    '''
   
    #
    # vestingRegistryProxyRemoveAdmin(receiver) # remove the script exexution from admins
    # 
    #
    # getGenericTokenSenderInfo()