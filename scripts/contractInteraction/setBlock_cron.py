from scripts.contractInteraction.staking_vesting import *
import scripts.contractInteraction.config as conf
from scripts.contractInteraction.cron_funding import (
    SET_BLOCK_GAS_LIMIT,
    check_signer_funding,
)


def main():
    check_signer_funding(
        "Set Block",
        conf.acct,
        SET_BLOCK_GAS_LIMIT * 2,
    )
    print(time.time())
    timeLockDate = readLockDate(time.time())
    print('Current time lock date: ', timeLockDate)

    #StakingRewards
    blockNumber = getBlockOfStakingRewardsTimestamp(timeLockDate)
    print('StakingRewards block number for the current lock date: ', blockNumber)
    if blockNumber == 0:
        setBlockForStakingRewards()
        
    #StakingRewardsOs    
    #if isStakingRewardsOsAddressSet():
    blockNumber = getBlockOfStakingRewardsOsTimestamp(timeLockDate)
    print('StakingRewardsOs block number for current lock date: ', blockNumber)
    if blockNumber == 0:
        setBlockForStakingRewardsOs()
