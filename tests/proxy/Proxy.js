/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying proxy and
 * implementation on every test.
 *
 * Total time elapsed: 4.3s
 * After optimization: 4.1s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, expectEvent, constants, BN, balance, time } = require("@openzeppelin/test-helpers");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const Proxy = artifacts.require("ProxyMockup");
const Implementation = artifacts.require("ImplementationMockup");

contract("Proxy", (accounts) => {
	let account1;
	let accountOwner;

	let proxy;
	let implementation;

	async function deploymentAndInitFixture(_wallets, _provider) {
		proxy = await Proxy.new({ from: accountOwner });
		implementation = await Implementation.new({ from: accountOwner });
	}

	before(async () => {
		account1 = accounts[0];
		accountOwner = accounts[9];
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("setProxyOwner", async () => {
		it("Should be able to transfer ownership", async () => {
			let tx = await proxy.setProxyOwner(account1, { from: accountOwner });
			expectEvent(tx, "OwnershipTransferred", {
				_oldOwner: accountOwner,
				_newOwner: account1,
			});

			let owner = await proxy.getProxyOwner.call();
			expect(owner).to.be.equal(account1);
		});

		it("Only owner should be able to transfer ownership", async () => {
			await expectRevert(proxy.setProxyOwner(account1, { from: account1 }), "Proxy:: access denied");
		});

		it("Should not be able to set proxy owner to zero address", async () => {
			await expectRevert(proxy.setProxyOwner(ZERO_ADDRESS, { from: accountOwner }), "Proxy::setProxyOwner: invalid address");
		});
	});

	describe("setImplementation", async () => {
		it("Should be able to set implementation", async () => {
			let tx = await proxy.setImplementation(implementation.address, { from: accountOwner });
			expectEvent(tx, "ImplementationChanged", {
				_oldImplementation: ZERO_ADDRESS,
				_newImplementation: implementation.address,
			});

			let returnedImplementation = await proxy.getImplementation.call();
			expect(returnedImplementation).to.be.equal(implementation.address);
		});

		it("Only owner should be able to set implementation", async () => {
			await expectRevert(proxy.setImplementation(implementation.address, { from: account1 }), "Proxy:: access denied");
		});

		it("Should not be able to set implementation to zero address", async () => {
			await expectRevert(proxy.setImplementation(ZERO_ADDRESS, { from: accountOwner }), "Proxy::setImplementation: invalid address");
		});
	});

	describe("invoke an implementation", async () => {
		let value = "12345";

		it("Should be able invoke method of the implementation", async () => {
			await proxy.setImplementation(implementation.address, { from: accountOwner });
			proxy = await Implementation.at(proxy.address);

			let tx = await proxy.setValue(value, { from: accountOwner });
			expectEvent(tx, "ValueChanged", {
				value: value,
			});

			let savedValue = await proxy.getValue.call();
			expect(savedValue.toString()).to.be.equal(value);
		});

		it("Storage data should be the same after an upgrade", async () => {
			/// @dev For some reason (probably proxy conflict w/ waffle fixtures)
			/// resuming the fixture snapshot is not enough to run this test successfully
			/// It is additionaly required a proxy redeployment
			proxy = await Proxy.new({ from: accountOwner });
			await proxy.setImplementation(implementation.address, { from: accountOwner });
			proxy = await Implementation.at(proxy.address);

			await proxy.setValue(value, { from: accountOwner });

			let implementationNew = await Implementation.new({ from: accountOwner });
			proxy = await Proxy.at(proxy.address);
			await proxy.setImplementation(implementationNew.address, { from: accountOwner });
			proxy = await Implementation.at(proxy.address);

			let savedValue = await proxy.getValue.call();
			expect(savedValue.toString()).to.be.equal(value);
		});

		it("Should not be able to invoke not set implementation", async () => {
			/// @dev For some reason (probably proxy conflict w/ waffle fixtures)
			/// resuming the fixture snapshot is not enough to run this test successfully
			/// It is additionaly required a proxy redeployment
			proxy = await Proxy.new({ from: accountOwner });
			await Implementation.new({ from: accountOwner });
			proxy = await Implementation.at(proxy.address);

			await expectRevert(proxy.setValue(456, { from: accountOwner }), "Proxy::(): implementation not found");
		});
	});
});
