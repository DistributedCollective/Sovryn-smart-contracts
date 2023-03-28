/* eslint-disable no-console */
const { task } = require("hardhat/config");
const Logs = require("node-logs");
const {
    sendWithMultisig,
    multisigCheckTx,
    multisigRevokeConfirmation,
    multisigExecuteTx,
    multisigAddOwner,
    multisigRemoveOwner,
} = require("../../deployment/helpers/helpers");

const logger = new Logs().showInConsole(true);

task("amm:whitelistConverter", "Whitelist converter in FeeSharingCollector")
    .addParam(
        "converter",
        "AMM liquidity pool converter deployment name to whitelist in FeeSharingCollector",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ converter, signer }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const signerAcc = (await hre.getNamedAccounts())[signer];
        const multisigDeployment = await get("MultiSigWallet");
        const feeSharingCollectorDeployment = await get("FeeSharingCollector");
        const converterAddress = (await get(converter)).address;

        const feeSharingCollectorWhitelistABI = [
            "function addWhitelistedConverterAddress(address converterAddress)",
        ];
        const iFeeSharingCollector = new ethers.utils.Interface(feeSharingCollectorWhitelistABI);
        let data = iFeeSharingCollector.encodeFunctionData("addWhitelistedConverterAddress", [
            converterAddress,
        ]);
        logger.warn(
            `Generating multisig tx to whitelist AMM pool converter ${converterAddress} in FeeSharingCollector...`
        );
        await sendWithMultisig(
            multisigDeployment.address,
            feeSharingCollectorDeployment.address,
            data,
            signerAcc
        );
    });
