const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const Proxy = artifacts.require("ProxyMockup");
const Implementation = artifacts.require("ImplementationMockup");

contract('Proxy', accounts => {

    let accountUnauthorized;
    let accountOwner;

    let proxy;

    before(async () => {
        accountUnauthorized = accounts[0];
        accountOwner = accounts[9];
    });

    beforeEach(async () => {
        proxy = await Proxy.new({from: accountOwner});
    });

    describe("setProxyOwner", async () => {

        it("Should be able to transfer ownership", async () => {
    
            let tx = await proxy.setProxyOwner(accountUnauthorized, {from: accountOwner});
            expectEvent(
                tx,
                'OwnershipTransferred',
                {
                    _oldOwner: accountOwner,
                    _newOwner: accountUnauthorized
                }
            );

            let owner = await proxy.getProxyOwner.call();
            expect(owner).to.be.equal(accountUnauthorized);
        });

        it("Only owner should be able to transfer ownership", async () => {
            await expectRevert(
                proxy.setProxyOwner(accountUnauthorized, {from: accountUnauthorized}),
                "Proxy:: access denied"
            );
        });

        it("Should not be able to set proxy owner to zero address", async () => {
            await expectRevert(
                proxy.setProxyOwner(ZERO_ADDRESS, {from: accountOwner}),
                "Proxy::setProxyOwner: invalid address"
            );
        });

    });

    describe("setImplementation", async () => {

        it("Should be able to set implementation", async () => {
    
            let tx = await proxy.setImplementation(accountUnauthorized, {from: accountOwner});
            expectEvent(
                tx,
                'ImplementationChanged',
                {
                    _oldImplementation: ZERO_ADDRESS,
                    _newImplementation: accountUnauthorized
                }
            );

            let implementation = await proxy.getImplementation.call();
            expect(implementation).to.be.equal(accountUnauthorized);
        });

        it("Only owner should be able to set implementation", async () => {
            await expectRevert(
                proxy.setImplementation(accountUnauthorized, {from: accountUnauthorized}),
                "Proxy:: access denied"
            );
        });

        it("Should not be able to set implementation to zero address", async () => {
            await expectRevert(
                proxy.setImplementation(ZERO_ADDRESS, {from: accountOwner}),
                "Proxy::setImplementation: invalid address"
            );
        });

    });

    describe("invoke an implementation", async () => {

        it("Should be able invoke method of the implementation", async () => {
            let mockImplementation = await Implementation.new({from: accountOwner});
            await proxy.setImplementation(mockImplementation.address, {from: accountOwner});
            proxy = await Implementation.at(proxy.address);
            
            let value = "123";
            let tx = await proxy.setValue(value, {from: accountOwner});
            expectEvent(
                tx,
                'ValueChanged',
                {
                    value: value
                }
            );

            let savedValue = await proxy.value.call();
            expect(savedValue.toString()).to.be.equal(value);
        });


        it("Should not be able to invoke not set implementation", async () => {
            await Implementation.new({from: accountOwner});
            proxy = await Implementation.at(proxy.address);

            await expectRevert(
                proxy.setValue(456, {from: accountOwner}),
                "Proxy::(): implementation not found"
            );
        });

    });


});
