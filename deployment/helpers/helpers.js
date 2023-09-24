//const hre = require("hardhat");
/*const {
    deployments: { deploy, get, log },
    getNamedAccounts,
    ethers,
} = hre;*/

///@dev This file requires HardhatRuntimeEnvironment `hre` variable in its parent context for functions using hre to work
const { arrayToUnique } = require("../helpers/utils");
const col = require("cli-color");

const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);

const logTimer = (time, passedTime) => {
    const delaySeconds = time / 1000;
    let timer = delaySeconds - passedTime;

    let hours = parseInt(timer / 3600, 10);
    let minutes = parseInt((timer % 3600) / 60, 10);
    let seconds = parseInt(timer % 60, 10);
    hours = hours < 10 ? "0" + hours : hours;
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
    process.stdout.write("");
    process.stdout.clearLine();
    process.stdout.cursorTo(0);

    process.stdout.write(hours + ":" + minutes + ":" + seconds);
};

const getStakingModulesNames = () => {
    return {
        StakingAdminModule: "StakingAdminModule",
        StakingGovernanceModule: "StakingGovernanceModule",
        StakingStakeModule: "StakingStakeModule",
        StakingStorageModule: "StakingStorageModule",
        StakingVestingModule: "StakingVestingModule",
        StakingWithdrawModule: "StakingWithdrawModule",
        WeightedStakingModule: "WeightedStakingModule",
    };
};

const getLoanTokenModulesNames = () => {
    return {
        LoanTokenLogic: "LoanTokenLogic",
        LoanTokenLogicWrbtc: "LoanTokenLogicWrbtc",
        LoanTokenLogicLM: "LoanTokenLogicLM",
        LoanTokenLogicWrbtcLM: "LoanTokenLogicWrbtcLM",
        LoanTokenSettingsLowerAdmin: "LoanTokenSettingsLowerAdmin",
    };
};

const stakingRegisterModuleWithMultisig = () => {
    return process.env.STAKING_REG_WITH_MULTISIG == "true";
};

const isMultisigOwner = async (multisigAddress, checkAddress) => {
    const multisig = await ethers.getContractAt("MultiSigWallet", multisigAddress);
    return await multisig.isOwner(checkAddress);
};

const multisigAddOwner = async (addAddress, sender) => {
    const {
        ethers,
        getNamedAccounts,
        deployments: { get },
    } = hre;
    const multisigDeployment = await get("MultiSigWallet");
    let multisigInterface = new ethers.utils.Interface(multisigDeployment.abi);
    let data = multisigInterface.encodeFunctionData("addOwner", [addAddress]);
    ///@todo check if the deployer is one of ms owners
    console.log(`creating multisig tx to add new owner ${addAddress}...`);
    await sendWithMultisig(multisigDeployment.address, multisigDeployment.address, data, sender);
    console.log(
        col.bgBlue(
            `>>> DONE. Requires Multisig (${multisigDeployment.address}) signing to execute tx <<<`
        )
    );
};

const multisigRemoveOwner = async (removeAddress, sender) => {
    const {
        ethers,
        getNamedAccounts,
        deployments: { get },
    } = hre;
    const multisigDeployment = await get("MultiSigWallet");
    let multisigInterface = new ethers.utils.Interface(multisigDeployment.abi);
    let data = multisigInterface.encodeFunctionData("removeOwner", [removeAddress]);
    console.log(`creating multisig tx to remove owner ${removeAddress}...`);
    await sendWithMultisig(multisigDeployment.address, multisigDeployment.address, data, sender);
    console.log(
        col.bgBlue(
            `>>> DONE. Requires Multisig (${multisigDeployment.address}) signing to execute tx <<<`
        )
    );
};

const sendWithMultisig = async (multisigAddress, contractAddress, data, sender, value = 0) => {
    const { ethers } = hre;
    const signer = await ethers.getSigner(sender);
    const multisig = await ethers.getContractAt("MultiSigWallet", multisigAddress, signer);
    const gasEstimated = (
        await multisig.estimateGas.submitTransaction(contractAddress, value, data)
    ).toNumber();
    receipt = await (
        await multisig.submitTransaction(contractAddress, value, data, {
            gasLimit: Math.round(gasEstimated * 1.3),
        })
    ).wait();

    const abi = ["event Submission(uint256 indexed transactionId)"];
    let iface = new ethers.utils.Interface(abi);
    const parsedEvent = await getParsedEventLogFromReceipt(receipt, iface, "Submission");
    await multisigCheckTx(parsedEvent.transactionId.value, multisig.address);
};

const signWithMultisig = async (multisigAddress, txId, sender) => {
    const { ethers, getNamedAccounts } = hre;
    console.log("Signing multisig txId...", txId);
    const signer = await ethers.getSigner(sender);
    const multisig = await ethers.getContractAt("MultiSigWallet", multisigAddress, signer);
    const gasEstimated = (await multisig.estimateGas.confirmTransaction(txId)).toNumber();
    /*
    receipt = await (
        await multisig.confirmTransaction(txId, { gasLimit: Math.round(gasEstimated * 1.3) })
    ).wait();
    // console.log("Required signatures:", await multisig.required());
    console.log("Signed. Details:");
    await multisigCheckTx(txId, multisig.address);
    */
    console.log("Estimated Gas:", gasEstimated);
    const lastBlock = await ethers.provider.getBlock();
    const lastBlockGasLimit = lastBlock.gasLimit.toNumber();
    console.log("Last Block Gas Limit:", lastBlockGasLimit);
    const gasEstimatedMul = gasEstimated * 1.5;

    let receipt;
    let wontSign = false;
    if (gasEstimatedMul < lastBlockGasLimit) {
        try {
            await multisig.callStatic.confirmTransaction(txId, { gasEstimatedMul });
            receipt = await (await multisig.confirmTransaction(txId, { gasEstimatedMul })).wait();
        } catch (e) {
            wontSign = true;
        }
    }
    if (wontSign || gasEstimatedMul >= lastBlockGasLimit) {
        receipt = await (
            await multisig.confirmTransaction(txId, { gasLimit: lastBlockGasLimit })
        ).wait();
    }

    console.log(
        col.yellowBright(
            "==============================================================================="
        )
    );
    console.log(col.greenBright("DONE. Details:"));
    console.log("Tx hash:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed.toNumber());
    await multisigCheckTx(txId, multisig.address);
    console.log(
        col.yellowBright(
            "==============================================================================="
        )
    );
};

const multisigCheckTx = async (txId, multisigAddress = ethers.constants.AddressZero) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        multisigAddress == ethers.constants.AddressZero
            ? (
                  await get("MultiSigWallet")
              ).address
            : multisigAddress
    );
    const transaction = await multisig.transactions(txId);
    console.log(
        "TX { ID: ",
        txId,
        ", Data: ",
        transaction.data,
        ", Value: ",
        transaction.value.toString(),
        ", Destination: ",
        transaction.destination,
        ", Confirmations: ",
        (await multisig.getConfirmationCount(txId)).toNumber(),
        ", Executed:",
        transaction.executed,
        ", Confirmed by:",
        await multisig.getConfirmations(txId),
        "}"
    );
};

const multisigRevokeConfirmation = async (
    txId,
    sender,
    multisigAddress = ethers.constants.AddressZero
) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const signer = await ethers.getSigner(sender);
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        multisigAddress == ethers.constants.AddressZero
            ? (
                  await get("MultiSigWallet")
              ).address
            : multisigAddress,
        signer
    );
    console.log("Revoking confirmation of txId", txId, "...");
    receipt = await (await multisig.revokeConfirmation(txId)).wait();
    // console.log("Required signatures:", await multisig.required());
    console.log(`Confirmation of txId ${txId} revoked.`);
    console.log("Details:");
    await multisigCheckTx(txId, multisig.address);
};

const multisigExecuteTx = async (txId, sender, multisigAddress = ethers.constants.AddressZero) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const signer = await ethers.getSigner(sender);
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        multisigAddress == ethers.constants.AddressZero
            ? (
                  await get("MultiSigWallet")
              ).address
            : multisigAddress,
        signer
    );
    console.log("Executing multisig txId", txId, "...");
    const gasEstimated = (await multisig.estimateGas.executeTransaction(txId)).toNumber();
    console.log("Estimated Gas:", gasEstimated);
    const lastBlock = await ethers.provider.getBlock();
    const lastBlockGasLimit = lastBlock.gasLimit.toNumber();
    console.log("Last Block Gas Limit:", lastBlockGasLimit);
    const gasEstimatedMul = gasEstimated * 1.3;

    let receipt;
    let wontExecute = false;
    if (gasEstimatedMul < lastBlockGasLimit) {
        try {
            await multisig.callStatic.executeTransaction(txId, { gasEstimatedMul });
            receipt = await (await multisig.executeTransaction(txId, { gasEstimatedMul })).wait();
        } catch (e) {
            wontExecute = true;
        }
    }
    if (wontExecute || gasEstimatedMul >= lastBlockGasLimit) {
        receipt = await (
            await multisig.executeTransaction(txId, { gasLimit: lastBlockGasLimit })
        ).wait();
    }

    console.log(
        col.yellowBright(
            "==============================================================================="
        )
    );
    console.log(col.greenBright("DONE. Details:"));
    console.log("Tx hash:", receipt.transactionHash);
    console.log("Gas used:", receipt.gasUsed.toNumber());
    await multisigCheckTx(txId, multisig.address);
    console.log(
        col.yellowBright(
            "==============================================================================="
        )
    );
};

const parseEthersLog = (parsed) => {
    let parsedEvent = {};
    for (let i = 0; i < parsed.args.length; i++) {
        const input = parsed.eventFragment.inputs[i];
        const arg = parsed.args[i];
        const newObj = { ...input, ...{ value: arg.toString() } };
        parsedEvent[input["name"]] = newObj;
    }
    return parsedEvent;
};

const parseEthersLogToValue = (parsed) => {
    let parsedEvent = {};
    for (let i = 0; i < parsed.args.length; i++) {
        const input = parsed.eventFragment.inputs[i];
        const arg = parsed.args[i];
        const newObj = { ...input, ...{ value: arg.toString() } };
        parsedEvent[input["name"]] = newObj.value;
    }
    return parsedEvent;
};

const getTxLog = (tx, contract) => {
    return tx.logs.map((log) => parseEthersLogToValue(contract.interface.parseLog(log)));
};

const getEthersLog = async (contract, filter) => {
    if (contract === undefined || filter === undefined) return;
    const events = await contract.queryFilter(filter);
    if (events.length === 0) return;
    let parsedEvents = [];
    for (let event of events) {
        const ethersParsed = contract.interface.parseLog(event);
        const customParsed = parseEthersLog(ethersParsed);
        parsedEvents.push(customParsed);
    }
    return parsedEvents;
};

const getParsedEventLogFromReceipt = async (receipt, iface, eventName) => {
    const topic = iface.getEventTopic(eventName);
    // search for the log by the topic
    const log = receipt.logs.find((x) => x.topics.indexOf(topic) >= 0);
    // finally, you can parse the log with the interface
    // to get a more user-friendly event object
    const parsedLog = iface.parseLog(log);
    return parseEthersLog(parsedLog);
};

/* return values: 
   - registered module contract address
   - zero address (no registered module containing the new module's func sigs found)
*/
const getStakingModuleContractToReplace = async (stakingModulesProxy, newModuleAddress) => {
    const { ethers } = hre;
    const clashing = await stakingModulesProxy.checkClashingFuncSelectors(newModuleAddress);
    if (
        clashing.clashingProxyRegistryFuncSelectors.length !== 0 &&
        clashing.clashingProxyRegistryFuncSelectors[0] != "0x00000000"
    ) {
        throw `Clashing functions signatures of ${newModuleAddress} with StakingModulesProxy functions:\n ${clashing.clashingProxyRegistryFuncSelectors}`;
    }

    if (
        clashing.clashingModules.length == 0 &&
        clashing.clashingProxyRegistryFuncSelectors.length == 0
    ) {
        return ethers.constants.AddressZero;
    }

    if (clashing.clashingModules.length != 0) {
        const clashingUnique = clashing.clashingModules.filter(arrayToUnique);
        if (clashingUnique.length == 1) {
            const addressModuleBeingReplaced = clashingUnique[0];
            if (addressModuleBeingReplaced != newModuleAddress) {
                return addressModuleBeingReplaced;
            } else {
                console.log(
                    `Skipping module ${newModuleAddress} replacement - the module is reused`
                );
                return false;
            }
        } else {
            console.log(`New module ${newModuleAddress} can't replace multiple modules at once:`);
            clashing.clashingModules.forEach((item, index, arr) => {
                console.log(`${item[index]} - ${arr[1][index]}`);
            });
            throw new Error("Execution interrupted");
        }
    }
};

const createProposal = async (
    governorAddress,
    targets,
    values,
    signatures,
    callDatas,
    description
) => {
    const { ethers } = hre;
    const { deployer } = await getNamedAccounts();
    console.log("CREATING PROPOSAL:");
    console.log(`=============================================================
    Proposal creator:    ${deployer}
    Governor Address:    ${governorAddress}
    Target:              ${targets}
    Values:              ${values}
    Signature:           ${signatures}
    Data:                ${callDatas}
    Description:         ${description}
    =============================================================`);

    const signer = await ethers.getSigner(deployer);
    const gov = await ethers.getContractAt("GovernorAlpha", governorAddress);
    const receipt = await (
        await gov.connect(signer).propose(targets, values, signatures, callDatas, description)
    ).wait();

    const abi = [
        `
            event ProposalCreated(
            uint256 id,
            address proposer,
            address[] targets,
            uint256[] values,
            string[] signatures,
            bytes[] calldatas,
            uint256 startBlock,
            uint256 endBlock,
            string description)
        `,
    ];
    let iface = new ethers.utils.Interface(abi);
    const parsedEvent = await getParsedEventLogFromReceipt(receipt, iface, "ProposalCreated");
    // const { id, proposer, targets, values, signatures, calldatas, startBlock, endBlock } =
    console.log("PROPOSAL CREATED:");
    console.log(`=============================================================
    Contract:            GovernorAlpha @ ${governorAddress}
    Proposal Id:         ${parsedEvent.id.value.toString()}
    Proposer:            ${parsedEvent.proposer.value}
    Targets:             ${parsedEvent.targets.value}
    Values:              ${parsedEvent.values.value}
    Signature:           ${parsedEvent.signatures.value}
    Data:                ${parsedEvent.calldatas.value}
    StartBlock:          ${parsedEvent.startBlock.value.toString()}
    EndBlock:            ${parsedEvent.endBlock.value.toString()}
    Description:         ${parsedEvent.description.value}
    =============================================================`);
    // return receipt;
    // @todo Add a decoded event logging: e.g. https://github.com/ethers-io/ethers.js/issues/487#issuecomment-1101937446
};

// the proxy ABI must have setImplementation() and getImplementation() functions
const deployWithCustomProxy = async (
    deployer,
    logicArtifactName, //logic contract artifact name
    proxyArtifactName, // proxy deployment name
    logicInstanceName = undefined, // save logic implementation as
    proxyInstanceName = undefined, // save proxy implementation as
    isOwnerMultisig = false, // overrides network dependency
    args = [],
    proxyArgs = [],
    multisigName = "MultiSigWallet",
    proxyOwner = "" // new proxy owner address, used for new proxy deployments and only if there are no post-deployment func calls from the creator address
) => {
    const {
        deployments: { deploy, get, getOrNull, log, save },
        ethers,
    } = hre;

    proxyInstanceName = proxyInstanceName == "" ? undefined : proxyInstanceName;
    logicInstanceName = logicInstanceName == "" ? undefined : logicInstanceName;

    const proxyName = proxyInstanceName ?? proxyArtifactName; // support multiple deployments of the same artifact
    let proxyDeployment = await getOrNull(proxyName);
    let isNewProxy = false;
    if (!proxyDeployment) {
        await deploy(proxyName, {
            contract: proxyArtifactName,
            from: deployer,
            args: proxyArgs,
            log: true,
        });
        isNewProxy = true;
    }

    const logicName = logicInstanceName ?? logicArtifactName;
    const logicImplName = logicName + "_Implementation"; // naming convention like in hh deployment
    const logicDeploymentTx = await deploy(logicImplName, {
        contract: logicArtifactName,
        from: deployer,
        args: args,
        log: true,
    });

    const proxy = await ethers.getContract(proxyName);
    const prevImpl = await proxy.getImplementation();
    log(`Current ${proxyName} implementation: ${prevImpl}`);

    if (logicDeploymentTx.newlyDeployed || logicDeploymentTx.address != prevImpl) {
        log(`New ${proxyName} implementation: ${logicImplName} @ ${logicDeploymentTx.address}`);
        await save(logicName, {
            address: proxy.address,
            implementation: logicDeploymentTx.address,
            abi: logicDeploymentTx.abi,
            bytecode: logicDeploymentTx.bytecode,
            deployedBytecode: logicDeploymentTx.deployedBytecode,
            devdoc: logicDeploymentTx.devdoc,
            userdoc: logicDeploymentTx.userdoc,
            storageLayout: logicDeploymentTx.storageLayout,
        });

        const proxyDeployment = await get(proxyName);
        if ((hre.network.tags["testnet"] || isOwnerMultisig) && !isNewProxy) {
            //multisig is the owner
            const multisigDeployment = await get(multisigName);
            //@todo wrap getting ms tx data into a helper
            let proxyInterface = new ethers.utils.Interface(proxyDeployment.abi);
            let data = proxyInterface.encodeFunctionData("setImplementation", [
                logicDeploymentTx.address,
            ]);
            logger.warn(
                `Creating multisig tx to set ${logicArtifactName} (${logicDeploymentTx.address}) as implementation for ${proxyName} (${proxyDeployment.address}...`
            );
            log();
            await sendWithMultisig(multisigDeployment.address, proxy.address, data, deployer);
            logger.info(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signing to execute tx <<<
                 >>> DON'T PUSH DEPLOYMENTS TO THE REPO UNTIL THE MULTISIG TX SUCCESSFULLY SIGNED & EXECUTED <<<`
            );
        } else if (hre.network.tags["mainnet"] && !isNewProxy) {
            logger.warn(">>> Create a Bitocracy proposal via SIP <<<");
            logger.error(
                ">>> DON'T PUSH DEPLOYMENTS TO THE REPO UNTIL THE SIP IS SUCCESSFULLY EXECUTED <<<`"
            );
            // governance is the owner - need a SIP to register
            // TODO: implementation ; meanwhile use brownie sip_interaction scripts to create proposal
        } else {
            const proxy = await ethers.getContractAt(proxyName, proxyDeployment.address);
            await proxy.setImplementation(logicDeploymentTx.address);
            log(
                `>>> New implementation ${await proxy.getImplementation()} is set to the proxy <<<`
            );
        }
        if (ethers.utils.isAddress(proxyOwner) && (await proxy.getOwner()) !== proxyOwner) {
            await proxy.transferOwnership(proxyOwner);
            logger.success(
                `Proxy ${proxyName} ownership transferred to ${await proxy.getOwner()}`
            );
        }
        log();
    }
};
const getTxRevertReason = async (txHash) => {
    const tx = await ethers.provider.getTransaction(txHash);
    try {
        let code = await ethers.provider.call(tx, tx.blockNumber);
        console.log("code:", code);
    } catch (err) {
        return err;
        /*console.log(err);
        const code = err.data.replace("Reverted ", "");
        console.log({ err });
        let reason = ethers.utils.toUtf8String("0x" + code.substr(138));
        console.log("Revert reason:", reason);
        return `Revert reason: ${reason}`;*/
    }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    getStakingModulesNames,
    getLoanTokenModulesNames,
    stakingRegisterModuleWithMultisig,
    parseEthersLog,
    getEthersLog,
    parseEthersLogToValue,
    getParsedEventLogFromReceipt,
    sendWithMultisig,
    signWithMultisig,
    multisigCheckTx,
    multisigRevokeConfirmation,
    multisigExecuteTx,
    isMultisigOwner,
    getStakingModuleContractToReplace,
    createProposal,
    deployWithCustomProxy,
    multisigAddOwner,
    multisigRemoveOwner,
    getTxLog,
    getTxRevertReason,
    delay,
    logTimer,
};
