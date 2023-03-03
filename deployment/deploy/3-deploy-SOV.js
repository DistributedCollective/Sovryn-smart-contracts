const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { ethers } = require("hardhat");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();
    const sovTotalSupply = ethers.utils.parseEther("100000000");

    await deploy("SOV", {
        from: deployer,
        args: [sovTotalSupply],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
func.tags = ["SOV"];
module.exports = func;
