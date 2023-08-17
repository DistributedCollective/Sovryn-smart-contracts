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
    sendWithMultisig,
    parseEthersLog,
    parseEthersLogToValue,
    getTxLog,
    delay,
    logTimer,
} = require("../../deployment/helpers/helpers");

const sipArgsList = require("./sips/args/sipArgs");

const logger = new Logs().showInConsole(true);

task("sips:state", "Get proposal state")
    .addParam("proposal", "Proposal Id", undefined, types.string)
    .addParam(
        "governor",
        "Governor deployment name: 'GovernorOwner' or 'GovernorAdmin'",
        undefined,
        types.string
    )
    .setAction(async ({ proposal, governor }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const governorContract = await ethers.getContract(governor);
        const proposalStates = [
            "Pending",
            "Active",
            "Canceled",
            "Defeated",
            "Succeeded",
            "Queued",
            "Expired",
            "Executed",
        ];
        logger.info(
            `SIP ${proposal} state: ${proposalStates[await governorContract.state(proposal)]}`
        );
    });

task("sips:create", "Create SIP to Sovryn Governance")
    .addParam(
        "argsFunc",
        "Function name from tasks/sips/args/sipArgs.ts which returns the sip arguments"
    )
    .setAction(async ({ argsFunc }, hre) => {
        const { governor: governorName, args: sipArgs } = await sipArgsList[argsFunc](hre);
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
    });

task("sips:populate", "Create SIP tx object to Propose to Sovryn Governance")
    .addParam(
        "argsFunc",
        "Function name from tasks/sips/args/sipArgs.ts which returns the sip arguments"
    )
    .setAction(async ({ argsFunc }, hre) => {
        const { governor: governorName, args: sipArgs } = await sipArgsList[argsFunc](hre);
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
        logger.info(`=============================================================`);

        let tx = await governor.populateTransaction.propose(
            sipArgs.targets,
            sipArgs.values,
            sipArgs.signatures,
            sipArgs.data,
            sipArgs.description,
            { gasLimit: 6500000, gasPrice: 66e6 }
        );

        delete tx.from;
        logger.warning("==================== populated tx start ====================");
        logger.info(tx);
        logger.warning("==================== populated tx end   =================");
        return tx;
    });

task("sips:queue", "Queue proposal in the Governor Owner contract")
    .addParam("proposal", "Proposal Id", undefined, types.string)
    .addParam(
        "governor",
        "Governor deployment name: 'GovernorOwner' or 'GovernorAdmin'",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ proposal, signer, governor }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const signerAcc = (await hre.getNamedAccounts())[signer];
        const governorContract = await ethers.getContract(
            governor,
            await ethers.getSigner(signerAcc)
        );
        await (await governorContract.queue(proposal)).wait();
        if ((await governorContract.state(proposal)) === 5) {
            logger.info(`SIP ${proposal} queued`);
        } else {
            logger.error(`SIP ${proposal} is NOT queued`);
        }
    });

task("sips:execute", "Execute proposal in a Governor contract")
    .addParam("proposal", "Proposal Id", undefined, types.string)
    .addParam(
        "governor",
        "Governor deployment name: 'GovernorOwner' or 'GovernorAdmin'",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ proposal, signer, governor }, hre) => {
        const {
            deployments: { get },
        } = hre;
        const signerAcc = (await hre.getNamedAccounts())[signer];
        const governorContract = await ethers.getContract(
            governor,
            await ethers.getSigner(signerAcc)
        );
        const gasEstimated = (await governorContract.estimateGas.execute(proposal)).toNumber();
        await (
            await governorContract.execute(proposal, { gasLimit: Math.round(gasEstimated * 2) })
        ).wait();
        if ((await governorContract.state(proposal)) === 7) {
            logger.info(`SIP ${proposal} executed`);
        } else {
            logger.error(`SIP ${proposal} is NOT executed`);
        }
    });

task("sips:cancel", "Queue proposal in the Governor Owner contract")
    .addParam("proposal", "Proposal Id", undefined, types.string)
    .addParam(
        "governor",
        "Governor deployment name: 'GovernorOwner' or 'GovernorAdmin'",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ proposal, signer, governor }, hre) => {
        const {
            deployments: { get },
            getNamedAccounts,
        } = hre;
        const governorContract = await ethers.getContract(governor);
        const guardian = await governorContract.guardian();
        const msAddress = (await get("MultiSigWallet")).address;
        if (!guardian == msAddress) {
            throw new Error(
                `Governor contract's (${governorContract.address}) guardian (${guardian}) is not multisig (${msAddress})`
            );
        }
        const governorInterface = new ethers.utils.Interface((await get(governor)).abi);
        const data = governorInterface.encodeFunctionData("cancel", [proposal]);
        await sendWithMultisig(msAddress, governorContract, data, signer);
    });

task("sips:vote-for", "Vote for or against a proposal in the Governor Owner contract")
    .addParam("proposal", "Proposal Id", undefined, types.string)
    .addParam(
        "governor",
        "Governor deployment name: 'GovernorOwner' or 'GovernorAdmin'",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ proposal, signer, governor }, hre) => {
        const {
            deployments: { get },
            getNamedAccounts,
        } = hre;
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        const governorContract = await ethers.getContract(
            governor,
            await ethers.getSigner(signerAcc)
        );
        const tx = await (await governorContract.castVote(proposal, true)).wait();
        console.log("Voted for");
        console.log("tx:", tx.transactionHash);
        console.log("{ to:", tx.to, "from:", tx.from, "}");
        console.log(
            "log:\n",
            tx.logs.map((log) => parseEthersLogToValue(governorContract.interface.parseLog(log)))
        );
    });

task("sips:queue-timer", "Queue SIP for execution with timer")
    .addParam("proposal", "Proposal Id", undefined, types.string)
    .addParam(
        "governor",
        "Governor deployment name: 'GovernorOwner' or 'GovernorAdmin'",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ proposal: proposalId, signer, governor }, hre) => {
        const {
            deployments: { get },
            getNamedAccounts,
        } = hre;
        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        const governorContract = await ethers.getContract(
            governor,
            await ethers.getSigner(signerAcc)
        );
        let proposal = await governorContract.proposals(proposalId);
        let currentBlockNumber = await ethers.provider.getBlockNumber();
        let passedTime = 0;
        let delayTime;
        let intervalId;
        const logTime = () => {
            logTimer(delayTime, passedTime);
            passedTime++;
        };
        while (currentBlockNumber <= proposal.endBlock) {
            delayTime = (proposal.endBlock - currentBlockNumber) * 30000;
            logger.warn(
                `${new Date().toUTCString()}, current block ${currentBlockNumber}, target block ${
                    proposal.endBlock
                }:  pausing for ${delayTime / 1000} secs (${delayTime / 30000} blocks)`
            );
            intervalId = setInterval(logTime, 1000);
            await delay(delayTime);
            currentBlockNumber = await ethers.provider.getBlockNumber();
        }
        clearInterval(intervalId);
        const proposalState = await governorContract.state(proposalId);
        if (proposalState !== 4) {
            throw new Error("Proposal NOT Succeeded");
        }
        (await governorContract.queue(proposalId)).wait();
        proposal = await governorContract.proposals(proposalId);
        console.log("");
        logger.success(`Proposal ${proposalId} queued. Execution ETA: ${proposal.eta}.`);
    });

task("sips:execute-timer", "Execute SIP with countdown")
    .addParam("proposal", "Proposal Id", undefined, types.string)
    .addParam(
        "governor",
        "Governor deployment name: 'GovernorOwner' or 'GovernorAdmin'",
        undefined,
        types.string
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .setAction(async ({ proposal: proposalId, signer, governor }, hre) => {
        const { getNamedAccounts } = hre;

        const signerAcc = ethers.utils.isAddress(signer)
            ? signer
            : (await getNamedAccounts())[signer];
        const governorContract = await ethers.getContract(
            governor,
            await ethers.getSigner(signerAcc)
        );

        if ((await governorContract.state(proposalId)) !== 5) {
            throw new Error("Proposal must be queued for execution");
        }
        let proposal = await governorContract.proposals(proposalId);
        //Math.floor(Date.now() / 1000)
        const currentBlockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
        let passedTime = 0;
        let logDelayTime;
        const logTime = () => {
            logTimer(logDelayTime, passedTime);
            passedTime++;
        };
        if (proposal.eta > currentBlockTimestamp) {
            const delayTime = proposal.eta - currentBlockTimestamp + 120; // add 2 minutes
            logDelayTime = delayTime * 1000;
            logger.info(`Delaying proposal ${proposalId} execution for ${delayTime} sec`);
            const intervalId = setInterval(logTime, 1000);
            await delay(delayTime * 1000);
            clearInterval(intervalId);
        }
        await (await governorContract.execute(proposalId)).wait();
        console.log("");
        if ((await governorContract.state(proposalId)) === 7) {
            logger.success(`Proposal ${proposalId} executed`);
        } else {
            logger.error(`Proposal ${proposalId} is NOT executed`);
        }
    });
