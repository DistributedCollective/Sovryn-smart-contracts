const { ethers, network } = require("hardhat");

async function main() {
    console.log("🖖🏽[ethers] Deploying and Verifying SafeDepositsSender in Tenderly");

    const SafeDepositsSender = await ethers.getContractFactory("SafeDepositsSender");

    const signer = (await ethers.getSigners())[0];

    let safeDepositsSender = await SafeDepositsSender.connect(signer).deploy(
        "0x949Cf9295d2950B6bD9B7334846101E9aE44BBB0", // safe deposits
        "0xb5e3dbaf69a46b71fe9c055e6fa36992ae6b2c1a", // LockDrop contract address
        "0xbdab72602e9ad40fc6a6852caf43258113b8f7a5", // SOV on eth
        "0xCF311E7375083b9513566a47B9f3e93F1FcdCfBF" // Depositor --> watcher script executor
    );

    await safeDepositsSender.deployed();
    safeDepositsSender = await safeDepositsSender.deployed();

    const safeDepositsSenderAddress = await safeDepositsSender.address;
    console.log("{SafeDepositsSender} deployed to", safeDepositsSenderAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
