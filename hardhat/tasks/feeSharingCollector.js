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

task("feeSharingCollector:freeze", "Freeze the FeeSharingCollector contract")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await freezeFeeSharingCollector(hre, signer);
    });

task("feeSharingCollector:unfreeze", "Unfreeze the FeeSharingCollector contract")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await unfreezeFeeSharingCollector(hre, signer);
    });

task(
    "feeSharingCollector:setProxyOwner",
    "Set the FeeSharingCollector proxy owner to ContractsGuardianMultisig"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await setFeeSharingCollectorProxyOwner(hre, signer);
    });

task(
    "feeSharingCollector:transferOwnership",
    "Transfer FeeSharingCollector ownership to ContractsGuardianMultisig"
)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await transferFeeSharingCollectorOwnership(hre, signer);
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

const freezeFeeSharingCollector = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const feeSharingCollector = await ethers.getContract("FeeSharingCollector");
    const isFrozen = await feeSharingCollector.frozen();

    if (isFrozen) {
        logger.error("FeeSharingCollector is already frozen");
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface(["function freeze()"]);
    let data = await iface.encodeFunctionData("freeze", []);

    logger.warn("Creating multisig tx to freeze FeeSharingCollector...");
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
    logger.info(">>> DONE. Requires Multisig signing to execute tx <<<");
};

const unfreezeFeeSharingCollector = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const feeSharingCollector = await ethers.getContract("FeeSharingCollector");
    const isFrozen = await feeSharingCollector.frozen();

    if (!isFrozen) {
        logger.error("FeeSharingCollector is not frozen");
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface(["function unfreeze()"]);
    let data = await iface.encodeFunctionData("unfreeze", []);

    logger.warn("Creating multisig tx to unfreeze FeeSharingCollector...");
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
    logger.info(">>> DONE. Requires Multisig signing to execute tx <<<");
};

const setFeeSharingCollectorProxyOwner = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const contractsGuardianMultisig = (await get("ContractsGuardianMultisig")).address;
    if (!ethers.utils.isAddress(contractsGuardianMultisig)) {
        logger.error(
            `ContractsGuardianMultisig - ${contractsGuardianMultisig} is invalid address`
        );
        return;
    }

    const feeSharingCollectorProxy = await get("FeeSharingCollector_Proxy");
    const proxy = await ethers.getContractAt(
        "FeeSharingCollectorProxy",
        feeSharingCollectorProxy.address
    );

    const currentProxyOwner = await proxy.getProxyOwner();
    logger.info(`Current proxy owner: ${currentProxyOwner}`);

    if (currentProxyOwner.toLowerCase() === contractsGuardianMultisig.toLowerCase()) {
        logger.error("ContractsGuardianMultisig is already the proxy owner");
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const iface = new ethers.utils.Interface(["function setProxyOwner(address _owner)"]);
    let data = await iface.encodeFunctionData("setProxyOwner", [contractsGuardianMultisig]);

    logger.warn(
        `Creating multisig tx to set proxy owner to ContractsGuardianMultisig (${contractsGuardianMultisig})...`
    );
    await sendWithMultisig(
        multisigDeployment.address,
        feeSharingCollectorProxy.address,
        data,
        signerAcc
    );
    logger.info(">>> DONE. Requires Multisig signing to execute tx <<<");
};

const transferFeeSharingCollectorOwnership = async (hre, signer) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const contractsGuardianMultisig = (await get("ContractsGuardianMultisig")).address;
    if (!ethers.utils.isAddress(contractsGuardianMultisig)) {
        logger.error(
            `ContractsGuardianMultisig - ${contractsGuardianMultisig} is invalid address`
        );
        return;
    }

    const feeSharingCollector = await ethers.getContract("FeeSharingCollector");
    const currentOwner = await feeSharingCollector.owner();
    logger.info(`Current owner: ${currentOwner}`);

    if (currentOwner.toLowerCase() === contractsGuardianMultisig.toLowerCase()) {
        logger.error("ContractsGuardianMultisig is already the owner");
        return;
    }

    const multisigDeployment = await get("MultiSigWallet");

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("FeeSharingCollector")).address;
    const iface = new ethers.utils.Interface(["function transferOwnership(address newOwner)"]);
    let data = await iface.encodeFunctionData("transferOwnership", [contractsGuardianMultisig]);

    logger.warn(
        `Creating multisig tx to transfer ownership to ContractsGuardianMultisig (${contractsGuardianMultisig})...`
    );
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
    logger.info(">>> DONE. Requires Multisig signing to execute tx <<<");
};
