const { deployWithCustomProxy } = require("../helpers/helpers");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const func = async function (hre) {
    const {
        deployments: { get },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();
    await logger.warn("Deploying FeeSharingCollector...");
    await deployWithCustomProxy(
        deployer,
        "FeeSharingCollector",
        "FeeSharingCollectorProxy",
        "",
        "FeeSharingCollector_Proxy",
        true,
        [],
        [(await get("SovrynProtocol")).address, (await get("StakingProxy")).address]
    );
};
func.tags = ["FeeSharingCollector"];
module.exports = func;
