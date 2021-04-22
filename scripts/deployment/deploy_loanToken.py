from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
import shared
import json
from munch import Munch

'''
script to deploy the loan tokens. can be used to deploy loan tokens separately, but is also used by deploy_everything
if deploying separetly, the addresses of the existing contracts need to be set.
'''
def main():
    wrbtcAddress = '0x602C71e4DAC47a042Ee7f46E0aee17F94A3bA0B6'
    susdAddress = '0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87'
    protocolAddress = '0xcCB53c9429d32594F404d01fbe9E65ED1DCda8D9'

    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet" or thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")

    tokens = Munch()
    if thisNetwork == "development":
        tokens.wrbtc = Contract.from_abi("TestWrbtc", address = wrbtcAddress, abi = TestWrbtc.abi, owner = acct)
    else:
        tokens.wrbtc = Contract.from_abi("WRBTC", address = wrbtcAddress, abi = WRBTC.abi, owner = acct)
    tokens.susd = Contract.from_abi("TestToken", address = susdAddress, abi = TestToken.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=acct)

    deployLoanTokens(acct, sovryn, tokens)

'''
Deploys and tests the two loan tokenn contracts
'''
def deployLoanTokens(acct, sovryn, tokens):
    
    print('\n DEPLOYING ISUSD')
    (contractSUSD, loanTokenSettingsSUSD) = deployLoanToken(acct, sovryn, tokens.susd.address, "iSUSD", "iSUSD", [tokens.wrbtc.address], tokens.wrbtc.address)
    print("initializing the lending pool with some tokens, so we do not run out of funds")
    tokens.susd.approve(contractSUSD.address,1000e18) #1k $
    contractSUSD.mint(acct, 1000e18)
    if network.show_active() == "development":
        testAffiliatesIntegration(acct, sovryn,contractSUSD.address, tokens.susd, tokens.wrbtc, 21e18, 0)
        testDeployment(acct, sovryn,contractSUSD.address, tokens.susd, tokens.wrbtc, 21e18, 0)
    
    print('\n DEPLOYING IWRBTC')
    (contractWRBTC, loanTokenSettingsWRBTC) = deployLoanToken(acct, sovryn, tokens.wrbtc.address, "iWRBTC", "iWRBTC", [tokens.susd.address], tokens.wrbtc.address)
    print("initializing the lending pool with some tokens, so we do not run out of funds")
    contractWRBTC = Contract.from_abi("loanToken", address=contractWRBTC.address, abi=LoanTokenLogicWrbtc.abi, owner=acct)
    contractWRBTC.mintWithBTC(acct, {'value':0.1e18})#0.1 BTC
    if network.show_active() == "development":
        testAffiliatesIntegration(acct, sovryn, contractWRBTC.address, tokens.wrbtc, tokens.susd, 0.0021e18, 0.0021e18)
        testDeployment(acct, sovryn, contractWRBTC.address, tokens.wrbtc, tokens.susd, 0.0021e18, 0.0021e18)

    return (contractSUSD, contractWRBTC, loanTokenSettingsSUSD, loanTokenSettingsWRBTC)

'''
Deploys a single loan token contract and sets it up
'''
def deployLoanToken(acct, sovryn, loanTokenAddress, loanTokenSymbol, loanTokenName, collateralAddresses, wrbtcAddress, multisig='', loanTokenLogicAddress=''):
    
    print("Deploying LoanTokenLogicStandard")
    if (len(loanTokenLogicAddress) == 0):
        if(loanTokenSymbol == 'iWRBTC'):
            loanTokenLogic = acct.deploy(LoanTokenLogicWrbtc)
        else:
            loanTokenLogic = acct.deploy(LoanTokenLogicStandard)
        loanTokenLogicAddress = loanTokenLogic.address
        _add_contract(loanTokenLogic)

    print("Deploying loan token using the loan logic as target for delegate calls")
    loanToken = acct.deploy(LoanToken, acct.address, loanTokenLogicAddress, sovryn.address, wrbtcAddress)
    _add_contract(loanToken)

    print("Initialize loanTokenAddress ")
    calldata = loanToken.initialize(loanTokenAddress, loanTokenName, loanTokenSymbol)#symbol and name might be mixed up
    # note: copied initialize  function from token settings to loan token - might cause problems later on
    loanTokenAddr = loanToken.loanTokenAddress()
    print(loanTokenAddr)

    #setting the logic ABI for the loan token contract
    loanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=acct)
    print("Setting up pool params on protocol.")
    
    if(acct == sovryn.owner()):
        sovryn.setLoanPool(
            [loanToken.address],
            [loanTokenAddress]
        )
    else:
        input = sovryn.setLoanPool.encode_input(
            [loanToken.address],
            [loanTokenAddress]
        )
        tx = multisig.submitTransaction(sovryn.address,0,input)
        txId = tx.events["Submission"]["transactionId"]
        print('confirm following txId to set loan pool:', txId)
        

    if not collateralAddresses:
        collateralAddresses = []

    constants = shared.Constants()

    print("Setting up margin pool params on loan token.")

    params = []
    
    for collateralAddress in collateralAddresses:
        data = [
            b"0x0", ## id
            False, ## active
            str(acct), ## owner
            constants.ZERO_ADDRESS, ## loanToken -> will be overwritten
            collateralAddress, ## collateralToken.
            Wei("20 ether"), ## minInitialMargin -> 20% (allows up to 5x leverage)
            Wei("15 ether"), ## maintenanceMargin -> 15%, below liquidation
            0 ## fixedLoanTerm -> will be overwritten with 28 days
        ]

        params.append(data)

    #configure the token settings, and set the setting contract address at the loan token logic contract
    tx = loanToken.setupLoanParams(params, False)
    #print(tx.info())

    print("Setting up torque pool params")

    params = []

    for collateralAddress in collateralAddresses:
        data = [
            b"0x0", ## id
            False, ## active
            str(acct), ## owner
            constants.ZERO_ADDRESS, ## loanToken -> will be overwritten
            collateralAddress, ## collateralToken.
            Wei("50 ether"), ## minInitialMargin -> 20% (allows up to 5x leverage)
            Wei("15 ether"), ## maintenanceMargin -> 15%, below liquidation
            0 ## fixedLoanTerm -> will be overwritten with 28 days
        ]

        params.append(data)

    #configure the token settings, and set the setting contract address at the loan token logic contract
    tx = loanToken.setupLoanParams(params, True)
    #print(tx.info())

    print("setting up interest rates")

    setupLoanTokenRates(acct, loanToken.address, loanTokenLogicAddress)

    return (loanToken, '')

'''
sets up the interest rates
'''
def setupLoanTokenRates(acct, loanTokenAddress, logicAddress):
    baseRate = 1e18
    rateMultiplier = 10e18
    targetLevel=0
    kinkLevel=90*10**18
    maxScaleRate=100*10**18
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    localLoanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier, targetLevel, kinkLevel, maxScaleRate)
    borrowInterestRate = localLoanToken.borrowInterestRate()
    print("borrowInterestRate: ",borrowInterestRate)

'''
test the loan token contract by entering and closing a trade position
'''
def testDeployment(acct, sovryn, loanTokenAddress, underlyingToken, collateralToken, loanTokenSent, value):

    print('\n TESTING THE DEPLOYMENT')
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    if(value == 0):
        underlyingToken.approve(loanToken.address, loanTokenSent)
    
    
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        2e18, # leverageAmount
        loanTokenSent, #loanTokenSent
        0, # no collateral token sent
        collateralToken.address, #collateralTokenAddress
        acct, #trader, 
        b'', #loanDataBytes (only required with ether)
        {'value': value}
    )
    tx.info()

    loanId = tx.events['Trade']['loanId']
    collateral = tx.events['Trade']['positionSize']
    print("closing loan with id", loanId)
    print("position size is ", collateral)
    tx = sovryn.closeWithSwap(loanId, acct, collateral, True, b'')

'''
test the affiliate margin trade by entering and closing a trade position
'''
def testAffiliatesIntegration(acct, sovryn, loanTokenAddress, underlyingToken, collateralToken, loanTokenSent, value):
    print('\n TESTING THE AFFILIATES INTEGRATION')
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    if(value == 0):
        underlyingToken.approve(loanToken.address, loanTokenSent)
    
    referrerAddress = accounts[9]
    print('\n Referrer address : ', referrerAddress)
    previousAffiliatesRewardBalanceOnChain = sovryn.affiliatesReferrerBalances(referrerAddress, underlyingToken)
    previousBalanceInTokenContract = underlyingToken.balanceOf(referrerAddress)
    
    tx = loanToken.marginTradeAffiliate(
        "0", #loanId  (0 for new loans)
        2e18, # leverageAmount
        loanTokenSent, #loanTokenSent
        0, # no collateral token sent
        collateralToken.address, #collateralTokenAddress
        acct, #trader, 
        referrerAddress,
        b'', #loanDataBytes (only required with ether)
        {'value': value}
    )
    tx.info()

    # Check if the referrer is correct
    print("\n--- CHECK REFERRER ---")
    referrerOnChain = sovryn.affiliatesUserReferrer(acct)
    if referrerOnChain != referrerAddress:
        raise Exception("Referrer is not match!")
    print("Check Referrer -- Passed")

    print("\n--- CHECK TRADER NOT FIRST TRADE FLAG (MUST BE TRUE) ---")
    notFirstTradeFlagOnChain = sovryn.getUserNotFirstTradeFlag(acct)
    if notFirstTradeFlagOnChain == False:
        raise Exception("Failed to change user first trade flag")
    print("Check First Trade Flag -- Passed")

    print("\n--- CHECK AFFILIATE REWARD BALANCE ---")
    submittedAffiliatesReward = tx.events['PayTradingFeeToAffiliate']['fee']
    affiliatesRewardBalanceOnChain = sovryn.affiliatesReferrerBalances(referrerAddress, underlyingToken)
    if affiliatesRewardBalanceOnChain - previousAffiliatesRewardBalanceOnChain != submittedAffiliatesReward:
        raise Exception("Affiliates reward is invalid")
    print("Check affiliate reward balance -- Passed with value (" , submittedAffiliatesReward , " & " , affiliatesRewardBalanceOnChain , ")\n")

    loanId = tx.events['Trade']['loanId']
    collateral = tx.events['Trade']['positionSize']
    print("closing loan with id", loanId)
    print("position size is ", collateral)
    tx = sovryn.closeWithSwap(loanId, acct, collateral, True, b'')

    latestAffiliateBalanceBeforeWithdrawal = sovryn.affiliatesReferrerBalances(referrerAddress, underlyingToken)
    previousBalanceInTokenContract = underlyingToken.balanceOf(referrerAddress)

    print("\n-- TEST WITHDRAW AFFILIATE BALANCE ---")
    withdrawAffiliateBalanceTx = sovryn.withdrawAffiliatesReferrerTokenFees(underlyingToken, referrerAddress, affiliatesRewardBalanceOnChain, {'from': referrerAddress})
    withdrawAffiliateBalanceTx.info

    print("\n--- CHECK REST BALANCE IN AFFILIATE CONTRACT ---")
    restAffiliateBalance = sovryn.affiliatesReferrerBalances(referrerAddress, underlyingToken)
    print("\nLatest affiliate balance: ", latestAffiliateBalanceBeforeWithdrawal)
    print("Withdrawn token: ", affiliatesRewardBalanceOnChain)
    print("Rest Balance", restAffiliateBalance)
    if latestAffiliateBalanceBeforeWithdrawal - affiliatesRewardBalanceOnChain != restAffiliateBalance:
        raise Exception("Rest token amount after withdrawal in affiliate contract is not matched")

    print("\n--- CHECK TOKEN BALANCE IN TOKEN CONTRACT ---")
    balanceInTokenContract = underlyingToken.balanceOf(referrerAddress)
    print("\nPrevious balance in token contract: ", previousBalanceInTokenContract)
    print("Withdrawn token: ", affiliatesRewardBalanceOnChain)
    print("Latest balance in token contract: ", balanceInTokenContract)
    if balanceInTokenContract - previousBalanceInTokenContract != affiliatesRewardBalanceOnChain:
        raise Exception("Withdrawn token amount in token contract is not matched")

    print("\n--- TEST WITHDRAW ALL AFFILIATE BALANCES ---")
    withdrawAffiliateBalanceTx = sovryn.withdrawAllAffiliatesReferrerTokenFees(referrerAddress, {'from': referrerAddress})
    withdrawAffiliateBalanceTx.info

    print("\n--- CHECK REST BALANCE AFTER WITHDRAW ALL ---")
    restTokenAddresses, restTokenBalances = sovryn.getAffiliatesReferrerBalances(referrerAddress)
    if len(restTokenAddresses) > 0 or len(restTokenBalances) > 0:
        raise Exception("Rest affiliates balance must be empty after user withdraw all of the affiliate balances")
    print("--- passed ---")

    print("\n--- CHECK TOKEN BALANCE AFTER WITHDRAW ALL ---")
    latestBalanceInTokenContract = underlyingToken.balanceOf(referrerAddress)
    print("Previous balance in token contract: ", balanceInTokenContract)
    print("Withdrawn token: ", restAffiliateBalance)
    print("Latest balance in token contract: ", latestBalanceInTokenContract)
    if latestBalanceInTokenContract != restAffiliateBalance + balanceInTokenContract:
        raise Exception("Rest token amount in token contract is not matched after withdraw all")