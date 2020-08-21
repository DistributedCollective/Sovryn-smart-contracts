#!/usr/bin/python3

import pytest
from brownie import Wei, reverts

@pytest.fixture(scope="module", autouse=True)
def loanSettings(LoanSettings, accounts, sovryn):
    sovryn.replaceContract(accounts[0].deploy(LoanSettings).address)

@pytest.fixture(scope="module", autouse=True)
def loanParamsId(accounts, sovryn, loanParams):
    tx = sovryn.setupLoanParams([list(loanParams.values())])
    loanParamsId = tx.events["LoanParamsIdSetup"][0]["id"]
    return loanParamsId

@pytest.fixture(scope="module", autouse=True)
def loanParams(accounts, sovryn, WETH, SUSD, Constants):
    loanParams = {
        "id": "0x0",
        "active": False,
        "owner": Constants["ZERO_ADDRESS"],
        "loanToken": SUSD.address,
        "collateralToken": WETH.address,
        "initialMargin": Wei("50 ether"),
        "maintenanceMargin": Wei("15 ether"),
        "fixedLoanTerm": "2419200"
    }
    return loanParams

def test_disableUnauthorizedOwnerLoanSettings(sovryn, accounts, SUSD, loanParamsId,):
    with reverts("unauthorized owner"):
        sovryn.disableLoanParams([loanParamsId], { "from": accounts[1] })

def test_LoanSettings_loanParamAlreadyExists(sovryn, accounts, SUSD, loanParamsId, loanParams):
    with reverts("loanParams exists"):
        sovryn.setupLoanParams([list(loanParams.values()), list(loanParams.values())])

def test_LoanSettings_otherRequires(sovryn, accounts, SUSD, loanParamsId, loanParams, Constants):

    localLoanParams = loanParams.copy()
   
    localLoanParams["loanToken"] = Constants["ZERO_ADDRESS"]
    print("localLoanParams",localLoanParams)
    with reverts("invalid params"):
        sovryn.setupLoanParams([list(localLoanParams.values())])
 
    localLoanParams = loanParams.copy()
    localLoanParams["collateralToken"] = Constants["ZERO_ADDRESS"]
    with reverts("invalid params"):
        sovryn.setupLoanParams([list(localLoanParams.values())])

    localLoanParams = loanParams.copy()
    localLoanParams["initialMargin"] = "10 ether"
    with reverts("invalid params"):
        sovryn.setupLoanParams([list(localLoanParams.values())])

    localLoanParams = loanParams.copy()
    localLoanParams["fixedLoanTerm"] = 1
    with reverts("invalid params"):
        sovryn.setupLoanParams([list(localLoanParams.values())])
