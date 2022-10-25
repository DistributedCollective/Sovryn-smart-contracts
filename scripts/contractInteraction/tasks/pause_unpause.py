from scripts.contractInteraction.contract_interaction_imports import *

'''

run from CLI:
brownie run scripts/contractInteraction/tasks/pause_unpause.py --network testnet
brownie run scripts/contractInteraction/tasks/pause_unpause.py --network rsk-mainnet
'''
def main():

    areAllLendingPoolsPaused()
    #pauseAllLoanTokens()
    #unpauseAllLoanTokens() 

    #  if need to pause separately
    # --- LoanTokenLogicBeaconLM ---
    #isLoanTokenLogicBeaconLMPaused()
    #pauseLoanTokenLogicBeaconLM()
    #unpauseLoanTokenLogicBeaconLM() 
    # --- LoanTokenLogicBeaconWRBTC ---
    #isLoanTokenLogicBeaconWRBTCPaused()
    #pauseLoanTokenLogicBeaconWRBTC()
    #unpauseLoanTokenLogicBeaconWRBTC()


    isProtocolPaused()  
    #pauseProtocolModules() 
    #unpauseProtocolModules() 

    isStakingPaused()
    #pauseStaking = False #False to unpause
    #pauseOrUnpauseStaking(pauseStaking) 

    isBiDiFastBTCPaused()
    #pauseBiDiFastBTC() 
    #unpauseBiDiFastBTC
