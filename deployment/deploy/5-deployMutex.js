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
    const { deployerAddress, contractAddress } = SAVED_DEPLOY_DATA;
    logger.warn("Deploying Mutex...");

    if (ethers.provider.getBalance(deployerAddress) === 0) {
        throw Exception("Deployer balance is zero");
    }

    const mutex = await getOrDeployMutex();
    if (mutex.address !== contractAddress) {
        throw Exception(`Mutex address is ${mutex.address}, expected ${contractAddress}`);
    }
    logger.warn("Mutex deployed");
};
func.tags = ["Mutex"];
module.exports = func;
