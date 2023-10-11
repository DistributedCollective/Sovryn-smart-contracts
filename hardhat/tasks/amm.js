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
const { transferOwnershipAMMContractsToGovernance, getAmmOracleAddress } = require("../helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

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

task("amm:transferOwnershipToGovernance", "Transferring ownership of AMM contracts to governance")
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ signer }, hre) => {
        const {
            deployments: { get },
        } = hre;

        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        const timelockAdmin = await get("TimelockAdmin");
        const timelockOwner = await get("TimelockOwner");

        const timeLockAdminListOracleTransfers = [
            {
                sourceConverter: "AmmConverterMoc",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
            {
                sourceConverter: "AmmConverterSov",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
            {
                sourceConverter: "AmmConverterEth",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
            {
                sourceConverter: "AmmConverterBnb",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
            {
                sourceConverter: "AmmConverterXusd",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
            {
                sourceConverter: "AmmConverterFish",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
            {
                sourceConverter: "AmmConverterRif",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
            {
                sourceConverter: "AmmConverterMynt",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
            {
                sourceConverter: "AmmConverterDllr",
                sourceConverterType: "ConverterV1",
                contractName: "",
            },
        ];

        const timeLockAdminListTransfers = [
            {
                contractAddress: (await get("AmmSovrynSwapNetwork")).address,
                contractName: "SovrynSwapNetwork",
            },
            {
                contractAddress: (await get("AmmSwapSettings")).address,
                contractName: "SwapSettings",
            },
            {
                contractAddress: (await get("AmmConversionPathFinder")).address,
                contractName: "ConversionPathFinder",
            },
            {
                contractAddress: (await get("AmmConverterUpgrader")).address,
                contractName: "SovrynSwapConverterUpgrader",
            },
            {
                contractAddress: (await get("AmmConverterRegistryData")).address,
                contractName: "SovrynSwapConverterRegistryData",
            },
            {
                contractAddress: (await get("AmmOracleWhitelist")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmRbtcWrapperProxy")).address,
                contractName: "",
            },
        ];

        const timeLockOwnerListTransfers = [
            {
                contractAddress: (await get("AmmConverterDoc")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterUsdt")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterBpro")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterBnb")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterMoc")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterXusd")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterSov")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterEth")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterFish")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterMynt")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterRif")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmConverterDllr")).address,
                contractName: "",
            },
            {
                contractAddress: (await get("AmmContractRegistry")).address,
                contractName: "ContractRegistry",
            },
            {
                contractAddress: (await get("AmmConverterFactory")).address,
                contractName: "ConverterFactory",
            },
        ];

        logger.info(
            `=== Transferring Ownership of Oracle AMM Contracts to Governance (Timelock Admin) ===`
        );
        for (let timeLockAdminListOracleTransfer of timeLockAdminListOracleTransfers) {
            const oracleAddress = await getAmmOracleAddress(
                timeLockAdminListOracleTransfer.sourceConverter,
                timeLockAdminListOracleTransfer.sourceConverterType
            );
            if (oracleAddress === ZERO_ADDRESS) {
                logger.error(
                    `Could not find the oracle from ${timeLockAdminListOracleTransfer.sourceConverter}`
                );
                break;
            }
            logger.info(`=== Transferring ownership of oracle ${oracleAddress} ===`);
            const isTransferOwnershipSuccess = await transferOwnershipAMMContractsToGovernance(
                oracleAddress,
                timelockAdmin.address,
                signerAcc,
                timeLockAdminListOracleTransfer.contractName
            );
            if (!isTransferOwnershipSuccess) break;
        }

        logger.info(
            `=== Transferring Ownership of AMM Contracts to Governance (Timelock Admin) ===`
        );
        for (let timeLockAdminListTransfer of timeLockAdminListTransfers) {
            logger.info(
                `=== Transferring ownership of ${timeLockAdminListTransfer.contractAddress} ===`
            );
            const isTransferOwnershipSuccess = await transferOwnershipAMMContractsToGovernance(
                timeLockAdminListTransfer.contractAddress,
                timelockAdmin.address,
                signerAcc,
                timeLockAdminListTransfer.contractName
            );
            if (!isTransferOwnershipSuccess) break;
        }

        logger.info(
            `=== Transferring Ownership of AMM Contracts to Governance (Timelock Owner) ===`
        );
        for (let timeLockOwnerListTransfer of timeLockOwnerListTransfers) {
            logger.info(
                `=== Transferring ownership of ${timeLockOwnerListTransfer.contractAddress} ===`
            );
            const isTransferOwnershipSuccess = await transferOwnershipAMMContractsToGovernance(
                timeLockOwnerListTransfer.contractAddress,
                timelockOwner.address,
                signerAcc,
                timeLockOwnerListTransfer.contractName
            );
            if (!isTransferOwnershipSuccess) break;
        }
    });
