const { upgradeWithTransparentUpgradableProxy } = require("../helpers/helpers");
const { getContractNameFromScriptFileName } = require("../helpers/utils");

const path = require("path");

const func = async (hre) => {
    const {
        deployments: { deploy, getOrNull, get, catchUnknownSigner },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts();
    const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
    const deployment = await getOrNull(deploymentName);

    //     function initialize(
    //     address _osSOV,
    //     IStaking _staking,
    //     uint256 _averageBlockTime
    // )

    const osSOV = await get("OsSOV");
    const staking = await get("Staking");
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
        console.log("initial deployment");
        //await catchUnknownSigner(
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
                            osSOV.address,
                            staking.address,
                            30, //seconds average block time
                        ],
                    },
                },
            },
            from: deployer,
            log: true,
        });
        //);
    }
};

func.tags = ["StakingRewardsOs"];
func.dependencies = ["TransparentUpgradableProxyAdmin", "OsSOV"];
module.exports = func;
