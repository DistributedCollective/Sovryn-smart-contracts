from scripts.contractInteraction.contract_interaction import *
from scripts.contractInteraction.tasks.airdrop_distribution.send_direct_XUSD import *
from scripts.contractInteraction.tasks.airdrop_distribution.send_direct_SOV import *
from scripts.contractInteraction.tasks.airdrop_distribution.create_vestings import *
from scripts.contractInteraction.tasks.airdrop_distribution.utils import *

def main():
    '''
    Implements 
    - direct distribution of SOV and XUSD
    - distribution via vested SOV
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
    # SOVAmount = 8715198 * 1e16 # 87151.98
    # 1.
    # transferSOVtoTokenSender(SOVAmount) # direct liquid SOV distribution
    # 2. 
    # sovDistributionPath = './scripts/contractInteraction/tasks/data/distribution/direct-SOV-transfers-22-04.csv'
    # dryRun = true # false to execute, true to verify the file structure
    # sendDirectSOV(sovDistributionPath, dryRun)
     
    #
    # - Distribute XUSD -
    # 
    # XUSDAmount = 4325316 * 1e16 #43,253.16
    # 1.
    # transferXUSDtoTokenSender(XUSDAmount) # direct liquid XUSD distribution
    # 2.
    # xusdDistributionPath = './scripts/contractInteraction/tasks/data/distribution/direct-XUSD-transfers-22-04.csv'
    # dryRun = true # false to execute, true to verify the file structure
    # sendDirectXUSD(xusdDistributionPath, dryRun)
    
    #
    # - VESTED DISTRIBUTION -
    #
    # add and remove in the end the script execution address to admins
    # vestingRegistryProxyAddAdmin('0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E')
    #
    # TODO:
    # 1. verify amounts format - should be 2 decimals strictly: 1000.01,"1000.00", "1,000.01" 
    # 2. trim address field to remove leading and trailing spaces
    # 3. set relevant path
    # 4. dry-run, the uncomment actual tx
    # 5. try small amount
    # 6. run full distribution 
    # 
    # vestingDistributionPath = './scripts/contractInteraction/tasks/data/distribution/vestings-XX.csv'
    # dryRun = true # false to execute, true to verify the file structure
    # createVestings(path, dryRun)
    #
    # vestingRegistryProxyRemoveAdmin('0xFEe171A152C02F336021fb9E79b4fAc2304a9E7E') # remove the script exexution from admins
    # 
    #