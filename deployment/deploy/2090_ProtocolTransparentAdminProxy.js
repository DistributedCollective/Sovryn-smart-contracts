const func = async ({ deployments: { deploy }, getNamedAccounts }) => {
    const { deployer } = await getNamedAccounts();
    console.log(deployer);
    await deploy("TransparentUpgradableProxyAdmin", {
        skipIfAlreadyDeployed: true,
        contract: "TransparentUpgradableProxyAdmin",
        from: deployer,
        log: true,
        //args: [deployer],
    });
};

func.tags = ["TransparentUpgradableProxyAdmin"];
module.exports = func;
