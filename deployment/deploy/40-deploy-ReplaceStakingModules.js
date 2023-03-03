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
        deployments: { get, log, deploy },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();
    const stakingProxyDeployment = await get("StakingProxy");
    const stakingModulesProxyDeployment = await get("StakingModulesProxy"); //await ethers.getContract("StakingModulesProxy");
    // @dev stakingModulesProxy@stakingProxy
    const stakingModulesProxy = await ethers.getContractAt(
        stakingModulesProxyDeployment.abi,
        stakingProxyDeployment.address
    );

    // ENTER NEW MODULES HERE//
    const newModulesObject = {
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

    const newModulesDeployment = {};
    for await (const contractKey of Object.keys(newModulesObject)) {
        console.log(`processing ${contractKey}...`);
        const newModuleContractName = newModulesObject[contractKey];
        const moduleDeployment = await deploy(newModuleContractName /*deployment instance name*/, {
            contract: contractKey, //contract to deploy
            from: deployer,
            args: [],
            log: true,
        });
        if (!moduleDeployment.newlyDeployed) {
            if (!(await stakingModulesProxy.isModuleRegistered(moduleDeployment.address))) {
                newModulesDeployment[newModuleContractName] = moduleDeployment.address;
            } else {
                console.warn(
                    `SKIPPING ${newModuleContractName} @ ${moduleDeployment.address} - already registered`
                );
            }
        }
    }
    const newModulesAddressList = Object.values(newModulesDeployment);

    // ENTER REGISTERED MODULES ADDRESSES TO REPLACE //
    // the order of the modules addresses doesn't matter
    const modulesToReplaceAddressList = [
        /*
       "0x0000000000000000000000000000000000000000", // e.g. "0x5ddC7eB2958C07c1F02f0A834FbA8982487d1940"
       "0x0000000000000000000000000000000000000000"
       */
    ];

    const computedModulesToBeReplaced = await Promise.all(
        newModulesAddressList.map(async (el) => {
            const module = await getStakingModuleContractToReplace(stakingModulesProxy, el);
            if (module == ethers.constants.AddressZero) {
                throw new Error(
                    `Module ${el} is not replacing any registered module (no func sigs found in registered modules) - must be added instead`
                );
            }
            return module;
        })
    );

    if (
        !(
            modulesToReplaceAddressList.length != 0 &&
            modulesToReplaceAddressList.length == Object.keys(newModulesDeployment).length
        )
    ) {
        throw "newModulesObject and modulesToReplaceAddressList arrays must be set and their size equal";
    }

    // REPLACE MODULES //

    log("Replacing Staking Modules...");

    // validate modules being replaced
    if (
        JSON.stringify(computedModulesToBeReplaced.sort()).toLowerCase() !=
        JSON.stringify(modulesToReplaceAddressList.sort()).toLowerCase()
    ) {
        log(`addresses computed: \n${computedModulesToBeReplaced.sort()}`);
        log(`addresses provided: \n${modulesToReplaceAddressList.sort()}`);
        throw new Error("Addresses of modules to replace are invalid");
    }

    const stakingModulesProxyInterface = new ethers.utils.Interface(
        stakingModulesProxyDeployment.abi
    );
    if (hre.network.tags["testnet"]) {
        // @todo wrap into a helper multisig tx creation
        const multisigDeployment = await get("MultiSigWallet");
        let data = stakingModulesProxyInterface.encodeFunctionData("replaceModules", [
            computedModulesToBeReplaced,
            newModulesAddressList,
        ]);

        log("Generating multisig transaction to replace modules...");
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
        log("Staking modules and StakingModuleProxy are deployed (those not modified are reused)");
        log("Prepare and run SIP function in sips.js to create the proposal");
    } else {
        // hh ganache
        await stakingModulesProxy.replaceModules(
            computedModulesToBeReplaced,
            newModulesAddressList
        );
    }
};
func.tags = ["ReplaceStakingModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["StakingModulesProxy", "StakingModules"];
module.exports = func;
