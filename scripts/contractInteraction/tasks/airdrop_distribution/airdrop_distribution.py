import csv
from scripts.contractInteraction.contract_interaction import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.send_direct_XUSD import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.send_direct_SOV import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.create_vestings import *
from scripts.contractInteraction.tasks.airdrop_distribution.functions.utils import *

def main():
    '''
    Implements 
    - direct distribution of SOV and XUSD
    - distribution SOV via vesting
    brownie run scripts/contractInteraction/tasks/airdrop_distribution.py --network testnet
    brownie run scripts/contractInteraction/tasks/airdrop_distribution.py --network rsk-mainnet
    '''
    
    # GenericTokenSenderAddAdmin("0x27d55f5668ef4438635bdce0adca083507e77752")
    # GenericTokenSenderAddAdmin("0x9E0816a71B53ca67201a5088df960fE90910DE55")
    
    # - LIQUID DISTRIBUTION - 

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
    # SOVAmount = 8715198 * 10**16 # 87151.98
    # 1.
    # transferSOVtoTokenSender(SOVAmount) # direct liquid SOV distribution
    # 2. 
    # sovDistributionPath = './scripts/contractInteraction/tasks/airdrop_distribution/data/direct-SOV-transfers-22-04.csv'
    # dryRun = true # false to execute, true to verify the file structure
    # multiplier = 10**16 # usually 10**16 <- amounts must with 2 decimals
    # sendDirectSOV(sovDistributionPath, dryRun, multiplier)
     
    #
    # - Distribute XUSD -
    # 
    # XUSDAmount = 4325316 * 10**16 #43,253.16
    # 1.
    # transferXUSDtoTokenSender(XUSDAmount) # direct liquid XUSD distribution
    # 2.
    # xusdDistributionPath = './scripts/contractInteraction/tasks/airdrop_distribution/data/direct-XUSD-transfers-22-04.csv'
    # dryRun = True # false to execute, true to verify the file structure
    # multiplier = 10**16 # usually 10**16 <- amounts must with 2 decimals
    # sendDirectXUSD(xusdDistributionPath, dryRun, multiplier)
    
    #
    # - VESTED DISTRIBUTION -
    # -----------------------
    
    # receiver = '0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E'
    # amount = 13601059 * 10**16
    # transferSOVtoAccount(receiver, amount) # vesting SOV distribution
    
    # ------------------------
    # add and remove in the end the script execution address to admins
    # vestingRegistryProxyAddAdmin('0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E')
    #
    # TODO:
    # 1. set relevant vestingDistributionPath
    # 2. set dryRun = True, run, verify
    # 3. set dryRun = False, run
    # 4. try small amount distributions - split the file into 2
    # 5. run full distribution 
    # 
    '''
    brownie run scripts/contractInteraction/tasks/airdrop_distribution/airdrop_distribution.py --network rsk-mainnet
    '''
    vestingDistributionPath = './scripts/contractInteraction/tasks/airdrop_distribution/data/vestings-22-04_3.csv'
    dryRun = False # false to execute, true to verify the file structure
    multiplier = 10**16 # multiplier == 10**16 <- amounts must with 2 decimals
    createVestings(vestingDistributionPath, dryRun, multiplier)
    #
    # vestingRegistryProxyRemoveAdmin('0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E') # remove the script exexution from admins
    # 
    #