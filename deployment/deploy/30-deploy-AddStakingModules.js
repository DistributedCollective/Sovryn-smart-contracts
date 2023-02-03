const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    sendWithMultisig,
} = require("../helpers/helpers");

const { arrayToUnique } = require("../helpers/utils");

const func = async function () {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    // const { deployer } = await getNamedAccounts();

    log("Registering Staking Modules...");

    const moduleNamesObject = getStakingModulesNames();
    let moduleDeployments = [];
    const moduleNames = Object.values(moduleNamesObject);
    let modulesAddressList = [];
    let totalGas = ethers.BigNumber.from(0);

    const stakingProxyDeployment = await get("StakingProxy");
    const stakingModulesProxyDeployment = await get("StakingModulesProxy"); //await ethers.getContract("StakingModulesProxy");
    // @dev stakingModulesProxy@stakingProxy
    const stakingModulesProxy = await ethers.getContractAt(
        stakingModulesProxyDeployment.abi,
        stakingProxyDeployment.address
    );

    const { deployer } = await getNamedAccounts();

    for (let moduleName in moduleNamesObject) {
        const moduleDeployment = await get(moduleName);
        //const moduleImpl = await ethers.getContractAt(moduleDeployment.abi, moduleDeployment.address);
        moduleDeployments.push({ name: moduleName, address: moduleDeployment.address });
        modulesAddressList.push(moduleDeployment.address);
    }

    // const modulesAddressList = Object.values(moduleDeployments);

    // use the list to exclude some staking modules from registering
    const dontAddModules = {
        /*
        StakingAdminModule: "StakingAdminModule",
        StakingGovernanceModule: "StakingGovernanceModule",
        StakingStakeModule: "StakingStakeModule",
        StakingStorageModule: "StakingStorageModule",
        StakingVestingModule: "StakingVestingModule",
        StakingWithdrawModule: "StakingWithdrawModule",
        WeightedStakingModule: "WeightedStakingModule",
        */
    };
    const modulesToAdd =
        Object.keys(dontAddModules).length > 0
            ? modulesAddressList.filter((k) => {
                  dontAddModules.indexOf(k) == -1;
              })
            : modulesAddressList;

    const canNotAddModules = (
        await stakingModulesProxy.canNotAddModules(modulesAddressList)
    ).filter((item, i, ar) => {
        item !== ethers.constants.AddressZero;
    });
    if (canNotAddModules.length > 0) {
        throw new Error("Cannot add these modules: " + canNotAddModules);
    }

    //const abi = ["event AddModule(address moduleAddress)"];
    const stakingModulesProxyABI = stakingModulesProxyDeployment.abi;
    const stakingModulesProxyInterface = new ethers.utils.Interface(stakingModulesProxyABI);
    // @todo wrap registration by networks into a helper
    if (hre.network.tags["testnet"]) {
        // @todo wrap into a helper multisig tx creation
        const multisigDeployment = await get("MultiSigWallet");
        let data = stakingModulesProxyInterface.encodeFunctionData("addModules", [modulesToAdd]);
        log("Generating multisig transaction to register modules...");
        await sendWithMultisig(
            multisigDeployment.address,
            stakingProxyDeployment.address,
            data,
            deployer
        );
        log(
            `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
        );
    } else if (hre.network.tags["mainnet"]) {
        //owned by governance - need a SIP to register
        // TODO: implementation ; meanwhile use brownie sip_interaction scripts to create proposal
        // TODO: figure out if possible to pass SIP via environment and run the script
        //const stakingProxyDeployment = await get("StakingProxy");

        log("Staking modules and StakingModuleProxy are deployed");
        log(
            "Prepare and run SIP function in sips.js to create the proposal\n or alternatively use the brownie python proposal creation script."
        );
    } else {
        // hh ganache
        log("Adding modules...");
        log(modulesToAdd);
        await stakingModulesProxy.addModules(modulesToAdd);
    }
};
func.tags = ["AddStakingModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;
