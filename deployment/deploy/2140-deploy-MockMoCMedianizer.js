const path = require("path");
const col = require("cli-color");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        ethers,
        deployments: { deploy, log, get },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();

    log(col.bgYellow("Deploying MockMoCMedianizer..."));
    await deploy("MoCMedianizer", {
        contract: "MockMoCMedianizer",
        from: deployer,
        args: ["100000000000000000000000"],
        log: true,
    });
};
func.tags = ["MockMoCMedianizer"];
module.exports = func;
