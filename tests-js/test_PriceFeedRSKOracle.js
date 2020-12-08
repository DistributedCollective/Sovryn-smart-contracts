require('@openzeppelin/test-helpers/configure')({
    provider: web3.currentProvider,
    singletons: {
      abstraction: 'truffle',
    },
  });

const { expect } = require('chai');
const { BN, time } = require('@openzeppelin/test-helpers');

const { duration, latest, increase } = time;

const PriceFeedRSKOracle = artifacts.require('PriceFeedRSKOracle');

contract('PriceFeedRSKOracle', () => {
    let priceFeedRSKOracle;

    beforeEach(async () => {
        priceFeedRSKOracle = await PriceFeedRSKOracle.deployed();
    });

    it('should always return Price for latestAnswer', async () => {
        const price = await priceFeedRSKOracle.latestAnswer.call();

        expect(price).to.be.above(0, 'The price must be larger than 0');
        
        if (price > 0) {
            console.log('The price is:', price);}
    });

    it('should always return the current time for latestTimestamp', async () => {
        expect(await priceFeedRSKOracle.latestTimestamp.call()).to.be.bignumber.equal(await latest());

        await increase(duration.days(1));

        expect(await priceFeedRSKOracle.latestTimestamp.call()).to.be.bignumber.equal(await latest());
    });
});
