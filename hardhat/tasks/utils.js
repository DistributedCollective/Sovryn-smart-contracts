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
        "Deployed contract artifact name or address to compare bytecode with the repository artifact",
        undefined,
        types.string
    )
    .addOptionalParam(
        "address",
        "Deployment address - use if it is different from the deployment data in the repository",
        undefined,
        types.string
    )
    .setAction(async ({ contract, address }, hre) => {
        const {
            ethers: { provider },
            deployments: { get, getArtifact },
            ethers,
        } = hre;

        const artifact = await getArtifact(contract);
        const deployment = ethers.utils.isAddress(address) ? "" : await get(contract);
        const contractAddress = ethers.utils.isAddress(address)
            ? address
            : deployment.implementation ?? deployment.address;
        // console.log("onchain bytecode: ", await provider.getCode(contractAddress));
        // console.log();
        // console.log("artifact deployedBytecode: ", artifact.deployedBytecode);

        if ((await provider.getCode(contractAddress)) == artifact.deployedBytecode) {
            logger.success(
                `Bytecodes MATCH of the contract ${
                    ethers.utils.isAddress(contract) ? "" : contract
                } deployed at ${contractAddress}, chainId: ${
                    (await ethers.provider.getNetwork()).chainId
                }`
            );
        } else {
            logger.error(
                `Bytecodes DO NOT MATCH of the contract ${
                    ethers.utils.isAddress(contract) ? "" : contract
                } deployed at ${contractAddress}, chainId: ${
                    (await ethers.provider.getNetwork()).chainId
                }`
            );
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
