/* eslint-disable no-console */
const { task } = require("hardhat/config");
const Logs = require("node-logs");
const { generateReportTimelockDepositor } = require("../../scripts/reportTimelockDepositor");
const { executeTimeLockDepositor } = require("../../scripts/timelockDepositor");

const logger = new Logs().showInConsole(true);

task("bob:generate-report-depositor", "Generate report depositor").setAction(async ({}, hre) => {
    await generateReportTimelockDepositor(hre);
});

task("bob:execute-timelock-depositor", "Generate report depositor")
    .addFlag("dryRun", "Dry run flag")
    .addOptionalParam(
        "signer",
        "Signer name: 'signer' or 'deployer' or 'safeDepositSender'",
        "safeDepositSender"
    )
    .setAction(async ({ dryRun, signer }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        if (dryRun) {
            logger.warn(`Dry run - it will not execute the transfer`);
        }
        await executeTimeLockDepositor(hre, signerAcc, dryRun);
    });
