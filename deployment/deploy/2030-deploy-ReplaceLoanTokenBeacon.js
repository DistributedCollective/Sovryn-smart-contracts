const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const { sendWithMultisig } = require("../helpers/helpers");
const col = require("cli-color");
const { getLoanTokenModulesNames, getLoanTokensData } = require("../helpers/helpers");

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

    const loanTokenLogicProxyInterface = (await ethers.getContractFactory("LoanTokenLogicProxy"))
        .interface;

    const loanTokenLogicBeaconLMDeployment = await get("LoanTokenLogicBeaconLM");
    const loanTokenLogicBeaconWRBTCDeployment = await get("LoanTokenLogicBeaconWrbtc");
    const loanTokenLogicLMDeployment = await get("LoanTokenLogicLM");
    const loanTokenLogicWRBTCDeployment = await get("LoanTokenLogicWrbtc");
    const loanTokenSettingsLowerAdminDeployment = await get("LoanTokenSettingsLowerAdmin");

    const loanTokenLogicBeaconLMContract = await ethers.getContract("LoanTokenLogicBeaconLM");
    const loanTokenLogicBeaconWRBTCContract = await ethers.getContract(
        "LoanTokenLogicBeaconWrbtc"
    );

    const loanTokenLogicBeaconLMInterface = new ethers.utils.Interface(
        loanTokenLogicBeaconLMDeployment.abi
    );

    const loanTokenLogicBeaconWRBTCInterface = new ethers.utils.Interface(
        loanTokenLogicBeaconWRBTCDeployment.abi
    );

    const loanTokens = await getLoanTokensData();

    if (hre.network.tags["testnet"] || hre.network.tags["mainnet"]) {
        const multisigDeployment = await get("MultiSigWallet");

        /** 1. Registering function signature to the new LoanTokenLogicBeaconLM */
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

        /** 2. Registering Loan Protocol Settings Module to LoanTokenLogicBeaconLM */
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

        /** 3. Registering function signature to the LoanTokenLogicBeaconWRBTC */
        activeModuleIndex = await loanTokenLogicBeaconWRBTCContract.activeModuleIndex(
            ethers.utils.formatBytes32String(modulesList.LoanTokenLogicWrbtc)
        );
        moduleImplAddress = await loanTokenLogicBeaconWRBTCContract.moduleUpgradeLog(
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

        /** 4. Registering Loan Protocol Settings Module to LoanTokenLogicBeaconWrbtc */
        activeModuleIndex = await loanTokenLogicBeaconWRBTCContract.activeModuleIndex(
            ethers.utils.formatBytes32String(modulesList.LoanTokenSettingsLowerAdmin)
        );
        moduleImplAddress = await loanTokenLogicBeaconWRBTCContract.moduleUpgradeLog(
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

        /** 5. Replace loan token logic beacon in proxy */
        for (let i = 0; i < loanTokens.length; i++) {
            data = loanTokenLogicProxyInterface.encodeFunctionData("setBeaconAddress", [
                loanTokens[i].beaconAddress,
            ]);
            log(
                `Generating multisig transaction to replace BeaconAddress in loanToken ${loanTokens[i].name}...`
            );
            await sendWithMultisig(
                multisigDeployment.address,
                loanTokens[i].deployment.address,
                data,
                deployer
            );
            log(
                col.bgBlue(
                    `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
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
        await loanTokenLogicBeaconWRBTCContract.registerLoanTokenModule(
            loanTokenLogicWRBTCDeployment.address
        );
        await loanTokenLogicBeaconWRBTCContract.registerLoanTokenModule(
            loanTokenSettingsLowerAdminDeployment.address
        );

        /** Replace loan token logic beacon in proxy */
        for (let i = 0; i < loanTokens.length; i++) {
            const loanTokenLogicContractIBPRO = await ethers.getContractAt(
                loanTokenLogicProxyDeployment.abi,
                loanTokens[i].deployment.address
            );
            await loanTokenLogicContractIBPRO.setBeaconAddress(loanTokens[i].beaconAddress);
        }
    }
};
func.tags = ["ReplaceLoanTokenBeacon"];
func.dependencies = ["DeployLoanTokenBeacon"];
module.exports = func;
