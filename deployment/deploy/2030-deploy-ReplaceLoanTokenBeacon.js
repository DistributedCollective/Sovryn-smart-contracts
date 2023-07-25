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

    const loanTokenDeploymentIBPRO = await get("LoanToken_iBPRO");
    const loanTokenDeploymentIDLLR = await get("LoanToken_iDLLR");
    const loanTokenDeploymentIDOC = await get("LoanToken_iDOC");
    const loanTokenDeploymentIUSDT = await get("LoanToken_iUSDT");
    const loanTokenDeploymentIXUSD = await get("LoanToken_iXUSD");
    const loanTokenDeploymentIRBTC = await get("LoanToken_iRBTC");

    const loanTokenLogicProxyDeployment = await get("LoanTokenLogicProxy");
    const loanTokenLogicProxyInterface = new ethers.utils.Interface(
        loanTokenLogicProxyDeployment.abi
    );

    const loanTokenLogicBeaconLMDeployment = await get("LoanTokenLogicBeaconLM");
    const loanTokenLogicBeaconWRBTCDeployment = await get("LoanTokenLogicBeaconWRBTC");
    const loanTokenLogicLMDeployment = await get("LoanTokenLogicLM");
    const loanTokenLogicWRBTCDeployment = await get("LoanTokenLogicWrbtc");
    const loanTokenSettingsLowerAdminDeployment = await get("LoanTokenSettingsLowerAdmin");

    const loanTokenLogicBeaconLMContract = await ethers.getContract("LoanTokenLogicBeaconLM");
    const loanTokenLogicBeaconWRBTCContract = await ethers.getContract(
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
        loanTokenWithProxyABI = Contract.from_abi(
            "loanTokenWithProxyABI",
            (address = loanTokenAddress),
            (abi = LoanTokenLogicProxy.abi),
            (owner = conf.acct)
        );
        let data = loanTokenLogicBeaconLMInterface.encodeFunctionData("registerLoanTokenModule", [
            loanTokenLogicLMDeployment.address,
        ]);

        /** iBPRO */
        data = loanTokenLogicProxyInterface.encodeFunctionData("setBeaconAddress", [
            loanTokenLogicBeaconLMDeployment.address,
        ]);
        log("Generating multisig transaction to replace BeaconAddress in loanToken BPRO...");
        await sendWithMultisig(
            multisigDeployment.address,
            loanTokenDeploymentIBPRO.address,
            data,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );

        /** iDLLR */
        data = loanTokenLogicProxyInterface.encodeFunctionData("setBeaconAddress", [
            loanTokenLogicBeaconLMDeployment.address,
        ]);
        log("Generating multisig transaction to replace BeaconAddress in loanToken DLLR...");
        await sendWithMultisig(
            multisigDeployment.address,
            loanTokenDeploymentIDLLR.address,
            data,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );

        /** iDOC */
        data = loanTokenLogicProxyInterface.encodeFunctionData("setBeaconAddress", [
            loanTokenLogicBeaconLMDeployment.address,
        ]);
        log("Generating multisig transaction to replace BeaconAddress in loanToken DOC...");
        await sendWithMultisig(
            multisigDeployment.address,
            loanTokenDeploymentIDOC.address,
            data,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );

        /** iUSDT */
        data = loanTokenLogicProxyInterface.encodeFunctionData("setBeaconAddress", [
            loanTokenLogicBeaconLMDeployment.address,
        ]);
        log("Generating multisig transaction to replace BeaconAddress in loanToken USDT...");
        await sendWithMultisig(
            multisigDeployment.address,
            loanTokenDeploymentIUSDT.address,
            data,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );

        /** iXUSD */
        data = loanTokenLogicProxyInterface.encodeFunctionData("setBeaconAddress", [
            loanTokenLogicBeaconLMDeployment.address,
        ]);
        log("Generating multisig transaction to replace BeaconAddress in loanToken XUSD...");
        await sendWithMultisig(
            multisigDeployment.address,
            loanTokenDeploymentIXUSD.address,
            data,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );

        /** iRBTC to use the loan token logic beacon WRBTC */
        data = loanTokenLogicProxyInterface.encodeFunctionData("setBeaconAddress", [
            loanTokenLogicBeaconWRBTCDeployment.address,
        ]);
        log("Generating multisig transaction to replace BeaconAddress in loanToken RBTC...");
        await sendWithMultisig(
            multisigDeployment.address,
            loanTokenDeploymentIRBTC.address,
            data,
            deployer
        );
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );
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
        // iBPRO
        const loanTokenLogicContractIBPRO = await ethers.getContractAt(
            loanTokenLogicProxyDeployment.abi,
            loanTokenDeploymentIBPRO.address
        );
        await loanTokenLogicContractIBPRO.setBeaconAddress(
            loanTokenLogicBeaconLMDeployment.address
        );

        // iDLLR
        const loanTokenLogicContractIDLLR = await ethers.getContractAt(
            loanTokenLogicProxyDeployment.abi,
            loanTokenDeploymentIDLLR.address
        );
        await loanTokenLogicContractIDLLR.setBeaconAddress(
            loanTokenLogicBeaconLMDeployment.address
        );

        // iDOC
        const loanTokenLogicContractIDOC = await ethers.getContractAt(
            loanTokenLogicProxyDeployment.abi,
            loanTokenDeploymentIDOC.address
        );
        await loanTokenLogicContractIDOC.setBeaconAddress(
            loanTokenLogicBeaconLMDeployment.address
        );

        // iUSDT
        const loanTokenLogicContractIUSDT = await ethers.getContractAt(
            loanTokenLogicProxyDeployment.abi,
            loanTokenDeploymentIUSDT.address
        );
        await loanTokenLogicContractIUSDT.setBeaconAddress(
            loanTokenLogicBeaconLMDeployment.address
        );

        // iXUSD
        const loanTokenLogicContractIXUSD = await ethers.getContractAt(
            loanTokenLogicProxyDeployment.abi,
            loanTokenDeploymentIXUSD.address
        );
        await loanTokenLogicContractIXUSD.setBeaconAddress(
            loanTokenLogicBeaconLMDeployment.address
        );

        // iRBTC
        const loanTokenLogicContractIRBTC = await ethers.getContractAt(
            loanTokenLogicProxyDeployment.abi,
            loanTokenDeploymentIRBTC.address
        );
        await loanTokenLogicContractIRBTC.setBeaconAddress(
            loanTokenLogicBeaconWRBTCDeployment.address
        );
    }
};
func.tags = ["DeployLoanTokenBeacon"];
func.dependencies = ["DeployLoanTokenBeacon"];
module.exports = func;
