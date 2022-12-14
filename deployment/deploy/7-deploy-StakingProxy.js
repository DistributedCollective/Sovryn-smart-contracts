const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { ethers } = require("hardhat");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        //ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();
    const sovTotalSupply = ethers.utils.parseEther("100000000");

    const txSov = await deploy("SOV", {
        from: deployer,
        args: [sovTotalSupply],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    await deploy("StakingProxy", {
        from: deployer,
        args: [txSov.address ? txSov.address : (await get("SOV")).address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};
func.tags = ["StakingProxy"];
module.exports = func;
