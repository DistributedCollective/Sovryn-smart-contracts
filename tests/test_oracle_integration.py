#!/usr/bin/python3

import pytest
from brownie import reverts


@pytest.fixture()
def set_oracle(PriceFeedsMoC, BZRX, PriceFeeds, WBTC, accounts, sovryn, swapsImpl):
    def internal_set_oracle(oracle_address=sovryn.address):
        price_feeds_moc = accounts[0].deploy(PriceFeedsMoC, oracle_address)
        price_feeds = accounts[0].deploy(PriceFeeds, WBTC.address, BZRX.address)

        price_feeds.setPriceFeed([BZRX.address, WBTC.address], [price_feeds_moc.address, price_feeds_moc.address])

        sovryn.setPriceFeedContract(
            price_feeds.address  # priceFeeds
        )

        sovryn.setSwapsImplContract(
            swapsImpl.address  # swapsImpl
        )

        return price_feeds, price_feeds_moc

    return internal_set_oracle


@pytest.fixture()
def pice_feed_moc_mockup(PriceFeedsMoCMockup):
    price_feeds_moc_mockup = PriceFeedsMoCMockup
    price_feeds_moc_mockup.setHas(True)
    price_feeds_moc_mockup.setValue()


def test_moc_oracle_integration(set_oracle, BZRX, WBTC):
    price_feeds, _ = set_oracle()

    res = price_feeds.queryPrecision(BZRX.address, WBTC.address)
    assert(res > 0)


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
