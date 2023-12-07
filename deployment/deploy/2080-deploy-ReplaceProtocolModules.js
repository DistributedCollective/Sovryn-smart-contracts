const path = require("path");
const hre = require("hardhat");
const { getProtocolModules, sendWithMultisig } = require("../helpers/helpers");
const col = require("cli-color");

const func = async function (hre) {
    const {
        deployments: { get, log, deploy },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();
    const sovrynProtocolDeployment = await get("SovrynProtocol");
    const sovrynProtocol = await ethers.getContract("SovrynProtocol");
    const sovrynProtocolInterface = new ethers.utils.Interface(sovrynProtocolDeployment.abi);

    const modulesList = getProtocolModules();
    const modulesToReplace = [];
    for (const moduleProp in modulesList) {
        const module = modulesList[moduleProp];
        const moduleDeployment = await get(module.moduleName);
        const currentModuleAddress = await sovrynProtocol.getTarget(module.sampleFunction);

        if (currentModuleAddress == moduleDeployment.address) {
            log(col.bgYellow(`Skipping Protocol Modules ${module.moduleName}`));
            continue;
        }

        modulesToReplace.push({
            moduleName: module.moduleName,
            moduleAddress: moduleDeployment.address,
        });
        log(col.bgYellow(`Replacing Protocol Modules ${module.moduleName}`));

        if (hre.network.tags["testnet"]) {
            const multisigDeployment = await get("MultiSigWallet");
            let data = sovrynProtocolInterface.encodeFunctionData("replaceContract", [
                moduleDeployment.address,
            ]);

            log("Generating multisig transaction to replace modules...");
            await sendWithMultisig(
                multisigDeployment.address,
                sovrynProtocolDeployment.address,
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
            log(col.bgBlue("Protocol modules are deployed"));
            log(
                col.bgBlue(
                    "Prepare a SIP creation function in sipArgs.js and run hardhat task `sips:create` to create proposal replacing modules:"
                )
            );

            console.log(col.yellow("modulesToReplace:"));
            for (const moduleToReplace of modulesToReplace) {
                console.log(`${moduleToReplace.moduleName}: ${moduleToReplace.moduleAddress}\n`);
            }
        } else {
            // hh ganache
            await sovrynProtocol.replaceContract(moduleDeployment.address);
        }
    }
};
func.tags = ["ReplaceProtocolModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["ProtocolModules"];
module.exports = func;
