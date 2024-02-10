const path = require("path");
const col = require("cli-color");
const func = async function (hre) {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners(); //

    log(col.bgYellow("Deploying SwapsImplSovrynSwapLib..."));
    await deploy("SwapsImplSovrynSwapLib", {
        from: deployer,
        log: true,
    });
};
func.tags = ["SwapsImplSovrynSwapLib"];
module.exports = func;
