/**
 * One face over the three fork nodes the rehearsal can run on. Every method
 * takes the raw JSON-RPC provider so the same code drives an in-process
 * hardhat node, anvil, or a Tenderly virtual testnet without branching in
 * the tests themselves.
 */
const { ethers } = require("hardhat");

const TEN_RBTC = "0x8AC7230489E80000";

const detectForkKind = async (provider) => {
    if (process.env.PERIMETER_FORK_KIND) return process.env.PERIMETER_FORK_KIND;
    const v = String(await provider.send("web3_clientVersion", []));
    if (/hardhat/i.test(v)) return "hardhat";
    if (/anvil/i.test(v)) return "anvil";
    return "tenderly";
};

const setBalance = async (provider, address, weiHex = TEN_RBTC) => {
    const kind = await detectForkKind(provider);
    const method = kind === "tenderly" ? "tenderly_setBalance" : "hardhat_setBalance";
    const params = kind === "tenderly" ? [[address], weiHex] : [address, weiHex];
    await provider.send(method, params);
};

/** Tenderly leaves every account unlocked, so only the funding is needed there. */
const impersonate = async (provider, address) => {
    const kind = await detectForkKind(provider);
    if (kind !== "tenderly") await provider.send("hardhat_impersonateAccount", [address]);
    await setBalance(provider, address);
    const signer = provider.getSigner(address);
    signer.address = ethers.utils.getAddress(address);
    return signer;
};

const mine = async (provider, blocks = 1) => {
    const kind = await detectForkKind(provider);
    if (kind === "hardhat") return provider.send("hardhat_mine", [ethers.utils.hexValue(blocks)]);
    if (kind === "anvil") return provider.send("anvil_mine", [ethers.utils.hexValue(blocks)]);
    for (let i = 0; i < blocks; i++) await provider.send("evm_mine", []);
};

const increaseTime = async (provider, seconds) => {
    await provider.send("evm_increaseTime", [ethers.utils.hexValue(seconds)]);
    await mine(provider, 1);
};

const supportsReset = (kind) => kind !== "tenderly";

module.exports = { detectForkKind, impersonate, setBalance, mine, increaseTime, supportsReset };
