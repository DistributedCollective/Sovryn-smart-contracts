const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const { sendWithMultisig } = require("../helpers/helpers");
const col = require("cli-color");

const { arrayToUnique } = require("../helpers/utils");

const func = async function (hre) {
    const {
        deployments: { get, log, deploy },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();

    // REPLACE MODULES //
    log(col.bgYellow("Replacing LoanToken Modules..."));

    const loanTokenLogicBeaconLMDeployment = await get("LoanTokenLogicBeaconLM");
    const loanTokenLogicBeaconWRBTCDeployment = await get("LoanTokenLogicBeaconWRBTC");
    const loanTokenLogicLMDeployment = await get("LoanTokenLogicLM");
    const loanTokenLogicWRBTCDeployment = await get("LoanTokenLogicWrbtc");
    const loanTokenSettingsLowerAdminDeployment = await get("LoanTokenSettingsLowerAdmin");

    const loanTokenLogicBeaconLMContract = await ethers.getContract("LoanTokenLogicBeaconLM");
    const loanTokenLogicBeaconWRBTCContract = await ethers.getContract("LoanTokenLogicBeaconWRBTC");

    const loanTokenLogicBeaconLMInterface = new ethers.utils.Interface(
        loanTokenLogicBeaconLMDeployment.abi
    );

    const loanTokenLogicBeaconWRBTCInterface = new ethers.utils.Interface(
        loanTokenLogicBeaconWRBTCDeployment.abi
    );

    if (hre.network.tags["testnet"] || hre.network.tags["mainnet"]) {
        const multisigDeployment = await get("MultiSigWallet");

        /** 1. Registering function signature to the LoanTokenLogicBeaconLM */
        log(col.bgYellow("Registering function signature to the LoanTokenLogicBeaconLM..."));

        let data = loanTokenLogicBeaconLMInterface.encodeFunctionData("registerLoanTokenModule", [
            loanTokenLogicLMDeployment.address,
        ]);

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

        /** 2. Registering Loan Protocol Settings Module to LoanTokenLogicBeaconLM */
        log(
            col.bgYellow("Registering Loan Protocol Settings Module to LoanTokenLogicBeaconLM...")
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

        /** 3. Registering function signature to the LoanTokenLogicBeaconWRBTC */
        log(col.bgYellow("Registering function signature to the LoanTokenLogicBeaconWRBTC..."));

        data = loanTokenLogicBeaconWRBTCInterface.encodeFunctionData("registerLoanTokenModule", [
            loanTokenLogicWRBTCDeployment.address,
        ]);

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

        /** 4. Registering Loan Protocol Settings Module to LoanTokenLogicBeaconWrbtc */
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
    }
};
func.tags = ["ReplaceLoanTokenModules"];
func.dependencies = ["LoanTokenModules"];
module.exports = func;
