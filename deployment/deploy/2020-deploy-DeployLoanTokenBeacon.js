const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const col = require("cli-color");
const { getLoanTokenModulesNames } = require("../helpers/helpers");
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners(); //
    let totalGas = ethers.BigNumber.from(0);

    // Deploy loan token logic beacon LM //
    log(col.bgYellow("Deploying LoanTokengLogicBeaconLM..."));
    const tx = await deploy("LoanTokenLogicBeaconLM", {
        from: deployer,
        args: [],
        log: true,
        contract: "LoanTokenLogicBeacon",
    });
    if (tx.newlyDeployed) {
        totalGas = totalGas.add(tx.receipt.cumulativeGasUsed);
        log("cumulative gas:", tx.receipt.cumulativeGasUsed.toString());
    }

    // Deploy loan token logic beacon WRBTC //
    log(col.bgYellow("Deploying LoanTokengLogicBeaconLM..."));
    const tx2 = await deploy("LoanTokenLogicBeaconWrbtc", {
        from: deployer,
        args: [],
        log: true,
        contract: "LoanTokenLogicBeacon",
    });
    if (tx2.newlyDeployed) {
        totalGas = totalGas.add(tx2.receipt.cumulativeGasUsed);
        log("cumulative gas:", tx2.receipt.cumulativeGasUsed.toString());
    }

    if (totalGas != 0) {
        log("=====================================================================");
        log("Total gas used for LoanTokenLogicBeacon deployment:", totalGas.toString());
        log("=====================================================================");
    }
};
func.tags = ["DeployLoanTokenBeacon"];
module.exports = func;
