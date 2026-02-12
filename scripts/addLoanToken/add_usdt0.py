from scripts.contractInteraction.loan_tokens import deployLoanToken
import scripts.contractInteraction.config as conf 

'''
Deploying a new loan token (iUSDT0) for USDT0.
This script only deploys the iUSDT0 loan token contract.

All protocol configuration is handled via SIP-0089 (governance):
- setPriceFeed(USDT0)
- setSupportedTokens(USDT0)
- setupLoanParams for other loan tokens to accept USDT0 as collateral
'''
def main():
    # Deploy iUSDT0 loan token using loan_tokens.py deployLoanToken
    # Note: This function uses the config module (conf) for account and contract references
    deployLoanToken(
        conf.contracts['USDT0'], #underlying token (USDT0)
        'iUSDT0', #symbol
        'iUSDT0', #name
        6e18, #base rate (6%)
        15e18, #rateMultiplier (15%)
        75e18, #kinkLevel (75%)
        150e18, # scaleRate (150%)
        [conf.contracts['WRBTC'], conf.contracts['BPro'], conf.contracts['DoC'], conf.contracts['SOV'], conf.contracts['XUSD'], conf.contracts['DLLR']]) #array of collateral addresses
    
    print("\n" + "="*70)
    print("iUSDT0 DEPLOYMENT COMPLETE!")
    print("="*70)
    print("\nNEXT STEPS:\n")
    print("1. Add iUSDT0 address to mainnet_contracts.json")
    print("    'iUSDT0': '<deployed_address_from_above>'\n")
    print("2. Execute governance SIP for complete activation")
    print("    The SIP must include:")
    print("    - setLoanPool(iUSDT0, USDT0)")
    print("    - setPriceFeed(USDT0)")
    print("    - setSupportedTokens(USDT0)")
    print("    - setupLoanParams for all loan tokens")
    print("    ")
    print("    Update SIP-0089 in sipArgs.js to include setLoanPool call")
    print("    Then run: npx hardhat sip-create --argsFunc getArgsSip0089 --network rskMainnet")
    print("    Test: tests-onchain/sip0089.test.js")
    print("="*70 + "\n")
