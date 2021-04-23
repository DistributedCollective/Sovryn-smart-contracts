from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract
from scripts.deployment.deploy_loanToken import deployLoanTokens
from scripts.deployment.deploy_everything import deployMoCMockup,deployRSKMockup
import shared
import json
from munch import Munch

'''
script to deploy the loan tokens. can be used to deploy loan tokens separately, but is also used by deploy_everything
if deploying separetly, the addresses of the existing contracts need to be set.
'''
def main():
    with open('./scripts/swapTest/swap_test.json') as config_file:
        data = json.load(config_file)

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
        wrbtcAddress = data['WRBTC']
        susdAddress = data['SUSD']
        protocolAddress = data['sovrynProtocol']
        sovTokenAddress = data['SOV']
        tokens.wrbtc = Contract.from_abi("TestWrbtc", address = wrbtcAddress, abi = TestWrbtc.abi, owner = acct)
        tokens.susd = Contract.from_abi("TestToken", address = susdAddress, abi = TestToken.abi, owner = acct)
    else:
        sovTokenAddress = contracts['SOV']


    print("Deploying Affiliates.")
    affiliates = acct.deploy(Affiliates)
    print("Calling replaceContract.")
    sovryn = Contract.from_abi("sovryn", address=protocolAddress, abi=interface.ISovrynBrownie.abi, owner=acct)
    sovryn.replaceContract(affiliates.address)

    sovToken = Contract.from_abi("SOV", address=sovTokenAddress, abi=SOV.abi, owner=acct)
    print("Set SOV Token address in protocol settings")
    sovryn.setSOVTokenAddress(sovToken.address)
    print("sovToken address loaded:", sovryn.sovTokenAddress())
    
    with open('./scripts/swapTest/swap_test.json', 'w') as configFile:
        json.dump(data, configFile)

    # Test integration
    if thisNetwork == "development":
        (loanTokenSUSD, loanTokenWRBTC, loanTokenSettingsSUSD, loanTokenSettingsWRBTC) = deployLoanTokens(acct, sovryn, tokens)