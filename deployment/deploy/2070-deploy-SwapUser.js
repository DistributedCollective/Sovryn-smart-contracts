const col = require("cli-color");
const func = async function (hre) {
    const {
        deployments: { deploy, log },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();
    log(col.bgYellow("Deploying SwapUser..."));
    await deploy("SwapUser", {
        from: deployer,
        args: [],
        log: true,
    });
};
func.tags = ["SwapUser"];
module.exports = func;
