/* eslint-disable no-console */
const { task } = require("hardhat/config");
const Logs = require("node-logs");
const sipArgsList = require("./args/sipArgs");

const logger = new Logs().showInConsole(true);

task("sips:create-sip", "Create SIP to Sovryn Governance")
    .addParam(
        "argsFunc",
        "Function name from tasks/sips/args/sipArgs.ts which returns the sip arguments"
    )
    .setAction(async ({ argsFunc }, hre) => {
        const sipArgs = await sipArgsList[argsFunc](hre);
        await createSIP(hre, sipArgs.args, sipArgs.governor);
    });

const createSIP = async (hre, sipArgs, governorName) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const governorDeployment = await get(governorName);
    const governor = await ethers.getContract(governorName);

    logger.info("=== Creating SIP ===");
    logger.info(`Governor Address:    ${governorDeployment.address}`);
    logger.info(`Targets:             ${sipArgs.targets}`);
    logger.info(`Values:              ${sipArgs.values}`);
    logger.info(`Signatures:          ${sipArgs.signatures}`);
    logger.info(`Data:                ${sipArgs.data}`);
    logger.info(`Description:         ${sipArgs.description}`);
    logger.info(`============================================================='`);

    const tx = await governor.propose(
        sipArgs.targets,
        sipArgs.values,
        sipArgs.signatures,
        sipArgs.data,
        sipArgs.description
    );
    const receipt = await tx.wait();

    const eventData = governor.interface.parseLog(receipt.logs[0]).args;

    logger.success("=== SIP has been created ===");
    logger.success(`Governor Address:     ${governor.address}`);
    logger.success(`Proposal ID:          ${eventData.id.toString()}`);
    logger.success(`Porposer:             ${eventData.proposer}`);
    logger.success(`Targets:              ${eventData.targets}`);
    logger.success(`Values:               ${eventData.values}`);
    logger.success(`Signatures:           ${eventData.signatures}`);
    logger.success(`Data:                 ${eventData.calldatas}`);
    logger.success(`Description:          ${eventData.description}`);
    logger.success(`Start Block:          ${eventData.startBlock}`);
    logger.success(`End Block:            ${eventData.endBlock}`);
    logger.success(`============================================================='`);
};
