/* eslint-disable no-console */
const { task } = require("hardhat/config");
const { ethers } = require("ethers");
const Logs = require("node-logs");
const {
    signWithMultisig, // <---- this calls and executes multisig.confirmTransaction(txId)
    multisigCheckTx, // this calls and prints multisig.transactions (public mapping)
    multisigRevokeConfirmation, // this calls and executes multisig.revokeConfirmation(txId)
    multisigExecuteTx, // <---- this calls and executes multisig.executeTransaction(txId)
    multisigAddOwner, // this calls and executes multisig.addOwner(newOwner)
    multisigRemoveOwner, // this calls and executes multisig.removeOwner(owner)
} = require("../../deployment/helpers/helpers");

const logger = new Logs().showInConsole(true);

task("multisig:sign-tx", "Sign multisig tx")
    .addPositionalParam("id", "Multisig transaction to sign", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig wallet address", ethers.constants.AddressZero)
    .setAction(async ({ id, signer, multisig }, hre) => {
        const {
            deployments: { get },
            ethers,
        } = hre;

        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        if (!ethers.utils.isAddress(multisig)) {
            multisig = ethers.constants.AddressZero;
        }
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }
        const ms =
            multisig === ethers.constants.AddressZero
                ? await get("MultiSigWallet")
                : await ethers.getContractAt("MultiSigWallet", multisig);
        await signWithMultisig(ms.address, id, signerAcc);
    });

task("multisig:sign-txs", "Sign multiple multisig tx")
    .addPositionalParam(
        "ids",
        "Multisig transactions to sign. Supports '12,14,16-20,22' format where '16-20' is a continuous range of integers",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig wallet address", ethers.constants.AddressZero)
    .setAction(async ({ ids, signer, multisig }, hre) => {
        const {
            deployments: { get },
            ethers,
        } = hre;
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        if (!ethers.utils.isAddress(multisig)) {
            multisig = ethers.constants.AddressZero;
        }
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }
        const ms =
            multisig === ethers.constants.AddressZero
                ? await get("MultiSigWallet")
                : await ethers.getContractAt("MultiSigWallet", multisig);
        const txnArray = ids.split(",");
        for (let txId of txnArray) {
            if (typeof txId !== "string" || txId.indexOf("-") === -1) {
                await signWithMultisig(ms.address, txId, signerAcc);
            } else {
                const txnRangeArray = txId.split("-", 2).map((num) => parseInt(num));
                for (let id = txnRangeArray[0]; id <= txnRangeArray[1]; id++) {
                    await signWithMultisig(ms.address, id, signerAcc);
                }
            }
        }
    });

task("multisig:execute-tx", "Execute multisig tx by one of tx signers")
    .addPositionalParam("id", "Multisig transaction to sign", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig wallet address", ethers.constants.AddressZero)
    .setAction(async ({ id, signer, multisig }, hre) => {
        const { ethers } = hre;
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        if (!ethers.utils.isAddress(multisig)) {
            multisig = ethers.constants.AddressZero;
        }
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }
        await multisigExecuteTx(id, signerAcc, multisig);
    });

task("multisig:execute-txs", "Execute multisig tx by one of tx signers")
    .addPositionalParam("ids", "Multisig transaction to sign", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig wallet address", ethers.constants.AddressZero)
    .setAction(async ({ id, signer, multisig }, hre) => {
        const { ethers } = hre;
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        if (!ethers.utils.isAddress(multisig)) {
            multisig = ethers.constants.AddressZero;
        }
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }

        const txnArray = ids.split(",");
        for (let txId of txnArray) {
            if (typeof txId !== "string" || txId.indexOf("-") === -1) {
                await multisigExecuteTx(txId, signerAcc, multisig);
            } else {
                const txnRangeArray = txId.split("-", 2).map((num) => parseInt(num));
                for (let id = txnRangeArray[0]; id <= txnRangeArray[1]; id++) {
                    await multisigExecuteTx(txId, signerAcc, multisig);
                }
            }
        }
    });

task("multisig:check-tx", "Check multisig tx")
    .addPositionalParam("id", "Multisig transaction id to check", undefined, types.string)
    .addOptionalParam("multisig", "Multisig wallet address", ethers.constants.AddressZero)
    .setAction(async ({ id, multisig }, hre) => {
        const { ethers } = hre;
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }
        await multisigCheckTx(id, multisig);
    });

task("multisig:check-txs", "Check multiple multisig txs")
    .addPositionalParam("ids", "Multisig transaction ids list to check", undefined, types.string)
    .addOptionalParam("multisig", "Multisig wallet address", ethers.constants.AddressZero)
    .setAction(async ({ ids, multisig }, hre) => {
        const { ethers } = hre;
        if (!ethers.utils.isAddress(multisig)) {
            multisig = ethers.constants.AddressZero;
        }
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }
        const txnArray = ids.split(",");
        for (let txId of txnArray) {
            if (typeof txId !== "string" || txId.indexOf("-") === -1) {
                await multisigCheckTx(txId, multisig);
            } else {
                const txnRangeArray = txId.split("-", 2).map((num) => parseInt(num));
                for (let id = txnRangeArray[0]; id <= txnRangeArray[1]; id++) {
                    await multisigCheckTx(id, multisig);
                }
            }
        }
    });

task("multisig:revoke-sig", "Revoke multisig tx confirmation")
    .addPositionalParam(
        "id",
        "Multisig transaction ids to revoke confirmation from",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig wallet address", ethers.constants.AddressZero)
    .setAction(async ({ id, signer, multisig }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        if (!ethers.utils.isAddress(multisig)) {
            multisig = ethers.constants.AddressZero;
        }
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }
        const ms =
            multisig === ethers.constants.AddressZero
                ? await get("MultiSigWallet")
                : await ethers.getContractAt("MultiSigWallet", multisig);
        await multisigRevokeConfirmation(id, signerAcc, ms.address);
    });

task("multisig:revoke-sigs", "Revoke multisig tx confirmation")
    .addPositionalParam(
        "ids",
        "Multisig transaction to revoke confirmation from",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig wallet address", ethers.constants.AddressZero)
    .setAction(async ({ ids, signer, multisig }, hre) => {
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        const {
            ethers,
            deployments: { get },
        } = hre;
        if (!ethers.utils.isAddress(multisig)) {
            multisig = ethers.constants.AddressZero;
        }
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }
        const ms =
            multisig === ethers.constants.AddressZero
                ? await get("MultiSigWallet")
                : await ethers.getContractAt("MultiSigWallet", multisig);
        const txnArray = ids.split(",");
        for (let txId of txnArray) {
            if (typeof txId !== "string" || txId.indexOf("-") === -1) {
                await multisigRevokeConfirmation(txId, signerAcc, ms.address);
            } else {
                const txnRangeArray = txId.split("-", 2).map((num) => parseInt(num));
                for (let id = txnRangeArray[0]; id <= txnRangeArray[1]; id++) {
                    await multisigRevokeConfirmation(id, signerAcc, ms.address);
                }
            }
        }
    });

task("multisig:add-owner", "Add or remove multisig owner")
    .addParam("address", "Owner address to add or remove", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ address, signer }, hre) => {
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        await multisigAddOwner(address, signerAcc);
    });

task("multisig:remove-owner", "Add or remove multisig owner")
    .addParam("address", "Owner address to add or remove", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ address, signer }, hre) => {
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        await multisigRemoveOwner(address, signerAcc);
    });

task(
    "multisig:treasury-status",
    "Checks the current treasury status for exchequer multisig"
).setAction(async ({}, hre) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    // Staking and Vesting Info
    logger.info("==================Staking and Vesting Info==================");
    const staking = await ethers.getContract("Staking");
    const VestingRegistry = await ethers.getContract("VestingRegistry");
    const multi = await ethers.getContract("MultiSigWallet");
    const stakingBalance = await staking.balanceOf(multi.address);
    if (stakingBalance.toString() == "0") {
        logger.info(`No stakings found for multisig address`);
    } else {
        logger.info(
            `Multisig Treasury Staked Balance: ${ethers.utils.formatEther(
                stakingBalance.toString()
            )} SOV`
        );
    }
    const Vestings = await VestingRegistry.getVestingsOf(multi.address);
    if (Vestings.length == 0) {
        logger.info(`No vestings found for multisig address`);
    } else {
        for (let i = 0; i < Vestings.length; i++) {
            // const vesting = await ethers.getContractAt("VestingLogic", Vestings[i].vestingAddress);
            const balance = await staking.balanceOf(Vestings[i].vestingAddress);
            logger.info(`Exchequer Vesting address: ${Vestings[i].vestingAddress}`);
            logger.info(
                `Has stakings on it for:    ${ethers.utils.formatEther(balance.toString())} SOV`
            );
        }
    }
    logger.info("==========================================================");
    logger.info("");
    // Borrowing Positions Info
    logger.info("==================Borrowing Positions Info==================");
    const sovProtocol = await get("SovrynProtocol");
    const sovABIMaintenance =
        require("../../deployment/deployments/rskSovrynMainnet/LoanMaintenance.json").abi;
    const protocol = await ethers.getContractAt(sovABIMaintenance, sovProtocol.address);
    const excheqerLoans = await protocol.getUserLoans(multi.address, 0, 30, 0, false, false);
    if (excheqerLoans.length == 0) {
        logger.info(`No borrowing positions found for multisig address`);
    } else {
        for (let i = 0; i < excheqerLoans.length; i++) {
            logger.info(`Exchequer Borrowing position:   ${excheqerLoans[i].loanId}`);
            logger.info(
                `Has a collateral of:            ${ethers.utils.formatEther(
                    excheqerLoans[i].collateral.toString()
                )}`
            );
            logger.info(`In terms of asset of the token: ${excheqerLoans[i].collateralToken}`);
            logger.info(
                `and a debt of:                  ${ethers.utils.formatEther(
                    excheqerLoans[i].principal.toString()
                )}`
            );
            logger.info(`In terms of asset of the token: ${excheqerLoans[i].loanToken}`);
        }
    }
    logger.info("==========================================================");
    logger.info("");
    // Liquidity Mining Info
    logger.info("==================Liquidity Mining Info==================");
    const liquidityMining = await ethers.getContract("LiquidityMining");
    const listOfPools = await liquidityMining.getPoolInfoList();
    const rewards = await liquidityMining.getUserAccumulatedRewardList(multi.address);
    let thereIsRewards = false;
    for (let i = 0; i < listOfPools.length; i++) {
        if (rewards[i].toString() == "0") continue;
        logger.info(`Multisig has Liquidity Mining rewards for pool token address:`);
        logger.info(`${listOfPools[i].poolToken}`);
        logger.info(`For an amount of: ${ethers.utils.formatEther(rewards[i].toString())}`);
        thereIsRewards = true;
    }
    if (!thereIsRewards) {
        logger.info(`No Liquidity Mining rewards found for multisig address`);
    }
    logger.info("==========================================================");
    logger.info("");
    // Assets Balances
    logger.info("==================Assets Balances Info==================");
    const assetsLPList = [
        "SOV-AMM",
        "FAKE-TOKEN",
        "USDT-AMM-BTC-SIDE",
        "USDT-AMM-USDT-SIDE",
        "DoC-AMM-BTC-SIDE",
        "DoC-AMM-DoC-SIDE",
        "BPro-AMM-BTC-SIDE",
        "BPro-AMM-BPro-SIDE",
        "ETH-AMM",
        "MoC-AMM",
        "XUSD-AMM",
        "BNB-AMM",
        "iXUSD",
        "FISH-AMM",
        "RIF-AMM",
        "MYNT-AMM",
        "DLLR-AMM",
    ];
    for (let i = 0; i < assetsLPList.length; i++) {
        const LPToken = await ethers.getContractAt("IERC20", listOfPools[i].poolToken);
        const balance = await LPToken.balanceOf(multi.address);
        if (balance.toString() == "0") continue;
        logger.info(
            `Balance in the multi sig wallet: ${ethers.utils.formatEther(balance.toString())} of ${
                assetsLPList[i]
            }`
        );
    }
    const otherLPAssetsList = [
        { iDLLR: "LoanToken_iDLLR" },
        { iBPRO: "LoanToken_iBPRO" },
        { iUSDT: "LoanToken_iUSDT" },
        { iWRBTC: "LoanToken_iRBTC" },
        { iDoC: "LoanToken_iDOC" },
    ];
    for (let i = 0; i < otherLPAssetsList.length; i++) {
        const LPToken = await ethers.getContract(Object.values(otherLPAssetsList[i])[0]);
        const balance = await LPToken.balanceOf(multi.address);
        if (balance.toString() == "0") continue;
        logger.info(
            `Balance in the multi sig wallet: ${ethers.utils.formatEther(balance.toString())} of ${
                Object.keys(otherLPAssetsList[i])[0]
            }`
        );
    }
    const basicAssetList = ["SOV", "XUSD", "DLLR", "ZUSDToken", "DoC", "USDT", "BPro"];
    for (let i = 0; i < basicAssetList.length; i++) {
        const LPToken = await ethers.getContract(basicAssetList[i]);
        const balance = await LPToken.balanceOf(multi.address);
        if (balance.toString() == "0") continue;
        logger.info(
            `Balance in the multi sig wallet: ${ethers.utils.formatEther(balance.toString())} of ${
                basicAssetList[i]
            }`
        );
    }
    const complementaryAMMList = [
        { WRBTC: "" },
        { MoC: "AmmConverterMoc" },
        { FISH: "AmmConverterFish" },
        { RIF: "AmmConverterRif" },
        { MYNT: "AmmConverterMynt" },
        { ETHs: "AmmConverterEth" },
        { BNBs: "AmmConverterBnb" },
    ];
    for (let i = 0; i < complementaryAMMList.length; i++) {
        if (i == 0) {
            const AMM = await ethers.getContract(Object.values(complementaryAMMList[1])[0]);
            const WRBTCAddress = await AMM.reserveTokens(0);
            const WRBTC = await ethers.getContractAt("IERC20", WRBTCAddress);
            const balance = await WRBTC.balanceOf(multi.address);
            if (balance.toString() == "0") continue;
            logger.info(
                `Balance in the multi sig wallet: ${ethers.utils.formatEther(
                    balance.toString()
                )} of WRBTC`
            );
            continue;
        }
        const AMM = await ethers.getContract(Object.values(complementaryAMMList[i])[0]);
        const TokenAddress = await AMM.reserveTokens(1);
        const LPToken = await ethers.getContractAt("IERC20", TokenAddress);
        const balance = await LPToken.balanceOf(multi.address);
        if (balance.toString() == "0") continue;
        logger.info(
            `Balance in the multi sig wallet: ${ethers.utils.formatEther(balance.toString())} of ${
                Object.keys(complementaryAMMList[i])[0]
            }`
        );
    }
    const bridgeAssetListForMainnet = [
        { ETHes: "0xFe878227c8F334038DAb20a99fC3B373fFe0a755" },
        { DAIes: "0x1A37c482465e78E6DAbE1Ec77B9a24D4236D2A11" },
        { USDCes: "0x8D1f7CbC6391D95E2774380e80A666FEbf655D6b" },
        { USDTes: "0xD9665EA8F5fF70Cf97E1b1Cd1B4Cd0317b0976e8" },
        { BNBbs: "0xd2a826b78200c8434b957913ce4067e6e3169385" },
        { ETHbs: "0x30d1B36924c2c0CD1c03EC257D7FFf31bD8c3007" },
        { BUSDbs: "0x61e9604e31a736129d7f5C58964c75935b2d80D6" },
        { DAIbs: "0x6A42Ff12215a90f50866A5cE43A9c9C870116e76" },
        { USDCbs: "0x91EDceE9567cd5612c9DEDeaAE24D5e574820af1" },
        { USDTbs: "0xFf4299bCA0313C20A61dc5eD597739743BEf3f6d" },
    ];
    const bridgeAssetListForTestnet = [
        { ETHes: "0x4F2Fc8d55c1888A5AcA2503e2F3E5d74eef37C33" },
        { DAIes: "0xcb92C8D49Ec01b92F2A766C7c3C9C501C45271E0" },
        { USDCes: "0xcc8Eec21ae75F1A2dE4aC7b32A7de888a45cF859" },
        { USDTes: "0x10C5A7930fC417e728574E334b1488b7895c4B81" },
        { BNBbs: "0xafa6A1eb7E2282E8854822d2bB412b6db2cabA4E" },
        { ETHbs: "0x793CE6F95912D5b43532c2116e1b68993d902272" },
        { BUSDbs: "0x8c9abb6c9d8d15ddb7ada2e50086e1050ab32688" },
        { DAIbs: "0x407ff7d4760d3a81b4740d268eb04490c7dfe7f2" },
        { USDCbs: "0x3e2cf87e7ff4048a57f9cdde9368c9f4bfb43adf" },
        { USDTbs: "0x43bc3f0ffff6c9bbf3c2eafe464c314d43f561de" },
    ];
    const bridgeAssetList = network.tags.mainnet
        ? bridgeAssetListForMainnet
        : bridgeAssetListForTestnet;
    for (let i = 0; i < bridgeAssetList.length; i++) {
        const LPToken = await ethers.getContractAt(
            "IERC20",
            Object.values(bridgeAssetList[i])[0].toLowerCase()
        );
        const balance = await LPToken.balanceOf(multi.address);
        if (balance.toString() == "0") continue;
        logger.info(
            `Balance in the multi sig wallet: ${ethers.utils.formatEther(balance.toString())} of ${
                Object.keys(bridgeAssetList[i])[0]
            }`
        );
    }
    logger.info("==========================================================");
    logger.info("");
    // Troves Info
    logger.info("==================Troves Info==================");
    const troveManager = await ethers.getContract("TroveManager");
    const troves = await troveManager.getEntireDebtAndColl(multi.address);
    // if(troves.debt.toString() == '0') {
    //     logger.info("Exchequer has No Trove Activity");
    // } else {
    logger.info(
        `Exchequer Trove Debt:           ${ethers.utils.formatEther(troves.debt.toString())}`
    );
    logger.info(
        `Exchequer Trove collateral:     ${ethers.utils.formatEther(troves.coll.toString())}`
    );
    logger.info(
        `Exchequer pending USD Rewadrs:  ${ethers.utils.formatEther(troves.pendingZUSDDebtReward)}`
    );
    logger.info(
        `Exchequer pending BTC Rewadrs:  ${ethers.utils.formatEther(
            troves.pendingETHReward.toString()
        )}`
    );
    // }
    logger.info("==========================================================");
    logger.info("");
});
