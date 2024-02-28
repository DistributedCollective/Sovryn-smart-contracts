const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

//authored by @cwsnt

task("bridge:allowToken", "Whitelist token on a bridge")
    .addPositionalParam("token", "Address or deployment name (e.g. DLLR) of a token to whitelist")
    .addOptionalParam("bridge", "Bridge contract to set allowance to", "BridgeRSK")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer, token, bridge }, hre) => {
        const {
            deployments: { get, getArtifact },
            ethers,
        } = hre;

        const tokenAddress = ethers.utils.isAddress(token) ? token : (await get(token)).address;
        const signerAcc = (await hre.getNamedAccounts())[signer];
        const allowTokensArtifact = await getArtifact("AllowTokens");
        const bridgeContract = await ethers.getContract(bridge);
        const allowTokensAddress = await bridgeContract.allowTokens();
        const allowTokensContract = await ethers.getContractAt(
            allowTokensArtifact.abi,
            allowTokensAddress
        );

        const multisigAddress = await allowTokensContract.owner();
        const multisigContract = await ethers.getContractAt("MultiSigWallet", multisigAddress);

        const allowTokensInterface = new ethers.utils.Interface(allowTokensArtifact.abi);
        let data = allowTokensInterface.encodeFunctionData("addAllowedToken", [tokenAddress]);

        if (await multisigContract.isOwner(signerAcc)) {
            await sendWithMultisig(
                multisigContract.address,
                allowTokensContract.address,
                data,
                signerAcc
            );
        } else {
            logger.warn(
                `The wallet ${signerAcc} is not an owner of the multisig ${multisigAddress}. Only multisig owners can whitelist tokens on a bridge`
            );
            logger.warn("Populating multisig tx...");

            const gasEstimated = (
                await multisigContract.estimateGas.submitTransaction(allowTokensAddress, 0, data)
            ).toNumber();

            const unsignedTx = await multisigContract.populateTransaction.submitTransaction(
                allowTokensAddress,
                0,
                data,
                {
                    gasLimit: Math.round(gasEstimated * 1.3),
                }
            );

            delete unsignedTx.from;
            logger.warning("==================== populated tx start ====================");
            logger.info(unsignedTx);
            logger.warning("==================== populated tx end   =================");
        }
    });
