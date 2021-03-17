from brownie import *
from scripts.addLoanToken.add_loanToken import addLoanToken

import shared
import json
from munch import Munch

def main():
    print('\n DEPLOYING SOV and iSOV')
    addLoanToken("SOV", "SOV", 18, 1e50, "iSOV", "iSOV", 1e17, 1000e18, 1000e18, 1e18, SOVPriceFeed)