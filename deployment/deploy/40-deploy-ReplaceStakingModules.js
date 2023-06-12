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
const col = require("cli-color");

const { arrayToUnique } = require("../helpers/utils");

const func = async function (hre) {
    const {
        deployments: { get, log, deploy },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();
    const stakingProxyDeployment = await get("StakingProxy");
    const stakingModulesProxyDeployment = await get("StakingModulesProxy"); //await ethers.getContract("StakingModulesProxy");
    // @dev stakingModulesProxy@stakingProxy
    const stakingModulesProxy = await ethers.getContract("StakingModulesProxy");

    const modulesList = getStakingModulesNames();
    let modulesFrom = [];
    let modulesTo = [];
    for (const moduleName of Object.values(modulesList)) {
        const moduleDeployment = await get(moduleName);
        const fromModule = await getStakingModuleContractToReplace(
            stakingModulesProxy,
            moduleDeployment.address
        );
        if (fromModule && fromModule !== ethers.constants.AddressZero) {
            modulesFrom.push(fromModule);
            modulesTo.push(moduleDeployment.address);
        }
    }

    // REPLACE MODULES //

    log(col.bgYellow("Replacing Staking Modules..."));

    const stakingModulesProxyInterface = new ethers.utils.Interface(
        stakingModulesProxyDeployment.abi
    );
    if (hre.network.tags["testnet"]) {
        // @todo wrap into a helper multisig tx creation
        const multisigDeployment = await get("MultiSigWallet");
        let data = stakingModulesProxyInterface.encodeFunctionData("replaceModules", [
            modulesFrom,
            modulesTo,
        ]);

        log("Generating multisig transaction to replace modules...");
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
        log(
            col.bgBlue(
                "Staking modules and StakingModuleProxy are deployed (those not modified are reused)"
            )
        );
        log(
            col.bgBlue(
                "Prepare and run SIP function in sips.js to create the proposal with params:"
            )
        );
        console.log(col.yellow("modulesFrom:"));
        console.log(modulesFrom);
        console.log(col.yellow("modulesTo:"));
        console.log(modulesTo);
    } else {
        // hh ganache
        await stakingModulesProxy.replaceModules(modulesFrom, modulesTo);
    }
};
func.tags = ["ReplaceStakingModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;
