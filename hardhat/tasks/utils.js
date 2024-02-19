const { task } = require("hardhat/config");
const Logs = require("node-logs");
/*const {
    signWithMultisig,
    multisigCheckTx,
    multisigRevokeConfirmation,
    multisigExecuteTx,
    multisigAddOwner,
    multisigRemoveOwner,
} = require("../../deployment/helpers/helpers");*/

const logger = new Logs().showInConsole(true);

task(
    "utils:compare-bytecode",
    "Compare the deployed onchain contract bytecode with the artifact to see if they match"
)
    .addParam(
        "contract",
        "Deployed contract artifact name or hh deployment name to compare deployedBytecode with onchain deployment",
        undefined,
        types.string
    )
    .addOptionalParam(
        "address",
        "Deployment address - use if it is different from the deployment data in the repository",
        undefined,
        types.string
    )
    .addOptionalParam(
        "useArtifact",
        "Take deployBytecode for comparison from artifact. Falls back to it if there is no deployedBytecode data in the deployment data or use explicitly.",
        false,
        types.boolean
    )
    .setAction(async ({ contract, address, useArtifact }, hre) => {
        const {
            ethers: { provider },
            deployments: { get, getOrNull, getArtifact },
            ethers,
        } = hre;

        let deploymentObject;
        let expectedBytecode;

        if (useArtifact) {
            deploymentObject = await getArtifact(contract);
            expectedBytecode = deploymentObject.deployedBytecode;
            logger.info("Trying to compare on-chain bytecode with artifact's deployedBytecode");
        } else {
            deploymentObject = await getOrNull(contract);
            expectedBytecode = deploymentObject ? deploymentObject.deployedBytecode : false;
            const bytecodeExists = expectedBytecode ?? false;
            if (!bytecodeExists) {
                logger.error("No deployedBytecode found in deployment object");
                deploymentObject = await getArtifact(contract);
                expectedBytecode = deploymentObject.deployedBytecode;
                logger.info(
                    "Trying to compare on-chain bytecode with ARTIFACT's deployedBytecode"
                );
            } else {
                logger.info(
                    "Trying to compare on-chain bytecode with DEPLOYEMNT object's deployedBytecode"
                );
            }
        }
        const deployment = ethers.utils.isAddress(address) ? "" : await get(contract);
        const contractAddress = ethers.utils.isAddress(address)
            ? address
            : deployment.implementation ?? deployment.address;
        const onchainBytecode = await provider.getCode(contractAddress);
        // console.log("onchain bytecode: ", await provider.getCode(contractAddress));
        // console.log();
        // console.log("expected deployedBytecode: ", deploymentObject.deployedBytecode);
        const sameLength = onchainBytecode.length === expectedBytecode.length;
        if (!sameLength) {
            logger.error(
                `Bytecode lengths DO NOT MATCH for the contract ${
                    ethers.utils.isAddress(contract) ? "" : contract
                } deployed at ${contractAddress}, chainId: ${
                    (await ethers.provider.getNetwork()).chainId
                }`
            );
            process.exit(0);
        }
        const isPair = expectedBytecode.length % 2 === 0;
        if (!isPair) {
            logger.error(
                `Bytecode lengths is not pair for the contract ${
                    ethers.utils.isAddress(contract) ? "" : contract
                } deployed at ${contractAddress}, chainId: ${
                    (await ethers.provider.getNetwork()).chainId
                }`
            );
            process.exit(0);
        }
        let N;
        if (sameLength && isPair) {
            for (let i = 2; i <= expectedBytecode.length; i += 2) {
                if (
                    onchainBytecode.slice(-i).slice(0, 2) !==
                    expectedBytecode.slice(-i).slice(0, 2)
                ) {
                    N = i - 2;
                    break;
                }
            }
            const U = N + 64;
            if (onchainBytecode.slice(0, -U) === expectedBytecode.slice(0, -U)) {
                logger.success(
                    `Bytecodes MATCH for the contract ${
                        ethers.utils.isAddress(contract) ? "" : contract
                    } deployed at ${contractAddress}, chainId: ${
                        (await ethers.provider.getNetwork()).chainId
                    }`
                );
            } else {
                logger.error(
                    `Bytecodes DO NOT MATCH for the contract ${
                        ethers.utils.isAddress(contract) ? "" : contract
                    } deployed at ${contractAddress}, chainId: ${
                        (await ethers.provider.getNetwork()).chainId
                    } at the track comparison ${U}`
                );
                logger.error(`at the track comparison ${U} and coincidence index ${N}`);
            }
        }
    });
task("utils:replace-tx", "Replace tx in mempool")
    .addParam("hash", "Replaced transaction hash", undefined, types.string)
    .addOptionalParam("newFrom", "New 'from' address")
    .addOptionalParam("newTo", "New 'to' address")
    .addOptionalParam("newGasPrice", "New gas prce")
    .addOptionalParam("newGasLimit", "New gas limit")
    .addOptionalParam("newMaxPriorityFee", "New maxPriorityFeePerGas")
    .addOptionalParam("newMaxFee", "New maxFeePerGas")
    .addOptionalParam("newData", "New data") // use 0x0 when canceling tx
    .addOptionalParam("newValue", "New value") // use 0x0 when canceling tx
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(
        async (
            {
                hash,
                newFrom,
                newTo,
                newGasPrice,
                newGasLimit,
                newMaxFee,
                newMaxPriorityFee,
                newData,
                newValue,
                signer,
            },
            hre
        ) => {
            const {
                ethers: { provider },
                ethers,
            } = hre;
            const pendingTx = await provider.getTransaction(hash);
            const signerAcc = (await hre.getNamedAccounts())[signer];
            const from = (newFrom ?? pendingTx.from).toLowerCase();
            if (signerAcc.toLowerCase() !== from) {
                logger.error(`'signer': ${signerAcc.toLowerCase()} !== 'from': ${from}`);
                return;
            }
            const deployerSigner = await ethers.getSigner(signerAcc);
            if (!pendingTx.blockNumber) {
                const replacementTx = {
                    nonce: pendingTx.nonce,
                    from,
                    to: (newTo ?? pendingTx.to).toLowerCase(),
                    data: newData ?? pendingTx.data,
                    value: newValue ?? pendingTx.value,
                    gasLimit: newGasLimit ?? pendingTx.gasLimit,
                    gasPrice: newGasPrice ?? pendingTx.gasPrice,
                    maxFeePerGas: newMaxFee ?? pendingTx.maxFeePerGas,
                    maxPriorityFeePerGas: newMaxPriorityFee ?? pendingTx.maxPriorityFeePerGas,
                };
                (await deployerSigner.sendTransaction(replacementTx)).wait();
            } else {
                logger.error(`Transaction ${hash} is already mined, co cannot be replaced`);
            }
        }
    );
