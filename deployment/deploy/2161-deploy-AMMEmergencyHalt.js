const { utils } = require("ethers");

const MAINNET_ADDRESS = "0x8c293ed020f4d7321b6b16c71584fddb560e0ebd";
const MAINNET_RUNTIME_HASH = "0x8ec8ffa2692ec6859263b043a1494bf41561e8a526d3d9555eb3ac3bba85c7ae";

const func = async function (hre) {
    if (String(await hre.getChainId()) === "30") {
        const record = await hre.deployments.getOrNull("AMMEmergencyHalt");
        if (!record) throw new Error("AMMEmergencyHalt: missing mainnet deployment record");
        if (record.address.toLowerCase() !== MAINNET_ADDRESS) {
            throw new Error("AMMEmergencyHalt: mainnet deployment address mismatch");
        }
        const code = await hre.ethers.provider.getCode(MAINNET_ADDRESS);
        if (utils.keccak256(code) !== MAINNET_RUNTIME_HASH) {
            throw new Error("AMMEmergencyHalt: mainnet runtime mismatch");
        }
        hre.deployments.log(`Reusing verified AMMEmergencyHalt at ${MAINNET_ADDRESS}`);
        return;
    }

    const { deployer } = await hre.getNamedAccounts();
    await hre.deployments.deploy("AMMEmergencyHalt", {
        from: deployer,
        args: [],
        log: true,
    });
};

func.tags = ["AMMEmergencyHalt"];
module.exports = func;
