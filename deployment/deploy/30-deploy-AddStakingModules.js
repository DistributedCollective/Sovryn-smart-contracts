const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    sendWithMultisig,
} = require("../helpers/helpers");
const col = require("cli-color");

const { arrayToUnique } = require("../helpers/utils");

const func = async function () {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    // const { deployer } = await getNamedAccounts();

    log(col.bgYellow("Adding New Staking Modules..."));

    const moduleNamesObject = getStakingModulesNames();
    let moduleDeployments = [];
    const moduleNames = Object.values(moduleNamesObject);
    let modulesAddressList = [];
    let totalGas = ethers.BigNumber.from(0);

    const stakingProxyDeployment = await get("StakingProxy");
    const stakingModulesProxyDeployment = await get("StakingModulesProxy"); //await ethers.getContract("StakingModulesProxy");
    // @dev stakingModulesProxy@stakingProxy
    const stakingModulesProxy = await ethers.getContract("StakingModulesProxy");

    const { deployer } = await getNamedAccounts();

    for (let moduleName in moduleNamesObject) {
        const moduleDeployment = await get(moduleName);
        moduleDeployments.push({ name: moduleName, address: moduleDeployment.address });
        modulesAddressList.push(moduleDeployment.address);
    }

    // use the list to exclude some staking modules from registering
    const dontAddModules = {
        StakingAdminModule: "StakingAdminModule",
        StakingGovernanceModule: "StakingGovernanceModule",
        StakingStakeModule: "StakingStakeModule",
        StakingStorageModule: "StakingStorageModule",
        StakingVestingModule: "StakingVestingModule",
        StakingWithdrawModule: "StakingWithdrawModule",
        WeightedStakingModule: "WeightedStakingModule",
    };
    const modulesToAdd =
        Object.keys(dontAddModules).length > 0
            ? modulesAddressList.filter((k, i) => {
                  return dontAddModules[moduleDeployments[i].name] === undefined;
              })
            : modulesAddressList;
    const canNotAddModules = (await stakingModulesProxy.canNotAddModules(modulesToAdd)).filter(
        (item) => item !== ethers.constants.AddressZero
    );

    if (canNotAddModules.length > 0) {
        throw new Error(col.redBright("Cannot add these modules: " + canNotAddModules));
    }
    if (modulesToAdd.length === 0) {
        log(col.bgBlue(">>> No modules to add"));
        return;
    }
    //const abi = ["event AddModule(address moduleAddress)"];
    const stakingModulesProxyABI = stakingModulesProxyDeployment.abi;
    const stakingModulesProxyInterface = new ethers.utils.Interface(stakingModulesProxyABI);
    // @todo wrap registration by networks into a helper
    if (hre.network.tags["testnet"]) {
        // @todo wrap into a helper multisig tx creation
        const multisigDeployment = await get("MultiSigWallet");
        let data = stakingModulesProxyInterface.encodeFunctionData("addModules", [modulesToAdd]);
        log(col.bgYellow("Generating multisig transaction to register modules..."));
        await sendWithMultisig(
            multisigDeployment.address,
            stakingProxyDeployment.address,
            data,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );
    } else if (hre.network.tags["mainnet"]) {
        //owned by governance - need a SIP to register
        // TODO: implementation ; meanwhile use brownie sip_interaction scripts to create proposal
        // TODO: figure out if possible to pass SIP via environment and run the script
        //const stakingProxyDeployment = await get("StakingProxy");
        log(col.bgBlue("Staking modules and StakingModuleProxy are deployed"));
        log(
            "Prepare and run SIP function in sips.js to create the proposal\n or alternatively use the brownie python proposal creation script."
        );
    } else {
        // hh ganache
        log(col.bgYellow("Adding modules..."));
        log(modulesToAdd);
        await stakingModulesProxy.addModules(modulesToAdd);
    }
};
func.tags = ["AddStakingModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;
