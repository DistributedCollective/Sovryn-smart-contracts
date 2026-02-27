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

task(
    "feeSharingCollector:getWithheldFees",
    "Print protocol withheld fees by token: symbol | address | amount (4 decimals)"
).setAction(async (_, hre) => {
    const { ethers } = hre;

    const toCommaSeparated = (value) => {
        return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const formatRoundedAmount = (amount, decimals) => {
        const tenThousand = ethers.BigNumber.from(10000);
        const ten = ethers.BigNumber.from(10);
        const decimalsNum = Number(decimals);

        let amountInTenThousandths;
        if (decimalsNum >= 4) {
            const factor = ten.pow(decimalsNum - 4);
            amountInTenThousandths = amount.add(factor.div(2)).div(factor);
        } else {
            const factor = ten.pow(4 - decimalsNum);
            amountInTenThousandths = amount.mul(factor);
        }

        const whole = amountInTenThousandths.div(tenThousand).toString();
        const fraction = amountInTenThousandths.mod(tenThousand).toString().padStart(4, "0");
        return `${toCommaSeparated(whole)}.${fraction}`;
    };

    const readTokenMeta = async (tokenAddress) => {
        const rbtcSpecialAddress = "0xeabd29be3c3187500df86a2613c6470e12f2d77d";
        if (tokenAddress.toLowerCase() === rbtcSpecialAddress) {
            return { symbol: "RBTC", decimals: 18 };
        }

        let symbol = "UNKNOWN";
        let decimals;

        try {
            const tokenStringSymbol = await ethers.getContractAt(
                ["function symbol() view returns (string)"],
                tokenAddress
            );
            symbol = await tokenStringSymbol.symbol();
        } catch (e) {
            try {
                const tokenBytesSymbol = await ethers.getContractAt(
                    ["function symbol() view returns (bytes32)"],
                    tokenAddress
                );
                const rawSymbol = await tokenBytesSymbol.symbol();
                symbol = ethers.utils.parseBytes32String(rawSymbol);
            } catch (_ignored) {}
        }

        try {
            const tokenDecimals = await ethers.getContractAt(
                ["function decimals() view returns (uint8)"],
                tokenAddress
            );
            decimals = await tokenDecimals.decimals();
        } catch (e) {
            throw new Error(
                `Could not read decimals() for token ${tokenAddress}. ERC20 token must implement decimals().`
            );
        }

        return { symbol, decimals };
    };

    const protocol = await ethers.getContract("ISovryn");
    const fscAddress = await protocol.feesController();
    if (!ethers.utils.isAddress(fscAddress)) {
        throw new Error(
            `Invalid FeeSharingCollector address from ISovryn.feesController(): ${fscAddress}`
        );
    }
    const feeSharingCollector = await ethers.getContractAt("FeeSharingCollector", fscAddress);
    const network = await ethers.provider.getNetwork();
    const tokenAddresses = await feeSharingCollector.getProtocolWithholdTokensList();

    if (tokenAddresses.length === 0) {
        logger.info(
            `No tokens found in protocol withhold list. network=${network.chainId} fsc=${fscAddress}`
        );
        return;
    }

    const rows = [];
    for (const tokenAddress of tokenAddresses) {
        const { symbol, decimals } = await readTokenMeta(tokenAddress);
        const rawWithheldAmount = await feeSharingCollector.getProtocolWithheldFees(tokenAddress);
        rows.push({
            symbol,
            address: tokenAddress,
            amount: formatRoundedAmount(rawWithheldAmount, decimals),
        });
    }

    const headers = {
        symbol: "TOKEN",
        address: "ADDRESS",
        amount: "WITHHELD",
    };

    const symbolWidth = Math.max(headers.symbol.length, ...rows.map((r) => r.symbol.length));
    const addressWidth = Math.max(headers.address.length, ...rows.map((r) => r.address.length));
    const amountWidth = Math.max(headers.amount.length, ...rows.map((r) => r.amount.length));

    const headerLine = `${headers.symbol.padEnd(symbolWidth)} | ${headers.address.padEnd(
        addressWidth
    )} | ${headers.amount.padStart(amountWidth)}`;
    const dividerLine = `${"-".repeat(symbolWidth)}-+-${"-".repeat(
        addressWidth
    )}-+-${"-".repeat(amountWidth)}`;

    console.log(`\nnetwork: ${network.chainId}`);
    console.log(`feeSharingCollector: ${fscAddress}\n`);
    console.log(headerLine);
    console.log(dividerLine);
    rows.forEach((row) => {
        console.log(
            `${row.symbol.padEnd(symbolWidth)} | ${row.address.padEnd(
                addressWidth
            )} | ${row.amount.padStart(amountWidth)}`
        );
    });
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
