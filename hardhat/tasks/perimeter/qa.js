/* eslint-disable no-console */
/**
 * The one command that turns a freshly booted QA fork into the released, armed,
 * operator-ready chain the two dapps are tested against.
 *
 * Boot the node first (scripts/perimeter/qa-node.sh), then:
 *     npx hardhat perimeter:qa up --network rskForkedMainnetQa
 *
 * It refuses to run anywhere but that network. Everything it does is a write to
 * a local fork, and the state file it leaves behind carries a published test
 * private key so the operator can import the account into MetaMask.
 */
const { task, types } = require("hardhat/config");

/** The bootstrap module is loaded inside the action, never at the top of this
 *  file. This file is required while hardhat.config.js is still being
 *  evaluated, and the bootstrap's own dependencies require the runtime
 *  environment — pulling that in from here would close a require cycle through
 *  a half-built hre. */
const loadBootstrap = () => require("../../../tests-onchain/perimeter/qa/bootstrap");

const SUBCOMMANDS = ["up"];

const row = (label, value) => console.log(`  ${label.padEnd(22)}${value}`);

task("perimeter:qa", "Bring a local QA fork to the released, armed withdrawal-delay state")
    .addPositionalParam("subcommand", `One of: ${SUBCOMMANDS.join(", ")}`, undefined, types.string)
    .addOptionalParam(
        "delay",
        "Hold length in seconds the delay is armed with",
        undefined,
        types.int
    )
    .addOptionalParam(
        "governance",
        "'impersonate' replays each proposal from its timelock and leaves the chain clock " +
            "alone; 'real' walks them through governance and jumps the clock days ahead",
        "impersonate",
        types.string
    )
    .addOptionalParam(
        "fee",
        "'on' (default) also closes the charge switch on the controller; 'off' arms the hold " +
            "alone",
        "on",
        types.string
    )
    .addFlag(
        "keepThreshold",
        "Leave the multisig's signature threshold as it is instead of dropping it to 1"
    )
    .setAction(async ({ subcommand, delay, governance, fee, keepThreshold }, hre) => {
        if (!SUBCOMMANDS.includes(subcommand)) {
            throw new Error(
                `perimeter:qa: unknown subcommand '${subcommand}' — expected one of: ` +
                    SUBCOMMANDS.join(", ")
            );
        }
        if (fee !== "on" && fee !== "off") {
            throw new Error(`perimeter:qa: --fee takes 'on' or 'off', not '${fee}'`);
        }
        // The guard is repeated inside the bootstrap, where the sends happen.
        // Here it is so the operator learns about a wrong --network before the
        // first fork read rather than after it.
        if (!hre.network.tags.qa) {
            throw new Error(
                `perimeter:qa: network '${hre.network.name}' is not a QA fork. Boot ` +
                    "scripts/perimeter/qa-node.sh and pass --network rskForkedMainnetQa."
            );
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
    });
