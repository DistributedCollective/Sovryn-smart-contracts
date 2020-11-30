from brownie import *
from scripts.addLoanToken.add_loanToken import addLoanToken

import shared
import json
from munch import Munch

def main():
    print('\n DEPLOYING BPro and iBPro')
    with open('./scripts/swapTest/swap_test.json') as config_file:
        swapTestData = json.load(config_file)
    mocStateAddress = swapTestData["mocState"]
    addLoanToken("BPro", "BPro", 18, 1e50, "iBPro", "iBPro", 1e18, 5e17, 5e17, 1e16, BProPriceFeed, mocStateAddress)
