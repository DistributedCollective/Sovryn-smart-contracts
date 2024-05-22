const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

task(
    "feeSharingCollector:initialize",
    "Initialize feeSharingCollector: set WrappedNativeToken and Loan Token WrappedNativeToken addresses to the FeeSharingCollector storage"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await initializeFeeSharingCollector(hre, signer, true);
    });

task(
    "feeSharingCollector:setWrtbcTokenAddress",
    "Set WrappedNativeToken token address in feeSharingCollector"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await setWrappedNativeTokenAddress(hre, signer, true);
    });

task(
    "feeSharingCollector:setLoanTokenWrtbcAddress",
    "Set WrappedNativeToken loan token address in feeSharingCollector"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await setLoanWrappedNativeTokenAddress(hre, signer, true);
    });

const initializeFeeSharingCollector = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    let initializeSelector = ethers.utils.id("initialize(address,address)").substring(0, 10);
    const isInitialized = await (
        await ethers.getContract("FeeSharingCollector")
    ).isFunctionExecuted(initializeSelector);
    if (isInitialized) {
        logger.error("FeeSharingCollector has already been initialized");
        return;
    }

    const wrappedNativeToken = (await get("WrappedNativeToken")).address;
    const loanWrappedNativeToken = (await get("LoanToken_iNativeToken")).address;

    if (!ethers.utils.isAddress(wrappedNativeToken)) {
        logger.error(`WrappedNativeToken - ${wrappedNativeToken} is invalid address`);
        return;
    }

    if (!ethers.utils.isAddress(loanWrappedNativeToken)) {
        logger.error(`loan token iNativeToken- ${loanWrappedNativeToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function initialize(address wrappedNativeToken, address loanWrappedNativeToken)",
    ]);
    let data = await iface.encodeFunctionData("initialize", [
        wrappedNativeToken,
        loanWrappedNativeToken,
    ]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};

const setWrappedNativeTokenAddress = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const wrappedNativeToken = (await get("WrappedNativeToken")).address;
    if (!ethers.utils.isAddress(wrappedNativeToken)) {
        logger.error(`wrappedNativeToken - ${wrappedNativeToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function setWrappedNativeToken(address newWrappedNativeTokenAddress)",
    ]);
    let data = await iface.encodeFunctionData("setWrappedNativeToken", [wrappedNativeToken]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};

const setLoanWrappedNativeTokenAddress = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const loanWrappedNativeToken = (await get("LoanToken_iNativeToken")).address;
    if (!ethers.utils.isAddress(loanWrappedNativeToken)) {
        logger.error(`loanWrappedNativeToken - ${loanWrappedNativeToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function setLoanWrappedNativeToken(address newLoanWrappedNativeTokenAddress)",
    ]);
    let data = await iface.encodeFunctionData("setLoanWrappedNativeToken", [
        loanWrappedNativeToken,
    ]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};
