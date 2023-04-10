const path = require("path");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const { sendWithMultisig } = require("../helpers/helpers");
const { deployWithCustomProxy } = require("../helpers/helpers");
const col = require("cli-color");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();
    log(col.bgYellow("Deploying LiquidityMining..."));
    await deployWithCustomProxy(
        deployer,
        "LiquidityMining",
        "LiquidityMiningProxy",
        "",
        "LiquidityMining_Proxy",
        true
    );
    //@todo add deploy with custom proxy
};
func.tags = ["LiquidityMining"];
//@todo - add func.dependencies = ["LiquidityMiningProxy"];
module.exports = func;
