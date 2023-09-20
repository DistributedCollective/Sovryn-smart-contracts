const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

task("feeSharingCollector:initialize", "Initialize feeSharingCollector")
    .addParam("wrbtcToken", "wrbtc token address")
    .addParam("loanWrbtcToken", "iWrbtc loan token address")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ wrbtcToken, loanWrbtcToken, signer }, hre) => {
        await initializeFeeSharingCollector(hre, wrbtcToken, loanWrbtcToken, signer, true);
    });

task("feeSharingCollector:setWrtbcTokenAddress", "Set wrbtc token address in feeSharingCollector")
    .addParam("wrbtcToken", "wrbtc token address")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ wrbtcToken, signer }, hre) => {
        await setWrbtcTokenAddress(hre, wrbtcToken, signer, true);
    });

task(
    "feeSharingCollector:setLoanTokenWrtbcAddress",
    "Set wrbtc token address in feeSharingCollector"
)
    .addParam("loanWrbtcToken", "iWrbtc loan token address")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ loanWrbtcToken, signer }, hre) => {
        await setLoanTokenWrbtcAddress(hre, loanWrbtcToken, signer, true);
    });

const initializeFeeSharingCollector = async (hre, wrbtcToken, loanWrbtcToken, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    if (!ethers.utils.isAddress(wrbtcToken)) {
        logger.error(`wrbtcToken - ${wrbtcToken} is invalid address`);
        return;
    }

    if (!ethers.utils.isAddress(loanWrbtcToken)) {
        logger.error(`loanWrbtcToken - ${loanWrbtcToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");
    let initializeSelector = ethers.utils.id("initialize(address,address)").substring(0, 10);
    const isInitialized = await (
        await ethers.getContract("FeeSharingCollector")
    ).isFunctionExecuted(initializeSelector);

    if (isInitialized) {
        logger.error("FeeSharingCollector has been initialized");
        return;
    }

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function initialize(address wrbtcToken, address loanWrbtcToken)",
    ]);
    let data = await iface.encodeFunctionData("initialize", [wrbtcToken, loanWrbtcToken]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};

const setWrbtcTokenAddress = async (hre, wrbtcToken, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    if (!ethers.utils.isAddress(wrbtcToken)) {
        logger.error(`wrbtcToken - ${wrbtcToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function setWrbtcToken(address newWrbtcTokenAddress)",
    ]);
    let data = await iface.encodeFunctionData("setWrbtcToken", [wrbtcToken]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};

const setLoanTokenWrbtcAddress = async (hre, loanWrbtcToken, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    if (!ethers.utils.isAddress(loanWrbtcToken)) {
        logger.error(`loanWrbtcToken - ${loanWrbtcToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function setLoanTokenWrbtc(address newLoanTokenWrbtcAddress)",
    ]);
    let data = await iface.encodeFunctionData("setLoanTokenWrbtc", [loanWrbtcToken]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};
