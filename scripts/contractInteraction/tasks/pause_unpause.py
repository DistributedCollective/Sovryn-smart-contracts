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

    # ----- Loan token functions pauser ----- #   
    loanTokensList = (
        "iDOC", 
        "iRBTC",
        "iXUSD",
        "iUSDT",
        "iBPro",
        "iDLLR"
    )

    #CHECK PAUSED
    checkLoanTokenFunctionsPause(loanTokensList)

    '''
    for tokenName in loanTokensList:
        setPauser(conf.contracts[tokenName], conf.contracts["multisig"])
    '''

    # PAUSE/UNPAUSE
    '''
    functions = {
            "marginTrade":"marginTrade(bytes32,uint256,uint256,uint256,address,address,uint256,bytes)", 
            "borrow": "borrow(bytes32,uint256,uint256,uint256,address,address,address,bytes)"
        }
    # comment/remove loanTokenToProcess elements to exclude tokens from processing
    loanTokensToProcess = {
        "iDOC", 
        #"iRBTC",
        #"iXUSD",
        #"iUSDT",
        #"iBPro",
        #"iDLLR"
    }
    value = True # False to unpause
    for tokenName in loanTokensToProcess:
        triggerFunctionEmergencyStop(conf.contracts[tokenName], functions["marginTrade"], value)
        #triggerFunctionEmergencyStop(conf.contracts[tokenName], functions["borrow"], value)
    '''

    