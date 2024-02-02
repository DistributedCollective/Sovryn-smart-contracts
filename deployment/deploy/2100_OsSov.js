const { upgradeWithTransparentUpgradableProxy } = require("../helpers/helpers");

const func = async (hre) => {
    const {
        deployments: { deploy, getOrNull },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();
    const deploymentName = "OsSOV";
    const deployment = await getOrNull(deploymentName);
    //const minter = await getOrNull("StakingRewardsOs");
    const minter = await getOrNull("StakingRewards"); //@todo replace with StakingRewardsOs
    if (!minter) {
        throw new Error("StakingRewardsOs is not deployed");
    }
    if (deployment) {
        await upgradeWithTransparentUpgradableProxy(
            deployer,
            deploymentName,
            "TransparentUpgradeableProxy",
            undefined,
            `${deploymentName}_Proxy`
        );
    } else {
        await deploy(deploymentName, {
            proxy: {
                owner: deployer,
                proxyContract: "OpenZeppelinTransparentProxy",
                viaAdminContract: {
                    name: "TransparentUpgradableProxyAdmin",
                    artifact: "TransparentUpgradableProxyAdmin",
                },
                execute: {
                    init: {
                        methodName: "initialize",
                        args: [minter.address],
                    },
                },
            },
            from: deployer,
            log: true,
        });
    }
};

func.tags = ["OsSOV"];
// func.dependencies = ["TransparentUpgradableProxyAdmin"];
module.exports = func;
