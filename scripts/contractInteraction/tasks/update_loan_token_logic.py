from scripts.contractInteraction.contract_interaction_imports  import *

def main():
    '''
    when LoanTokenLogicStandard change, because it is inherited by all mofules, 
    it requires the following update which is essentially redeploy all of 
    loan token logic contract & also redeploy of modules
    
    brownie run scripts/contractInteraction/tasks/update_loan_token_logic.py --network testnet
    brownie run scripts/contractInteraction/tasks/update_loan_token_logic.py --network rsk-mainnet
    '''
    # 1. BACKUP current logic addresses to revert if anything goes wrong
    # 2. deploy new logics and register them with the beacon contracts - the new logic will be applied right away
    # replaceLoanTokenLogicOnAllContracts()
    #3. deploy and replace protocol settings module address in the protocol if changed else comment out
    # replaceProtocolSettings()
    #4. deploy and replace modules address in the protocol if changed else comment out respective calls
    # replaceLoanOpenings()
    # replaceLoanClosings()
    # replaceSwapsExternal()
    # replaceLoanMaintenance()
    #5. deploy and replace in the protocol sovryn swaps implementation contract
    # replaceSwapsImplSovrynSwap()