const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    sendWithMultisig,
    createProposal,
    multisigCheckTx,
    getStakingModuleContractToReplace,
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
        log(`>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures <<<`);
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

    // TODO: implement `else` - simple replacement for local node deployment - see sips.js
    //flow:
    // for each module
    //   if can add - add
    //   else
    //      check if can be replaced - replace
    //         if cannot, then log clashing
    //
    /*
        for (let i = 0; i < modulesAddressList.length; i++) {
            if (await stakingModulesProxy.canAddModule(modulesAddressList[i])) {
                moduleDepl;
                const moduleImpl = await ethers.getContractAt();
            }
        }
    
        if (stakingRegisterModuleWithMultisig() && hre.network.live) {
            const iStakingModulesProxy = new ethers.utils.Interface(stakingModulesProxyDeployment.abi);
            const data = iStakingModulesProxy.encodeFunctionData("addModules", [modulesAddressList]);
            const multisigDeployment = await get("multisig");
            const { deployer } = await getNamedAccounts("deployer");
            await sendWithMultisig(
                multisigDeployment.address,
                stakingModulesProxy.address,
                data,
                deployer
            );
        } else {
            for (let i = 0; i < modulesAddressList.length; i++) {
                if (await stakingModulesProxy.canAddModule(modulesAddressList[i])) {
                    log(`Adding module ${moduleNames[i]}`);
                    const receipt = await (
                        await stakingModulesProxy.addModule(modulesAddressList[i])
                    ).wait();
                    log(`cumulativeGasUsed: ${receipt.cumulativeGasUsed.toString()}`);
                    totalGas = totalGas.add(receipt.cumulativeGasUsed);
                } else {
                    const clashing = await stakingModulesProxy.checkClashingFuncSelectors(
                        modulesAddressList[i]
                    );
                    if (
                        clashing.clashingModules.length == 0 &&
                        clashing.clashingProxyRegistryFuncSelectors.length == 0
                    ) {
                        log("All modules are reused - nothing to register");
                        return;
                    }
                    if (
                        clashing.clashingModules.length != 0 &&
                        clashing.clashingModules[0] != ethers.constants.AddressZero
                    ) {
                        const clashingUnique = clashing.clashingModules.filter(arrayToUnique);
                        if (clashingUnique.length == 1) {
                            const addressModuleBeingReplaced = clashingUnique[0];
                            if (addressModuleBeingReplaced != modulesAddressList[i]) {
                                log(`Replacing module ${moduleNames[i]}`);
                                const receipt = await (
                                    await stakingModulesProxy.replaceModule(
                                        addressModuleBeingReplaced,
                                        modulesAddressList[i]
                                    )
                                ).wait();
    
                                log(`cumulativeGasUsed: ${receipt.cumulativeGasUsed.toString()}`);
                                totalGas = totalGas.add(receipt.cumulativeGasUsed);
                            } else
                                log(
                                    `Skipping module ${moduleNames[i]} replacement - the module is reused`
                                );
                        } else {
                            log(`can't replace multiple modules at once:`);
                            clashing.clashingModules.forEach((item, index, arr) => {
                                log(`${item[index]} - ${arr[1][index]}`);
                            });
                        }
                    }
                    if (
                        clashing.clashingProxyRegistryFuncSelectors.length !== 0 &&
                        clashing.clashingProxyRegistryFuncSelectors[0] != "0x00000000"
                    ) {
                        log("Clashing functions signatures with ModulesProxy functions:");
                        log(clashing.clashingProxyRegistryFuncSelectors);
                    }
                }
            }
            if (totalGas != 0) {
                log("=====================================================================");
                log("Total gas used for Staking Modules registration:", totalGas.toString());
                log("=====================================================================");
            }
        }*/
};
func.tags = ["AddStakingModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;
