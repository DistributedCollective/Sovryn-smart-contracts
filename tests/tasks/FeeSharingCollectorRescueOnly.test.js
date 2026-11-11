const assert = require("assert");
const { ethers, network } = require("hardhat");
describe("FeeSharingCollectorRescueOnly", function () {
    let owner, other, proxy, logic, rescue;
    beforeEach(async function () {
        [owner, other] = await ethers.getSigners();
        logic = await (await ethers.getContractFactory("FeeSharingCollectorRescueOnly")).deploy();
        proxy = await (
            await ethers.getContractFactory("FeeSharingCollectorProxy")
        ).deploy(owner.address, owner.address);
        await proxy.setImplementation(logic.address);
        rescue = logic.attach(proxy.address);
    });
    it("moves all native cash only to proxy owner", async function () {
        await network.provider.send("hardhat_setBalance", [proxy.address, "0xde0b6b3a7640000"]);
        const before = await ethers.provider.getBalance(owner.address);
        const receipt = await (await rescue.rescueNative()).wait();
        assert((await ethers.provider.getBalance(proxy.address)).isZero());
        const after = await ethers.provider.getBalance(owner.address);
        assert(
            after
                .add(receipt.gasUsed.mul(receipt.effectiveGasPrice))
                .sub(before)
                .eq(ethers.utils.parseEther("1"))
        );
    });
    it("rejects non-owner rescue and direct implementation rescue", async function () {
        await assert.rejects(rescue.connect(other).rescueNative());
        await assert.rejects(logic.rescueNative());
    });
    it("reverts delegated normal collector functions and native intake", async function () {
        const data = new ethers.utils.Interface([
            "function withdrawFeesAMM(address[])",
        ]).encodeFunctionData("withdrawFeesAMM", [[]]);
        await assert.rejects(
            network.provider.send("eth_call", [{ to: proxy.address, data }, "latest"])
        );
        await assert.rejects(other.sendTransaction({ to: proxy.address, value: 1 }));
    });
    it("moves full ERC20 balances in kind and leaves old claim storage unchanged", async function () {
        const token = await (await ethers.getContractFactory("CollectorRescueToken")).deploy();
        await token.mint(proxy.address, 1000);
        await token.mint(owner.address, 12);
        const slots = Array.from({ length: 21 }, (_, i) => ethers.utils.hexValue(i));
        const mappingKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [token.address, 16])
        );
        await network.provider.send("hardhat_setStorageAt", [
            proxy.address,
            mappingKey,
            ethers.utils.hexZeroPad("0x1234", 32),
        ]);
        slots.push(mappingKey);
        const before = await Promise.all(
            slots.map((k) => ethers.provider.getStorageAt(proxy.address, k))
        );
        await rescue.rescueERC20(token.address);
        assert((await token.balanceOf(proxy.address)).isZero());
        assert((await token.balanceOf(owner.address)).eq(1012));
        assert.deepEqual(
            await Promise.all(slots.map((k) => ethers.provider.getStorageAt(proxy.address, k))),
            before
        );
        const lock = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("sovryn.feeCollector.rescueOnly.lock.v1")
        );
        assert.equal(
            await ethers.provider.getStorageAt(proxy.address, lock),
            ethers.constants.HashZero
        );
        assert.equal(await proxy.getProxyOwner(), owner.address);
    });
    it("a paused token remains safely in custody without blocking native rescue", async function () {
        const token = await (await ethers.getContractFactory("CollectorRescueToken")).deploy();
        await token.mint(proxy.address, 1000);
        await token.setPaused(true);
        await assert.rejects(rescue.rescueERC20(token.address));
        assert((await token.balanceOf(proxy.address)).eq(1000));
        await network.provider.send("hardhat_setBalance", [proxy.address, "0x1234"]);
        await rescue.rescueNative();
        assert((await ethers.provider.getBalance(proxy.address)).isZero());
        await token.setPaused(false);
        await rescue.rescueERC20(token.address);
        assert((await token.balanceOf(owner.address)).eq(1000));
    });
    it("short receipts revert atomically instead of silently losing assets", async function () {
        const token = await (await ethers.getContractFactory("CollectorRescueToken")).deploy();
        await token.mint(proxy.address, 1000);
        await token.setChargeFee(true);
        await assert.rejects(rescue.rescueERC20(token.address));
        assert((await token.balanceOf(proxy.address)).eq(1000));
        assert((await token.balanceOf(owner.address)).isZero());
    });
    it("token callbacks cannot invoke another rescue", async function () {
        const token = await (await ethers.getContractFactory("CollectorRescueToken")).deploy();
        await token.mint(proxy.address, 1000);
        await token.setCallback(proxy.address);
        await network.provider.send("hardhat_setBalance", [proxy.address, "0x1234"]);
        await rescue.rescueERC20(token.address);
        assert.equal(await token.callbackSucceeded(), false);
        assert((await ethers.provider.getBalance(proxy.address)).eq(0x1234));
    });
    it("empty asset rescue is repeatable and proxy restoration remains owner-controlled", async function () {
        await rescue.rescueNative();
        await rescue.rescueNative();
        await assert.rejects(proxy.connect(other).setImplementation(logic.address));
        const replacement = await (
            await ethers.getContractFactory("FeeSharingCollectorRescueOnly")
        ).deploy();
        await proxy.setImplementation(replacement.address);
        assert.equal(await proxy.getImplementation(), replacement.address);
    });
});
