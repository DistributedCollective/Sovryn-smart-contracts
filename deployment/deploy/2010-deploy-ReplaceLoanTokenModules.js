const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const { sendWithMultisig } = require("../helpers/helpers");
const col = require("cli-color");
const { getLoanTokenModulesNames } = require("../helpers/helpers");

const { arrayToUnique } = require("../helpers/utils");

const func = async function (hre) {
    const {
        deployments: { get, log, deploy },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();

    const modulesList = getLoanTokenModulesNames();

    // REPLACE MODULES //
    log(col.bgYellow("Replacing LoanToken Modules..."));

    const loanTokenLogicBeaconLMDeployment = await get("LoanTokenLogicBeaconLM");
    const loanTokenLogicBeaconWRBTCDeployment = await get("LoanTokenLogicBeaconWRBTC");
    const loanTokenLogicLMDeployment = await get("LoanTokenLogicLM");
    const loanTokenLogicWRBTCDeployment = await get("LoanTokenLogicWrbtc");
    const loanTokenSettingsLowerAdminDeployment = await get("LoanTokenSettingsLowerAdmin");
    const loanTokenMintAndBurnDeployment = await get("LoanTokenMintAndBurn");
    const loanTokenMintAndBurnWrbtcDeployment = await get("LoanTokenMintAndBurnWrbtc");

    const loanTokenLogicBeaconLMContract = await ethers.getContract("LoanTokenLogicBeaconLM");
    const loanTokenLogicBeaconWrbtcContract = await ethers.getContract(
        "LoanTokenLogicBeaconWRBTC"
    );

    const loanTokenLogicBeaconLMInterface = new ethers.utils.Interface(
        loanTokenLogicBeaconLMDeployment.abi
    );

    const loanTokenLogicBeaconWRBTCInterface = new ethers.utils.Interface(
        loanTokenLogicBeaconWRBTCDeployment.abi
    );

    if (hre.network.tags["testnet"] || hre.network.tags["mainnet"]) {
        const multisigDeployment = await get("MultiSigWallet");

        /** 1. Registering function signature to the LoanTokenLogicBeaconLM */
        let activeModuleIndex = await loanTokenLogicBeaconLMContract.activeModuleIndex(
            ethers.utils.formatBytes32String(modulesList.LoanTokenLogicLM)
        );
        let moduleImplAddress = await loanTokenLogicBeaconLMContract.moduleUpgradeLog(
            ethers.utils.formatBytes32String(modulesList.LoanTokenLogicLM),
            activeModuleIndex
        );
        if (
            moduleImplAddress["implementation"].toLowerCase() !==
            loanTokenLogicLMDeployment.address.toLowerCase()
        ) {
            log(col.bgYellow("Registering function signature to the LoanTokenLogicBeaconLM..."));
            let data = loanTokenLogicBeaconLMInterface.encodeFunctionData(
                "registerLoanTokenModule",
                [loanTokenLogicLMDeployment.address]
            );

            log("Generating multisig transaction to replace LoanTokenLogicBeaconLM...");
            await sendWithMultisig(
                multisigDeployment.address,
                loanTokenLogicBeaconLMDeployment.address,
                data,
                deployer
            );
            log(
                col.bgBlue(
                    `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
                )
            );
        } else {
            log(
                col.bgYellow(
                    "Skipping LoanTokenLogicBeaconLM registration in LoanTokenLogicBeaconLM..."
                )
            );
        }

        /** 2. Registering Loan Token Mint and Burn Module to LoanTokenLogicBeaconLM */
        activeModuleIndex = await loanTokenLogicBeaconLMContract.activeModuleIndex(
            ethers.utils.formatBytes32String(modulesList.LoanTokenMintAndBurn)
        );
        moduleImplAddress = await loanTokenLogicBeaconLMContract.moduleUpgradeLog(
            ethers.utils.formatBytes32String(modulesList.LoanTokenMintAndBurn),
            activeModuleIndex
        );
        if (
            moduleImplAddress["implementation"].toLowerCase() !==
            loanTokenMintAndBurnDeployment.address.toLowerCase()
        ) {
            log(
                col.bgYellow(
                    "Registering Loan Token Mint and Burn Module to LoanTokenLogicBeaconLM..."
                )
            );

            data = loanTokenLogicBeaconLMInterface.encodeFunctionData("registerLoanTokenModule", [
                loanTokenMintAndBurnDeployment.address,
            ]);

            log("Generating multisig transaction to replace LoanTokenMintAndBurn in beacon LM...");
            await sendWithMultisig(
                multisigDeployment.address,
                loanTokenLogicBeaconLMDeployment.address,
                data,
                deployer
            );
            log(
                col.bgBlue(
                    `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
                )
            );
        } else {
            log(
                col.bgYellow(
                    "Skipping LoanTokenMintAndBurn registration in LoanTokenLogicBeaconLM..."
                )
            );
        }

        /** 3. Registering Loan Protocol Settings Module to LoanTokenLogicBeaconLM */
        activeModuleIndex = await loanTokenLogicBeaconLMContract.activeModuleIndex(
            ethers.utils.formatBytes32String(modulesList.LoanTokenSettingsLowerAdmin)
        );
        moduleImplAddress = await loanTokenLogicBeaconLMContract.moduleUpgradeLog(
            ethers.utils.formatBytes32String(modulesList.LoanTokenSettingsLowerAdmin),
            activeModuleIndex
        );
        if (
            moduleImplAddress["implementation"].toLowerCase() !==
            loanTokenSettingsLowerAdminDeployment.address.toLowerCase()
        ) {
            log(
                col.bgYellow(
                    "Registering Loan Protocol Settings Module to LoanTokenLogicBeaconLM..."
                )
            );

            data = loanTokenLogicBeaconLMInterface.encodeFunctionData("registerLoanTokenModule", [
                loanTokenSettingsLowerAdminDeployment.address,
            ]);

            log(
                "Generating multisig transaction to replace LoanTokenSettingsLowerAdmin in beacon LM..."
            );
            await sendWithMultisig(
                multisigDeployment.address,
                loanTokenLogicBeaconLMDeployment.address,
                data,
                deployer
            );
            log(
                col.bgBlue(
                    `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
                )
            );
        } else {
            log(
                col.bgYellow(
                    "Skipping LoanTokenSettingsLowerAdmin registration in LoanTokenLogicBeaconLM..."
                )
            );
        }

        /** 4. Registering function signature to the LoanTokenLogicBeaconWRBTC */
        activeModuleIndex = await loanTokenLogicBeaconWrbtcContract.activeModuleIndex(
            ethers.utils.formatBytes32String(modulesList.LoanTokenLogicWrbtc)
        );
        moduleImplAddress = await loanTokenLogicBeaconWrbtcContract.moduleUpgradeLog(
            ethers.utils.formatBytes32String(modulesList.LoanTokenLogicWrbtc),
            activeModuleIndex
        );
        if (
            moduleImplAddress["implementation"].toLowerCase() !==
            loanTokenLogicWRBTCDeployment.address.toLowerCase()
        ) {
            log(
                col.bgYellow("Registering function signature to the LoanTokenLogicBeaconWRBTC...")
            );

            data = loanTokenLogicBeaconWRBTCInterface.encodeFunctionData(
                "registerLoanTokenModule",
                [loanTokenLogicWRBTCDeployment.address]
            );

            log("Generating multisig transaction to replace LoanTokenLogicBeaconWRBTC...");
            await sendWithMultisig(
                multisigDeployment.address,
                loanTokenLogicBeaconWRBTCDeployment.address,
                data,
                deployer
            );
            log(
                col.bgBlue(
                    `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
                )
            );
        } else {
            log(
                col.bgYellow(
                    "Skipping LoanTokenLogicWrbtc registration in LoanTokenLogicBeaconWRBTC..."
                )
            );
        }

        /** 5. Registering Loan Token Mint and Burn Wrbtc Module to LoanTokenLogicBeaconWrbtc */
        activeModuleIndex = await loanTokenLogicBeaconWrbtcContract.activeModuleIndex(
            ethers.utils.formatBytes32String(modulesList.LoanTokenMintAndBurnWrbtc)
        );
        moduleImplAddress = await loanTokenLogicBeaconWrbtcContract.moduleUpgradeLog(
            ethers.utils.formatBytes32String(modulesList.LoanTokenMintAndBurnWrbtc),
            activeModuleIndex
        );
        if (
            moduleImplAddress["implementation"].toLowerCase() !==
            loanTokenMintAndBurnWrbtcDeployment.address.toLowerCase()
        ) {
            log(
                col.bgYellow(
                    "Registering Loan Token Mint and Burn Wrbtc Module to LoanTokenLogicBeaconWrbtc..."
                )
            );

            data = loanTokenLogicBeaconLMInterface.encodeFunctionData("registerLoanTokenModule", [
                loanTokenMintAndBurnWrbtcDeployment.address,
            ]);

            log(
                "Generating multisig transaction to replace LoanTokenMintAndBurnWrbtc in beacon WRBTC..."
            );
            await sendWithMultisig(
                multisigDeployment.address,
                loanTokenLogicBeaconWRBTCDeployment.address,
                data,
                deployer
            );
            log(
                col.bgBlue(
                    `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
                )
            );
        } else {
            log(
                col.bgYellow(
                    "Skipping loanTokenMintAndBurnWrbtc registration in LoanTokenLogicBeaconWrbtc..."
                )
            );
        }

        /** 6. Registering Loan Protocol Settings Module to LoanTokenLogicBeaconWrbtc */
        activeModuleIndex = await loanTokenLogicBeaconWrbtcContract.activeModuleIndex(
            ethers.utils.formatBytes32String(modulesList.LoanTokenSettingsLowerAdmin)
        );
        moduleImplAddress = await loanTokenLogicBeaconWrbtcContract.moduleUpgradeLog(
            ethers.utils.formatBytes32String(modulesList.LoanTokenSettingsLowerAdmin),
            activeModuleIndex
        );
        if (
            moduleImplAddress["implementation"].toLowerCase() !==
            loanTokenSettingsLowerAdminDeployment.address.toLowerCase()
        ) {
            log(
                col.bgYellow(
                    "Registering Loan Protocol Settings Module to LoanTokenLogicBeaconWrbtc..."
                )
            );

            data = loanTokenLogicBeaconLMInterface.encodeFunctionData("registerLoanTokenModule", [
                loanTokenSettingsLowerAdminDeployment.address,
            ]);

            log(
                "Generating multisig transaction to replace LoanTokenSettingsLowerAdmin in beacon WRBTC..."
            );
            await sendWithMultisig(
                multisigDeployment.address,
                loanTokenLogicBeaconWRBTCDeployment.address,
                data,
                deployer
            );
            log(
                col.bgBlue(
                    `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
                )
            );
        } else {
            log(
                col.bgYellow(
                    "Skipping LoanTokenSettingsLowerAdmin registration in LoanTokenLogicBeaconWrbtc..."
                )
            );
        }
    } else {
        // hh ganache
        await loanTokenLogicBeaconLMContract.registerLoanTokenModule(
            loanTokenLogicLMDeployment.address
        );
        await loanTokenLogicBeaconLMContract.registerLoanTokenModule(
            loanTokenSettingsLowerAdminDeployment.address
        );
        await loanTokenLogicBeaconLMContract.registerLoanTokenModule(
            loanTokenMintAndBurnDeployment.address
        );
        await loanTokenLogicBeaconWrbtcContract.registerLoanTokenModule(
            loanTokenLogicWRBTCDeployment.address
        );
        await loanTokenLogicBeaconWrbtcContract.registerLoanTokenModule(
            loanTokenSettingsLowerAdminDeployment.address
        );
        await loanTokenLogicBeaconWrbtcContract.registerLoanTokenModule(
            loanTokenMintAndBurnWrbtcDeployment.address
        );
    }
};
func.tags = ["ReplaceLoanTokenModules"];
func.dependencies = ["LoanTokenModules"];
module.exports = func;
