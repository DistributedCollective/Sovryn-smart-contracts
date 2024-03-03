const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { ethers } = require("hardhat");
const col = require("cli-color");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, log, getOrNull },
        getNamedAccounts,
        network,
    } = hre;
    let deployer, owners, requiredSigners;
    log(col.bgYellow("Deploying MultiSigWallet..."));
    const msDeployment = await getOrNull("MultiSigWallet");
    if (msDeployment) {
        log(col.yellow("MultiSigWallet already deployed"));
        return;
    }
    if (network.tags.mainnet || network.tags.testnet) {
        deployer = (await getNamedAccounts()).deployer;
        owners = []; // @todo add owners or use hh ingnition module for the mainnet
        requiredSigners = hre.networks.tags["mainnet"] ? 3 : 2;
    } else {
        [deployer, owner2, owner3] = (await ethers.getSigners()).map((signer) => signer.address);
        owners = [deployer, owner2, owner3];
        requiredSigners = 2;
    }
    await deploy("MultiSigWallet", {
        from: deployer,
        args: [owners, requiredSigners],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
func.tags = ["MultiSigWallet"];
module.exports = func;
