const func = async ({ deployments: { deploy, get }, getNamedAccounts, ethers }) => {
    const { deployer } = await getNamedAccounts();
    const multisig = await get("MultiSigWallet");
    const tx = await deploy("TransparentUpgradableProxyAdmin", {
        skipIfAlreadyDeployed: true,
        contract: "TransparentUpgradableProxyAdmin",
        from: deployer,
        log: true,
    });
    if (tx.newlyDeployed) {
        const proxy = await ethers.getContract("TransparentUpgradableProxyAdmin");
        await proxy.transferOwnership(multisig.address);
    }
};

func.tags = ["TransparentUpgradableProxyAdmin"];
module.exports = func;
