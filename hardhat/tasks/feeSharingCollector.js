const { task } = require("hardhat/config");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

task(
    "feeSharingCollector:initialize",
    "Initialize feeSharingCollector: set WRBTC and Loan Token WRBTC addresses to the FeeSharingCollector storage"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await initializeFeeSharingCollector(hre, signer, true);
    });

task("feeSharingCollector:setWrtbcTokenAddress", "Set WRBTC token address in feeSharingCollector")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await setWrbtcTokenAddress(hre, signer, true);
    });

task(
    "feeSharingCollector:setLoanTokenWrtbcAddress",
    "Set WRBTC loan token address in feeSharingCollector"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await setLoanTokenWrbtcAddress(hre, signer, true);
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

    const wrbtcToken = (await get("WRBTC")).address;
    const loanWrbtcToken = (await get("LoanToken_iRBTC")).address;

    if (!ethers.utils.isAddress(wrbtcToken)) {
        logger.error(`WRBTC - ${wrbtcToken} is invalid address`);
        return;
    }

    if (!ethers.utils.isAddress(loanWrbtcToken)) {
        logger.error(`loan token iRBTC - ${loanWrbtcToken} is invalid address`);
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface([
        "function initialize(address wrbtcToken, address loanWrbtcToken)",
    ]);
    let data = await iface.encodeFunctionData("initialize", [wrbtcToken, loanWrbtcToken]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};

const setWrbtcTokenAddress = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const wrbtcToken = (await get("WRBTC")).address;
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

const setLoanTokenWrbtcAddress = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const loanWrbtcToken = (await get("iRBTC")).address;
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
