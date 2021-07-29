const { assert, expect } = require("chai");

const { BN, constants, balance, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const sovrynProtocol = artifacts.require("sovrynProtocol");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const ISovryn = artifacts.require("ISovryn");
const TestToken = artifacts.require("TestToken");
const LockedSOV = artifacts.require("LockedSOVMockup");

contract("Affliates", (accounts) => {
	beforeEach(async () => {
		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);
		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.setSovrynProtocolAddress(sovrynproxy.address);
	});
	it("Saves Sovryn Proxy Address correctly", async () => {
		assert.equal(await sovryn.getProtocolAddress(), sovryn.address);
		//assert.equal(loanTokenAddress, doc.address, "Doc address not set yet");
	});

	// Should successfully set the sov token address
	it("Test set sov token addres", async () => {
		const sov = await TestToken.new("Sovryn", "SOV", 18, new BN(10).pow(new BN(50)));

		// Should revert if set with non owner
		await expectRevert(sovryn.setSOVTokenAddress(constants.ZERO_ADDRESS, { from: accounts[1] }), "unauthorized");
		await expectRevert(sovryn.setSOVTokenAddress(constants.ZERO_ADDRESS), "newSovTokenAddress not a contract");

		await sovryn.setSOVTokenAddress(sov.address);
		expect((await sovryn.getSovTokenAddress()) == sov.address).to.be.true;
	});

	// Should successfully set the locked SOV address
	it("Test set sov token address", async () => {
		const sov = await TestToken.new("Sovryn", "SOV", 18, new BN(10).pow(new BN(50)));
		const lockedSOV = await LockedSOV.new(sov.address, [accounts[0]]);

		// Should revert if set with non owner
		await expectRevert(sovryn.setLockedSOVAddress(constants.ZERO_ADDRESS, { from: accounts[1] }), "unauthorized");
		await expectRevert(sovryn.setLockedSOVAddress(constants.ZERO_ADDRESS), "newLockSOVAddress not a contract");

		await sovryn.setLockedSOVAddress(lockedSOV.address);
		expect((await sovryn.getLockedSOVAddress()) == lockedSOV.address).to.be.true;
	});

	// Should successfully set the Affiliate Fee Percent
	it("Test set affiliate fee percent", async () => {
		const affiliateFeePercent = web3.utils.toWei("20", "ether");
		const invalidAffiliateFeePercent = web3.utils.toWei("101", "ether");
		// Should revert if set with non owner
		await expectRevert(sovryn.setAffiliateFeePercent(affiliateFeePercent, { from: accounts[1] }), "unauthorized");
		// Should revert if value too high
		await expectRevert(sovryn.setAffiliateFeePercent(invalidAffiliateFeePercent), "value too high");

		await sovryn.setAffiliateFeePercent(affiliateFeePercent);
		expect((await sovryn.affiliateFeePercent()).toString() == affiliateFeePercent).to.be.true;
	});

	// Should successfully set the Affiliate Trading Token Fee Percent
	it("Test set affiliate fee percent", async () => {
		// Should revert if set with non owner
		const affiliateTradingTokenFeePercent = web3.utils.toWei("20", "ether");
		const invalidAffiliateTradingTokenFeePercent = web3.utils.toWei("101", "ether");
		// Should revert if set with non owner
		await expectRevert(
			sovryn.setAffiliateTradingTokenFeePercent(affiliateTradingTokenFeePercent, { from: accounts[1] }),
			"unauthorized"
		);
		// Should revert if value too high
		await expectRevert(sovryn.setAffiliateTradingTokenFeePercent(invalidAffiliateTradingTokenFeePercent), "value too high");

		await sovryn.setAffiliateTradingTokenFeePercent(affiliateTradingTokenFeePercent);
		expect((await sovryn.affiliateTradingTokenFeePercent()).toString() == affiliateTradingTokenFeePercent).to.be.true;
	});
});
