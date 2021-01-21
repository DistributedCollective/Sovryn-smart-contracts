const { accounts, contract, web3 } = require('@openzeppelin/test-environment');

require("@openzeppelin/test-helpers/configure")({
	provider: web3.currentProvider,
	singletons: {
		abstraction: "truffle",
	},
});

const { expect } = require('chai');
require('chai').should();

const { BN, time } = require("@openzeppelin/test-helpers");

const { duration, latest, increase } = time;

const PriceFeedRSKOracle = contract.fromArtifact("PriceFeedRSKOracle");
const PriceFeedRSKOracleMockup = contract.fromArtifact("PriceFeedRSKOracleMockup");

describe("PriceFeedRSKOracle", () => {
	let priceFeedRSKOracle;

	beforeEach(async () => {
		priceFeedRSKOracleMockup = await PriceFeedRSKOracleMockup.new();
		await priceFeedRSKOracleMockup.setValue(1);
		priceFeedRSKOracle = await PriceFeedRSKOracle.new(priceFeedRSKOracleMockup.address);
	});

	it("should always return Price for latestAnswer", async () => {
		const price = (await priceFeedRSKOracle.latestAnswer.call()).toNumber();

		expect(price).to.be.above(0, "The price must be larger than 0");

		if (price > 0) {
			console.log("The price is:", price);
		}
	});

	it("should always return the current time for latestTimestamp", async () => {
		expect(await priceFeedRSKOracle.latestTimestamp.call()).to.be.bignumber.equal(await latest());

		await increase(duration.days(1));

		expect(await priceFeedRSKOracle.latestTimestamp.call()).to.be.bignumber.equal(await latest());
	});
});
