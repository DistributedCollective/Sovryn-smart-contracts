/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { task } = require("hardhat/config");
const { ethers } = require("ethers");
const Logs = require("node-logs");
const policy = require("./policy");
const recovery = require("./recovery");
const recoveryTasks = require("./recoveryTasks");
const { resolveOptionalAddress } = require("./addressParam");
const { assertLocalQaFork } = require("../../../tests-onchain/perimeter/qa/guard");

const logger = new Logs().showInConsole(true);

const TASK = "perimeter:route:lending-pools";
const LENDER = policy.SURFACES.PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW;

/** The protocol's pool list is read in pages of this size until a page comes
 *  back short. */
const POOL_PAGE = 50;

const PROTOCOL_ABI = [
    "function getLoanPoolsList(uint256 start, uint256 count) view returns (bytes32[])",
    "function loanPoolToUnderlying(address) view returns (address)",
];
const POOL_ABI = [
    "function loanTokenAddress() view returns (address)",
    "function symbol() view returns (string)",
];
const TOKEN_ABI = ["function symbol() view returns (string)"];

const walletInterface = new ethers.utils.Interface([
    "function submitTransaction(address destination, uint256 value, bytes data) returns (uint256 transactionId)",
]);

/** A display symbol, or undefined when the contract does not answer for one.
 *  Only ever used to label a line; nothing is built from it. */
const readSymbol = async (hre, address, abi) => {
    try {
        const symbol = await (await hre.ethers.getContractAt(abi, address)).symbol();
        return typeof symbol === "string" && symbol !== "" ? symbol : undefined;
    } catch (error) {
        return undefined;
    }
};

/**
 * Every pool the protocol lists, each with the asset its withdrawals escrow.
 *
 * The queue records a request's asset from the pool itself (`loanTokenAddress`)
 * and a route matches on exactly that, so the pool's own answer is what the
 * route is built from. The protocol keeps its own record of the same asset; a
 * pool the two disagree on is refused, because a route built from either would
 * register cleanly and then refuse every refund it was meant for.
 *
 * Sorted by address so two operators reading the same block produce the same
 * batch: the protocol's own list order moves when a pool is removed.
 */
const readLendingPools = async (hre, protocolAddress) => {
    const { ethers: hreEthers } = hre;
    const protocol = await hreEthers.getContractAt(PROTOCOL_ABI, protocolAddress);

    const listed = [];
    for (let start = 0; ; start += POOL_PAGE) {
        const page = await protocol.getLoanPoolsList(start, POOL_PAGE);
        for (const word of page) {
            listed.push(hreEthers.utils.getAddress(hreEthers.utils.hexDataSlice(word, 12)));
        }
        if (page.length < POOL_PAGE) break;
    }
    if (listed.length === 0) {
        throw new Error(`${TASK}: the protocol at ${protocolAddress} lists no lending pool`);
    }

    const pools = [];
    for (const pool of listed) {
        let asset;
        try {
            asset = hreEthers.utils.getAddress(
                await (await hreEthers.getContractAt(POOL_ABI, pool)).loanTokenAddress()
            );
        } catch (error) {
            throw new Error(
                `${TASK}: the pool ${pool} does not answer loanTokenAddress(), so the asset its ` +
                    "withdrawals escrow cannot be read and no route can be built for it"
            );
        }
        const recorded = hreEthers.utils.getAddress(await protocol.loanPoolToUnderlying(pool));
        if (recorded !== asset) {
            throw new Error(
                `${TASK}: the pool ${pool} escrows ${asset} but the protocol records ${recorded} ` +
                    "as its asset — a route built from either would never match a withdrawal"
            );
        }
        pools.push({
            pool,
            asset,
            symbol: await readSymbol(hre, pool, POOL_ABI),
            assetSymbol: await readSymbol(hre, asset, TOKEN_ABI),
        });
    }
    return pools.sort((a, b) => (a.pool.toLowerCase() < b.pool.toLowerCase() ? -1 : 1));
};

const poolPhrase = (entry) => `${entry.symbol ? `${entry.symbol} ` : ""}pool ${entry.pool}`;
const assetPhrase = (entry) => `asset ${entry.assetSymbol || entry.asset}`;

/** One multisig transaction: the queue call, the wallet call that carries it,
 *  and the sentence read back from the calldata itself — never from the
 *  arguments the call was built from — so the line can only say what the bytes
 *  say. */
const transactionFor = (built, queueAddress, extra) => {
    const decoded = recovery.decodeRecoveryCall(built.data);
    if (!decoded || decoded.signature !== built.signature) {
        throw new Error(
            `${TASK}: the ${built.signature} calldata built here does not decode back to itself`
        );
    }
    return {
        kind: built.signature.split("(")[0],
        ...extra,
        signature: built.signature,
        destination: queueAddress,
        value: "0",
        calldata: built.data,
        submitTransaction: walletInterface.encodeFunctionData("submitTransaction", [
            queueAddress,
            0,
            built.data,
        ]),
        decoded: decoded.meaning,
    };
};

/**
 * Read the queue and the protocol and build the batch: one call that allows
 * refund-to-pool routes on lender withdrawals (left out when they already are
 * allowed), then one route registration per pool, in pool address order.
 *
 * A pool that already has an active top-up route is left out and listed. So is
 * a pool that has some OTHER active route on the same surface, pool and asset:
 * a second matching route makes `perimeter:refund --to pool` refuse to choose
 * between them, so it is left for the operator to remove first.
 */
const prepareLendingRoutes = async (
    hre,
    { queueAddress, live, protocolAddress, multisigAddress }
) => {
    const pools = await readLendingPools(hre, protocolAddress);
    const feasibleNow = await recoveryTasks.readTopUpFeasible(live, LENDER);
    const wrbtc = await recoveryTasks.readWrbtc(live);

    const transactions = [];
    const skipped = [];

    if (!feasibleNow) {
        transactions.push(
            transactionFor(
                recovery.buildRecoveryCall("setTopUpFeasible", {
                    surfaceId: LENDER,
                    feasible: true,
                }),
                queueAddress,
                { label: "refund-to-pool on lender withdrawals" }
            )
        );
    }

    for (const entry of pools) {
        const matching = await recoveryTasks.activeRoutesFor(
            live,
            LENDER,
            entry.pool,
            entry.asset
        );
        const topUp = matching.find((route) => route.topUpPool);
        if (topUp) {
            skipped.push({
                ...entry,
                reason: "topUpRouteActive",
                routeIds: [topUp.routeId],
                detail: `${poolPhrase(entry)} already has an active top-up route ${topUp.routeId}`,
            });
            continue;
        }
        if (matching.length > 0) {
            skipped.push({
                ...entry,
                reason: "otherRouteActive",
                routeIds: matching.map((route) => route.routeId),
                detail:
                    `${poolPhrase(entry)} has another active route on the same surface and ` +
                    "asset, and a second matching route makes a refund to the pool refuse to " +
                    "choose between them — remove it with `perimeter:route:remove` and run this " +
                    "task again:\n    " +
                    matching
                        .map((route) => recovery.describeRoute(route.routeId, route))
                        .join("\n    "),
            });
            continue;
        }

        let destination;
        try {
            destination = recovery.requireRouteDestination({
                destination: entry.pool,
                token: entry.asset,
                subProduct: entry.pool,
                topUpPool: true,
                queue: queueAddress,
                wrbtc,
                surfaceId: LENDER,
                // The feasibility call is part of this batch, or the surface
                // already allows it, so the route is met with it allowed.
                topUpFeasible: true,
            });
        } catch (error) {
            throw new Error(`${TASK}: ${poolPhrase(entry)}: ${error.message}`);
        }
        transactions.push(
            transactionFor(
                recovery.buildRecoveryCall("setRecoveryRoute", {
                    active: true,
                    surfaceId: LENDER,
                    subProduct: entry.pool,
                    token: entry.asset,
                    destination,
                    topUpPool: true,
                }),
                queueAddress,
                {
                    label: `${poolPhrase(entry)}, ${assetPhrase(entry)}`,
                    pool: entry.pool,
                    asset: entry.asset,
                    routeId: recovery.routeIdOf(LENDER, entry.pool, entry.asset, destination),
                }
            )
        );
    }

    transactions.forEach((tx, i) => {
        tx.index = i + 1;
    });

    return {
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId,
        readAtBlock: await hre.ethers.provider.getBlockNumber(),
        queue: queueAddress,
        multisig: multisigAddress,
        protocol: protocolAddress,
        surface: {
            name: "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW",
            id: LENDER,
            phrase: policy.surfaceLabel(LENDER),
        },
        refundToPoolAllowed: feasibleNow,
        poolsListed: pools.length,
        transactions,
        skipped,
    };
};

const row = (label, value) => `  ${`${label}:`.padEnd(20)}${value}`;

const presentPlan = (plan) => {
    logger.info(`Queue:      ${plan.queue}`);
    logger.info(`Multisig:   ${plan.multisig}`);
    logger.info(`Protocol:   ${plan.protocol}`);
    logger.info(
        `Pools:      ${plan.poolsListed} listed by the protocol, ` +
            `${plan.transactions.filter((tx) => tx.pool).length} routes to register, ` +
            `${plan.skipped.length} left out`
    );
    if (plan.refundToPoolAllowed) {
        logger.info(
            `Refund-to-pool is already allowed on ${plan.surface.phrase} — no feasibility ` +
                "call is needed."
        );
    }
    for (const skip of plan.skipped) {
        logger.warn(`Left out: ${skip.detail}`);
    }
    if (plan.transactions.length === 0) {
        logger.info("nothing to prepare: every pool has its route and the surface allows it");
        return;
    }
    for (const tx of plan.transactions) {
        logger.info(`Transaction ${tx.index} of ${plan.transactions.length} — ${tx.label}`);
        logger.info(row("destination", tx.destination));
        logger.info(row("calldata", tx.calldata));
        logger.info(row("submitTransaction", tx.submitTransaction));
        logger.info(row("decoded", tx.decoded));
    }
    if (!plan.refundToPoolAllowed && plan.transactions.length > 1) {
        logger.warn(
            "The route calls revert until the feasibility call has EXECUTED — confirm them in " +
                "order, and check the first one executed before confirming the rest."
        );
    }
};

/** Refuse to send anywhere but a local QA fork, before anything is read. The
 *  guard is the one every QA command runs behind: loopback url, a hardhat or
 *  anvil node, chain id 30, and the `qa` network tag. */
const requireForkForSubmit = async (hre) => {
    try {
        await assertLocalQaFork(hre);
    } catch (error) {
        throw new Error(
            `${TASK}: --submit sends through the multisig and runs on a local QA fork only. ` +
                "Without --submit this task only reads and prints the batch, on any network. " +
                error.message
        );
    }
};

/** Submit the batch through the multisig, one transaction after another in the
 *  batch's own order, each read back against the queue. */
const submitLendingRoutes = async (
    hre,
    plan,
    { multisigAddress, queueAddress, signerAcc, queue }
) => {
    const submitted = [];
    for (const tx of plan.transactions) {
        logger.info(`Submitting transaction ${tx.index} of ${plan.transactions.length}`);
        const txId = await recoveryTasks.submitQueueCall(hre, {
            multisigAddress,
            queueAddress,
            signerAcc,
            built: { data: tx.calldata, signature: tx.signature, meaning: tx.decoded },
            queue,
        });
        submitted.push({ index: tx.index, multisigTransactionId: txId.toString() });
    }
    return submitted;
};

const resolveProtocolAddress = async (hre, protocolParam) => {
    const {
        ethers: hreEthers,
        deployments: { getOrNull },
    } = hre;
    const address = await resolveOptionalAddress(hreEthers, protocolParam, async () => {
        const record = await getOrNull("ISovryn");
        if (!record) {
            throw new Error(
                `${TASK}: no ISovryn deployment record on this network — pass --protocol`
            );
        }
        return record.address;
    });
    if ((await hreEthers.provider.getCode(address)) === "0x") {
        throw new Error(`${TASK}: no contract code at the protocol ${address}`);
    }
    return address;
};

const runLendingRoutes = async ({ queue, protocol, multisig, signer, out, submit }, hre) => {
    if (submit) await requireForkForSubmit(hre);

    const { address: queueAddress, queue: live } = await recoveryTasks.resolveQueue(
        hre,
        TASK,
        queue
    );
    const protocolAddress = await resolveProtocolAddress(hre, protocol);
    const multisigAddress = await recoveryTasks.resolveMultisigAddress(hre, multisig);
    // setTopUpFeasible and setRecoveryRoute are Owner-only on the queue.
    await recoveryTasks.requireQueueRole(hre, live, TASK, multisigAddress, false);

    const plan = await prepareLendingRoutes(hre, {
        queueAddress,
        live,
        protocolAddress,
        multisigAddress,
    });
    presentPlan(plan);

    const file = path.resolve(
        process.cwd(),
        out || `perimeter-lending-routes.${plan.network}.json`
    );
    fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
    logger.info(`Batch written to ${file}`);

    if (!submit) {
        logger.info("nothing was submitted: pass --submit on a local QA fork to send this batch");
        return plan;
    }
    if (plan.transactions.length === 0) return plan;

    const signerAcc = await recoveryTasks.resolveSigner(hre, signer);
    logger.info(`Submitter:  ${signerAcc}`);
    plan.submitted = await submitLendingRoutes(hre, plan, {
        multisigAddress,
        queueAddress,
        signerAcc,
        queue: live,
    });
    logger.info(
        "A transaction still waiting on confirmations reads back with " +
            "`perimeter:check-block --id <id>`, and the whole route list with " +
            "`perimeter:route:show` — a multisig receipt does not say the inner call ran."
    );
    return plan;
};

task(
    TASK,
    "Prepare the Exchequer multisig transactions that allow refund-to-pool routes on lender " +
        "withdrawals and register one refund-to-pool route for every lending pool"
)
    .addOptionalParam("queue", "ExitDelayQueue address (defaults to the deployment record)")
    .addOptionalParam("protocol", "Protocol address that lists the pools (defaults to ISovryn)")
    .addOptionalParam("multisig", "Multisig address (defaults to the MultiSigWallet deployment)")
    .addOptionalParam(
        "out",
        "File the whole batch is written to (defaults to perimeter-lending-routes.<network>.json)"
    )
    .addOptionalParam("signer", "Signer name: 'signer' or 'deployer'", "deployer")
    .addFlag("submit", "Send the batch through the multisig — a local QA fork only")
    .setAction(runLendingRoutes);

module.exports = { runLendingRoutes, prepareLendingRoutes, submitLendingRoutes, readLendingPools };
