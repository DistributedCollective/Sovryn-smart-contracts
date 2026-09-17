/* eslint-disable no-console */
const { task, types } = require("hardhat/config");
const Logs = require("node-logs");
const { sendWithMultisig, multisigCheckTx } = require("../../deployment/helpers/helpers");
const {
    CONTRACT_CALLERS,
    assertContractCallersExempt,
    readSwitch,
} = require("./perimeter/contractCallerExemptions");
const { resolveOptionalAddress } = require("./perimeter/addressParam");
const policy = require("./perimeter/policy");

const logger = new Logs().showInConsole(true);

/** Print a decoded block lever's own arguments — which address(es) or
 *  request id(s), the receiver flag, the reason hash as a bare 32-byte value
 *  — so a stale or mismatched `--data` paste is visibly distinguishable from
 *  a correct one in this task's own output, not just in
 *  `07_BlockExits.s.sol`'s preview. Never prints anything about what a
 *  reason hash MEANS: only the hash itself, exactly as `policy.stringifyArg`
 *  renders it. */
const printDecodedBlockCall = (decoded) => {
    logger.info(`Call:       ${decoded.signature} — ${decoded.meaning}`);
    for (const field of decoded.fields) {
        logger.info(`  ${field.name} (${field.type}): ${field.value}`);
    }
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

        // Refuse anything that does not fully decode as one of the queue's
        // block levers — not just a selector match, a full ABI decode of the
        // arguments too, so a truncated or wrong-window paste that happens to
        // start with a real selector still refuses rather than being
        // submitted sight-unseen. This is a paste guard, not authorization:
        // nothing here is a substitute for `07_BlockExits.s.sol`'s own
        // preview.
        const decoded = policy.decodeCall(data);
        if (!decoded || decoded.target !== "queue") {
            throw new Error(
                `perimeter:submit-block: calldata with selector ${data.slice(0, 10)} does not ` +
                    "decode as any known ExitDelayQueue block lever — refusing to submit an " +
                    "unrecognized or malformed call. Expected one of:\n  " +
                    Object.keys(policy.BLOCK_LEVERS).join("\n  ")
            );
        }

        const signerAcc = hreEthers.utils.isAddress(signer)
            ? signer
            : (await hre.getNamedAccounts())[signer];

        const multisigAddress = await resolveOptionalAddress(
            hreEthers,
            multisig,
            async () => (await get("MultiSigWallet")).address
        );

        logger.info(`Queue:      ${queue}`);
        logger.info(`Multisig:   ${multisigAddress}`);
        logger.info(`Submitter:  ${signerAcc}`);
        printDecodedBlockCall(decoded);
        logger.warn(`This will ${decoded.meaning}.`);

        await sendWithMultisig(multisigAddress, queue, data, signerAcc);

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

        const multisigAddress = await resolveOptionalAddress(
            hreEthers,
            multisig,
            async () => (await get("MultiSigWallet")).address
        );

        const ms = await hreEthers.getContractAt("MultiSigWallet", multisigAddress);
        const tx = await ms.transactions(id);
        const decoded = policy.decodeCall(tx.data);

        logger.info(`Target:    ${tx.destination}`);
        logger.info(`Executed:  ${tx.executed}`);
        if (decoded && decoded.target === "queue") {
            printDecodedBlockCall(decoded);
        } else {
            logger.info("Call:      NOT an ExitDelayQueue block lever");
        }
        await multisigCheckTx(id, multisigAddress);
    });

/**
 * The go-live check for the addresses the owner has exempted from the perimeter.
 *
 * Read-only, and run BEFORE arming — it is the runbook's blocker step, the one
 * that is otherwise a paragraph of prose nothing enforces. The registry and the
 * reasoning live in `contractCallerExemptions.js`; this only points it at a
 * live controller and prints the verdict.
 */
task(
    "perimeter:verify-arming",
    "Refuse go-live while an exempted address lacks its zero fee rate or its delay bypass"
)
    .addOptionalParam(
        "controller",
        "ExitFeeController address (defaults to the deployment record)"
    )
    .setAction(async ({ controller }, hre) => {
        const {
            deployments: { get },
            ethers: hreEthers,
        } = hre;

        const address = await resolveOptionalAddress(
            hreEthers,
            controller,
            async () => (await get("ExitFeeController")).address
        );
        if ((await hreEthers.provider.getCode(address)) === "0x") {
            throw new Error(
                `perimeter:verify-arming: no contract code at the controller ${address}`
            );
        }

        const live = await hreEthers.getContractAt(
            [
                "function securityPerimeterEnabled() view returns (bool)",
                "function globalDelaySeconds() view returns (uint32)",
                "function actorPolicy(bytes32,address) view returns (tuple(bool active, uint16 rateBps))",
                "function actorBypass(bytes32,address) view returns (tuple(bool active, bool bypass))",
                // The enumeration views: what the controller actually carries,
                // at every tier, rather than only the registry's own list.
                "function bypassSurfaceIds() view returns (bytes32[])",
                "function surfaceBypassKeys() view returns (bytes32[])",
                "function subProductBypassKeys(bytes32) view returns (address[])",
                "function actorBypassKeys(bytes32) view returns (address[])",
                "function surfaceBypass(bytes32) view returns (tuple(bool active, bool bypass))",
                "function subProductBypass(bytes32,address) view returns (tuple(bool active, bool bypass))",
            ],
            address
        );

        logger.info(`Controller: ${address}`);
        const { armed, globalDelaySeconds } = await readSwitch(live);
        logger.info(`Delay armed: ${armed}`);
        logger.info(
            `Global delay: ${typeof globalDelaySeconds === "number" ? `${globalDelaySeconds}s` : globalDelaySeconds}`
        );
        for (const caller of CONTRACT_CALLERS) {
            logger.info(
                `  ${caller.name} ${caller.address} on ${caller.surface} -> ` +
                    `${JSON.stringify(caller.registration)}`
            );
        }
        logger.info(
            '  "bypass" requires both actor entries: fee policy {active: true, rateBps: 0} and ' +
                "delay bypass {active: true, bypass: true}"
        );

        await assertContractCallersExempt(live);
        logger.success(
            "Every exempted address carries both halves of its exemption, and the controller " +
                "carries no active delay bypass this registry does not account for. Nothing here " +
                "blocks arming."
        );
    });
