#!/usr/bin/python3

import pytest
from brownie import Wei, reverts

@pytest.fixture(scope="module", autouse=True)
def loanSettings(LoanSettings, accounts, sovryn, WETH, BZRX):
    sovryn.replaceContract(accounts[0].deploy(LoanSettings, WETH.address, BZRX.address).address)

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


def test_setup_removeLoanParams(Constants, sovryn, accounts, SUSD, WETH, loanParamsId, loanParams):
    loanParamsAfter = sovryn.getLoanParams([loanParamsId])[0]
    loanParamsAfter = dict(zip(list(loanParams.keys()), loanParamsAfter))
    print(loanParamsAfter)

    assert(loanParamsAfter["id"] != "0x0")
    assert(loanParamsAfter["active"])
    assert(loanParamsAfter["owner"] == accounts[0])
    assert(loanParamsAfter["loanToken"] == SUSD.address)

    with reverts("unauthorized owner"):
        sovryn.disableLoanParams([loanParamsId], { "from": accounts[1] })

    sovryn.disableLoanParams([loanParamsId], { "from": accounts[0] })
    assert(sovryn.getLoanParams([loanParamsId])[0][0] != "0x0")


def test_setup_removeLoanOrder(Constants, sovryn, accounts, SUSD, WETH, loanParamsId, loanParams):
    loanParamsAfter = sovryn.getLoanParams([loanParamsId])[0]
    loanParamsAfter = dict(zip(list(loanParams.keys()), loanParamsAfter))
    print(loanParamsAfter)

    assert(loanParamsAfter["id"] != "0x0")
    assert(loanParamsAfter["active"])
    assert(loanParamsAfter["owner"] == accounts[0])
    assert(loanParamsAfter["loanToken"] == SUSD.address)

    with reverts("unauthorized owner"):
        sovryn.disableLoanParams([loanParamsId], { "from": accounts[1] })

    sovryn.disableLoanParams([loanParamsId], { "from": accounts[0] })
    assert(sovryn.getLoanParams([loanParamsId])[0][0] != "0x0")


def test_disableLoanParams(sovryn, accounts, SUSD, WETH, loanParamsId, loanParams):
    sovryn.disableLoanParams([loanParamsId], { "from": accounts[0] })
    loanParamsAfter = sovryn.getLoanParams([loanParamsId])[0]
    loanParamsAfter = dict(zip(list(loanParams.keys()), loanParamsAfter))
    print("loanParamsAfter", loanParamsAfter)
    assert(loanParamsAfter["id"] != "0x0")
    assert(loanParamsAfter["active"] == False) # False because we disabled Loan Param just before
    assert(loanParamsAfter["owner"] == accounts[0])
    assert(loanParamsAfter["loanToken"] == SUSD.address)
    assert(loanParamsAfter["collateralToken"] == WETH.address)
    assert(loanParamsAfter["initialMargin"] == Wei("50 ether"))
    assert(loanParamsAfter["maintenanceMargin"] == Wei("15 ether"))
    assert(loanParamsAfter["fixedLoanTerm"] == "2419200")


def test_getLoanParams(sovryn, accounts, SUSD, WETH, loanParamsId, loanParams):
    loanParamsAfter = sovryn.getLoanParams([loanParamsId])[0]
    loanParamsAfter = dict(zip(list(loanParams.keys()), loanParamsAfter))
    print("loanParamsAfter", loanParamsAfter)
    assert(loanParamsAfter["id"] != "0x0")
    assert(loanParamsAfter["active"])
    assert(loanParamsAfter["owner"] == accounts[0])
    assert(loanParamsAfter["loanToken"] == SUSD.address)
    assert(loanParamsAfter["collateralToken"] == WETH.address)
    assert(loanParamsAfter["initialMargin"] == Wei("50 ether"))
    assert(loanParamsAfter["maintenanceMargin"] == Wei("15 ether"))
    assert(loanParamsAfter["fixedLoanTerm"] == "2419200")


def test_getLoanParamsList(sovryn, accounts, loanParamsId, loanParams):
    loanParamsList = sovryn.getLoanParamsList(accounts[0], 0, 1)
    assert(loanParamsList[0] == loanParamsId)


def test_getTotalPrincipal(Constants, sovryn, accounts, SUSD, WETH, RBTC, loanParamsId, loanParams):
    totalPrincipal = sovryn.getTotalPrincipal(accounts[0], SUSD.address)
    print("totalPrincipal", totalPrincipal)
    assert(totalPrincipal == 0)
