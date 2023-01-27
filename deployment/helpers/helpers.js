//const hre = require("hardhat");
/*const {
    deployments: { deploy, get, log },
    getNamedAccounts,
    ethers,
} = hre;*/

///@dev This file requires HardhatRuntimeEnvironment `hre` variable in its parent context for functions using hre to work

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
    const { ethers } = hre;
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
const getStakingModuleContractToReplace = async (newModuleAddress) => {
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
            if (addressModuleBeingReplaced != moduleAddressList[i]) {
                return addressModuleBeingReplaced;
                /* log(`Replacing module ${moduleNames[i]}`);
                const receipt = await (
                    await stakingModulesProxy.replaceModule(
                        addressModuleBeingReplaced,
                        moduleAddressList[i]
                    )
                ).wait();

                log(`cumulativeGasUsed: ${receipt.cumulativeGasUsed.toString()}`);
                totalGas = totalGas.add(receipt.cumulativeGasUsed);*/
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
    //governorDeployment = (await get("GovernorAlpha")).address;
    console.log(`=============================================================
    Governor Address:    ${governorAddress}
    Target:              ${targets}
    Values:              ${values}
    Signature:           ${signatures}
    Data:                ${callDatas}
    Description:         ${description}
    =============================================================`);
    const gov = await ethers.getContractAt("GovernorAlpha", governorAddress);
    const tx = await (
        await gov.propose(targets, values, signatures, callDatas, description)
    ).wait();
    console.log(tx.receipt);
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
    getStakingModuleContractToReplace,
    createProposal,
};
