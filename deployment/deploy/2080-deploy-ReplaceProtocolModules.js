const path = require("path");
const hre = require("hardhat");
const { getProtocolModules, sendWithMultisig } = require("../helpers/helpers");
const {
    assertRetainedProtocolRoutes,
    assertCurrentMaintenanceImplementations,
    SELECTED_PROTOCOL_SIGNATURES,
} = require("../helpers/protocolRetention");
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

    // Refuse before any replacement if the explicitly retained live module differs.
    await assertRetainedProtocolRoutes(hre, sovrynProtocol);
    await assertCurrentMaintenanceImplementations(hre);

    const modulesList = getProtocolModules();
    // Existing records for other modules do not authorize their replacement.
    const selectedModules = Object.keys(SELECTED_PROTOCOL_SIGNATURES).map((name) => {
        const module = modulesList[name];
        if (!module || module.moduleName !== name)
            throw new Error(`missing authorized protocol module ${name}`);
        return module;
    });
    const modulesToReplace = [];
    for (const module of selectedModules) {
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

    // Pin the borrower-exit charge hook (BorrowerExitPerimeterOps) on the proxy.
    // onlyOwner — on testnet/mainnet this must be bundled into the same
    // multisig/SIP that registers ExitFeeModule (the setter selector only
    // becomes reachable once ExitFeeModule is registered above); locally we
    // call it directly. Until it is set, borrower exits fail-open to full gross.
    const opsDeployment = await get("BorrowerExitPerimeterOps");
    if (hre.network.tags["testnet"] || hre.network.tags["mainnet"]) {
        log(
            col.bgBlue(
                `>>> Governance must also call setBorrowerExitPerimeterOps(${opsDeployment.address}) <<<`
            )
        );
    } else {
        const exitFeeModuleDeployment = await get("ExitFeeModule");
        const proxyAsExitFee = new ethers.Contract(
            sovrynProtocolDeployment.address,
            exitFeeModuleDeployment.abi,
            (await ethers.getSigners())[0]
        );
        if ((await proxyAsExitFee.borrowerExitPerimeterOps()) != opsDeployment.address) {
            await proxyAsExitFee.setBorrowerExitPerimeterOps(opsDeployment.address);
            log(col.bgYellow(`Pinned BorrowerExitPerimeterOps: ${opsDeployment.address}`));
        }
    }
    await assertRetainedProtocolRoutes(hre, sovrynProtocol);
};
func.tags = ["ReplaceProtocolModules"]; // getContractNameFromScriptFileName(path.basename(__filename))
func.dependencies = ["ProtocolModules", "BorrowerExitPerimeterOps"];
module.exports = func;
