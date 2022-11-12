const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");

const { getStakingModulesNames } = require("../helpers/helpers");
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners(); //
    let totalGas = ethers.BigNumber.from(0);
    for (let moduleName in getStakingModulesNames()) {
        const tx = await deploy(moduleName, {
            from: deployer,
            args: [],
            log: true,
        });
        if (tx.newlyDeployed) {
            totalGas = totalGas.add(tx.receipt.cumulativeGasUsed);
            log(tx.receipt.cumulativeGasUsed.toString());
        }
    }
    if (totalGas != 0) {
        log("=====================================================================");
        log("Total gas used for Staking Modules deployment:", totalGas.toString());
        log("=====================================================================");
    }
};
func.tags = ["StakingModules"];
module.exports = func;
