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
    .addParam("id", "Multisig transaction to sign", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ id, signer }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const signerAcc = (await hre.getNamedAccounts())[signer];
        const ms = await get("MultiSigWallet");
        await signWithMultisig(ms.address, id, signerAcc);
    });

task("multisig:sign-txs", "Sign multiple multisig tx")
    .addParam(
        "txIds",
        "Multisig transactions to sign. Supports '12,14,16-20,22' format where '16-20' is a continuous range of integers",
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
    .addParam("id", "Multisig transaction to sign", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ id, signer }, hre) => {
        const signerAcc = (await hre.getNamedAccounts())[signer];
        await multisigExecuteTx(id, signerAcc);
    });

task("multisig:check-tx", "Check multisig tx")
    .addParam("id", "Multisig transaction id to check", undefined, types.string)
    .setAction(async (taskArgs, hre) => {
        await multisigCheckTx(taskArgs.id);
    });

task("multisig:revoke-confirmation", "Revoke multisig tx confirmation")
    .addParam("tx", "Multisig transaction to revoke confirmation from", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ id, signer }, hre) => {
        const signerAcc = (await hre.getNamedAccounts())[signer];
        await multisigRevokeConfirmation(id, signerAcc);
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
