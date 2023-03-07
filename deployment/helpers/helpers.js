//const hre = require("hardhat");
/*const {
    deployments: { deploy, get, log },
    getNamedAccounts,
    ethers,
} = hre;*/

///@dev This file requires HardhatRuntimeEnvironment `hre` variable in its parent context for functions using hre to work
const { arrayToUnique } = require("../helpers/utils");

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

const stakingRegisterModuleWithMultisig = () => {
    return process.env.STAKING_REG_WITH_MULTISIG == "true";
};

const isMultisigOwner = async (multisigAddress, checkAddress) => {
    const multisig = await ethers.getContractAt("MultiSigWallet", multisigAddress);
    return await multisig.isOwner(checkAddress);
};

const multisigAddOwner = async (addAddress) => {
    const {
        ethers,
        getNamedAccounts,
        deployments: { get },
    } = hre;

    const multisigDeployment = await get("MultiSigWallet");
    let multisigInterface = new ethers.utils.Interface(multisigDeployment.abi);
    let data = multisigInterface.encodeFunctionData("addOwner", [addAddress]);
    const { deployer } = await getNamedAccounts();
    ///@todo check if the deployer is one of ms owners
    console.log(`creating multisig tx to add new owner ${addAddress}...`);
    await sendWithMultisig(multisigDeployment.address, multisigDeployment.address, data, deployer);
    console.log(
        `>>> DONE. Requires Multisig (${multisigDeployment.address}) signing to execute tx <<<`
    );
};

const multisigRemoveOwner = async (removeAddress) => {
    const {
        ethers,
        getNamedAccounts,
        deployments: { get },
    } = hre;

    const multisigDeployment = await get("MultiSigWallet");
    let multisigInterface = new ethers.utils.Interface(multisigDeployment.abi);
    let data = multisigInterface.encodeFunctionData("removeOwner", [removeAddress]);
    const { deployer } = await getNamedAccounts();
    console.log(`creating multisig tx to remove owner ${removeAddress}...`);
    await sendWithMultisig(multisigDeployment.address, multisigDeployment.address, data, deployer);
    console.log(
        `>>> DONE. Requires Multisig (${multisigDeployment.address}) signing to execute tx <<<`
    );
};

const sendWithMultisig = async (multisigAddress, contractAddress, data, sender, value = 0) => {
    const { ethers } = hre;
    const multisig = await ethers.getContractAt("MultiSigWallet", multisigAddress);
    const signer = await ethers.getSigner(sender);
    receipt = await (
        await multisig.connect(signer).submitTransaction(contractAddress, value, data)
    ).wait();

    const abi = ["event Submission(uint256 indexed transactionId)"];
    let iface = new ethers.utils.Interface(abi);
    const parsedEvent = await getParsedEventLogFromReceipt(receipt, iface, "Submission");
    await multisigCheckTx(parsedEvent.transactionId.value.toNumber(), multisig.address);
};

const signWithMultisig = async (multisigAddress, txId, sender) => {
    const { ethers, getNamedAccounts } = hre;
    console.log("Signing multisig txId:", txId);
    const multisig = await ethers.getContractAt("MultiSigWallet", multisigAddress);
    const signer = await ethers.getSigner(sender);
    receipt = await (await multisig.connect(signer).confirmTransaction(txId)).wait();
    // console.log("Required signatures:", await multisig.required());
    console.log("Signed. Details:");
    await multisigCheckTx(txId, multisig.address);
};

const multisigCheckTx = async (txId, multisigAddress = ethers.constants.ADDRESS_ZERO) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        multisigAddress == ethers.constants.ADDRESS_ZERO
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
    multisigAddress = ethers.constants.ADDRESS_ZERO
) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        multisigAddress == ethers.constants.ADDRESS_ZERO
            ? (
                  await get("MultiSigWallet")
              ).address
            : multisigAddress
    );
    console.log("Revoking confirmation of txId", txId, "...");
    const signer = await ethers.getSigner(sender);
    receipt = await (await multisig.connect(signer).revokeConfirmation(txId)).wait();
    // console.log("Required signatures:", await multisig.required());
    console.log(`Confirmation of txId ${txId} revoked.`);
    console.log("Details:");
    await multisigCheckTx(txId, multisig.address);
};

const multisigAddRemoveOwner = async (
    addOwner,
    ownerAddress,
    sender,
    multisigAddress = ethers.constants.ADDRESS_ZERO
) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        multisigAddress == ethers.constants.ADDRESS_ZERO
            ? (
                  await get("MultiSigWallet")
              ).address
            : multisigAddress
    );
    console.log(`${addOwner ? "Adding" : "Removing"} ${ownerAddress}`);
    const signer = await ethers.getSigner(sender);
    if (addOwner) {
        receipt = await (await multisig.connect(signer).addOwner(ownerAddress)).wait();
    } else {
        receipt = await (await multisig.connect(signer).removeOwner(ownerAddress)).wait();
    }

    console.log("Details:");
    await multisigCheckTx(txId, multisig.address);
};

const multisigExecuteTx = async (
    txId,
    sender,
    multisigAddress = ethers.constants.ADDRESS_ZERO
) => {
    const {
        ethers,
        deployments: { get },
    } = hre;
    const multisig = await ethers.getContractAt(
        "MultiSigWallet",
        multisigAddress == ethers.constants.ADDRESS_ZERO
            ? (
                  await get("MultiSigWallet")
              ).address
            : multisigAddress
    );
    console.log("Executing multisig txId", txId, "...");
    const signer = await ethers.getSigner(sender);
    receipt = await (await multisig.connect(signer).execute(txId)).wait();
    // console.log("Required signatures:", await multisig.required());
    console.log("DONE. Details:");
    await multisigCheckTx(txId, multisig.address);
};

const parseEthersLog = (parsed) => {
    let parsedEvent = {};
    for (let i = 0; i < parsed.args.length; i++) {
        const input = parsed.eventFragment.inputs[i];
        const arg = parsed.args[i];
        const newObj = { ...input, ...{ value: arg } };
        parsedEvent[input["name"]] = newObj;
    }
    return parsedEvent;
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
        return [ethers.constants.AddressZero];
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
    Values:              ${parsedEvent.values.value.map(toString)}
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
    logicName,
    proxyName,
    logicProxyName,
    isOwnerMultisig = false,
    multisigName = "MultiSigWallet",
    logicInstanceName = "",
    args = [],
    proxyArgs = []
) => {
    const {
        deployments: { deploy, get, getOrNull, log },
        // getNamedAccounts,
        ethers,
    } = hre;
    // const { deployer } = await getNamedAccounts();

    let proxyDeployment = await getOrNull(proxyName);
    if (!proxyDeployment) {
        await deploy(proxyName, {
            from: deployer,
            args: proxyArgs,
            log: true,
        });
    }

    const tx = await deploy(logicInstanceName ? logicInstanceName : logicName, {
        contract: logicName,
        from: deployer,
        args: args,
        log: true,
    });

    const proxy = await ethers.getContract(proxyName);
    const prevImpl = await proxy.getImplementation();
    log(`Current ${proxyName} implementation: ${prevImpl}`);

    if (tx.newlyDeployed || tx.address != prevImpl) {
        log(`New ${logicName} implementation: ${tx.address}`);
        const proxyDeployment = await get(proxyName);
        await deployments.save(logicProxyName, {
            address: proxy.address,
            abi: proxyDeployment.abi,
            bytecode: tx.bytecode,
            deployedBytecode: tx.deployedBytecode,
            implementation: tx.address,
        });
        if (hre.network.tags["testnet"] || isOwnerMultisig) {
            //multisig is the owner
            const multisigDeployment = await get(multisigName);
            //@todo wrap getting ms tx data into a helper
            let proxyInterface = new ethers.utils.Interface(proxyDeployment.abi);
            let data = proxyInterface.encodeFunctionData("setImplementation", [tx.address]);
            log(
                `Creating multisig tx to set ${logicName} (${tx.address}) as implementation for ${proxyName} (${proxyDeployment.address}...`
            );
            log();
            await sendWithMultisig(multisigDeployment.address, proxy.address, data, deployer);
            log(
                `>>> DONE. Requires Multisig (${multisigDeployment.address}) signing to execute tx <<<
                 >>> DON'T PUSH DEPLOYMENTS TO THE REPO UNTIL THE MULTISIG TX SUCCESSFULLY SIGNED & EXECUTED <<<`
            );
        } else if (hre.network.tags["mainnet"]) {
            log(">>> Create a Bitocracy proposal via SIP <<<");
            log(
                ">>> DON'T PUSH DEPLOYMENTS TO THE REPO UNTIL THE SIP IS SUCCESSFULLY EXECUTED <<<`"
            );
            // governance is the owner - need a SIP to register
            // TODO: implementation ; meanwhile use brownie sip_interaction scripts to create proposal
        } else {
            const proxy = await ethers.getContractAt(proxyName, proxyDeployment.address);
            await proxy.setImplementation(tx.address);
            log(
                `>>> New implementation ${await proxy.getImplementation()} is set to the proxy <<<`
            );
        }
        log();
    }
};

module.exports = {
    getStakingModulesNames,
    stakingRegisterModuleWithMultisig,
    parseEthersLog,
    getEthersLog,
    getParsedEventLogFromReceipt,
    sendWithMultisig,
    signWithMultisig,
    multisigCheckTx,
    multisigRevokeConfirmation,
    multisigExecuteTx,
    getStakingModuleContractToReplace,
    createProposal,
    deployWithCustomProxy,
    multisigAddRemoveOwner,
    multisigAddOwner,
    multisigRemoveOwner,
};
