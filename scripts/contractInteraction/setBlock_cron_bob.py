from scripts.contractInteraction.staking_vesting import *


def main():
    print(time.time())
    timeLockDate = readLockDate(time.time())
    print('Current time lock date: ', timeLockDate)
        
    #StakingRewardsOs    
    #if isStakingRewardsOsAddressSet():
    blockNumber = getBlockOfStakingRewardsOsTimestamp(timeLockDate)
    print('StakingRewardsOs block number for current lock date: ', blockNumber)
    if blockNumber == 0:
        setBlockForStakingRewardsOs()
