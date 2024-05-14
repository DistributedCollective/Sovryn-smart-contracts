const col = require("cli-color");
const func = async ({ deployments: { deploy, log, get }, getNamedAccounts, ethers }) => {
    const { deployer } = await getNamedAccounts();
    const multisig = await get("ContractsGuardianMultisig");
    const tx = await deploy("TransparentUpgradableProxyAdmin", {
        skipIfAlreadyDeployed: true,
        contract: "TransparentUpgradableProxyAdmin",
        from: deployer,
        log: true,
    });
    if (tx.newlyDeployed) {
        log(col.yellow("Transferring ownership to Multisig..."));
        const proxy = await ethers.getContract("TransparentUpgradableProxyAdmin");
        await (await proxy.transferOwnership(multisig.address)).wait();
    }
};

func.tags = ["TransparentUpgradableProxyAdmin"];
module.exports = func;
