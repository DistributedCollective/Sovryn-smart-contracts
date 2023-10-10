const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const col = require("cli-color");
const { getLoanTokensData } = require("../helpers/helpers");

const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners(); //

    const multisigDeployment = await get("MultiSigWallet");

    // Deploy loan token logic proxy //
    log(col.bgYellow("Deploying LoanTokenLogicProxy..."));
    const tx = await deploy("LoanTokenLogicProxy", {
        from: deployer,
        args: [],
        log: true,
        contract: "LoanTokenLogicProxy",
    });

    const loanTokens = await getLoanTokensData();
    const loanTokenLogicProxyDeployment = await get("LoanTokenLogicProxy");
    const loanTokenLogicProxyInterface = new ethers.utils.Interface(
        loanTokenLogicProxyDeployment.abi
    );

    for (let i = 0; i < loanTokens.length; i++) {
        let loanTokenContract = await ethers.getContractAt(
            loanTokenLogicProxyInterface,
            loanTokens[i].deployment.address
        );

        const currentLoanTokenTarget = await loanTokenContract.getTarget();

        /** If the loanToken already used the correct loanTokenLogicProxy, skip it */
        if (currentLoanTokenTarget == loanTokenLogicProxyDeployment.address) {
            log(col.bgGreen(`Skipping LoanTokenLogicProxy replacement of ${loanTokens[i].name}`));
            continue;
        }

        log(col.bgYellow(`Replacing LoanTokenLogicProxy of ${loanTokens[i].name}`));
        loanTokenContract = await ethers.getContract(`LoanToken_${loanTokens[i].name}`);

        const loanTokenInterface = new ethers.utils.Interface(loanTokens[i].deployment.abi);
        let data = loanTokenInterface.encodeFunctionData("setTarget", [
            loanTokenLogicProxyDeployment.address,
        ]);

        log(
            `Generating multisig transaction to replace LoanTokenLogicProxy of ${loanTokens[i].name}`
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
};
func.tags = ["DeployLoanTokenLogicProxy"];
module.exports = func;
