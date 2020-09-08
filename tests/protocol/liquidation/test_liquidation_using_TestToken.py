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
@pytest.mark.parametrize('rate', [1e21, 6.7e21])
def test_liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WBTC):
    liquidate(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, rate, WBTC)
    
'''
Test if fails when the position is healthy currentMargin > maintenanceRate
'''  
def test_liquidate_healthy_position_should_fail(accounts, loanToken, SUSD, set_demand_curve, RBTC, WBTC, sovryn, priceFeeds):
    liquidate_healthy_position_should_fail(accounts, loanToken, SUSD, set_demand_curve, RBTC, sovryn, priceFeeds, WBTC)