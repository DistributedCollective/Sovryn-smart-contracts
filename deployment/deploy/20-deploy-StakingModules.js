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

    for (let moduleName in getStakingModulesNames()) {
        await deploy(moduleName, {
            from: deployer,
            args: [],
            log: true,
        });
    }
};
func.tags = [getContractNameFromScriptFileName(path.basename(__filename))];
module.exports = func;
