const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { ethers } = require("hardhat");
const col = require("cli-color");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        //ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();
    const sovTotalSupply = ethers.utils.parseEther("100000000");
    log(col.bgYellow("Deploying StakingProxy..."));
    await deploy("StakingProxy", {
        from: deployer,
        args: [(await get("SOV")).address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
func.tags = ["StakingProxy"];
func.dependencies = ["SOV"];
module.exports = func;
