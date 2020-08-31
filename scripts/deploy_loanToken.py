from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
import shared
from munch import Munch

'''
script to deploy the loan tokens. can be used to deploy loan tokens separately, but is also used by deploy_everything
if deploying separetly, the addresses of the existing contracts need to be set.
'''
def main():
    wethAddress = '0xc90bB9fEee164263709336C7e5E9F8e540fA3C6D'
    susdAddress = '0xE631653c4Dc6Fb98192b950BA0b598f90FA18B3E'
    rbtcAddress = '0xE53d858A78D884659BF6955Ea43CBA67c0Ae293F'
    protocolAddress = '0xBAC609F5C8bb796Fa5A31002f12aaF24B7c35818'
    
    thisNetwork = network.show_active()

    if thisNetwork == "development":
        acct = accounts[0]
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
    else:
        raise Exception("network not supported")
        
    tokens = Munch()
    tokens.weth = Contract.from_abi("TestToken", address = wethAddress, abi = TestToken.abi, owner = acct)
    tokens.susd = Contract.from_abi("TestToken", address = susdAddress, abi = TestToken.abi, owner = acct)
    tokens.rbtc = Contract.from_abi("TestToken", address = rbtcAddress, abi = TestToken.abi, owner = acct)
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovryn.abi, owner=acct)
    
    deployLoanTokens(acct, sovryn, tokens)

def deployLoanTokens(acct, sovryn, tokens):

    print('\n DEPLOYING ISUSD')
    contract = deployLoanToken(acct, sovryn, tokens.susd.address, "SUSD", "SUSD", tokens.rbtc.address, tokens.weth.address)
    print("initializing the lending pool with some tokens, so we do not run out of funds")
    tokens.susd.approve(contract.address,1e24) #1M $
    contract.mint(acct, 1e24)
    testDeployment(acct, sovryn,contract.address, tokens.susd, tokens.rbtc)
    
    print('\n DEPLOYING IRBTC')
    contract = deployLoanToken(acct, sovryn, tokens.rbtc.address, "RBTC", "RBTC", tokens.susd.address, tokens.weth.address)
    print("initializing the lending pool with some tokens, so we do not run out of funds")
    tokens.rbtc.approve(contract.address,1e20) #100 BTC 
    contract.mint(acct, 1e20)
    testDeployment(acct, sovryn, contract.address, tokens.rbtc, tokens.susd)

def deployLoanToken(acct, sovryn, loanTokenAddress, loanTokenSymbol, loanTokenName, collateralAddress, wethAddress):
    
    print("Deploying LoanTokenLogicStandard")
    loanTokenLogic = acct.deploy(LoanTokenLogicStandard)
    _add_contract(loanTokenLogic)

    
    print("Deploying LoanTokenSettingsLowerAdmin for above loan token")
    loanTokenSettings = acct.deploy(LoanTokenSettingsLowerAdmin)
    _add_contract(loanTokenSettings)
    
    print("Deploying loan token using the loan logic as target for delegate calls")
    loanToken = acct.deploy(LoanToken, loanTokenLogic.address, sovryn.address, wethAddress)
    _add_contract(loanToken)
    
    print("Initialize loanTokenAddress ")
    calldata = loanToken.initialize(loanTokenAddress, loanTokenName, loanTokenSymbol)#symbol and name might be mixed up
    # note: copied initialize  function from token settings to loan token - might cause problems later on
    loanTokenAddr = loanToken.loanTokenAddress()
    print(loanTokenAddr)
    
    #setting the logic ABI for the loan token contract
    #loanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)
    loanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    print("Setting up pool params on protocol.")
    
    sovryn.setLoanPool(
        [loanToken.address],
        [loanTokenAddress] 
    )
    
    print("Setting up margin pool params on loan token.")
    
    constants = shared.Constants()
    params = [];
    
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
    
    #configure the token settings
    calldata = loanTokenSettings.setupMarginLoanParams.encode_input(params)
    
    #print(calldata)
    
    #set the setting contract address at the loan token logic contract (need to load the logic ABI in line 171 to work)
    tx = loanToken.updateSettings(loanTokenSettings.address, calldata, { "from": acct })
    #print(tx.info())
    
    print("setting up interest rates")
    
    setupLoanTokenRates(acct, loanToken.address, loanTokenSettings.address, loanTokenLogic.address)
    
    return loanToken
    
def setupLoanTokenRates(acct, loanTokenAddress, settingsAddress, logicAddress):
    baseRate = 1e18
    rateMultiplier = 20.25e18
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    localLoanToken.setTarget(settingsAddress)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)
    localLoanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanToken.abi, owner=acct)
    localLoanToken.setTarget(logicAddress)
    localLoanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    borrowInterestRate = localLoanToken.borrowInterestRate()
    print("borrowInterestRate: ",borrowInterestRate)
    
    
def testDeployment(acct, sovryn, loanTokenAddress, underlyingToken, collateralToken):

    print('\n TESTING THE DEPLOYMENT')
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    
    loanTokenSent = 1e18
    underlyingToken.mint(acct,loanTokenSent)
    underlyingToken.approve(loanToken.address, loanTokenSent)
    
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        2e18, # leverageAmount
        loanTokenSent, #loanTokenSent
        0, # no collateral token sent
        collateralToken.address, #collateralTokenAddress
        acct, #trader, 
        b'' #loanDataBytes (only required with ether)
    )

    loanId = tx.events['Trade']['loanId']
    collateral = tx.events['Trade']['positionSize']
    print("closing loan with id", loanId)
    print("position size is ", collateral)
    tx = sovryn.closeWithSwap(loanId, acct, collateral, True, b'')

    
    

