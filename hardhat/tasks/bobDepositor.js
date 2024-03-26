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
    .addOptionalParam("dryRun", "dry run flag, if true, it will not execute the transfer", "1") // dry run is true by default
    .addOptionalParam(
        "signer",
        "Signer name: 'signer' or 'deployer' or 'safeDepositSender'",
        "safeDepositSender"
    )
    .setAction(async ({ dryRun, signer }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const signerAcc = (await hre.getNamedAccounts())[signer];
        dryRun = Boolean(parseInt(dryRun));

        logger.info(
            `dryRun is ${dryRun}, it will not execute the transfer, pass dryRun as false to execute the transfer transaction`
        );
        await executeTimeLockDepositor(hre, signer, dryRun);
    });
