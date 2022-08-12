from scripts.contractInteraction.staking_vesting import *


def main():
    print(time.time())
    timeLockDate = readLockDate(time.time())
    print(timeLockDate)
    blockNumber = getBlockOfStakingInterval(timeLockDate)
    print(blockNumber)
    if blockNumber == 0:
        setBlockForStakingRewards()
