const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { sendWithMultisig } = require("../helpers/helpers");
const { deployWithCustomProxy } = require("../helpers/helpers");
const col = require("cli-color");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();
    log(col.bgYellow("Deploying StakingModulesProxy..."));
    await deployWithCustomProxy(deployer, "ModulesProxy", "StakingProxy", "StakingModulesProxy");
};
func.tags = ["StakingModulesProxy"];
func.dependencies = ["StakingProxy"];
module.exports = func;
