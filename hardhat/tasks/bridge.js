const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");
const { Percent } = require("@uniswap/sdk-core");
const { nearestUsableTick, Position } = require("@uniswap/v3-sdk");

task("allowToken", "Allow token")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addParam("token", "Address of token")
    .setAction(async ({ signer, token }, hre) => {
        const {
            deployments: { get },
            ethers,
        } = hre;

        const allowTokensDeployment = await get("AllowTokens");

        const bridgeContract = await ethers.getContract("BridgeRSK");

        const allowTokensAddress = await bridgeContract.allowTokens();

        const allowTokensContract = await ethers.getContractAt(
            allowTokensDeployment.abi,
            allowTokensAddress
        );

        const multisigAddress = await allowTokensContract.owner();
        const multisigContract = await ethers.getContractAt("MultiSigWallet", multisigAddress);

        const allowTokensInterface = new ethers.utils.Interface(allowTokensDeployment.abi);
        let data = allowTokensInterface.encodeFunctionData("addAllowedToken", [token]);

        const tx = await multisigContract.populateTransaction.submitTransaction(
            allowTokensAddress,
            0,
            data
        );

        delete tx.from;
        logger.warning("==================== populated tx start ====================");
        logger.info(tx);
        logger.warning("==================== populated tx end   =================");
    });
