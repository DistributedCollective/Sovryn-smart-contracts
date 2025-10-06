const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

//authored by @cwsnt

task("bridge:allowToken", "Whitelist token on a bridge")
    .addPositionalParam("token", "Address or deployment name (e.g. DLLR) of a token to whitelist")
    .addOptionalParam("bridge", "Bridge contract to set allowance to", "Bridge")
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

task("bridge:getDailyLimit", "Get bridge tokens transfer daily limit")
    .addOptionalParam(
        "bridge",
        "Bridge contract to get tokens transfer daily limit from",
        "Bridge"
    )
    .setAction(async ({ bridge }, hre) => {
        const {
            deployments: { getArtifact },
            ethers,
        } = hre;
        const allowTokensArtifact = await getArtifact("AllowTokens");
        const bridgeContract = await ethers.getContract(bridge);
        const allowTokensAddress = await bridgeContract.allowTokens();
        const allowTokensContract = await ethers.getContractAt(
            allowTokensArtifact.abi,
            allowTokensAddress
        );

        const dailyLimit = await allowTokensContract.dailyLimit();

        logger.info(
            `The bridge ${bridgeContract.address} daily tokens limit is ${(dailyLimit / 1e18).toLocaleString("en")}`
        );
    });

task("bridge:setDailyLimit", "Set daily tokens transfer limit on a bridge")
    .addPositionalParam(
        "amount",
        "Daily tokens transfer limit amount to set in ETH (will be multiplied by 1e18)"
    )
    .addOptionalParam("bridge", "Bridge contract to set allowance to", "Bridge")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer, amount, bridge }, hre) => {
        const {
            deployments: { getArtifact },
            ethers,
        } = hre;

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
        let data = allowTokensInterface.encodeFunctionData("changeDailyLimit", [
            ethers.utils.parseEther(amount),
        ]);

        if (await multisigContract.isOwner(signerAcc)) {
            await sendWithMultisig(
                multisigContract.address,
                allowTokensContract.address,
                data,
                signerAcc
            );
        } else {
            logger.warn(
                `The wallet ${signerAcc} is not an owner of the multisig ${multisigAddress}. Only multisig owners can create txs on a bridge`
            );
            logger.warn("Populating multisig tx...");

            // const gasEstimated = (
            //     await multisigContract.estimateGas.submitTransaction(allowTokensAddress, 0, data)
            // ).toNumber();

            const unsignedTx = await multisigContract.populateTransaction.submitTransaction(
                allowTokensAddress,
                0,
                data,
                {
                    gasLimit: Math.round(6800000),
                }
            );

            delete unsignedTx.from;
            logger.warning("==================== populated tx start ====================");
            logger.info(unsignedTx);
            logger.warning("==================== populated tx end   =================");
        }
    });

task("bridge:getMaxTokensAllowed", "Get bridge max tokens limit per transfer")
    .addOptionalParam("bridge", "Bridge contract to get max tokens limit per transfer", "Bridge")
    .setAction(async ({ bridge }, hre) => {
        const {
            deployments: { getArtifact },
            ethers,
        } = hre;
        const allowTokensArtifact = await getArtifact("AllowTokens");
        const bridgeContract = await ethers.getContract(bridge);
        const allowTokensAddress = await bridgeContract.allowTokens();
        const allowTokensContract = await ethers.getContractAt(
            allowTokensArtifact.abi,
            allowTokensAddress
        );

        const maxTokensAllowed = await allowTokensContract.getMaxTokensAllowed();

        logger.info(
            `The bridge ${bridgeContract.address} max tokens allowed per transfer is ${(maxTokensAllowed / 1e18).toLocaleString("en")}`
        );
    });

task("bridge:setMaxTokensAllowed", "Set max tokens transfer limit per transfer on a bridge")
    .addPositionalParam(
        "amount",
        "Max tokens single transfer limit amount to set in ETH (will be multiplied by 1e18)"
    )
    .addOptionalParam("bridge", "Bridge contract to set allowance to", "Bridge")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer, amount, bridge }, hre) => {
        const {
            deployments: { get, getArtifact },
            ethers,
        } = hre;

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
        let data = allowTokensInterface.encodeFunctionData("setMaxTokensAllowed", [
            ethers.utils.parseEther(amount),
        ]);

        if (await multisigContract.isOwner(signerAcc)) {
            await sendWithMultisig(
                multisigContract.address,
                allowTokensContract.address,
                data,
                signerAcc
            );
        } else {
            logger.warn(
                `The wallet ${signerAcc} is not an owner of the multisig ${multisigAddress}. Only multisig owners can create txs on a bridge`
            );
            logger.warn("Populating multisig tx...");

            // const gasEstimated = (
            //     await multisigContract.estimateGas.submitTransaction(allowTokensAddress, 0, data)
            // ).toNumber();
            //logger.warn(`Gas estimated: ${gasEstimated}`);
            const unsignedTx = await multisigContract.populateTransaction.submitTransaction(
                allowTokensAddress,
                0,
                data
                // {
                //     gasLimit: Math.round(gasEstimated * 1.3),
                // }
            );

            delete unsignedTx.from;
            logger.warning("==================== populated tx start ====================");
            logger.info(unsignedTx);
            logger.warning("==================== populated tx end   =================");
        }
    });

task("bridge:sovFromMultisig", "Bridge SOV from am exchequer multisig")
    .addPositionalParam("amount", "SOV amount to transfer (will be multiplied by 1e18)")
    .addPositionalParam("receiver", "Receiver address")
    .addOptionalParam("bridge", "Bridge contract to set allowance to", "Bridge")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer, amount, bridge, receiver }, hre) => {
        const {
            deployments: { getArtifact },
            ethers,
        } = hre;

        const signerAcc = (await hre.getNamedAccounts())[signer];
        const bridgeContract = await ethers.getContract(bridge);
        const multisigContract = await ethers.getContract("MultiSigWallet");

        // Get the token address (assume token is deployment name or address)
        const tokenAddress = (await ethers.getContract("SOV")).address;

        // Prepare the data for receiveTokensAt(token, amount, receiver, bytes)
        const bridgeArtifact = await getArtifact("Bridge");
        const receiveTokensAtInterface = new ethers.utils.Interface(bridgeArtifact.abi);
        let data = receiveTokensAtInterface.encodeFunctionData("receiveTokensAt", [
            tokenAddress,
            ethers.utils.parseEther(amount),
            receiver,
            "0x",
        ]);

        if (await multisigContract.isOwner(signerAcc)) {
            await sendWithMultisig(
                multisigContract.address,
                bridgeContract.address,
                data,
                signerAcc
            );
        } else {
            logger.warn(
                `The wallet ${signerAcc} is not an owner of the multisig ${multisigContract.address}. Only multisig owners can create txs on a bridge`
            );
            logger.warn("Populating multisig tx...");

            // const gasEstimated = (
            //     await multisigContract.estimateGas.submitTransaction(allowTokensAddress, 0, data)
            // ).toNumber();
            //logger.warn(`Gas estimated: ${gasEstimated}`);
            const unsignedTx = await multisigContract.populateTransaction.submitTransaction(
                bridgeContract.address,
                0,
                data
                // {
                //     gasLimit: Math.round(gasEstimated * 1.3),
                // }
            );

            delete unsignedTx.from;
            logger.warning("==================== populated tx start ====================");
            logger.info(unsignedTx);
            logger.warning("==================== populated tx end   =================");
        }
    });
