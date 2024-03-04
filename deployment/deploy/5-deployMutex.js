const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { SAVED_DEPLOY_DATA, getOrDeployMutex } = require("../helpers/reentrancy/utils");

const func = async function (hre) {
    const {
        deployments: { deploy, log, getOrNull },
        getNamedAccounts,
        network,
        ethers,
    } = hre;
    let deployer, owners, requiredSigners;
    logger.warn("Deploying Mutex...");
    deployer = SAVED_DEPLOY_DATA.deployer;
    if (ethers.provider.getBalance(deployer) === 0) {
        throw Exception("Deployer balance is zero");
    }

    const mutex = await getOrDeployMutex();
    if (mutex.address !== SAVED_DEPLOY_DATA.contractAddress) {
        throw Exception(
            `Mutex address is ${mutex.address}, expected ${SAVED_DEPLOY_DATA.contractAddress}`
        );
    }
    logger.warn("Mutex deployed");
};
func.tags = ["Mutex"];
module.exports = func;
