const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const col = require("cli-color");
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { signer2: deployer } = await getNamedAccounts(); //await ethers.getSigners(); //
    let totalGas = ethers.BigNumber.from(0);

    const args = [
        (await get("SafeBobDeposits")).address,
        (await get("BobLockDrop")).address,
        (await get("SOV")).address,
        "0x86De732721FfFCdf163629C64e3925B5BF7F371A".toLowerCase(),
    ];
    // Deploy loan token logic beacon LM //
    log(col.bgYellow("Deploying SafeDepositsSender..."));
    const tx = await deploy("SafeDepositsSender", {
        from: deployer,
        args: args,
        log: true,
    });
    if (tx.newlyDeployed) {
        totalGas = totalGas.add(tx.receipt.cumulativeGasUsed);
        log("cumulative gas:", tx.receipt.cumulativeGasUsed.toString());
        log(
            col.bgYellow(
                "Create Safe transaction to register SafeDepositsSender module",
                tx.address
            )
        );
    }
};
func.tags = ["SafeDepositsSender"];
module.exports = func;
