/* eslint-disable no-console */
const { task } = require("hardhat/config");
const { boolean } = require("hardhat/internal/core/params/argumentTypes");
const Logs = require("node-logs");
const { sendWithMultisig } = require("../../deployment/helpers/helpers");

const logger = new Logs().showInConsole(true);

// -------------- PAUSE / UNPAUSE -------------- //

// -------- Sovryn Protocol -------- //

const protocolPaused = async (hre) => {
    const {
        deployments: { get },
        ethers,
    } = hre;
    return await (await ethers.getContract("ISovryn")).isProtocolPaused();
};

const printIsProtocolPaused = async (hre) => {
    if (await protocolPaused(hre)) {
        logger.warn(`Sovryn protocol is paused`);
    } else {
        logger.success(`Sovryn protocol is not paused`);
    }
};

const pauseUnpauseProtocol = async (hre, signer, bool) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const isProtocolPaused = await protocolPaused(hre);
    logger.warn(`${isProtocolPaused ? "pausing" : "lifting pause from"} Sovryn protocol`);
    if (isProtocolPaused == bool) {
        logger.warn(`Sovryn protocol is already ${isProtocolPaused ? "paused" : "not paused"}`);
        return;
    }
    const signerAcc = (await hre.getNamedAccounts())[signer];
    const targetDeploymentAddress = (await get("ISovryn")).address;
    const iface = new ethers.utils.Interface(["function togglePaused(bool paused)"]);
    let data = await iface.encodeFunctionData("togglePaused", [bool]);
    await sendWithMultisig(multisigDeployment.address, targetDeploymentAddress, data, signerAcc);
};

task("pausing:is-protocol-paused", "Pause Sovryn protocol modules").setAction(async ({}, hre) => {
    await printIsProtocolPaused(hre);
});

task("pausing:pause-protocol", "Pause Sovryn protocol modules")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await pauseUnpauseProtocol(hre, signer, true);
    });

task("pausing:unpause-protocol", "Lift pause from Sovryn protocol modules")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await pauseUnpauseProtocol(hre, signer, false);
    });

// -------- Staking -------- //

const stakingPauseUnpause = async (hre, signer, bool) => {
    const {
        deployments: { get },
        ethers,
    } = hre;
    const signerAcc = (await hre.getNamedAccounts())[signer];
    const multisigDeployment = await get("MultiSigWallet");
    const targetDeployment = await get("Staking");

    const stakingInterface = new ethers.utils.Interface(targetDeployment.abi);
    let data = stakingInterface.encodeFunctionData("pauseUnpause", [bool]);
    logger.warn("Generating multisig tx to pause Staking...");
    await sendWithMultisig(multisigDeployment.address, targetDeployment.address, data, signerAcc);
};

const stakingPaused = async (hre) => {
    const { ethers } = hre;
    return await (await ethers.getContract("Staking")).paused();
};

const printIsStakingPaused = async (hre) => {
    const {
        deployments: { get },
        ethers,
    } = hre;
    if (await stakingPaused(hre)) {
        logger.warn(`Staking is paused`);
    } else {
        logger.success(`Staking is not paused`);
    }
};

task("pausing:is-staking-paused", "Log Staking paused or unpaused").setAction(async ({}, hre) => {
    await printIsStakingPaused(hre);
});

task("pausing:pause-staking", "Pause Staking Modules Contracts")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await stakingPauseUnpause(hre, signer, true);
    });

task("pausing:unpause-staking", "Pause Staking Modules Contracts")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await stakingPauseUnpause(hre, signer, false);
    });

// -------- Lending pools (Loan tokens) -------- //

const isLoanTokenBeaconPaused = async (hre, beaconDeploymentName) => {
    const { ethers } = hre;
    return await (await ethers.getContract(beaconDeploymentName)).paused();
};

const printLoanTokenBeaconsPaused = async (hre, beaconsList) => {
    const { ethers } = hre;
    let beacons = beaconsList.split(",");
    for (let beaconDeploymentName of beacons) {
        const beaconPaused = await (await ethers.getContract(beaconDeploymentName)).paused();
        logger.warn(
            `Loan tokens beacon ${beaconDeploymentName} is ${
                beaconPaused ? "paused" : "not paused"
            }`
        );
    }
};

const beaconsPauseUnpause = async (hre, signer, beaconsList, boolPauseUnpause) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const multisigDeployment = await get("MultiSigWallet");

    let beacons = beaconsList.split(",");
    for (let beaconDeploymentName of beacons) {
        const pauseOrUnpause = boolPauseUnpause ? "pause" : "unpause";
        const beaconPaused = await isLoanTokenBeaconPaused(hre, beaconDeploymentName);
        if (beaconPaused == boolPauseUnpause) {
            logger.warn(
                `Loan tokens beacon ${beaconDeploymentName} is already ${pauseOrUnpause}d`
            );
            continue;
        }

        const targetDeployment = await get(beaconDeploymentName);

        const targetInterface = new ethers.utils.Interface(targetDeployment.abi);
        let data = targetInterface.encodeFunctionData(pauseOrUnpause);
        logger.warn(
            `Generating multisig tx to ${pauseOrUnpause} loan token logic beacon ${beaconDeploymentName}...`
        );
        await sendWithMultisig(
            multisigDeployment.address,
            targetDeployment.address,
            data,
            signerAcc
        );
    }
};

task("pausing:print-lp-beacons-paused", "Log Lending Pools Beacons paused/unpaused")
    .addOptionalParam(
        "names",

        "Beacon deployment name(s): a single beacon deployment name or a list: 'LoanTokenLogicBeaconLM,LoanTokenLogicBeaconWrbtc'",
        "LoanTokenLogicBeaconLM,LoanTokenLogicBeaconWrbtc"
    )
    .setAction(async ({ names: beaconsList }, hre) => {
        await printLoanTokenBeaconsPaused(hre, beaconsList);
    });

task("pausing:pause-lp-beacon(s)", "Pause Lending Pools Beacons")
    .addOptionalParam(
        "names",
        "Beacon deployment name(s): a single beacon deployment name or a list: 'LoanTokenLogicBeaconLM,LoanTokenLogicBeaconWrbtc'",
        "LoanTokenLogicBeaconLM,LoanTokenLogicBeaconWrbtc"
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer, names: beaconsList }, hre) => {
        await beaconsPauseUnpause(hre, signer, beaconsList, true);
    });

task("pausing:unpause-lp-beacon(s)", "Unpause Lending Pools Beacons")
    .addOptionalParam(
        "names",
        "Beacon deployment name(s): a single beacon deployment name or a list: 'LoanTokenLogicBeaconLM,LoanTokenLogicBeaconWrbtc'",
        "LoanTokenLogicBeaconLM,LoanTokenLogicBeaconWrbtc"
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer, names: beaconsList }, hre) => {
        await beaconsPauseUnpause(hre, signer, beaconsList, true);
    });

// -------- Lending pools (Loan tokens) functions -------- //

loanTokenFunctionsList = {
    borrow: "borrow(bytes32,uint256,uint256,uint256,address,address,address,bytes)",
    marginTrade: "marginTrade(bytes32,uint256,uint256,uint256,address,address,uint256,bytes)",
};

const printLoanTokenFunctionsPaused = async (hre, loanTokensListParam) => {
    const {
        deployments: { get },
        ethers,
    } = hre;
    let tokens = loanTokensListParam.split(",");
    for (let loanTokenDeploymentName of tokens) {
        const loanToken = await ethers.getContractAt(
            "ILoanTokenModules",
            (
                await get(loanTokenDeploymentName)
            ).address
        );
        for (let funcName of Object.keys(loanTokenFunctionsList)) {
            let funcId = loanTokenFunctionsList[funcName];
            const isFuncPaused = await loanToken.checkPause(funcId);
            logger.warn(
                `Loan Token function ${loanTokenDeploymentName}.${funcName} is ${
                    isFuncPaused ? "paused" : "unpaused"
                }`
            );
        }
    }
};

const loanTokenFunctionsPauseUnpause = async (
    hre,
    signer,
    loanTokensListParam,
    functionsListParam,
    bool
) => {
    const { ethers } = hre;

    const signerAcc = (await hre.getNamedAccounts())[signer];

    let tokens = loanTokensListParam.split(",");
    let functions = functionsListParam.split(",");

    const iface = new ethers.utils.Interface(["function togglePaused(bool paused)"]);
    let data = await iface.encodeFunctionData("togglePaused", [bool]);

    for (let loanTokenDeploymentName of tokens) {
        const loanToken = await ethers.getContract(loanTokenDeploymentName);
        for (let loanTokenFunctionName of functions) {
            let funcId = loanTokenFunctionsList[loanTokenFunctionName]; //"borrow(bytes32,uint256,uint256,uint256,address,address,address,bytes)";
            const funcIsPaused = await loanToken.checkPause(funcId);
            if (funcIsPaused == bool) {
                logger.warn(
                    `Loan Token function ${loanTokenDeploymentName}.${loanTokenFunctionName} is already ${
                        funcIsPaused ? "paused" : "unpaused"
                    }, skipping it`
                );
                continue;
            }
            logger.warn(
                `Generating multisig tx to ${
                    bool ? "pause" : "unpause"
                } ${loanTokenDeploymentName}.${loanTokenFunctionName} ...`
            );
            await sendWithMultisig(multisigDeployment.address, loanToken.address, data, signerAcc);
        }
    }
};

const loanTokensList = [
    "LoanToken_iDOC",
    "LoanToken_iRBTC",
    "LoanToken_iXUSD",
    "LoanToken_iUSDT",
    "LoanToken_iBPRO",
    "LoanToken_iDLLR",
];

task("pausing:print-lp-functions-paused", "Log Lending Pools functions paused/unpaused")
    .addOptionalParam(
        "names",
        "Loan Tokens Deployment name(s): a single lending pool name or a list, e.g. 'LoanToken_iDOC,LoanToken_iRBTC,'",
        loanTokensList.toString()
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ names }, hre) => {
        await printLoanTokenFunctionsPaused(hre, names);
    });

task("pausing:pause-unpause-lp-functions", "Pause/unpause Lending Pools functions")
    .addOptionalParam(
        "tokens",
        "Loan Tokens Deployment name(s): a single lending pool name or a list, e.g. 'LoanToken_iDOC,LoanToken_iRBTC'",
        loanTokensList.toString()
    )
    .addOptionalParam(
        "functions",
        "Loan Token function(s) to pause/unpause: a single func name or a list, e.g. 'borrow,marginTrading'",
        Object.keys(loanTokenFunctionsList).toString()
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addParam("pause", "Pause or unpause", undefined, types.bool)
    .setAction(async ({ signer, tokens, functions, pause }, hre) => {
        await loanTokenFunctionsPauseUnpause(hre, signer, tokens, functions, pause);
    });

// -------------- FREEZE / UNFREEZE -------------- //

// -------------- Staking -------------- //

const isStakingFrozen = async (hre) => {
    const { ethers } = hre;
    return await (await ethers.getContract("Staking")).frozen();
};

const printIsStakingFrozen = async (hre) => {
    const frozen = await isStakingFrozen(hre);
    logger.warn(`Staking contract is ${frozen ? "frozen" : "not frozen"}`);
};

const stakingFreezeUnfreezeWithdrawal = async (hre, signer, bool) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    if ((await isStakingFrozen(hre)) == bool) {
        logger.warn(`Staking is already ${bool ? "frozen" : "unfrozen"}`);
        return;
    }

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const multisigDeployment = await get("MultiSigWallet");
    const targetDeployment = await get("Staking");

    const targetInterface = new ethers.utils.Interface(targetDeployment.abi);
    let data = targetInterface.encodeFunctionData("freezeUnfreeze", [bool]);
    logger.warn("Generating multisig tx to freeze Staking withdrawal...");
    await sendWithMultisig(multisigDeployment.address, targetDeployment.address, data, signerAcc);
};

task("pausing:is-staking-frozen", "Log Staking frozen or not frozen").setAction(
    async ({}, hre) => {
        await printIsStakingFrozen(hre);
    }
);

task("pausing:freeze-staking-withdrawal", "Freeze Staking Withdrawal")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await stakingFreezeUnfreezeWithdrawal(hre, signer, true);
    });

task("pausing:unfreeze-staking-withdrawal", "Unfreeze Staking Withdrawal")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await stakingFreezeUnfreezeWithdrawal(hre, signer, false);
    });

// -------------- FastBTCBiDi -------------- //

const freezeUnfreezeBiDiFastBTC = async (hre, signer, bool) => {
    const {
        deployments: { get },
        ethers,
    } = hre;

    if ((await isFastBtcFrozen(hre)) == bool) {
        logger.warn(`FastBTCBiDi contracts is already ${bool ? "frozen" : "unfrozen"}`);
        return;
    }

    const signerAcc = (await hre.getNamedAccounts())[signer];
    const multisigDeployment = await get("MultiSigWallet");
    const targetDeployment = await get("FastBTCBiDiFreezable");

    const targetInterface = new ethers.utils.Interface(targetDeployment.abi);
    const funcName = bool ? "freeze" : "unfreeze";
    let data = targetInterface.encodeFunctionData(funcName);
    logger.warn(`Generating multisig tx to ${funcName} FastBTCBiDi ...`);
    await sendWithMultisig(multisigDeployment.address, targetDeployment.address, data, signerAcc);
};

const isFastBtcFrozen = async (hre) => {
    const { ethers } = hre;
    return await (await ethers.getContract("FastBTCBiDiFreezable")).frozen();
};

const printIsFastBtcFrozen = async (hre) => {
    const frozen = await isFastBtcFrozen(hre);
    logger.warn(`Staking contract is ${frozen ? "frozen" : "not frozen"}`);
};

task("pausing:is-fastbtc-frozen", "Log FastBTCBiDi is frozen or not frozen").setAction(
    async ({}, hre) => {
        await printIsFastBtcFrozen(hre);
    }
);

task("pausing:freeze-fastbtc", "Freeze BiDi FastBTC")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await freezeUnfreezeBiDiFastBTC(hre, signer, true);
    });

task("pausing:unfreeze-fastbtc", "Unfreeze BiDi FastBTC")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        await freezeUnfreezeBiDiFastBTC(hre, signer, false);
    });
