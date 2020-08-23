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
def priceFeeds(accounts, WETH, SUSD, RBTC, BZRX, PriceFeeds, PriceFeedsLocal):
    if network.show_active() == "development":
        feeds = accounts[0].deploy(PriceFeedsLocal, WETH.address, BZRX.address)
        
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
        feeds = accounts[0].deploy(PriceFeeds, WETH.address, BZRX.address)
        #feeds.setPriceFeedsBatch(...)

    return feeds

@pytest.fixture(scope="module")
def swapsImpl(accounts, SwapsImplKyber, SwapsImplLocal, WETH, BZRX):
    if network.show_active() == "development":
        feeds = accounts[0].deploy(SwapsImplLocal, WETH.address, BZRX.address)
    else:
        feeds = accounts[0].deploy(SwapsImplKyber)
        #feeds.setPriceFeedsBatch(...)

    return feeds

@pytest.fixture(scope="module", autouse=True)
def sovryn(accounts, interface, sovrynProtocol, ProtocolSettings, LoanSettings, LoanMaintenance, WETH, BZRX):
    sovrynproxy = accounts[0].deploy(sovrynProtocol)
    sovryn = Contract.from_abi("sovryn", address=sovrynproxy.address, abi=interface.ISovryn.abi, owner=accounts[0])
    _add_contract(sovryn)
    
    sovryn.replaceContract(accounts[0].deploy(ProtocolSettings, WETH.address, BZRX.address).address)
    sovryn.replaceContract(accounts[0].deploy(LoanSettings, WETH.address, BZRX.address).address)
    sovryn.replaceContract(accounts[0].deploy(LoanMaintenance, WETH.address, BZRX.address).address)
    #sovryn.replaceContract(accounts[0].deploy(LoanOpenings).address)
    #sovryn.replaceContract(accounts[0].deploy(LoanClosings).address)
    
    return sovryn

@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    pass

@pytest.fixture(scope="module", autouse=True)
def WETH(module_isolation, accounts, TestWeth):
    yield accounts[0].deploy(TestWeth) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87

@pytest.fixture(scope="module", autouse=True)
def BZRX(module_isolation, accounts, TestWeth):
    yield accounts[0].deploy(TestWeth) ## 0x3194cBDC3dbcd3E11a07892e7bA5c3394048Cc87