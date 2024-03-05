const { ethers } = require("hardhat");
const col = require("cli-color");
const { CONFIG_DEPLOYMENT_PARAMS } = require("./config/data");
const func = async function (hre) {
    const {
        deployments: { deploy, log },
        getNamedAccounts,
        network
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();
    const configDeploymentParams = CONFIG_DEPLOYMENT_PARAMS[network.name]
    log(col.bgYellow("Deploying MultiSigWallet..."));
    await deploy("MultiSigWallet", {
        from: deployer,
        args: [configDeploymentParams.multisigOwners],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
func.tags = ["MultiSigWallet"];
module.exports = func;
