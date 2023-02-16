from scripts.contractInteraction.contract_interaction_imports import *

'''

run from CLI:
brownie run scripts/contractInteraction/tasks/freeze_unfreeze.py --network testnet
brownie run scripts/contractInteraction/tasks/freeze_unfreeze.py --network rsk-mainnet
'''

def main():

    isStakingFrozen()
    #stakingWithdrawFreeze = True #False to unfreeze
    #freezeOrUnfreezeStakingWithdawal(stakingWithdrawFreeze)

    isBiDiFastBTCFrozen()
    #freezeFlag = True #False - unfreeze
    #freezeBiDiFastBTC()
    #unfreezeBiDiFastBTC()

