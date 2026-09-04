/* eslint-disable no-console */
/**
 * The commands that turn a freshly booted QA fork into the released, armed
 * chain the two dapps are tested against, and then drive its queue through
 * every state those dapps have to draw.
 *
 * Boot the node first (scripts/perimeter/qa-node.sh), then:
 *     npx hardhat perimeter:qa up       --network rskForkedMainnetQa
 *     npx hardhat perimeter:qa status   --network rskForkedMainnetQa
 *     npx hardhat perimeter:qa withdraw --surface lender --network rskForkedMainnetQa
 *
 * Every subcommand refuses to run anywhere but a local QA fork. Everything they
 * do is a write to that fork, and the state file the bootstrap leaves behind
 * carries a published test private key so the operator can import the account
 * into MetaMask.
 */
const { task, types } = require("hardhat/config");

/** The bootstrap and engine modules are loaded inside the action, never at the
 *  top of this file. This file is required while hardhat.config.js is still
 *  being evaluated, and their own dependencies require the runtime environment
 *  — pulling that in from here would close a require cycle through a
 *  half-built hre. */
const loadBootstrap = () => require("../../../tests-onchain/perimeter/qa/bootstrap");
const loadEngine = () => require("../../../tests-onchain/perimeter/qa/engine");

const SUBCOMMANDS = [
    "up",
    "status",
    "withdraw",
    "advance",
    "execute",
    "execute-all",
    "freeze",
    "blacklist",
    "release",
    "pause",
    "unpause",
    "kill",
    "route",
    "refund",
    "confirm",
    "snapshot",
    "revert",
];

const row = (label, value) => console.log(`  ${String(label).padEnd(22)}${value}`);

/** Every scalar of a result, one per line; nested objects and arrays are left
 *  to the caller or rendered as JSON. */
const printRecord = (record) => {
    for (const [key, value] of Object.entries(record)) {
        if (value === undefined || value === null) continue;
        if (key === "receipt" || key === "requests") continue;
        if (typeof value === "object") {
            row(key, JSON.stringify(value));
            continue;
        }
        row(key, value);
    }
};

const column = (value, width) => String(value).padEnd(width);

const printStatus = (state) => {
    console.log("");
    console.log("Perimeter QA fork — status");
    row("queue", state.queue);
    row("controller", state.controller);
    row("paused", state.paused);
    row("perimeter enabled", state.perimeterEnabled);
    row("delay", `${state.delaySeconds}s`);
    row("charge", state.feeEnabled ? "on" : "off");
    row("last request id", state.lastRequestId);
    row("multisig threshold", state.multisigRequired);
    row(
        "multisig txs",
        `${state.multisigTransactionCount} (last ${state.multisigPendingScanned} scanned)`
    );
    row("multisig pending", state.multisigPending.length ? state.multisigPending.join(", ") : "—");
    if (state.multisigRequired === 1 && state.multisigPending.length) {
        // At threshold 1 every lever this tool sends executes on submission, so
        // anything still pending is the live wallet's own backlog, carried in
        // from mainnet — not work this session left half done.
        console.log(
            "    (threshold is 1, so these are the live wallet's own unfinished transactions " +
                "from mainnet, not anything this session submitted)"
        );
    }
    console.log("");
    if (!state.requests.length) {
        console.log("  no requests yet");
        return;
    }
    console.log(
        "  " +
            column("id", 4) +
            column("surface", 10) +
            column("status", 19) +
            column("amount", 22) +
            column("left", 7) +
            column("originator", 44) +
            column("receiver", 44) +
            "block"
    );
    for (const r of state.requests) {
        const blocks = [
            `o:${r.blockState.originator}`,
            `w:${r.blockState.owner}`,
            `r:${r.blockState.receiver}`,
        ].join(" ");
        console.log(
            "  " +
                column(r.id, 4) +
                column(r.surface, 10) +
                column(r.status, 19) +
                column(r.amount, 22) +
                column(r.status === "Queued" ? `${r.remaining}s` : "—", 7) +
                column(r.originator, 44) +
                column(r.receiver, 44) +
                blocks
        );
    }
};

const idsFrom = (args, subcommand) => {
    const ids = args.map((a) => Number(a));
    if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw new Error(`perimeter:qa ${subcommand}: give one or more request ids`);
    }
    return ids;
};

task("perimeter:qa", "Bring up a local QA fork and drive its withdrawal queue")
    .addPositionalParam("subcommand", `One of: ${SUBCOMMANDS.join(", ")}`, undefined, types.string)
    .addOptionalVariadicPositionalParam(
        "args",
        "Arguments for the subcommand: seconds, request ids, an address, a snapshot id",
        []
    )
    .addOptionalParam("delay", "up: hold length in seconds to arm", undefined, types.int)
    .addOptionalParam(
        "governance",
        "up: 'impersonate' replays each proposal from its timelock and leaves the chain clock " +
            "alone; 'real' walks them through governance and jumps the clock days ahead",
        "impersonate",
        types.string
    )
    .addOptionalParam(
        "fee",
        "up: 'on' (default) also closes the charge switch on the controller; 'off' arms the " +
            "hold alone",
        "on",
        types.string
    )
    .addFlag(
        "keepThreshold",
        "up: leave the multisig's signature threshold as it is instead of dropping it to 1"
    )
    .addOptionalParam(
        "surface",
        "withdraw: lender, borrower, zero or surplus",
        undefined,
        types.string
    )
    .addOptionalParam(
        "as",
        "withdraw/execute/execute-all: test, suspect1..suspect3, or an address",
        undefined,
        types.string
    )
    .addOptionalParam("receiver", "withdraw: where the exit pays out", undefined, types.string)
    .addOptionalParam(
        "amount",
        "withdraw: amount in RBTC, e.g. 0.5 — on the lender surface how much to lend and then " +
            "withdraw, on the borrower and zero surfaces how much collateral to take back out. " +
            "The surplus surface ignores it: the surplus is whatever the redemption left",
        undefined,
        types.string
    )
    .addOptionalParam("to", "refund: 'pool' or an address", undefined, types.string)
    .addFlag("blacklisted", "release: undo a blacklist rather than a freeze")
    .addFlag("alsoReceiver", "freeze/blacklist: block the payout address too")
    .addFlag(
        "viaConsole",
        "print the calldata instead of sending it — works on every lever that goes through the " +
            "multisig (freeze, blacklist, release, pause, unpause, kill, route, refund). On " +
            "route, which is two levers, it prints both and reports that nothing was sent"
    )
    .setAction(async (params, hre) => {
        const { subcommand, args } = params;
        if (!SUBCOMMANDS.includes(subcommand)) {
            throw new Error(
                `perimeter:qa: unknown subcommand '${subcommand}' — expected one of: ` +
                    SUBCOMMANDS.join(", ")
            );
        }
        // The guard is repeated inside the bootstrap and the engine, where the
        // sends happen. Here it is so the operator learns about a wrong
        // --network before the first fork read rather than after it.
        if (!hre.network.tags.qa) {
            throw new Error(
                `perimeter:qa: network '${hre.network.name}' is not a QA fork. Boot ` +
                    "scripts/perimeter/qa-node.sh and pass --network rskForkedMainnetQa."
            );
        }

        if (subcommand === "up") return runUp(params, hre);

        const { attachQa } = loadBootstrap();
        const engine = loadEngine();
        await engine.assertQa();
        const s = await attachQa(hre);
        const log = console.log;
        const opts = {
            log,
            as: params.as,
            receiver: params.receiver,
            blacklisted: params.blacklisted ? true : undefined,
            alsoReceiver: params.alsoReceiver,
            viaConsole: params.viaConsole,
        };

        console.log(`perimeter QA: ${subcommand}`);
        let record;
        switch (subcommand) {
            case "status":
                record = await engine.status(s);
                printStatus(record);
                console.log("");
                console.log(`  recorded in ${engine.appendState(record)}`);
                return;
            case "withdraw":
                record = await engine.withdraw(s, {
                    ...opts,
                    surface: params.surface,
                    amount: params.amount ? hre.ethers.utils.parseEther(params.amount) : undefined,
                });
                break;
            case "advance":
                record = await engine.advance(s, args[0], opts);
                break;
            case "execute":
                record = await engine.execute(s, idsFrom(args, subcommand)[0], opts);
                break;
            case "execute-all":
                record = await engine.executeAll(s, opts);
                break;
            case "freeze":
                record = await engine.freeze(s, idsFrom(args, subcommand), opts);
                break;
            case "blacklist":
                record = await engine.blacklist(s, idsFrom(args, subcommand), opts);
                break;
            case "release":
                if (!args[0]) throw new Error("perimeter:qa release: give an address");
                record = await engine.release(s, args[0], opts);
                break;
            case "pause":
                record = await engine.pause(s, opts);
                break;
            case "unpause":
                record = await engine.unpause(s, opts);
                break;
            case "kill":
                if (args[0] !== "on" && args[0] !== "off") {
                    throw new Error("perimeter:qa kill: say 'on' or 'off'");
                }
                record = await engine.kill(s, args[0] === "on", opts);
                break;
            case "route":
                record = await engine.route(s, args[0], args[1], args[2], opts);
                break;
            case "refund":
                if (!params.to) throw new Error("perimeter:qa refund: pass --to pool|<address>");
                record = await engine.refund(s, idsFrom(args, subcommand), params.to, opts);
                break;
            case "confirm":
                record = await engine.confirm(s, args[0], opts);
                break;
            case "snapshot":
                record = await engine.snapshot(s, opts);
                break;
            case "revert":
                if (!args[0]) throw new Error("perimeter:qa revert: give a snapshot id");
                record = await engine.revert(s, args[0], opts);
                break;
            default:
                throw new Error(`perimeter:qa: '${subcommand}' has no action`);
        }

        console.log("");
        printRecord(record);
        console.log("");
        console.log(`  recorded in ${engine.appendState(record)}`);
    });

const runUp = async ({ delay, governance, fee, keepThreshold }, hre) => {
    if (fee !== "on" && fee !== "off") {
        throw new Error(`perimeter:qa: --fee takes 'on' or 'off', not '${fee}'`);
    }
    const { bootstrapQa, STATE_FILE, DEFAULT_DELAY_SECONDS } = loadBootstrap();
    const state = await bootstrapQa(hre, {
        delaySeconds: delay,
        governance,
        fee: fee === "on",
        keepThreshold,
    });

    console.log("");
    console.log(`Perimeter QA fork — ${state.how}`);
    row("rpc", state.rpc);
    row("chain id", state.chainId);
    row("fork block", state.forkBlock);
    row("queue", state.queue);
    row("controller", state.controller);
    row("multisig", state.multisig);
    row("test key", state.testKey.address);
    row("delay", `${state.delaySeconds}s`);
    row("charge", state.feeEnabled ? "on" : "off");
    row("fee receiver", state.feeReceiver);
    row("governance", state.governance);
    if (state.warning) row("warning", state.warning);
    console.log("");
    console.log(`  state file: ${STATE_FILE}`);
    console.log(
        `  the state file holds a published test private key — local QA only, never a ` +
            `real network`
    );
    if (delay === undefined && state.delaySeconds !== DEFAULT_DELAY_SECONDS) {
        console.log(
            `  (--delay was not given, so the hold this fork already carried was kept; ` +
                `${DEFAULT_DELAY_SECONDS}s is the default for a fresh one)`
        );
    }
};
