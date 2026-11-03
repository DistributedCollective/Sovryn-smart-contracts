const {
    assertNoSigningInputs,
    assertIsolatedUnitContext,
} = require("../../scripts/zero-emergency-halt/keyless");
assertNoSigningInputs();
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const haltArtifact = require("../../external/artifacts/ZeroEmergencyHalt.sol/ZeroEmergencyHalt.json");
const proxyRecord = require("../../external/deployments/rskMainnet/BorrowerOperations_Proxy.json");

const REASON = "Zero: emergency shutdown";
const communityProxy = require("./fixtures/CommunityIssuanceProxy.json");
const PROXY_HASH = "0x577b60873bd1f538cb301bf0ede6c0a03869e4066386569ccb8265e0521048a5";
const OWNER_SLOT = ethers.utils.id("key.ownable.owner");
const IMPLEMENTATION_SLOT = ethers.utils.id("key.implementation");
const requests = ["0x", "0x01", "0x0102", "0x010203", "0xdeadbeef", "0xdeadbeef01020304"];

// Existing observed chain-30 runtime record at block 9364190, block hash
// 0xfd76498d6bca6ca9a47f8de4f0eb804405a1c31835a1d89958e27a80e3ae5ea3.
// Install its exact runtime and constructor-equivalent owner state; do not
// substitute lending's proxy or claim to replay Zero's historical deployment.
async function nativeZeroProxy(owner, record) {
    if (record === communityProxy) {
        const instance = await new ethers.ContractFactory(
            record.abi,
            record.bytecode,
            owner
        ).deploy();
        await instance.deployed();
        expect(await ethers.provider.getCode(instance.address)).to.equal(record.deployedBytecode);
        return instance;
    }
    const address = ethers.Wallet.createRandom().address;
    expect(ethers.utils.keccak256(proxyRecord.deployedBytecode)).to.equal(PROXY_HASH);
    expect(proxyRecord.linkedData.runtimeCodeHash).to.equal(PROXY_HASH);
    await network.provider.send("hardhat_setCode", [address, proxyRecord.deployedBytecode]);
    await network.provider.send("hardhat_setStorageAt", [
        address,
        OWNER_SLOT,
        ethers.utils.hexZeroPad(owner.address, 32),
    ]);
    return new ethers.Contract(address, proxyRecord.abi, owner);
}

async function snapshot(address) {
    return {
        value: await ethers.provider.getStorageAt(address, 0),
        adjacent: await ethers.provider.getStorageAt(address, 1),
        owner: await ethers.provider.getStorageAt(address, OWNER_SLOT),
        implementation: await ethers.provider.getStorageAt(address, IMPLEMENTATION_SLOT),
        balance: (await ethers.provider.getBalance(address)).toString(),
    };
}

for (const record of [proxyRecord, communityProxy]) {
    describe(`ZeroEmergencyHalt / ${record.address}`, () => {
        let owner, outsider, halt, proxy, original, delegated;
        beforeEach(async () => {
            await assertIsolatedUnitContext({ ethers, network });
            [owner, outsider] = await ethers.getSigners();
            halt = await new ethers.ContractFactory(
                haltArtifact.abi,
                haltArtifact.bytecode,
                owner
            ).deploy();
            await halt.deployed();
            proxy = await nativeZeroProxy(owner, record);
            original = await (await ethers.getContractFactory("TestValueSetter")).deploy();
            await proxy.setImplementation(original.address);
            delegated = original.attach(proxy.address);
            await delegated.setValue(42);
            expect(await delegated.value()).to.equal(42);
            await network.provider.send("hardhat_setBalance", [proxy.address, "0x1234"]);
            await proxy.setImplementation(halt.address);
        });

        it("uses the reviewed fallback ABI and deployed runtime", async () => {
            expect(haltArtifact.abi).to.deep.equal([
                { payable: true, stateMutability: "payable", type: "fallback" },
            ]);
            expect(ethers.utils.keccak256(haltArtifact.deployedBytecode)).to.equal(
                "0x824f7d71bf073c4c12d28ed3bac7a58e4bc1a27f3cb16bb5558ec99a5b3f85ae"
            );
            expect(await ethers.provider.getCode(halt.address)).to.equal(
                haltArtifact.deployedBytecode
            );
        });

        for (const data of requests) {
            for (const value of [0, 1]) {
                it(`rejects direct and delegated ${data} calldata with native value ${value}`, async () => {
                    const before = await snapshot(proxy.address);
                    for (const to of [halt.address, proxy.address]) {
                        await expect(
                            outsider.sendTransaction({ to, data, value })
                        ).to.be.revertedWith(REASON);
                    }
                    expect(await snapshot(proxy.address)).to.deep.equal(before);
                });
            }
        }

        it("blocks delegated known writes and getters without changing custody or state", async () => {
            const before = await snapshot(proxy.address);
            await expect(delegated.connect(outsider).setValue(99)).to.be.revertedWith(REASON);
            await expect(delegated.value()).to.be.revertedWith(REASON);
            expect(await snapshot(proxy.address)).to.deep.equal(before);
        });

        it("preserves native owner administration, denies unauthorized restoration and restores state", async () => {
            const before = await snapshot(proxy.address);
            expect(await proxy.getOwner()).to.equal(owner.address);
            expect(await proxy.getImplementation()).to.equal(halt.address);
            await expect(
                proxy.connect(outsider).setImplementation(original.address)
            ).to.be.revertedWith("Ownable:: access denied");
            await expect(proxy.connect(outsider).setOwner(outsider.address)).to.be.revertedWith(
                "Ownable:: access denied"
            );
            expect(await snapshot(proxy.address)).to.deep.equal(before);
            await proxy.setOwner(outsider.address);
            expect(await proxy.getOwner()).to.equal(outsider.address);
            await expect(proxy.setImplementation(original.address)).to.be.revertedWith(
                "Ownable:: access denied"
            );
            await proxy.connect(outsider).setImplementation(original.address);
            expect(await proxy.getImplementation()).to.equal(original.address);
            expect(await delegated.value()).to.equal(42);
            await delegated.setValue(73);
            expect(await delegated.value()).to.equal(73);
            expect(await ethers.provider.getStorageAt(proxy.address, 1)).to.equal(before.adjacent);
            expect((await ethers.provider.getBalance(proxy.address)).toString()).to.equal(
                before.balance
            );
        });
    });
}
