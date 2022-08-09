const path = require("path");
const fs = require("fs");
const { getContractNameFromScriptFileName } = require("../helpers/utils");
const hre = require("hardhat");
const { sendWithMultisig } = require("../helpers/helpers");

const func = async function () {
    const {
        deployments: { deploy, get, log },
        getNamedAccounts,
        ethers,
    } = hre;
    const { deployer } = await getNamedAccounts();

    const lmProxyDeployment = await get("liquidityMiningProxy");
    const lmLogicDeployment = await get("liquidityMining");
    const wrapperProxy = await deploy("RBTCWrapperProxy", {
        args: [
            (await get("WRBTC")).address,
            (await get("swapNetwork")).address,
            (await get("AMMContractRegistry")).address,
            lmProxyDeployment.address,
        ],
    });

    //TODO: add LM deployment & setup/use a boilerplate for creating proxy-based deplloyments

    const lm = await ethers.getContractAt(lmLogicDeployment.abi, lmProxyDeployment.address);
    const iLM = new ethers.utils.Interface(lmLogicDeployment.abi);
    const lmSetWrapperData = iLM.encodeFunctionData("setWrapper", [wrapperProxy.address]);
    const multisigDeployment = await get("multisig");

    await sendWithMultisig(
        multisigDeployment.address,
        lmProxyDeployment.address,
        lmSetWrapperData,
        deployer
    );
};
func.tags = [getContractNameFromScriptFileName(path.basename(__filename))];
module.exports = func;
