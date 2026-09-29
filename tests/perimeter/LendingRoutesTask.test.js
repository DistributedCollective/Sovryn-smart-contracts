/**
 * `perimeter:route:lending-pools`: the batch of Exchequer multisig transactions
 * that allows refund-to-pool routes on lender withdrawals and registers one
 * refund-to-pool route per lending pool — how many calls it builds and in what
 * order, that each one decodes to the sentence printed beside it, which pools it
 * leaves out, and that it never sends anywhere but a local QA fork.
 *
 * The queue is a stand-in that stores what each call sets, the protocol is a
 * stand-in that lists pools, and the wallet is the real multisig. The routes'
 * behaviour against the real queue is covered on a fork by the operator step
 * in the deployment runbook.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/LendingRoutesTask.test.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const recovery = require("../../hardhat/tasks/perimeter/recovery");
const policy = require("../../hardhat/tasks/perimeter/policy");
const recoveryTasks = require("../../hardhat/tasks/perimeter/recoveryTasks");
const lendingRoutes = require("../../hardhat/tasks/perimeter/lendingRoutes");

const TASK = "perimeter:route:lending-pools";
const LENDER = policy.SURFACES.PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW;
const BORROWER = policy.SURFACES.PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW;

// Decoded with an ABI written out here, not with the one the task encodes with,
// so a shared mistake in the task's own tables cannot pass both sides.
const queueIface = new ethers.utils.Interface([
    "function setRecoveryRoute((bool active, bytes32 surfaceId, address subProduct, address token, address destination, bool topUpPool) route)",
    "function setTopUpFeasible(bytes32 surfaceId, bool feasible)",
]);
const walletIface = new ethers.utils.Interface([
    "function submitTransaction(address destination, uint256 value, bytes data)",
]);

const captureConsole = async (fn) => {
    const original = console.log;
    const lines = [];
    console.log = (...args) => lines.push(args.map(String).join(" "));
    try {
        await fn();
    } finally {
        console.log = original;
    }
    return lines.join("\n");
};

/** One labelled line of a transaction block, as the task prints it. */
const row = (label, value) => `  ${`${label}:`.padEnd(20)}${value}`;

const rejection = async (promise) => {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    return null;
};

describe("perimeter:route:lending-pools", () => {
    let owner;
    let multisig;
    let stub;
    let protocol;
    let pools;
    let outDir;
    let out;

    const deployPool = async (symbol, assetSymbol) => {
        const Pool = await ethers.getContractFactory("MockLoanPool");
        const asset = await Pool.deploy(ethers.constants.AddressZero, assetSymbol);
        await asset.deployed();
        const pool = await Pool.deploy(asset.address, symbol);
        await pool.deployed();
        await protocol.setLoanPool(pool.address, asset.address);
        return { pool: pool.address, asset: asset.address, symbol, assetSymbol };
    };

    beforeEach(async () => {
        [owner] = await ethers.getSigners();
        const Wallet = await ethers.getContractFactory("MultiSigWallet");
        multisig = await Wallet.deploy([owner.address], 1);
        await multisig.deployed();
        stub = await (await ethers.getContractFactory("MockRecoveryQueue")).deploy();
        await stub.deployed();
        await stub.setRoles(multisig.address, multisig.address);
        protocol = await (await ethers.getContractFactory("MockLendingProtocol")).deploy();
        await protocol.deployed();
        pools = [
            await deployPool("iDOC", "DOC"),
            await deployPool("iRBTC", "WRBTC"),
            await deployPool("iUSDT", "USDT"),
        ];
        outDir = fs.mkdtempSync(path.join(os.tmpdir(), "lending-routes-"));
        out = path.join(outDir, "batch.json");
    });

    afterEach(() => {
        fs.rmSync(outDir, { recursive: true, force: true });
    });

    const params = (extra) => ({
        queue: stub.address,
        protocol: protocol.address,
        multisig: multisig.address,
        signer: owner.address,
        out,
        ...extra,
    });
    const run = (extra) => hre.run(TASK, params(extra));
    const sortedPools = () =>
        [...pools].sort((a, b) => (a.pool.toLowerCase() < b.pool.toLowerCase() ? -1 : 1));
    const batchFile = () => JSON.parse(fs.readFileSync(out, "utf8"));

    it("builds the feasibility call first and then one route call per pool, in pool address order", async () => {
        const plan = await run();
        expect(plan.transactions.map((tx) => tx.kind)).to.deep.equal([
            "setTopUpFeasible",
            ...pools.map(() => "setRecoveryRoute"),
        ]);
        expect(plan.transactions).to.have.length(1 + pools.length);
        expect(plan.transactions.slice(1).map((tx) => tx.pool)).to.deep.equal(
            sortedPools().map((entry) => entry.pool)
        );
        expect(plan.transactions.map((tx) => tx.index)).to.deep.equal([1, 2, 3, 4]);
    });

    it("writes the whole batch to the JSON file, the same transactions the task returns", async () => {
        const plan = await run();
        const file = batchFile();
        expect(file.queue).to.equal(stub.address);
        expect(file.multisig).to.equal(multisig.address);
        expect(file.transactions).to.deep.equal(JSON.parse(JSON.stringify(plan.transactions)));
        expect(file.skipped).to.deep.equal([]);
        for (const tx of file.transactions) {
            expect(tx.destination).to.equal(stub.address);
            expect(tx.value).to.equal("0");
        }
    });

    it("carries a calldata that decodes to the feasibility call the line describes", async () => {
        const plan = await run();
        const [feasible] = plan.transactions;
        const decoded = queueIface.decodeFunctionData("setTopUpFeasible", feasible.calldata);
        expect(decoded.surfaceId).to.equal(LENDER);
        expect(decoded.feasible).to.equal(true);
        expect(feasible.decoded).to.equal(
            "allows a refund-to-pool route to be registered on lender withdrawals"
        );
    });

    it("carries a calldata that decodes to the refund-to-pool route the line describes, for every pool", async () => {
        const plan = await run();
        for (const tx of plan.transactions.slice(1)) {
            const entry = pools.find((p) => p.pool === tx.pool);
            const [route] = queueIface.decodeFunctionData("setRecoveryRoute", tx.calldata);
            expect(route.active).to.equal(true);
            expect(route.surfaceId).to.equal(LENDER);
            expect(route.subProduct).to.equal(entry.pool);
            expect(route.token).to.equal(entry.asset);
            expect(route.destination).to.equal(entry.pool);
            expect(route.topUpPool).to.equal(true);
            expect(tx.decoded).to.equal(
                `registers a recovery route on lender withdrawals that tops up the pool ` +
                    `${entry.pool} with the escrowed ${entry.asset}`
            );
            expect(tx.routeId).to.equal(
                recovery.routeIdOf(LENDER, entry.pool, entry.asset, entry.pool)
            );
        }
    });

    it("wraps every call in a submitTransaction to the queue with no value", async () => {
        const plan = await run();
        for (const tx of plan.transactions) {
            const [destination, value, data] = walletIface.decodeFunctionData(
                "submitTransaction",
                tx.submitTransaction
            );
            expect(destination).to.equal(stub.address);
            expect(value.toString()).to.equal("0");
            expect(data).to.equal(tx.calldata);
        }
    });

    it("prints destination, calldata, submitTransaction calldata and the decoded line for each transaction", async () => {
        const output = await captureConsole(() => run());
        const plan = batchFile();
        expect(plan.transactions).to.have.length(4);
        for (const tx of plan.transactions) {
            expect(output).to.include(row("destination", stub.address));
            expect(output).to.include(row("calldata", tx.calldata));
            expect(output).to.include(row("submitTransaction", tx.submitTransaction));
            expect(output).to.include(row("decoded", tx.decoded));
        }
        expect(output).to.include(`Multisig:   ${multisig.address}`);
        expect(output).to.match(/Transaction 1 of 4/);
        expect(output).to.match(/Transaction 4 of 4/);
    });

    it("names each pool and its asset by symbol beside its transaction", async () => {
        const output = await captureConsole(() => run());
        for (const entry of pools) {
            expect(output).to.include(
                `${entry.symbol} pool ${entry.pool}, asset ${entry.assetSymbol}`
            );
        }
    });

    it("sends nothing without --submit", async () => {
        const before = (await multisig.transactionCount()).toString();
        await run();
        expect((await multisig.transactionCount()).toString()).to.equal(before);
        expect(await stub.topUpFeasible(LENDER)).to.equal(false);
        expect(await stub.recoveryRouteIds()).to.have.length(0);
    });

    it("skips a pool that already has an active top-up route and says so", async () => {
        const [held] = sortedPools();
        await stub.setRoute(true, LENDER, held.pool, held.asset, held.pool, true);
        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });
        expect(plan.transactions).to.have.length(pools.length);
        expect(plan.transactions.map((tx) => tx.pool).filter(Boolean)).to.not.include(held.pool);
        expect(plan.skipped).to.have.length(1);
        expect(plan.skipped[0].pool).to.equal(held.pool);
        expect(plan.skipped[0].reason).to.equal("topUpRouteActive");
        expect(output).to.include(
            `${held.symbol} pool ${held.pool} already has an active top-up route`
        );
        expect(batchFile().skipped).to.have.length(1);
    });

    it("still registers a pool whose earlier route on the same key was switched off", async () => {
        const [held] = sortedPools();
        await stub.setRoute(false, LENDER, held.pool, held.asset, held.pool, true);
        const plan = await run();
        expect(plan.skipped).to.have.length(0);
        expect(plan.transactions.map((tx) => tx.pool)).to.include(held.pool);
    });

    it("leaves a pool out and warns when another active route already covers its provenance", async () => {
        const [held] = sortedPools();
        await stub.setRoute(true, LENDER, held.pool, held.asset, owner.address, false);
        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });
        expect(plan.transactions.map((tx) => tx.pool)).to.not.include(held.pool);
        expect(plan.skipped).to.have.length(1);
        expect(plan.skipped[0].reason).to.equal("otherRouteActive");
        expect(output).to.match(/another active route/);
        expect(output).to.match(/perimeter:route:remove/);
    });

    it("leaves the feasibility call out when the surface already allows refund-to-pool", async () => {
        await stub.setTopUpFeasible(LENDER, true);
        const output = await captureConsole(async () => {
            await run();
        });
        const plan = batchFile();
        expect(plan.transactions.map((tx) => tx.kind)).to.deep.equal(
            pools.map(() => "setRecoveryRoute")
        );
        expect(output).to.include("Refund-to-pool is already allowed on lender withdrawals");
    });

    it("prepares nothing and says so when every pool is routed and the surface allows it", async () => {
        await stub.setTopUpFeasible(LENDER, true);
        for (const entry of pools) {
            await stub.setRoute(true, LENDER, entry.pool, entry.asset, entry.pool, true);
        }
        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });
        expect(plan.transactions).to.have.length(0);
        expect(plan.skipped).to.have.length(pools.length);
        expect(output).to.include("nothing to prepare");
    });

    it("ignores a route registered on another surface", async () => {
        const [held] = sortedPools();
        await stub.setRoute(true, BORROWER, held.pool, held.asset, held.pool, true);
        const plan = await run();
        expect(plan.skipped).to.have.length(0);
        expect(plan.transactions).to.have.length(1 + pools.length);
    });

    it("lists every pool when the protocol holds more than one page of them", async () => {
        for (let i = 0; i < 48; i++) {
            pools.push(await deployPool(`iP${i}`, `P${i}`));
        }
        expect(pools).to.have.length(51);
        const plan = await run();
        expect(plan.transactions).to.have.length(1 + 51);
        expect(plan.transactions.slice(1).map((tx) => tx.pool)).to.deep.equal(
            sortedPools().map((entry) => entry.pool)
        );
    });

    it("refuses a pool whose own asset differs from the one the protocol records for it", async () => {
        const other = ethers.Wallet.createRandom().address;
        await protocol.setLoanPool(pools[1].pool, other);
        const error = await rejection(run());
        expect(error, "a pool with two different assets must refuse").to.not.equal(null);
        expect(error.message).to.include(pools[1].pool);
        expect(error.message).to.match(/escrows .* the protocol records/);
        expect(fs.existsSync(out)).to.equal(false);
    });

    it("refuses a pool that does not answer for its asset", async () => {
        const bare = (await (await ethers.getContractFactory("MockRecoveryQueue")).deploy())
            .address;
        await protocol.setLoanPool(bare, pools[0].asset);
        const error = await rejection(run());
        expect(error).to.not.equal(null);
        expect(error.message).to.match(/does not answer loanTokenAddress/);
    });

    it("refuses a protocol that lists no pool", async () => {
        const empty = await (await ethers.getContractFactory("MockLendingProtocol")).deploy();
        await empty.deployed();
        const error = await rejection(run({ protocol: empty.address }));
        expect(error).to.not.equal(null);
        expect(error.message).to.match(/lists no lending pool/);
    });

    it("refuses a protocol address with no code", async () => {
        const error = await rejection(run({ protocol: ethers.Wallet.createRandom().address }));
        expect(error).to.not.equal(null);
        expect(error.message).to.match(/no contract code at the protocol/);
    });

    it("refuses a multisig that does not hold the Owner role on the queue", async () => {
        await stub.setRoles(owner.address, owner.address);
        const error = await rejection(run());
        expect(error).to.not.equal(null);
        expect(error.message).to.match(/needs Owner on the queue/);
        expect(fs.existsSync(out)).to.equal(false);
    });

    it("refuses --submit on a network that is not a local QA fork, before any read or send", async () => {
        const before = (await multisig.transactionCount()).toString();
        const error = await rejection(run({ submit: true }));
        expect(error, "the in-process network is not a QA fork").to.not.equal(null);
        expect(error.message).to.include(`${TASK}: --submit`);
        expect(error.message).to.match(/loopback/);
        expect((await multisig.transactionCount()).toString()).to.equal(before);
        expect(fs.existsSync(out), "nothing is written when the send is refused").to.equal(false);
    });

    it("refuses --submit on a real network without touching the provider", async () => {
        const untouched = new Proxy(
            {},
            {
                get: () => {
                    throw new Error("the provider was used");
                },
            }
        );
        const realNetwork = {
            network: {
                name: "rskSovrynMainnet",
                config: { url: "https://mainnet-dev.sovryn.app/rpc" },
                tags: { mainnet: true },
            },
            ethers: untouched,
            deployments: untouched,
        };
        const error = await rejection(
            lendingRoutes.runLendingRoutes(params({ submit: true }), realNetwork)
        );
        expect(error, "a hosted network must be refused").to.not.equal(null);
        expect(error.message).to.include(`${TASK}: --submit`);
        expect(error.message).to.match(/loopback/);
        expect(error.message).to.not.match(/provider was used/);
    });

    it("submits the printed calldata to the queue through the multisig, in order", async () => {
        const plan = await run();
        const before = await multisig.transactionCount();
        await lendingRoutes.submitLendingRoutes(hre, plan, {
            multisigAddress: multisig.address,
            queueAddress: stub.address,
            signerAcc: owner.address,
            queue: await recoveryTasks.queueAt(hre, stub.address),
        });
        const after = await multisig.transactionCount();
        expect(after.sub(before).toNumber()).to.equal(plan.transactions.length);
        for (let i = 0; i < plan.transactions.length; i++) {
            const sent = await multisig.transactions(before.add(i));
            expect(sent.destination).to.equal(stub.address);
            expect(sent.data).to.equal(plan.transactions[i].calldata);
            expect(sent.executed).to.equal(true);
        }
        expect(await stub.topUpFeasible(LENDER)).to.equal(true);
        expect(await stub.recoveryRouteIds()).to.have.length(pools.length);
        for (const entry of pools) {
            const route = await stub.getRecoveryRoute(
                recovery.routeIdOf(LENDER, entry.pool, entry.asset, entry.pool)
            );
            expect(route.active).to.equal(true);
            expect(route.topUpPool).to.equal(true);
        }
    });
});
