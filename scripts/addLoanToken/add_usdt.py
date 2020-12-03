from brownie import *
from scripts.addLoanToken.add_loanToken import addLoanToken

import shared
import json
from munch import Munch

def main():
    print('\n DEPLOYING USDT and iUSDT')
    addLoanToken("USDT", "USDT", 18, 1e50, "iUSDT", "iUSDT", 1e17, 1000e18, 1000e18, 1e18, USDTPriceFeed)