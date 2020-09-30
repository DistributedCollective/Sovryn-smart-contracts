#!/usr/bin/python3

import pytest
from brownie import reverts


@pytest.fixture()
def set_oracle(PriceFeedsMoC, BZRX, PriceFeeds, WRBTC, accounts, sovryn, swapsImpl, SUSD):
    def internal_set_oracle(oracle_address=sovryn.address):
        price_feeds_moc = accounts[0].deploy(PriceFeedsMoC, oracle_address)
        price_feeds = accounts[0].deploy(PriceFeeds, WRBTC.address, BZRX.address, SUSD.address)

        price_feeds.setPriceFeed([BZRX.address, WRBTC.address], [price_feeds_moc.address, price_feeds_moc.address])

        sovryn.setPriceFeedContract(
            price_feeds.address  # priceFeeds
        )

        sovryn.setSwapsImplContract(
            swapsImpl.address  # swapsImpl
        )

        return price_feeds, price_feeds_moc

    return internal_set_oracle


@pytest.fixture()
def pice_feed_moc_mockup(accounts, PriceFeedsMoCMockup):
    price_feeds_moc_mockup = accounts[0].deploy(PriceFeedsMoCMockup)
    price_feeds_moc_mockup.setHas(True)
    price_feeds_moc_mockup.setValue(1e22)
    return price_feeds_moc_mockup


def test_moc_oracle_integration(set_oracle, BZRX, WRBTC, pice_feed_moc_mockup):
    price_feeds,  price_feeds_moc = set_oracle(pice_feed_moc_mockup.address)

    res = price_feeds.queryPrecision(BZRX.address, WRBTC.address)
    assert(res == 1e18)
    
    res = price_feeds_moc.latestAnswer()
    assert(res == 1e22)


def test_set_moc_oracle_address(set_oracle, accounts, BZRX):
    _, price_feeds_moc = set_oracle()

    res = price_feeds_moc.setMoCOracleAddress(BZRX.address)
    res.info()

    set_event = res.events['SetMoCOracleAddress']
    assert(set_event['mocOracleAddress'] == BZRX.address)
    assert(set_event['changerAddress'] == accounts[0].address)
    assert(price_feeds_moc.mocOracleAddress() == BZRX.address)


def test_set_moc_oracle_address_unauthorized_user_should_fail(set_oracle, accounts, BZRX):
    _, price_feeds_moc = set_oracle()

    with reverts("unauthorized"):
        price_feeds_moc.setMoCOracleAddress(BZRX.address, {"from": accounts[1]})
