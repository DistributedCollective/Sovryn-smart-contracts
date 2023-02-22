const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { ethers } = require("hardhat");

// const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();

    // the logic is used aking Clones design pattern
    // actual vestings are passed the logic at creation and delegate calls to it
    // therefore using it as a library
    const tx = await deploy("FourYearVestingLogic", {
        from: deployer,
        args: [],
        log: true,
    });
};
func.tags = ["FourYearVestingLogic"];
module.exports = func;
