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
    log(col.bgYellow("Deploying WETH..."));
    await deploy("WETH", {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
func.tags = ["WETH"];
module.exports = func;
