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

    const loanTokens = await getLoanTokensData();

    log(col.bgYellow("Setting Loan Tokens Params"));

    // for each token:
    // - if StakingContractAddress is not equal to the deployment address
    //    create multisig tx to set it `setStakingContractAddress`

    if (hre.network.tags["testnet"] || hre.network.tags["mainnet"]) {
        const loanTokenLogicProxyInterface = (
            await ethers.getContractFactory("LoanTokenLogicProxy")
        ).interface;

        const lowerAdminDeployment = await get("LoanTokenSettingsLowerAdmin");

        const lowerAdminInterface = new ethers.utils.Interface(lowerAdminDeployment.abi);
        const stakingContractAddress = (await get("Staking")).address;
        const data = lowerAdminInterface.encodeFunctionData("setStakingContractAddress", [
            stakingContractAddress,
        ]);
        const multisigDeployment = await get("MultiSigWallet");

        log(col.bgYellow(`Setting Staking address ${stakingContractAddress}:...`));

        for (let i = 0; i < loanTokens.length; i++) {
            const lowerAdminAtLoanToken = await ethers.getContractAt(
                "LoanTokenSettingsLowerAdmin",
                lowerAdminDeployment.address
            );
            if (
                (await lowerAdminAtLoanToken.getStakingContractAddress()) != stakingContractAddress
            ) {
                log(
                    `Generating multisig transaction to set Staking contract address in loanToken ${loanTokens[i].name}`
                );
                await sendWithMultisig(
                    multisigDeployment.address,
                    loanTokens[i].deployment.address,
                    data,
                    deployer
                );
            } else {
                log(col.bgBlue(`Staking address already set on ${loanTokens[i].name}`));
            }
        }
        log(
            col.bgBlue(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
            )
        );
    } else {
        // hh ganache
        /** Replace loan token logic beacon in proxy */
        for (let i = 0; i < loanTokens.length; i++) {
            const loanTokenLogic = await ethers.getContractAt(
                lowerAdminInterface.abi,
                loanTokens[i].deployment.address
            );
            await loanTokenLogic.setStakingContractAddress(stakingContractAddress);
        }
    }
};
func.tags = ["SetLoanTokenParams"];
// func.dependencies = ["DeployLoanTokenBeacon"];
module.exports = func;
