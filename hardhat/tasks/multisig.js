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
    sendWithMultisig,
    multisigReplaceOwner, // this calls and executes multisig.replaceOwner(oldOwner, newOwner)
    sendTokensWithMultisig,
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
    .setAction(async ({ ids, signer, multisig }, hre) => {
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
                    await multisigExecuteTx(id, signerAcc, multisig);
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
    .addPositionalParam("address", "Owner address to add or remove", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ address, signer }, hre) => {
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        await multisigAddOwner(address, signerAcc);
    });

task("multisig:get-owners", "Print multisig owners")
    .addOptionalParam("multisig", "Multisig address", "MultiSigWallet")
    .setAction(async ({ multisig }, hre) => {
        const { ethers } = hre;
        if (!ethers.utils.isAddress(multisig)) {
            multisig = ethers.constants.AddressZero;
        }
        const code = await ethers.provider.getCode(multisig);
        if (code === "0x") {
            multisig = ethers.constants.AddressZero;
        }
        const ms =
            multisig === ethers.constants.AddressZero
                ? await ethers.getContract("MultiSigWallet")
                : await ethers.getContractAt("MultiSigWallet", multisig);
        //const multisigContract = await ethers.getContract(multisig);
        logger.info("Owners: ", await ms.getOwners());
    });

task("multisig:remove-owner", "Remove multisig owner")
    .addPositionalParam("address", "Owner address to remove", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address", "MultiSigWallet")
    .setAction(async ({ address, signer, multisig }, hre) => {
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        await multisigRemoveOwner(address, signerAcc, multisig);
    });

task("multisig:replace-owner", "Replace multisig owner")
    .addParam("oldOwner", "Owner address to be replaced", undefined, types.string)
    .addParam("newOwner", "New owner address", undefined, types.string)
    .addOptionalParam("multisig", "Multisig address", "MultiSigWallet")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ oldOwner, newOwner, signer, multisig }, hre) => {
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];
        await multisigReplaceOwner(oldOwner, newOwner, signerAcc, multisig);
    });

task("multisig:send-tokens", "Send ERC20 tokens or gas tokens via multisig")
    .addParam(
        "transfers",
        "JSON array of transfers: [{token, to, amount}]. Token can be an address, deployment name (SOV, DLLR, etc.), or 'GasToken' for native token",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address or deployment name", "MultiSigWallet")
    .setAction(async ({ transfers, signer, multisig }, hre) => {
        const { ethers } = hre;
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        // Parse the transfers JSON
        let transfersArray;
        try {
            transfersArray = JSON.parse(transfers);
        } catch (error) {
            logger.error(`Error parsing transfers JSON: ${error.message}`);
            logger.error(
                `Expected format: '[{"token":"SOV","to":"0x...","amount":"1000000000000000000"}]'`
            );
            return;
        }

        // Validate transfers array
        if (!Array.isArray(transfersArray) || transfersArray.length === 0) {
            logger.error("Transfers must be a non-empty array");
            return;
        }

        // Validate each transfer
        for (const transfer of transfersArray) {
            if (!transfer.token || !transfer.to || !transfer.amount) {
                logger.error("Each transfer must have 'token', 'to', and 'amount' properties");
                return;
            }
        }

        await sendTokensWithMultisig(transfersArray, signerAcc, multisig);
    });

// @todo  create helper to send ERC20 tokens and gas token via multisig. if the user is one of the owners - create tx - call submitTransaction. If not - just create and print tx data: to address, value 0, excoded tx data. it should accept and process multiple tokens - either passed as addresses or deployed names like BOS, SOV, DLLR etc. reserved word for the gas token is GasToken. it should accept an arbitrary multisig optionally, by default - MultiSigWallet.
// task("multisig:sendTo", "Send gas token using multisig")
//     .addPositionalParam("address", "Receiver", undefined, types.string)
//     .addPositionalParam("amount", "Amount in wei/sat", undefined, types.string)
//     .addOptionalParam("multisig", "Multisig address", "MultiSigWallet")
//     .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
//     .setAction(async ({ address, amount, multisig, signer }, hre) => {
//         const signerAcc = ethers.utils.isAddress(signer)
//             ? signer
//             : (await hre.getNamedAccounts())[signer];
//         //const signerObj = await getSignerFromAccount(hre, sender);
//         const ms = await getMultisig(multisig);
//         await sendWithMultisig(ms.address, signerAcc, amount); - to be replaced with token sending function
//     });
