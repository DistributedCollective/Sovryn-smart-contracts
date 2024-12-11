const path = require("path");
const col = require("cli-color");
const { sendWithMultisig } = require("../helpers/helpers");
//const deploymentName = getContractNameFromScriptFileName(path.basename(__filename));
const func = async function (hre) {
    const {
        ethers,
        deployments: { deploy, log, get },
        getNamedAccounts,
    } = hre;
    const { deployer } = await getNamedAccounts(); //await ethers.getSigners();

    const priceFeeds = await get("PriceFeeds");
    const priceFeedsMoC = await get("PriceFeedsMoC");
    const wrbtc = await get("WRBTC");

    const priceFeedsABI = priceFeeds.abi;
    const priceFeedsInterface = new ethers.utils.Interface(priceFeedsABI);

    log(
        col.bgYellow(
            "Generating multisig transaction to set the wrbtc priceFeeds to use the new priceFeedsMoC"
        )
    );
    const multisigDeployment = await get("MultiSigWallet");
    let data = priceFeedsInterface.encodeFunctionData("setPriceFeed", [
        [wrbtc.address],
        [priceFeedsMoC.address],
    ]);
    await sendWithMultisig(multisigDeployment.address, priceFeeds.address, data, deployer);
    log(
        col.bgBlue(
            `>>> DONE. Requires Multisig (${multisigDeployment.address}) signatures to execute tx <<<`
        )
    );
};
func.tags = ["FixOracleTestnet"];
module.exports = func;
