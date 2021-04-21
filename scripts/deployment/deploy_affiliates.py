from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
from scripts.deployment.deploy_loanToken import deployLoanTokens
import shared
import json
from munch import Munch

'''
script to deploy the loan tokens. can be used to deploy loan tokens separately, but is also used by deploy_everything
if deploying separetly, the addresses of the existing contracts need to be set.
'''
def main():
    thisNetwork = network.show_active()
    ##Affiliates
    # == Load config =======================================================================================================================
    if thisNetwork == "development":
        acct = accounts[0]
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/testnet_contracts.json')
    elif thisNetwork == "rsk-mainnet":
        acct = accounts.load("rskdeployer")
        configFile =  open('./scripts/contractInteraction/mainnet_contracts.json')
    else:
        raise Exception("network not supported")

    # TODO check CSOV addresses in config files
    # load deployed contracts addresses
    contracts = json.load(configFile)
    protocolAddress = contracts['sovrynProtocol']

    tokens = Munch()
    if thisNetwork == "development":
        wrbtcAddress = '0x602C71e4DAC47a042Ee7f46E0aee17F94A3bA0B6'
        susdAddress = '0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87'
        protocolAddress = '0x2c15A315610Bfa5248E4CbCbd693320e9D8E03Cc'
        tokens.wrbtc = Contract.from_abi("TestWrbtc", address = wrbtcAddress, abi = TestWrbtc.abi, owner = acct)
        tokens.susd = Contract.from_abi("TestToken", address = susdAddress, abi = TestToken.abi, owner = acct)

    print("Deploying Affiliates.")
    affiliates = acct.deploy(Affiliates)
    print("Calling replaceContract.")
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=acct)
    sovryn.replaceContract(affiliates.address)

    # Test integration
    if thisNetwork == "development":
        (loanTokenSUSD, loanTokenWRBTC, loanTokenSettingsSUSD, loanTokenSettingsWRBTC) = deployLoanTokens(acct, sovryn, tokens)