const { deployWithCustomProxy } = require("../helpers/helpers");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);

const func = async function (hre) {
    const {
        deployments: { get },
        getNamedAccounts,
    } = hre;

    const { deployer } = await getNamedAccounts();

    // Existing protocol + staking proxies (still the same addresses)
    const protocol = (await get("SovrynProtocol")).address;
    const staking = (await get("StakingProxy")).address;

    await logger.warn("Deploying FeeSharingCollector V2 (new proxy + new implementation)...");

    await deployWithCustomProxy(
        deployer,
        "FeeSharingCollector", // artifact (Solidity contract)
        "FeeSharingCollectorProxy", // proxy artifact (Solidity contract)
        "FeeSharingCollectorV2", // NEW logic instance name => NEW impl name FeeSharingCollectorV2_Implementation
        "FeeSharingCollector_ProxyV2", // NEW proxy instance name => NEW proxy address
        false, // isOwnerMultisig (only matters for upgrades; new proxy will still deploy fine)
        [],
        [protocol, staking]
    );
};

func.tags = ["FeeSharingCollectorV2"];
module.exports = func;
