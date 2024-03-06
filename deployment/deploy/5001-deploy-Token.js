const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { ethers } = require("hardhat");
const col = require("cli-color");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, log },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();
    log(col.bgYellow("Deploying Token..."));
    await deploy("Token", {
        from: deployer,
        // @todo change the name & symbol
        args: ["Bob SOV", "bSov"],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    const multisigDeployment = await get("MultiSigWallet");
    const tokenSov = await ethers.getContract("TokenSov");
    await tokenSov.transferOwnership(multisigDeployment.address);
};
func.tags = ["TokenSov"];
module.exports = func;
