const Logs = require("node-logs");
const { sendWithMultisig } = require("../deployment/helpers/helpers");
const logger = new Logs().showInConsole(true);

const sourceContractTypesToValidate = {
    ContractRegistry: "ContractRegistry",
    ConverterV1: "ConverterV1",
    ConverterV2: "ConverterV2",
    ConverterRegistry: "ConverterRegistry",
};

const validateAmmOnchainAddresses = async function (deploymentTarget) {
    const {
        deployments: { get },
        ethers,
    } = hre;

    if (!deploymentTarget.sourceContractTypeToValidate) {
        logger.info(`Skipped validation for ${deploymentTarget.contractName}`);
        return true;
    }

    if (
        deploymentTarget.sourceContractTypeToValidate ===
        sourceContractTypesToValidate.ContractRegistry
    ) {
        const ammContractRegistry = await get(deploymentTarget.sourceContractNameToValidate);
        const ammContractRegistryInterface = new ethers.utils.Interface(ammContractRegistry.abi);
        const ammRegistryContract = await ethers.getContractAt(
            ammContractRegistryInterface,
            ammContractRegistry.address
        );
        const AmmSovrynSwapNetwork = deploymentTarget.contractName;
        const registeredAddressOnchain = await ammRegistryContract.addressOf(
            ethers.utils.formatBytes32String(AmmSovrynSwapNetwork)
        );

        if (deploymentTarget.deployment.address !== registeredAddressOnchain) {
            logger.error(
                `unmatched onchain for contract ${deploymentTarget.contractName}, artifact: ${deploymentTarget.deployment.address}, onchain: ${registeredAddressOnchain}`
            );
            return false;
        }
    } else if (
        deploymentTarget.sourceContractTypeToValidate === sourceContractTypesToValidate.ConverterV1
    ) {
        const ammConverter = await get(deploymentTarget.sourceContractNameToValidate);
        const ammConverterInterface = new ethers.utils.Interface(ammConverter.abi);

        const ammConverterContract = await ethers.getContractAt(
            ammConverterInterface,
            ammConverter.address
        );
        const registeredAddressOnchain = await ammConverterContract.oracle();

        if (deploymentTarget.deployment.address !== registeredAddressOnchain) {
            logger.error(
                `unmatched onchain for contract ${deploymentTarget.contractName}, artifact: ${deploymentTarget.deployment.address}, onchain: ${registeredAddressOnchain}`
            );
            return false;
        }
    } else if (
        deploymentTarget.sourceContractTypeToValidate === sourceContractTypesToValidate.ConverterV2
    ) {
        const ammConverter = await get(deploymentTarget.sourceContractNameToValidate);
        const ammConverterInterface = new ethers.utils.Interface(ammConverter.abi);

        const ammConverterContract = await ethers.getContractAt(
            ammConverterInterface,
            ammConverter.address
        );
        const registeredAddressOnchain = await ammConverterContract.priceOracle();

        if (deploymentTarget.deployment.address !== registeredAddressOnchain) {
            logger.error(
                `unmatched onchain for contract ${deploymentTarget.contractName}, artifact: ${deploymentTarget.deployment.address}, onchain: ${registeredAddressOnchain}`
            );
            return false;
        }
    } else if (
        deploymentTarget.sourceContractTypeToValidate ===
        sourceContractTypesToValidate.ConverterRegistry
    ) {
        const ammConverterRegistry = await get(deploymentTarget.sourceContractNameToValidate);
        const ammConverterRegistryInterface = new ethers.utils.Interface(ammConverterRegistry.abi);

        const ammConverterContract = await ethers.getContractAt(
            deploymentTarget.deployment.abi,
            deploymentTarget.deployment.address
        );
        const lpToken = await ammConverterContract.token();

        const ammConverterRegistryAddress = (await get("AmmConverterRegistry")).address;
        const ammConverterRegistryContract = await ethers.getContractAt(
            ammConverterRegistryInterface,
            ammConverterRegistryAddress
        );
        const isLiquidityPool = await ammConverterRegistryContract.isLiquidityPool(lpToken);

        if (!isLiquidityPool) {
            logger.error(`converter ${deploymentTarget.deployment.address} is not active pool`);
            return false;
        }
    } else {
        logger.error(
            `Source validation ${deploymentTarget.sourceContractTypeToValidate} for contract ${deploymentTarget.contractName} has not been implemented`
        );
        return false;
    }

    return true;
};

const transferOwnershipAMMContractsToGovernance = async (
    contractAddress,
    newOwnerAddress,
    signerAcc,
    contractName = ""
) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const ownershipInterface = new ethers.utils.Interface([
        {
            constant: false,
            inputs: [{ name: "_newOwner", type: "address" }],
            name: "transferOwnership",
            outputs: [],
            payable: false,
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            constant: true,
            inputs: [],
            name: "owner",
            outputs: [
                {
                    internalType: "address",
                    name: "",
                    type: "address",
                },
            ],
            payable: false,
            stateMutability: "view",
            type: "function",
        },
    ]);
    const ammContract = await ethers.getContractAt(ownershipInterface, contractAddress);
    const multisig = await get("MultiSigWallet");

    if (contractName) {
        logger.info(`Verifying contract address for ${contractName}`);
        const ammContractRegistry = await get("AmmContractRegistry");
        const ammContractRegistryInterface = new ethers.utils.Interface(ammContractRegistry.abi);
        const ammRegistryContract = await ethers.getContractAt(
            ammContractRegistryInterface,
            ammContractRegistry.address
        );
        const onchainContractAddress = await ammRegistryContract.addressOf(
            ethers.utils.formatBytes32String(contractName)
        );

        if (contractAddress.toUpperCase() !== onchainContractAddress.toUpperCase()) {
            logger.error(
                `Unmatched contract address with the on-chain for ${contractName}, local: ${contractAddress}, onchain: ${onchainContractAddress}`
            );
            return false;
        }
    }

    const currentOwner = await ammContract.owner();
    if (currentOwner.toUpperCase() !== multisig.address.toUpperCase()) {
        logger.error(`Multisig is not the owner, the onchain owner is ${currentOwner}`);
        return false;
    }

    logger.info(
        `Transferring ownership for ${contractName} (${contractAddress}) from ${multisig.address} to ${newOwnerAddress}`
    );
    let data = ownershipInterface.encodeFunctionData("transferOwnership", [newOwnerAddress]);
    await sendWithMultisig(multisig.address, ammContract.address, data, signerAcc);

    return true;
};

module.exports = {
    validateAmmOnchainAddresses,
    transferOwnershipAMMContractsToGovernance,
};
