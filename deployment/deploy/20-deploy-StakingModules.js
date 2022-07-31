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
        //log(tx.receipt);
        totalGas = totalGas.add(tx.receipt.gasUsed);
        log(tx.receipt.cumulativeGasUsed.toString());
    }
    log("Total gas used:", totalGas.toString());
};
func.tags = [getContractNameFromScriptFileName(path.basename(__filename))];
module.exports = func;
