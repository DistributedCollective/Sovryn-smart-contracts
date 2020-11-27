import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared

def test_modifying_name_and_symbol(accounts, loanToken, loanTokenLogic, name, symbol, LoanToken, LoanTokenLogicStandard):
    
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanToken.abi, owner=accounts[0])
    localLoanToken.setTarget(loanTokenLogic.address)
    localLoanToken = Contract.from_abi("loanToken", address=loanToken.address, abi=LoanTokenLogicStandard.abi, owner=accounts[0])
    
    localLoanToken.changeLoanToken(name, symbol)

    assert(localLoanToken.name() == name)
    assert(localLoanToken.symbol() == symbol)
