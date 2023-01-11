const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    sendWithMultisig,
    createProposal,
    multisigCheckTx,
} = require("../helpers/helpers");

const { arrayToUnique } = require("../helpers/utils");

const func = async function () {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    //const { deployer } = await getNamedAccounts();
    const proxyDeployment = await get("StakingModulesProxy");
    const stakingModulesProxyDeployment = await get("StakingModulesProxy"); //await ethers.getContract("StakingModulesProxy");

    log("Registering Staking Modules...");

    //const abi = ["event AddModule(address moduleAddress)"];
    const abi = stakingModulesProxyDeployment.abi;
    const iface = new ethers.utils.Interface(abi);

    const moduleNamesObject = getStakingModulesNames();
    const moduleNames = Object.values(moduleNamesObject);
    let moduleAddressList = [];
    let moduleDeployments = [];
    let totalGas = ethers.BigNumber.from(0);

    for (let moduleName in moduleNamesObject) {
        const moduleDeployment = await get(moduleName);
        //const moduleImpl = await ethers.getContractAt(moduleDeployment.abi, moduleDeployment.address);
        moduleDeployments.push({ name: moduleName, address: moduleDeployment.address });
        //moduleAddressList.push(moduleDeployment.address);
    }

    //TODO:
    //1. add function canBeReplaced() to the contract
    //2. split the modules into 2 parts: add & replace

    const stakingProxyDeployment = await get("StakingProxy");
    //const stakingModulesProxy = await get("stakingModulesProxy");
    if (hre.network.tags["testnet"]) {
        //StakingProxy owner is multisig on the testnet
        //const stakingProxyDeployment = await get("StakingProxy");
        const multisigDeployment = await get("MultiSigWallet");
        let stakingProxyInterface = new ethers.utils.Interface(stakingProxyDeployment.abi);
        let data = stakingProxyInterface.encodeFunctionData("setImplementation", [tx.address]);
        const { deployer } = await getNamedAccounts("deployer");
        await sendWithMultisig(multisigDeployment.address, tx.address, data, deployer);
        //TODO: add modules addind and replacement
    } else if (hre.network.tags["mainnet"]) {
        //owned by governance - need a SIP to register
        // TODO: implementation ; meanwhile use brownie sip_interaction scripts to create proposal
        // TODO: figure out if possible to pass SIP via environment and run the script
        //const stakingProxyDeployment = await get("StakingProxy");
        log("Staking modules and StakingModuleProxy are deployed (reused those not changed)");
        log("Prepare and run SIP function in sips.js to create the proposal");
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
        for (let i = 0; i < moduleAddressList.length; i++) {
            if (await stakingModulesProxy.canAddModule(moduleAddressList[i])) {
                moduleDepl;
                const moduleImpl = await ethers.getContractAt();
            }
        }
    
        if (stakingRegisterModuleWithMultisig() && hre.network.live) {
            const iStakingModulesProxy = new ethers.utils.Interface(stakingModulesProxyDeployment.abi);
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
            for (let i = 0; i < moduleAddressList.length; i++) {
                if (await stakingModulesProxy.canAddModule(moduleAddressList[i])) {
                    log(`Adding module ${moduleNames[i]}`);
                    const receipt = await (
                        await stakingModulesProxy.addModule(moduleAddressList[i])
                    ).wait();
                    log(`cumulativeGasUsed: ${receipt.cumulativeGasUsed.toString()}`);
                    totalGas = totalGas.add(receipt.cumulativeGasUsed);
                } else {
                    const clashing = await stakingModulesProxy.checkClashingFuncSelectors(
                        moduleAddressList[i]
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
                            if (addressModuleBeingReplaced != moduleAddressList[i]) {
                                log(`Replacing module ${moduleNames[i]}`);
                                const receipt = await (
                                    await stakingModulesProxy.replaceModule(
                                        addressModuleBeingReplaced,
                                        moduleAddressList[i]
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
func.tags = ["RegisterStakingModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;