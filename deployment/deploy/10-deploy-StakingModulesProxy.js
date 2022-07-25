const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");

const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners(); //

    const deployTx = await deploy("StakingModulesProxy", {
        contract: "ModulesProxy",
        from: deployer,
        args: [],
        log: true,
    });
    //console.log(deployTx);
    //console.log((await get("ModulesProxy")).address, (await get("ModulesProxy")).address);
};
func.tags = [deploymentName];
module.exports = func;
