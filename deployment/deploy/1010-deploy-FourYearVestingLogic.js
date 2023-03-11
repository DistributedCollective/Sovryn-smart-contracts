const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { ethers } = require("hardhat");
const col = require("cli-color");
// const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, log },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();

    // the logic is used aking Clones design pattern
    // actual vestings are passed the logic at creation and delegate calls to it
    // therefore using it as a library
    log(col.bgYellow("Deploying FourYearVestingLogic..."));
    const tx = await deploy("FourYearVestingLogic", {
        from: deployer,
        args: [],
        log: true,
    });
};
func.tags = ["FourYearVesting"];
func.runAtTheEnd = true;
module.exports = func;
