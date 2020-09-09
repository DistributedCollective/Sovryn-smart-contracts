'''
Should test the liquidation handling
1. Liquidate a position
2. Should fail to liquidate a healthy position
'''

import pytest
from brownie import Contract, Wei, reverts
from fixedint import *
import shared
from shared_liquidation_functions import * 

'''
Test with different rates so the currentMargin is <= liquidationIncentivePercent
or > liquidationIncentivePercent
liquidationIncentivePercent = 5e18 by default
'''
@pytest.mark.parametrize('rate', [1e23, 1.34e22])
def test_liquidate(accounts, loanTokenWRBTC, SUSD, set_demand_curve, WRBTC, sovryn, priceFeeds, rate):
    liquidate(accounts, loanTokenWRBTC, WRBTC, set_demand_curve, SUSD, sovryn, priceFeeds, rate, WRBTC)

'''
Test if fails when the position is healthy currentMargin > maintenanceRate
'''
def test_liquidate_healthy_position_should_fail(accounts, loanTokenWRBTC, SUSD, set_demand_curve, WRBTC, sovryn, priceFeeds):
    liquidate_healthy_position_should_fail(accounts, loanTokenWRBTC, WRBTC, set_demand_curve, SUSD, sovryn, priceFeeds, WRBTC)