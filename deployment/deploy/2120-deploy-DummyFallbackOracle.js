const path = require("path");
const col = require("cli-color");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        deployments: { deploy, log },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();
    log(col.bgYellow("Deploying DummyFallbackOracle..."));
    await deploy("FallbackOracle", {
        contract: "DummyFallbackOracle",
        from: deployer,
        args: [],
        log: true,
    });
};
func.tags = ["DummyFallbackOracle"];
module.exports = func;
