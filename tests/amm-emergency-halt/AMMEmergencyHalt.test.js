const {
    assertNoSigningInputs,
    assertIsolatedUnitContext,
} = require("../../scripts/zero-emergency-halt/keyless");
assertNoSigningInputs();
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const REASON = "AMM: emergency shutdown";
const requests = ["0x", "0x01", "0x010203", "0x59e02dd7", "0xdeadbeef01020304"];

async function snapshot(address) {
    return {
        value: await ethers.provider.getStorageAt(address, 0),
        adjacent: await ethers.provider.getStorageAt(address, 1),
        owner: await ethers.provider.getStorageAt(address, ethers.utils.id("key.proxy.owner")),
        implementation: await ethers.provider.getStorageAt(
            address,
            ethers.utils.id("key.implementation")
        ),
        balance: (await ethers.provider.getBalance(address)).toString(),
    };
}

describe("AMMEmergencyHalt", function () {
    let owner, outsider, halt, proxy, original, delegated;
    beforeEach(async function () {
        await assertIsolatedUnitContext({ ethers, network });
        [owner, outsider] = await ethers.getSigners();
        halt = await (await ethers.getContractFactory("AMMEmergencyHalt")).deploy();
        proxy = await (await ethers.getContractFactory("UpgradableProxy")).deploy();
        original = await (await ethers.getContractFactory("TestValueSetter")).deploy();
        await proxy.setImplementation(original.address);
        delegated = original.attach(proxy.address);
        await delegated.setValue(42);
        expect(await delegated.value()).to.equal(42);
        await network.provider.send("hardhat_setBalance", [proxy.address, "0x1234"]);
        await proxy.setImplementation(halt.address);
    });

    it("rejects every tested direct call, including peek and native transfers", async function () {
        const before = await snapshot(halt.address);
        for (const data of requests) {
            for (const value of [0, 1]) {
                await expect(
                    outsider.sendTransaction({ to: halt.address, data, value })
                ).to.be.revertedWith(REASON);
            }
        }
        expect(await snapshot(halt.address)).to.deep.equal(before);
    });

    it("rejects delegated reads, writes and value calls without changing custody or storage", async function () {
        const before = await snapshot(proxy.address);
        await expect(delegated.value()).to.be.revertedWith(REASON);
        await expect(delegated.connect(outsider).setValue(99)).to.be.revertedWith(REASON);
        for (const data of requests) {
            await expect(
                outsider.sendTransaction({ to: proxy.address, data, value: 1 })
            ).to.be.revertedWith(REASON);
        }
        expect(await snapshot(proxy.address)).to.deep.equal(before);
    });

    it("preserves native proxy administration and restores the original application state", async function () {
        expect(await proxy.getProxyOwner()).to.equal(owner.address);
        expect(await proxy.getImplementation()).to.equal(halt.address);
        const before = await snapshot(proxy.address);
        await expect(
            proxy.connect(outsider).setImplementation(original.address)
        ).to.be.revertedWith("Proxy:: access denied");
        expect(await snapshot(proxy.address)).to.deep.equal(before);
        await proxy.setImplementation(original.address);
        expect(await delegated.value()).to.equal(42);
        await delegated.setValue(73);
        expect(await delegated.value()).to.equal(73);
        expect((await ethers.provider.getBalance(proxy.address)).toString()).to.equal(
            before.balance
        );
    });
});
