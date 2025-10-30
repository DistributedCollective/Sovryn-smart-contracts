const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const {
    LOAN_ID_MUTEX_DEPLOY_DATA,
    getOrDeployLoanIdMutex,
} = require("../helpers/reentrancy/utils");

const func = async function (hre) {
    const {
        deployments: { deploy, log, getOrNull },
        getNamedAccounts,
        network,
        ethers,
    } = hre;
    const { contractAddress } = LOAN_ID_MUTEX_DEPLOY_DATA;
    logger.warn("Deploying LoanIdMutex...");

    // getOrDeployLoanIdMutex will automatically fund the deployer address if needed
    const loanIdMutex = await getOrDeployLoanIdMutex();
    if (loanIdMutex.address !== contractAddress) {
        throw Exception(
            `LoanIdMutex address is ${loanIdMutex.address}, expected ${contractAddress}`
        );
    }
    logger.warn("LoanIdMutex deployed");
};
func.tags = ["LoanIdMutex"];
module.exports = func;
