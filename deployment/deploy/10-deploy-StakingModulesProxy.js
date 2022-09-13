const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");

const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();

    await deploy("StakingModulesProxy", {
        contract: "ModulesProxy",
        from: deployer,
        args: [],
        log: true,
    });
};
func.tags = [deploymentName];
module.exports = func;
