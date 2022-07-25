const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const { getStakingModulesNames } = require("../helpers/helpers");

const func = async function () {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    //const { deployer } = await getNamedAccounts();
    const proxy = await ethers.getContract("StakingModulesProxy");

    log("====================================================================================");

    const abi = ["event AddModule(address moduleAddress)"];
    const iface = new ethers.utils.Interface(abi);

    const moduleNames = getStakingModulesNames();

    for (let moduleName in moduleNames) {
        const moduleDeployment = await get(moduleName);
        const receipt = await (await proxy.addModule(moduleDeployment.address)).wait();
        const parsedLogs = iface.parseLog(receipt.logs[receipt.logs.length - 1]);
        try {
            if (parsedLogs.args["moduleAddress"] == moduleDeployment.address)
                log(`Registered module "${moduleName}" @ ${moduleDeployment.address}`);
            else throw `ERROR registering module "${moduleName}" @ ${moduleDeployment.address}`;
        } catch (e) {
            throw new Error(e);
        }
    }
    log("====================================================================================");
};
func.tags = [getContractNameFromScriptFileName(path.basename(__filename))];
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;
