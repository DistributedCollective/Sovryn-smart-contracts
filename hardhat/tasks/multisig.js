/* eslint-disable no-console */
const { task } = require("hardhat/config");
const Logs = require("node-logs");
const {
    signWithMultisig,
    multisigCheckTx,
    multisigRevokeConfirmation,
    multisigExecuteTx,
    multisigAddOwner,
    multisigRemoveOwner,
} = require("../../deployment/helpers/helpers");

const logger = new Logs().showInConsole(true);

task("multisig:sign-tx", "Sign multisig tx")
    .addParam("txId", "Multisig transaction to sign", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ txId, signer }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const signerAcc = (await hre.getNamedAccounts())[signer];
        const ms = await get("MultiSigWallet");
        await signWithMultisig(ms.address, txId, signerAcc);
    });

task("multisig:sign-txs", "Sign multiple multisig tx")
    .addParam(
        "txIds",
        "Multisig transactions to sign. Supports '12,14,16-20,22' format where '16-20' is a continuous series of numbers",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ txIds, signer }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const signerAcc = (await hre.getNamedAccounts())[signer];
        const ms = await get("MultiSigWallet");
        const txnArray = txIds.split(",").map((num) => parseInt(num));
        /*for (let txId = txnArray[0]; txId <= txnArray[1]; txId++) {
            await signWithMultisig(ms.address, txId, signerAcc);
        }*/
        for (let txId of txnArray) {
            if (typeof txId !== "string" || txId.indexOf("-") === -1) {
                await signWithMultisig(ms.address, txId, signerAcc);
            } else {
                const txnRangeArray = txIds.split("-", 2).map((num) => parseInt(num));
                for (let txId = txnRangeArray[0]; txId <= txnRangeArray[1]; txId++) {
                    await signWithMultisig(ms.address, txId, signerAcc);
                }
            }
        }
    });

task("multisig:execute-tx", "Execute multisig tx by one of tx signers")
    .addParam("txId", "Multisig transaction to sign", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ txId, signer }, hre) => {
        const signerAcc = (await hre.getNamedAccounts())[signer];
        await multisigExecuteTx(txId, signerAcc);
    });

task("multisig:check-tx", "Check multisig tx")
    .addParam("txId", "Multisig transaction to check", undefined, types.string)
    .setAction(async (taskArgs, hre) => {
        await multisigCheckTx(taskArgs.txId);
    });

task("multisig:revoke-confirmation", "Revoke multisig tx confirmation")
    .addParam("txId", "Multisig transaction to check", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ txId, signer }, hre) => {
        const signerAcc = (await hre.getNamedAccounts())[signer];
        await multisigRevokeConfirmation(txId, signerAcc);
    });

task("multisig:add-owner", "Add or remove multisig owner")
    .addParam("address", "Owner address to add or remove", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ add, address, signer }, hre) => {
        const signerAcc = (await hre.getNamedAccounts())[signer];
        await multisigAddOwner(address, signer);
    });

task("multisig:remove-owner", "Add or remove multisig owner")
    .addParam("address", "Owner address to add or remove", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ add, address, signer }, hre) => {
        const signerAcc = (await hre.getNamedAccounts())[signer];
        await multisigRemoveOwner(address, signerAcc);
    });
