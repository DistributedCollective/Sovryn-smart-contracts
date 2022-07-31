const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    sendWithMultisig,
    multisigCheckTx,
} = require("../helpers/helpers");

const func = async function () {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    //const { deployer } = await getNamedAccounts();
    const proxyDeployment = await get("StakingModulesProxy");
    const stakingModulesProxy = await ethers.getContract("StakingModulesProxy");

    log("Registering Staking Modules...");

    //const abi = ["event AddModule(address moduleAddress)"];
    const abi = proxyDeployment.abi;
    const iface = new ethers.utils.Interface(abi);

    const moduleNamesObject = getStakingModulesNames();
    const moduleNames = Object.values(moduleNamesObject);
    let moduleAddressList = [];

    for (let moduleName in moduleNamesObject) {
        const moduleDeployment = await get(moduleName);
        moduleAddressList.push(moduleDeployment.address);
    }
    //TODO: 2 options:
    //  [x]    - register directly (e.g. for the testnet) create tx for multisig
    //  [ ]    - create tx for multisig or SIP
    log("hre.network.live", hre.network.live);
    if (stakingRegisterModuleWithMultisig() && hre.network.live) {
        const iStakingModulesProxy = new ethers.utils.Interface(proxyDeployment.abi);
        const data = iStakingModulesProxy.encodeFunctionData("addModules", [moduleAddressList]);
        const multisigDeployment = await get("multisig");
        const { deployer } = await getNamedAccounts("deployer");
        await sendWithMultisig(
            multisigDeployment.address,
            stakingModulesProxy.address,
            data,
            deployer
        );
    } else {
        const receipt = await (await stakingModulesProxy.addModules(moduleAddressList)).wait();
        log(`gasUsed: ${receipt.gasUsed}`);
    }
};
func.tags = [getContractNameFromScriptFileName(path.basename(__filename))];
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;
