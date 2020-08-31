#!/usr/bin/python3

import pytest
from brownie import Wei, reverts

@pytest.fixture(scope="module", autouse=True)
def loanSettings(LoanSettings, accounts, sovryn):
    sovryn.replaceContract(accounts[0].deploy(LoanSettings).address)

def test_setupLoanParamsEvents(Constants, sovryn, accounts, SUSD, WBTC):
    loanParams = {
        "id": "0x0",
        "active": False,
        "owner": Constants["ZERO_ADDRESS"],
        "loanToken": SUSD.address,
        "collateralToken": WBTC.address,
        "initialMargin": Wei("50 ether"),
        "maintenanceMargin": Wei("15 ether"),
        "fixedLoanTerm": "2419200"
    }

    tx = sovryn.setupLoanParams([list(loanParams.values())])
    print("tx.events", tx.events)

    loanParamsIdSetup = tx.events["LoanParamsIdSetup"][0] 
    assert(loanParamsIdSetup[0]["id"] != "0x0")
    assert(loanParamsIdSetup[0]["owner"] == accounts[0])

    loanParamsSetup = tx.events["LoanParamsSetup"][0] 
    assert(loanParamsSetup["id"] != "0x0") 
    assert(loanParamsSetup["owner"] == accounts[0])
    assert(loanParamsSetup["loanToken"] == SUSD.address)
    assert(loanParamsSetup["collateralToken"] == WBTC.address)
    assert(loanParamsSetup["minInitialMargin"] == Wei("50 ether"))
    assert(loanParamsSetup["maintenanceMargin"] == Wei("15 ether"))
    assert(loanParamsSetup["maxLoanTerm"] == "2419200")

def test_disableLoanParamsEvents(Constants, sovryn, accounts, SUSD, WBTC):
    loanParams = {
        "id": "0x0",
        "active": False,
        "owner": Constants["ZERO_ADDRESS"],
        "loanToken": SUSD.address,
        "collateralToken": WBTC.address,
        "initialMargin": Wei("50 ether"),
        "maintenanceMargin": Wei("15 ether"),
        "fixedLoanTerm": "2419200"
    }
    txsetupLoanParams = sovryn.setupLoanParams([list(loanParams.values())])
    loanParamsId = txsetupLoanParams.events["LoanParamsIdSetup"][0]["id"]
    
    print("loanParamsId", loanParamsId)
    tx = sovryn.disableLoanParams([loanParamsId], { "from": accounts[0] })
    print("tx.events", tx)

    loanParamsIdDisabled = tx.events["LoanParamsIdDisabled"][0] 
    assert(loanParamsIdDisabled[0]["id"] != "0x0")
    assert(loanParamsIdDisabled[0]["owner"] == accounts[0])

    loanParamsDisabled = tx.events["LoanParamsDisabled"][0] 
    assert(loanParamsDisabled["id"] != "0x0") 
    assert(loanParamsDisabled["owner"] == accounts[0])
    assert(loanParamsDisabled["loanToken"] == SUSD.address)
    assert(loanParamsDisabled["collateralToken"] == WBTC.address)
    assert(loanParamsDisabled["minInitialMargin"] == Wei("50 ether"))
    assert(loanParamsDisabled["maintenanceMargin"] == Wei("15 ether"))
    assert(loanParamsDisabled["maxLoanTerm"] == "2419200")
