#!/usr/bin/python3

import pytest
from brownie import Contract, network
from brownie.network.contract import InterfaceContainer
from brownie.network.state import _add_contract, _remove_contract

@pytest.fixture(scope="module")
def Constants():
    return {
        "ZERO_ADDRESS": "0x0000000000000000000000000000000000000000",
        "ONE_ADDRESS": "0x0000000000000000000000000000000000000001",
        "MAX_UINT": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    }

@pytest.fixture(scope="module")
def SUSD(accounts, TestToken):
    return accounts[0].deploy(TestToken, "SUSD", "SUSD", 18, 1e50)

@pytest.fixture(scope="module")
def RBTC(accounts, TestToken):
    return accounts[0].deploy(TestToken, "RBTC", "RBTC", 18, 1e50)

@pytest.fixture(scope="module")
def priceFeeds(accounts, WETH, SUSD, RBTC, PriceFeeds, PriceFeedsLocal):
    if network.show_active() == "development":
        feeds = accounts[0].deploy(PriceFeedsLocal)
        
        feeds.setRates(
            WETH.address,
            RBTC.address,
            0.34e18
        )
        feeds.setRates(
            WETH.address,
            SUSD.address,
            382e18
        )
        feeds.setRates(
            RBTC.address,
            SUSD.address,
            1e22
        )
    else:
        feeds = accounts[0].deploy(PriceFeeds)
        #feeds.setPriceFeedsBatch(...)

    return feeds

@pytest.fixture(scope="module")
def swapsImpl(accounts, SwapsImplKyber, SwapsImplLocal):
    if network.show_active() == "development":
        feeds = accounts[0].deploy(SwapsImplLocal)
    else:
        feeds = accounts[0].deploy(SwapsImplKyber)
        #feeds.setPriceFeedsBatch(...)

    return feeds

@pytest.fixture(scope="module", autouse=True)
def bzx(accounts, interface, bZxProtocol, ProtocolSettings, LoanSettings, LoanMaintenance):
    bzxproxy = accounts[0].deploy(bZxProtocol)
    bzx = Contract.from_abi("bzx", address=bzxproxy.address, abi=interface.IBZx.abi, owner=accounts[0])
    _add_contract(bzx)
    
    bzx.replaceContract(accounts[0].deploy(ProtocolSettings).address)
    bzx.replaceContract(accounts[0].deploy(LoanSettings).address)
    bzx.replaceContract(accounts[0].deploy(LoanMaintenance).address)
    #bzx.replaceContract(accounts[0].deploy(LoanOpenings).address)
    #bzx.replaceContract(accounts[0].deploy(LoanClosings).address)
    
    return bzx

@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    pass

@pytest.fixture(scope="module", autouse=True)
def WETH(module_isolation, accounts, TestWeth):
    yield accounts[0].deploy(TestWeth) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87

@pytest.fixture(scope="module", autouse=True)
def BZRX(module_isolation, accounts, TestWeth):
    yield accounts[0].deploy(TestWeth) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87