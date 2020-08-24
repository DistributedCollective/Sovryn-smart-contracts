#!/usr/bin/python3

from brownie import *
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract

import shared
from munch import Munch




def main():
    deployLoanToken()

def deployLoanToken():
    global deploys, sovryn, tokens, constants, addresses, thisNetwork, acct

    thisNetwork = network.show_active()

    if thisNetwork != "testnet":
        raise Exception("Only RSK testnet supported")
    else : ## thisNetwork == "testnet":
        acct = accounts.load("rskdeployer")
        #careful: hardcoded
        collateralToken = "0x48f7B0E6f3994Ae486a86F03BEbbEA8ae5D3b2f5"

    print("Loaded account",acct)
    
    print("Deploying LoanTokenLogicStandard   - careful: hardcoded sovryn and WEth contracts.")
    loanTokenLogic = acct.deploy(LoanTokenLogicStandard)
    _add_contract(loanTokenLogic)

    
    print("Deploying LoanTokenSettingsLowerAdmin ")
    loanTokenSettings = acct.deploy(LoanTokenSettingsLowerAdmin)
    _add_contract(loanTokenSettings)
    
    print("Deploying loan token using the loan logic as target for delegate calls")
    loanToken = acct.deploy(LoanToken, loanTokenLogic.address)
    _add_contract(loanToken)
    
    print("Initialize loanTokenAddress ")
    calldata = loanToken.initialize("0x48f7B0E6f3994Ae486a86F03BEbbEA8ae5D3b2f5", "DAI", "DAI")
    # note: copied initialize  function from token settings to loan token - might cause problems later on
    loanTokenAddress = loanToken.loanTokenAddress()
    print(loanTokenAddress)
    
    #setting the logic ABI for the loan token contract
    #loanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenSettingsLowerAdmin.abi, owner=acct)
    loanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=acct)
    
    print("Setting up Fulcrum.")
    
    constants = shared.Constants()
    params = [];
    
    data = [
        b"0x0", ## id
        False, ## active
        str(acct), ## owner
        constants.ZERO_ADDRESS, ## loanToken
        collateralToken, ## collateralToken. 
        Wei("20 ether"), ## minInitialMargin
        Wei("15 ether"), ## maintenanceMargin
        0 ## fixedLoanTerm
    ]
    
    
    params.append(data)
    
    #configure the token settings
    calldata = loanTokenSettings.setupMarginLoanParams.encode_input(params)
    
    #print(calldata)
    
    #set the setting contract address at the loan token logic contract (need to load the logic ABI in line 171 to work)
    tx = loanToken.updateSettings(loanTokenSettings.address, calldata, { "from": acct })
    print(tx.info())
  