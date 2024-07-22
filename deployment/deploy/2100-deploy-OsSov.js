const { upgradeWithTransparentUpgradableProxy } = require("../helpers/helpers");
const col = require("cli-color");

const func = async (hre) => {
    const {
        deployments: { deploy, getOrNull, get, log },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();
    const deploymentName = "OsSOV";
    const deployment = await getOrNull(deploymentName);
    const minter = await getOrNull("StakingRewardsOs");
    const multisig = await get("MultiSigWallet");
    if (deployment) {
        await upgradeWithTransparentUpgradableProxy(
            deployer,
            deploymentName,
            "TransparentUpgradeableProxy",
            undefined,
            `${deploymentName}_Proxy`
        );
    } else {
        log(col.yellow("Deploying OsSOV..."));
        await deploy(deploymentName, {
            proxy: {
                owner: multisig.address,
                proxyContract: "OpenZeppelinTransparentProxy",
                viaAdminContract: {
                    name: "TransparentUpgradableProxyAdmin",
                    artifact: "TransparentUpgradableProxyAdmin",
                },
                execute: {
                    init: {
                        methodName: "initialize",
                        args: [
                            multisig.address, //owner
                            multisig.address, //DEFAULT_ADMIN_ROLE
                            minter ? minter.address : ethers.constants.AddressZero, // AUTHORISED_MINTER_ROLE
                        ],
                    },
                },
            },
            from: deployer,
            log: true,
        });
    }
};

func.tags = ["OsSOV"];
func.dependencies = ["TransparentUpgradableProxyAdmin"];
module.exports = func;
