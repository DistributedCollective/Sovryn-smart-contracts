/* eslint-disable no-console */
const { task, types } = require("hardhat/config");
const { ethers } = require("ethers");
const Logs = require("node-logs");
const { sendWithMultisig, multisigCheckTx } = require("../../deployment/helpers/helpers");

const logger = new Logs().showInConsole(true);

/**
 * The block levers on the ExitDelayQueue, by selector.
 *
 * The queue is Exchequer-owned, so every one of these is a multisig
 * transaction. This task submits calldata built by
 * `Sovryn-perimeter/script/07_BlockExits.s.sol`, which is where the decision
 * logic lives — it reads the queue's state to resolve who is affected and to
 * refuse anything that would revert on-chain.
 *
 * Nothing here is a substitute for that preview. The selector allowlist below
 * is a paste guard, not authorization: it stops a mistyped or truncated blob
 * from being submitted as some other call, and it lets the operator see in
 * words what they are about to ask the other signers to approve.
 */
const BLOCK_LEVERS = {
    "freeze(address)": "freeze one account",
    "freeze(address[])": "freeze a batch of accounts",
    "blacklist(address)": "blacklist one account",
    "blacklist(address[])": "blacklist a batch of accounts",
    "unfreeze(address)": "clear a freeze on one account",
    "unfreeze(address[])": "clear a freeze on a batch of accounts",
    "unblacklist(address)": "clear a blacklist on one account",
    "unblacklist(address[])": "clear a blacklist on a batch of accounts",
    "freezeFromRequest(uint256,bool,bytes32)": "freeze the parties behind one request",
    "freezeFromRequest(uint256[],bool,bytes32)": "freeze the parties behind a batch of requests",
    "blacklistFromRequest(uint256,bool,bytes32)": "blacklist the parties behind one request",
    "blacklistFromRequest(uint256[],bool,bytes32)":
        "blacklist the parties behind a batch of requests",
    "setSecurityPerimeterPaused(bool)": "pause or resume releases for EVERYONE",
};

const selectorTable = () => {
    const table = {};
    for (const [signature, meaning] of Object.entries(BLOCK_LEVERS)) {
        table[ethers.utils.id(signature).slice(0, 10)] = { signature, meaning };
    }
    return table;
};

task(
    "perimeter:submit-block",
    "Submit ExitDelayQueue block calldata (from 07_BlockExits.s.sol) to the Exchequer multisig"
)
    .addParam("queue", "ExitDelayQueue address — the transaction target", undefined, types.string)
    .addParam("data", "Calldata printed by 07_BlockExits.s.sol", undefined, types.string)
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .setAction(async ({ queue, data, signer, multisig }, hre) => {
        const {
            deployments: { get },
            ethers: hreEthers,
        } = hre;

        if (!hreEthers.utils.isAddress(queue)) {
            throw new Error(`perimeter:submit-block: '${queue}' is not an address`);
        }
        if ((await hreEthers.provider.getCode(queue)) === "0x") {
            throw new Error(`perimeter:submit-block: no contract code at the queue ${queue}`);
        }
        if (!/^0x[0-9a-fA-F]*$/.test(data) || data.length < 10) {
            throw new Error("perimeter:submit-block: --data must be 0x-prefixed calldata");
        }

        // Refuse anything that is not one of the queue's block levers. A
        // truncated or wrong-window paste is the realistic failure here, and it
        // must not become a signed multisig transaction.
        const known = selectorTable()[data.slice(0, 10).toLowerCase()];
        if (!known) {
            throw new Error(
                `perimeter:submit-block: selector ${data.slice(0, 10)} is not an ExitDelayQueue ` +
                    "block lever. Expected one of:\n  " +
                    Object.keys(BLOCK_LEVERS).join("\n  ")
            );
        }

        const signerAcc = hreEthers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        const multisigAddress = hreEthers.utils.isAddress(multisig)
            ? multisig
            : (await get("MultiSigWallet")).address;

        logger.info(`Queue:      ${queue}`);
        logger.info(`Multisig:   ${multisigAddress}`);
        logger.info(`Submitter:  ${signerAcc}`);
        logger.info(`Call:       ${known.signature}`);
        logger.warn(`This will ${known.meaning}.`);

        await sendWithMultisig(hre, multisigAddress, queue, data, signerAcc);

        logger.info(
            "Submitted. It needs the remaining confirmations before it executes — sign with " +
                "`multisig:sign-tx <id>`, watch with `multisig:check-tx <id>`, and confirm the " +
                "result with `BLOCK_ACTION=verify forge script script/07_BlockExits.s.sol`."
        );
    });

task(
    "perimeter:check-block",
    "Print a submitted block transaction and decode which lever it pulls"
)
    .addParam("id", "Multisig transaction id", undefined, types.string)
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .setAction(async ({ id, multisig }, hre) => {
        const {
            deployments: { get },
            ethers: hreEthers,
        } = hre;

        const multisigAddress = hreEthers.utils.isAddress(multisig)
            ? multisig
            : (await get("MultiSigWallet")).address;

        const ms = await hreEthers.getContractAt("MultiSigWallet", multisigAddress);
        const tx = await ms.transactions(id);
        const known = selectorTable()[(tx.data || "0x").slice(0, 10).toLowerCase()];

        logger.info(`Target:    ${tx.destination}`);
        logger.info(`Executed:  ${tx.executed}`);
        logger.info(
            known
                ? `Call:      ${known.signature} — ${known.meaning}`
                : "Call:      NOT an ExitDelayQueue block lever"
        );
        await multisigCheckTx(hre, id, multisigAddress);
    });
