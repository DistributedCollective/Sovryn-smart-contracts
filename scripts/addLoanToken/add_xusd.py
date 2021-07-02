from brownie import *
import shared
import json
from munch import Munch
from scripts.deployment.deploy_loanToken import deployLoanToken
from scripts.utils import * 

'''
Deploying a new loan token and doing the required setup.
Steps:
1. Deploy the new contract using the deploy_loantoken script
2. Set the underlying address as a supported token for the sovryn protocol
3. Set the price feed contract (first deploy a new one if required)
4. Set the token as valid collateral at other loan tokens
'''
def main():
    global multisig, sovryn, contracts, acct

    thisNetwork = network.show_active()
    if thisNetwork == "testnet":
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")
    
    contracts = json.load(configFile)
    acct = accounts.load("rskdeployer")
    multisig = Contract.from_abi("MultiSig", address=contracts["multisig"], abi=MultiSigWallet.abi, owner=acct)
    sovryn = Contract.from_abi("Sovryn", address=contracts['sovrynProtocol'], abi=interface.ISovrynBrownie.abi, owner=acct)
    
    deployLoanToken(
        acct, #deployer
        sovryn, #sovryn protocol
        contracts['XUSD'], #underlying token
        'iXUSD', #symbol
        'iXUSD', #name
        [contracts['WRBTC'], contracts['BPro'], contracts['DoC']], #array of collateral addresses
        contracts['WRBTC'], #wrbtc address
        multisig, #multisig contract if existing
        contracts['LoanTokenLogicStandard'], #loan token logic address if existing
        6e18, #base rate
        15e18, #rateMultiplier
        75e18, #kinkLevel
        150e18) # scaleRate
    
    
    data = sovryn.setSupportedTokens.encode_input([contracts['XUSD']],[True])
    sendWithMultisig(multisig.address, sovryn.address, data, acct)

    feeds = Contract.from_abi("PriceFeeds", address= contracts['PriceFeeds'], abi = PriceFeeds.abi, owner = acct)
    priceFeed = feeds.pricesFeeds(contracts['USDT'])
    data = feeds.setPriceFeed.encode_input([contracts['XUSD']], [priceFeed])
    sendWithMultisig(multisig.address, feeds.address, data, acct)
    
    setupLoanParams()



'''
sets the loan params for borrowing and lending for all other lending pools
'''
def setupLoanParams():
    setupSingleLoanParams(contracts['iRBTC'])
    setupSingleLoanParams(contracts['iBPro'])
    setupSingleLoanParams(contracts['iDOC'])

def setupSingleLoanParams(loanTokenAddress):
    loanToken = Contract.from_abi("loanToken", address=loanTokenAddress, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    params = []
    setup = [
        b"0x0", ## id
        False, ## active
        multisig.address, ## owner
        "0x0000000000000000000000000000000000000000", ## loanToken -> will be overwritten
        contracts['XUSD'], ## collateralToken.
        Wei("20 ether"), ## minInitialMargin
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm -> will be overwritten
    ]
    params.append(setup)

    data = loanToken.setupLoanParams.encode_input(params, False)
    sendWithMultisig(multisig.address, loanToken.address, data, acct)

    params = []
    setup[5] = Wei("50 ether")

    params.append(setup)

    data = loanToken.setupLoanParams.encode_input(params, True)
    sendWithMultisig(multisig.address, loanToken.address, data, acct)
