const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { deployWithCustomProxy } = require("../helpers/helpers");
const { ethers } = require("hardhat");
const col = require("cli-color");
// const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();
    // const deployWithCustomProxy = async(deployer, logicName, proxyName, logicProxyName, isOwnerMultisig = false, multisigName = "MultiSigWallet", logicInstanceName = "", args = [], proxyArgs = [])
    // using VestingRegistryInstance for logicName because VestingRegistry already exists
    log(col.bgYellow("Deploying VestingRegistry..."));
    await deployWithCustomProxy(
        deployer,
        "VestingRegistryLogic",
        "VestingRegistryProxy",
        "VestingRegistry",
        undefined,
        true
    );
};
func.tags = ["VestingRegistry"];
func.runAtTheEnd = true;
module.exports = func;
