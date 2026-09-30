/**
 * `perimeter:route:lending-pools`: the task that submits the Exchequer multisig
 * transactions allowing refund-to-pool routes on lender withdrawals and
 * registering one refund-to-pool route per lending pool — how many calls it
 * builds and in what order, that each one decodes to the sentence printed beside
 * it, which pools it leaves out, who may run it, and how it treats a call that
 * is already waiting in the multisig.
 *
 * The queue is a stand-in that stores what each call sets, the protocol is a
 * stand-in that lists pools, and the wallet is the real multisig. The stand-in
 * queue enforces none of the real queue's own refusals (a surface that does not
 * allow refund-to-pool, a destination that is not the pool), and no committed
 * test runs this task against the real queue.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/LendingRoutesTask.test.js
 */
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

/** The sentence a queue call's calldata says, decoded with this file's own ABI. */
const lineFor = (data) => {
    if (data.startsWith(queueIface.getSighash("setTopUpFeasible"))) {
        const decoded = queueIface.decodeFunctionData("setTopUpFeasible", data);
        expect(decoded.surfaceId).to.equal(LENDER);
        expect(decoded.feasible).to.equal(true);
        return "allows a refund-to-pool route to be registered on lender withdrawals";
    }
    const [route] = queueIface.decodeFunctionData("setRecoveryRoute", data);
    expect(route.active).to.equal(true);
    expect(route.surfaceId).to.equal(LENDER);
    expect(route.topUpPool).to.equal(true);
    return (
        "registers a recovery route on lender withdrawals that tops up the pool " +
        `${route.subProduct} with the escrowed ${route.token}`
    );
};

describe("perimeter:route:lending-pools", () => {
    let owner;
    let second;
    let outsider;
    let multisig;
    let stub;
    let protocol;
    let pools;

    const deployPool = async (symbol, assetSymbol) => {
        const Pool = await ethers.getContractFactory("MockLoanPool");
        const asset = await Pool.deploy(ethers.constants.AddressZero, assetSymbol);
        await asset.deployed();
        const pool = await Pool.deploy(asset.address, symbol);
        await pool.deployed();
        await protocol.setLoanPool(pool.address, asset.address);
        return { pool: pool.address, asset: asset.address, symbol, assetSymbol };
    };

    /** Replace the multisig with a wallet of these owners and this threshold, and
     *  make it the queue's Owner. */
    const seatWallet = async (owners, required) => {
        const Wallet = await ethers.getContractFactory("MultiSigWallet");
        multisig = await Wallet.deploy(
            owners.map((one) => one.address),
            required
        );
        await multisig.deployed();
        await stub.setRoles(multisig.address, multisig.address);
    };

    beforeEach(async () => {
        [owner, second, outsider] = await ethers.getSigners();
        stub = await (await ethers.getContractFactory("MockRecoveryQueue")).deploy();
        await stub.deployed();
        await seatWallet([owner], 1);
        protocol = await (await ethers.getContractFactory("MockLendingProtocol")).deploy();
        await protocol.deployed();
        pools = [
            await deployPool("iDOC", "DOC"),
            await deployPool("iRBTC", "WRBTC"),
            await deployPool("iUSDT", "USDT"),
        ];
    });

    const params = (extra) => ({
        queue: stub.address,
        protocol: protocol.address,
        multisig: multisig.address,
        signer: owner.address,
        ...extra,
    });
    const run = (extra) => hre.run(TASK, params(extra));
    const dry = (extra) => run({ dryRun: true, ...extra });
    const sortedPools = () =>
        [...pools].sort((a, b) => (a.pool.toLowerCase() < b.pool.toLowerCase() ? -1 : 1));
    const count = async () => (await multisig.transactionCount()).toNumber();

    /** Every multisig transaction from `first` on, as the wallet stores it. */
    const storedSince = async (first) => {
        const stored = [];
        const total = await count();
        for (let id = first; id < total; id++) {
            const tx = await multisig.transactions(id);
            stored.push({
                id,
                destination: tx.destination,
                value: tx.value.toString(),
                data: tx.data,
                executed: tx.executed,
            });
        }
        return stored;
    };

    /** The calldata of every call a fresh run plans, in order. */
    const plannedCalldata = async () => (await dry()).transactions.map((tx) => tx.calldata);

    /** A wallet call that queues `data` at the queue, as an owner would by hand. */
    const submitByHand = async (data) => {
        const before = await count();
        await (await multisig.connect(owner).submitTransaction(stub.address, 0, data)).wait();
        return before;
    };

    it("builds the feasibility call first and then one route call per pool, in pool address order", async () => {
        const plan = await dry();
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

    it("carries a calldata that decodes to the feasibility call the line describes", async () => {
        const plan = await dry();
        const [feasible] = plan.transactions;
        const decoded = queueIface.decodeFunctionData("setTopUpFeasible", feasible.calldata);
        expect(decoded.surfaceId).to.equal(LENDER);
        expect(decoded.feasible).to.equal(true);
        expect(feasible.decoded).to.equal(
            "allows a refund-to-pool route to be registered on lender withdrawals"
        );
    });

    it("carries a calldata that decodes to the refund-to-pool route the line describes, for every pool", async () => {
        const plan = await dry();
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
        const plan = await dry();
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
        let plan;
        const output = await captureConsole(async () => {
            plan = await dry();
        });
        expect(plan.transactions).to.have.length(4);
        for (const tx of plan.transactions) {
            expect(output).to.include(row("destination", stub.address));
            expect(output).to.include(row("calldata", tx.calldata));
            expect(output).to.include(row("submitTransaction", tx.submitTransaction));
            expect(output).to.include(row("decoded", tx.decoded));
        }
        expect(output).to.match(/Transaction 1 of 4/);
        expect(output).to.match(/Transaction 4 of 4/);
    });

    it("names each pool and its asset by symbol beside its transaction", async () => {
        const output = await captureConsole(() => dry());
        for (const entry of pools) {
            expect(output).to.include(
                `${entry.symbol} pool ${entry.pool}, asset ${entry.assetSymbol}`
            );
        }
    });

    it("submits 1 + N multisig transactions in order without --dry-run, each decoding to the line printed for it", async () => {
        const expected = await plannedCalldata();
        expect(expected).to.have.length(1 + pools.length);
        const before = await count();
        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });

        const stored = await storedSince(before);
        expect(stored).to.have.length(1 + pools.length);
        expect(stored.map((tx) => tx.data)).to.deep.equal(expected);
        for (const tx of stored) {
            expect(tx.destination).to.equal(stub.address);
            expect(tx.value).to.equal("0");
            expect(output).to.include(`multisig transaction ${tx.id} — ${lineFor(tx.data)}`);
        }
        expect(plan.submitted.map((sent) => sent.multisigTransactionId)).to.deep.equal(
            stored.map((tx) => String(tx.id))
        );
        expect(await stub.topUpFeasible(LENDER)).to.equal(true);
        expect(await stub.recoveryRouteIds()).to.have.length(pools.length);
    });

    it("prints every submitted id in the order the calls were submitted, beside its line", async () => {
        const before = await count();
        const output = await captureConsole(() => run());
        const stored = await storedSince(before);
        expect(stored).to.have.length(1 + pools.length);
        const at = stored.map((tx) =>
            output.indexOf(`multisig transaction ${tx.id} — ${lineFor(tx.data)}`)
        );
        expect(at.every((position) => position >= 0)).to.equal(true);
        expect([...at].sort((a, b) => a - b)).to.deep.equal(at);
    });

    it("sends nothing with --dry-run and says so", async () => {
        const before = await count();
        let plan;
        const output = await captureConsole(async () => {
            plan = await dry();
        });
        expect(await count()).to.equal(before);
        expect(await stub.topUpFeasible(LENDER)).to.equal(false);
        expect(await stub.recoveryRouteIds()).to.have.length(0);
        expect(plan.transactions).to.have.length(1 + pools.length);
        expect(plan.submitted).to.equal(undefined);
        expect(output).to.include("dry run: nothing was submitted");
    });

    it("prints the network with its chain id, the queue, the protocol, the multisig and the signer before it sends anything", async () => {
        const { chainId } = await ethers.provider.getNetwork();
        const output = await captureConsole(() => run());
        const lines = [
            `Network:    ${hre.network.name} (chain id ${chainId})`,
            `Queue:      ${stub.address}`,
            `Protocol:   ${protocol.address}`,
            `Multisig:   ${multisig.address}`,
            `Signer:     ${owner.address}`,
        ];
        const firstSend = output.indexOf("Submitting transaction 1");
        expect(firstSend).to.be.greaterThan(0);
        for (const line of lines) {
            expect(output, line).to.include(line);
            expect(output.indexOf(line)).to.be.lessThan(firstSend);
        }
    });

    it("prints the same header on a dry run", async () => {
        const output = await captureConsole(() => dry());
        expect(output).to.include(`Multisig:   ${multisig.address}`);
        expect(output).to.include(`Signer:     ${owner.address}`);
        expect(output).to.match(/Network:    hardhat \(chain id \d+\)/);
    });

    it("signs as the named deployer account when --signer is not given", async () => {
        const output = await captureConsole(() => run({ signer: undefined }));
        expect(output).to.include(`Signer:     ${owner.address}`);
        expect(await stub.topUpFeasible(LENDER)).to.equal(true);
    });

    it("refuses a signer name that is neither an address nor a named account, and sends nothing", async () => {
        const before = await count();
        const error = await rejection(run({ signer: "nobody" }));
        expect(error).to.not.equal(null);
        expect(error.message).to.include("nobody");
        expect(await count()).to.equal(before);
    });

    /** The raw transactions a run printed, one JSON object per line. */
    const rawLines = (output) =>
        output
            .split("\n")
            .filter((line) => line.startsWith("{"))
            .map((line) => JSON.parse(line));

    /** What each printed raw transaction must carry: the multisig as its target,
     *  no value, the chain, `submitTransaction(queue, 0, call)` as its data and
     *  the sentence the call's own calldata says. */
    const expectRawTransactions = async (raw, calls) => {
        const { chainId } = await ethers.provider.getNetwork();
        expect(raw).to.have.length(calls.length);
        raw.forEach((tx, i) => {
            expect(tx.to).to.equal(multisig.address);
            expect(tx.value).to.equal("0");
            expect(tx.chainId).to.equal(chainId);
            const [destination, value, data] = walletIface.decodeFunctionData(
                "submitTransaction",
                tx.data
            );
            expect(destination).to.equal(stub.address);
            expect(value.toString()).to.equal("0");
            expect(data).to.equal(calls[i]);
            expect(tx.description).to.equal(lineFor(calls[i]));
        });
    };

    it("sends nothing for a signer that is not an owner and outputs 1 + N raw transactions, in order, that submit each call to the multisig", async () => {
        const planned = await plannedCalldata();
        const before = await count();
        let plan;
        const output = await captureConsole(async () => {
            plan = await run({ signer: outsider.address });
        });
        expect(await count()).to.equal(before);
        expect(await stub.topUpFeasible(LENDER)).to.equal(false);
        expect(plan.submitted).to.equal(undefined);
        expect(output).to.include(
            `the signer ${outsider.address} is not an owner of the multisig ${multisig.address} — ` +
                "nothing was sent; send each transaction below from an owner account, in order"
        );
        const raw = rawLines(output);
        expect(planned).to.have.length(1 + pools.length);
        await expectRawTransactions(raw, planned);
        expect(plan.rawTransactions).to.deep.equal(raw);
    });

    it("says the signer is not an owner above the raw transactions", async () => {
        const output = await captureConsole(() => run({ signer: outsider.address }));
        const statement = output.indexOf("is not an owner of the multisig");
        const firstRaw = output.indexOf("\n{");
        expect(statement).to.be.greaterThan(0);
        expect(firstRaw).to.be.greaterThan(statement);
    });

    it("sends nothing with --raw-tx for an owner signer and outputs the same raw transactions", async () => {
        const planned = await plannedCalldata();
        const before = await count();
        const output = await captureConsole(() => run({ rawTx: true }));
        expect(await count()).to.equal(before);
        expect(await stub.topUpFeasible(LENDER)).to.equal(false);
        expect(output).to.include("--raw-tx: nothing was sent");
        await expectRawTransactions(rawLines(output), planned);
    });

    it("lands a printed raw transaction in the multisig with the same data when an owner sends it", async () => {
        await seatWallet([owner, second], 2);
        const planned = await plannedCalldata();
        const output = await captureConsole(() => run({ signer: outsider.address }));
        const before = await count();
        for (const tx of rawLines(output)) {
            await (
                await owner.sendTransaction({ to: tx.to, value: tx.value, data: tx.data })
            ).wait();
        }
        const stored = await storedSince(before);
        expect(stored.map((tx) => tx.data)).to.deep.equal(planned);
        for (const tx of stored) expect(tx.destination).to.equal(stub.address);
    });

    it("leaves a call already waiting in the multisig out of the raw transactions and names its id", async () => {
        await seatWallet([owner, second], 2);
        const planned = await plannedCalldata();
        const waitingId = await submitByHand(planned[0]);
        const before = await count();
        const output = await captureConsole(() => run({ signer: outsider.address }));
        expect(await count()).to.equal(before);
        expect(output).to.include(
            `already waiting for confirmations as multisig transaction ${waitingId}`
        );
        await expectRawTransactions(rawLines(output), planned.slice(1));
        expect(output).to.include(
            `The route transactions revert until the allow transaction (multisig transaction ${waitingId}) has EXECUTED`
        );
    });

    it("tells the owner who sends the raw transactions to confirm the allow transaction first", async () => {
        const output = await captureConsole(() => run({ signer: outsider.address }));
        expect(output).to.include(
            "The route transactions revert until the allow transaction (the first transaction above) has EXECUTED"
        );
        expect(output).to.match(/`executeTransaction`/);
        expect(output).to.include("perimeter:check-block --id <id>");
    });

    it("gives no allow instruction and no allow transaction when the surface already allows refund-to-pool", async () => {
        await stub.setTopUpFeasible(LENDER, true);
        const output = await captureConsole(() => run({ signer: outsider.address }));
        const raw = rawLines(output);
        expect(raw).to.have.length(pools.length);
        for (const tx of raw) expect(tx.description).to.match(/^registers a recovery route/);
        expect(output).to.include("Refund-to-pool is already allowed on lender withdrawals");
        expect(output).to.not.include("until the allow transaction");
    });

    it("outputs no raw transaction for a non-owner signer when every call is already in place", async () => {
        await stub.setTopUpFeasible(LENDER, true);
        for (const entry of pools) {
            await stub.setRoute(true, LENDER, entry.pool, entry.asset, entry.pool, true);
        }
        const before = await count();
        const output = await captureConsole(() => run({ signer: outsider.address }));
        expect(await count()).to.equal(before);
        expect(rawLines(output)).to.have.length(0);
        expect(output).to.include("nothing to submit");
    });

    it("outputs the raw transactions with a warning when the pending transactions cannot be read, and sends nothing", async () => {
        await seatWallet([owner, second], 2);
        await submitByHand("0xdeadbeef");
        const planned = await plannedCalldata();
        const before = await count();
        const output = await captureConsole(async () => {
            await lendingRoutes.runLendingRoutes(
                params({ signer: outsider.address }),
                walletReadFailsHre("transactions")
            );
        });
        expect(await count()).to.equal(before);
        expect(output).to.match(/pending transactions could not be read/);
        expect(output).to.include("out of gas");
        await expectRawTransactions(rawLines(output), planned);
    });

    it("outputs the raw transactions and sends nothing when the multisig does not say whether the signer is an owner", async () => {
        const planned = await plannedCalldata();
        const before = await count();
        const output = await captureConsole(async () => {
            await lendingRoutes.runLendingRoutes(params(), walletReadFailsHre("isOwner"));
        });
        expect(await count()).to.equal(before);
        expect(output).to.match(
            /whether the signer .* is an owner of the multisig .* could not be read/
        );
        expect(output).to.include("out of gas");
        expect(output).to.include(
            "nothing was sent; send each transaction below from an owner account"
        );
        await expectRawTransactions(rawLines(output), planned);
    });

    it("reports a non-owner signer as a warning on a dry run, prints the plan and no raw transaction", async () => {
        const before = await count();
        let plan;
        const output = await captureConsole(async () => {
            plan = await dry({ signer: outsider.address });
        });
        expect(await count()).to.equal(before);
        expect(plan.transactions).to.have.length(1 + pools.length);
        expect(output).to.include(outsider.address);
        expect(output).to.match(/not an owner of the multisig/);
        expect(output).to.include("dry run: nothing was submitted");
        expect(rawLines(output)).to.have.length(0);
    });

    it("prints the raw transactions on a dry run when --raw-tx is given as well", async () => {
        const planned = await plannedCalldata();
        const before = await count();
        const output = await captureConsole(() => dry({ rawTx: true }));
        expect(await count()).to.equal(before);
        await expectRawTransactions(rawLines(output), planned);
        expect(output).to.include("dry run: nothing was submitted");
    });

    it("prints no raw transaction when an owner signer submits", async () => {
        const output = await captureConsole(() => run());
        expect(rawLines(output)).to.have.length(0);
        expect(output).to.include("Signer is an owner of the multisig");
    });

    it("skips a call already waiting in the multisig, names it with its id, and sends the others", async () => {
        await seatWallet([owner, second], 2);
        const [allow] = await plannedCalldata();
        const waitingId = await submitByHand(allow);
        const before = await count();

        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });

        expect(output).to.include(
            `already waiting for confirmations as multisig transaction ${waitingId}`
        );
        const stored = await storedSince(before);
        expect(stored).to.have.length(pools.length);
        expect(stored.map((tx) => tx.data)).to.not.include(allow);
        expect(
            stored.every((tx) => tx.data.startsWith(queueIface.getSighash("setRecoveryRoute")))
        ).to.equal(true);
        const waiting = plan.skipped.filter((skip) => skip.reason === "alreadyWaiting");
        expect(waiting).to.have.length(1);
        expect(waiting[0].kind).to.equal("setTopUpFeasible");
        expect(waiting[0].multisigTransactionIds).to.deep.equal([String(waitingId)]);
    });

    it("skips every call on a second run while the first run's calls are still waiting", async () => {
        await seatWallet([owner, second], 2);
        await run();
        const before = await count();
        expect(before).to.equal(1 + pools.length);

        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });

        expect(await count()).to.equal(before);
        expect(plan.transactions).to.have.length(0);
        expect(plan.skipped.filter((skip) => skip.reason === "alreadyWaiting")).to.have.length(
            1 + pools.length
        );
        for (let id = 0; id < before; id++) {
            expect(output).to.include(
                `already waiting for confirmations as multisig transaction ${id}`
            );
        }
        expect(output).to.include("nothing to submit");
    });

    it("matches on the whole call, so a waiting transaction to the same queue with other data is not a duplicate", async () => {
        await seatWallet([owner, second], 2);
        const other = queueIface.encodeFunctionData("setTopUpFeasible", [BORROWER, true]);
        await submitByHand(other);
        const before = await count();
        const plan = await run();
        expect(plan.skipped.filter((skip) => skip.reason === "alreadyWaiting")).to.have.length(0);
        expect(await count()).to.equal(before + 1 + pools.length);
    });

    it("finds a waiting call behind a long tail of executed transactions", async () => {
        await seatWallet([owner, second], 2);
        const [allow] = await plannedCalldata();
        const waitingId = await submitByHand(allow);
        // An address that takes an empty call: each of these executes at the
        // second confirmation and leaves the pending set.
        const executedTail = 100;
        for (let i = 0; i < executedTail; i++) {
            const id = await count();
            await (
                await multisig.connect(owner).submitTransaction(outsider.address, 0, "0x")
            ).wait();
            await (await multisig.connect(second).confirmTransaction(id)).wait();
        }
        // A transaction to the queue with data it refuses stays waiting for good.
        await submitByHand("0xdeadbeef");
        const before = await count();

        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });

        expect(output).to.include(
            `already waiting for confirmations as multisig transaction ${waitingId}`
        );
        expect(await count()).to.equal(before + pools.length);
        expect(plan.skipped.filter((skip) => skip.reason === "alreadyWaiting")).to.have.length(1);
    });

    /** An hre whose multisig contract answers through `wrap(contract)`, which
     *  returns an object standing in for it; every other contract is the real one. */
    const walletHre = (wrap) =>
        Object.assign(Object.create(hre), {
            ethers: Object.assign(Object.create(ethers), {
                getContractAt: async (abi, address, signer) => {
                    const contract = await ethers.getContractAt(abi, address, signer);
                    return Array.isArray(abi) && address === multisig.address
                        ? wrap(contract)
                        : contract;
                },
            }),
        });

    /** `contract` with the reads in `replacements` (name to function) swapped
     *  for other functions and every other read left as it is. */
    const withReads = (contract, replacements) =>
        Object.create(
            contract,
            Object.fromEntries(
                Object.entries(replacements).map(([name, value]) => [name, { value }])
            )
        );

    /** An hre whose multisig fails the reads named in `failing`, the way a call
     *  over its gas limit does, and answers every other read. */
    const walletReadFailsHre = (...failing) =>
        walletHre((contract) =>
            withReads(
                contract,
                Object.fromEntries(
                    failing.map((name) => [
                        name,
                        async () => {
                            throw new Error("call exception: out of gas");
                        },
                    ])
                )
            )
        );

    /** An hre whose multisig fails the first try of every read named in
     *  `failing` for each distinct argument list and answers the tries after. */
    const walletReadsFlakyHre = (...failing) => {
        const tried = new Set();
        return walletHre((contract) =>
            withReads(
                contract,
                Object.fromEntries(
                    failing.map((name) => [
                        name,
                        async (...args) => {
                            const key = `${name}:${args
                                .filter((arg) => typeof arg !== "object")
                                .join(",")}`;
                            if (!tried.has(key)) {
                                tried.add(key);
                                throw new Error("504 gateway timeout");
                            }
                            return contract[name](...args);
                        },
                    ])
                )
            )
        );
    };

    it("tries a failed read of the multisig again and goes on when the next try answers", async () => {
        await seatWallet([owner, second], 2);
        const [allow] = await plannedCalldata();
        const waitingId = await submitByHand(allow);
        const before = await count();
        let plan;
        const output = await captureConsole(async () => {
            plan = await lendingRoutes.runLendingRoutes(
                params(),
                walletReadsFlakyHre("transactionCount", "transactions")
            );
        });
        expect(output).to.include(
            `already waiting for confirmations as multisig transaction ${waitingId}`
        );
        expect(plan.submitted).to.have.length(pools.length);
        expect(await count()).to.equal(before + pools.length);
    });

    for (const failing of ["transactionCount", "transactions"]) {
        it(`refuses to send when ${failing} on the multisig fails, and points at --dry-run`, async () => {
            await seatWallet([owner, second], 2);
            await submitByHand("0xdeadbeef");
            const before = await count();
            const error = await rejection(
                lendingRoutes.runLendingRoutes(params(), walletReadFailsHre(failing))
            );
            expect(error, "an unreadable pending set must refuse").to.not.equal(null);
            expect(error.message).to.match(/pending transactions could not be read/);
            expect(error.message).to.include("out of gas");
            expect(error.message).to.include("--dry-run");
            expect(error.message).to.match(/Nothing was sent/);
            expect(await count()).to.equal(before);
            expect(await stub.topUpFeasible(LENDER)).to.equal(false);
        });
    }

    it("reads the multisig without its filtered pending views, which loop over the whole history in one call", async () => {
        await seatWallet([owner, second], 2);
        const [allow] = await plannedCalldata();
        const waitingId = await submitByHand(allow);
        const before = await count();
        let plan;
        const output = await captureConsole(async () => {
            plan = await lendingRoutes.runLendingRoutes(
                params(),
                walletReadFailsHre("getTransactionCount", "getTransactionIds")
            );
        });
        expect(output).to.include(
            `already waiting for confirmations as multisig transaction ${waitingId}`
        );
        expect(plan.submitted).to.have.length(pools.length);
        expect(await count()).to.equal(before + pools.length);
    });

    it("lists the multisig's waiting transactions in id order with their destination, value and data", async () => {
        await seatWallet([owner, second], 2);
        await submitByHand("0xdeadbeef");
        await (await multisig.connect(owner).submitTransaction(outsider.address, 0, "0x")).wait();
        await (await multisig.connect(second).confirmTransaction(1)).wait();
        await submitByHand("0xcafe");
        const waiting = await lendingRoutes.readPendingCalls(hre, multisig.address);
        expect(waiting.map((held) => held.id)).to.deep.equal(["0", "2"]);
        expect(waiting.map((held) => held.data)).to.deep.equal(["0xdeadbeef", "0xcafe"]);
        for (const held of waiting) {
            expect(held.destination).to.equal(stub.address);
            expect(held.value.isZero()).to.equal(true);
        }
    });

    it("warns instead of refusing on a dry run when the pending transactions cannot be read", async () => {
        await seatWallet([owner, second], 2);
        await submitByHand("0xdeadbeef");
        let plan;
        const output = await captureConsole(async () => {
            plan = await lendingRoutes.runLendingRoutes(
                params({ dryRun: true }),
                walletReadFailsHre("transactions")
            );
        });
        expect(plan.transactions).to.have.length(1 + pools.length);
        expect(output).to.match(/pending transactions could not be read/);
        expect(output).to.include("out of gas");
        expect(output).to.include("dry run: nothing was submitted");
    });

    /** Fail the `failing`-th queue call the task submits; every other one goes
     *  through the wallet as usual. Returns what was submitted before it. */
    const failingSubmit = async (failing) => {
        const original = recoveryTasks.submitQueueCall;
        let calls = 0;
        recoveryTasks.submitQueueCall = async (...args) => {
            calls += 1;
            if (calls === failing) throw new Error("the node refused the submission");
            return original(...args);
        };
        try {
            return await rejection(run());
        } finally {
            recoveryTasks.submitQueueCall = original;
        }
    };

    it("stops at a failed submission, reports which calls were submitted and which were not, and rethrows", async () => {
        await seatWallet([owner, second], 2);
        const planned = await plannedCalldata();
        const before = await count();
        let error;
        const output = await captureConsole(async () => {
            error = await failingSubmit(3);
        });

        expect(error, "the failure must be rethrown").to.not.equal(null);
        expect(error.message).to.equal("the node refused the submission");
        expect(await count()).to.equal(before + 2);

        const stored = await storedSince(before);
        const report = output.slice(output.indexOf("Stopped"));
        expect(report).to.match(/Stopped/);
        const submittedPart = report.slice(0, report.indexOf("Not submitted"));
        const notSubmittedPart = report.slice(report.indexOf("Not submitted"));
        for (const tx of stored) {
            expect(submittedPart).to.include(
                `multisig transaction ${tx.id} — ${lineFor(tx.data)}`
            );
        }
        for (const data of planned.slice(2)) {
            expect(notSubmittedPart).to.include(lineFor(data));
        }
        for (const data of planned.slice(0, 2)) {
            expect(notSubmittedPart).to.not.include(lineFor(data));
        }
        expect(report).to.match(/running this task again skips the submitted calls/i);
    });

    it("skips what a stopped run submitted when it is run again, and sends the rest", async () => {
        await seatWallet([owner, second], 2);
        const before = await count();
        await captureConsole(async () => {
            await failingSubmit(3);
        });
        expect(await count()).to.equal(before + 2);

        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });
        expect(plan.skipped.filter((skip) => skip.reason === "alreadyWaiting")).to.have.length(2);
        expect(output).to.include(
            `already waiting for confirmations as multisig transaction ${before}`
        );
        expect(output).to.include(
            `already waiting for confirmations as multisig transaction ${before + 1}`
        );
        expect(await count()).to.equal(before + 1 + pools.length);
    });

    it("reports a stop on the first submission as nothing submitted", async () => {
        const before = await count();
        let error;
        const output = await captureConsole(async () => {
            error = await failingSubmit(1);
        });
        expect(error).to.not.equal(null);
        expect(await count()).to.equal(before);
        expect(output).to.match(/Submitted before the failure: none/);
    });

    it("tells the co-signers to confirm the allow transaction first and to check it executed, and what a too-early confirmation leaves", async () => {
        await seatWallet([owner, second], 2);
        const before = await count();
        const output = await captureConsole(() => run());
        const allowId = before;
        expect(output).to.include(
            `The route transactions revert until the allow transaction (multisig transaction ${allowId}) has EXECUTED`
        );
        expect(output).to.match(
            /confirm it first and check it executed before confirming the rest/
        );
        expect(output).to.match(/records an execution failure in the multisig/);
        expect(output).to.match(/`executeTransaction`/);
        expect(output).to.include("perimeter:check-block --id <id>");
        expect(output).to.include("perimeter:route:show");
    });

    it("gives the same instruction when the allow call is still waiting from an earlier run", async () => {
        await seatWallet([owner, second], 2);
        const [allow] = await plannedCalldata();
        const allowId = await submitByHand(allow);
        const output = await captureConsole(() => run());
        expect(output).to.include(
            `The route transactions revert until the allow transaction (multisig transaction ${allowId}) has EXECUTED`
        );
        const listing = output.slice(output.indexOf("in the order to confirm them"));
        expect(listing).to.include(`multisig transaction ${allowId} (already waiting) — `);
    });

    it("gives no allow instruction when the surface already allows refund-to-pool", async () => {
        await seatWallet([owner, second], 2);
        await stub.setTopUpFeasible(LENDER, true);
        const before = await count();
        const output = await captureConsole(() => run());
        expect(await count()).to.equal(before + pools.length);
        expect(output).to.include("in the order to confirm them");
        expect(output).to.not.include("until the allow transaction");
        expect(output).to.not.include("executeTransaction");
    });

    it("skips a pool that already has an active top-up route and says so", async () => {
        const [held] = sortedPools();
        await stub.setRoute(true, LENDER, held.pool, held.asset, held.pool, true);
        let plan;
        const output = await captureConsole(async () => {
            plan = await dry();
        });
        expect(plan.transactions).to.have.length(pools.length);
        expect(plan.transactions.map((tx) => tx.pool).filter(Boolean)).to.not.include(held.pool);
        expect(plan.skipped).to.have.length(1);
        expect(plan.skipped[0].pool).to.equal(held.pool);
        expect(plan.skipped[0].reason).to.equal("topUpRouteActive");
        expect(output).to.include(
            `${held.symbol} pool ${held.pool} already has an active top-up route`
        );
    });

    it("does not send a call for a pool whose top-up route is already active", async () => {
        const [held] = sortedPools();
        await stub.setRoute(true, LENDER, held.pool, held.asset, held.pool, true);
        const before = await count();
        await run();
        const stored = await storedSince(before);
        expect(stored).to.have.length(pools.length);
        const routed = stored
            .filter((tx) => tx.data.startsWith(queueIface.getSighash("setRecoveryRoute")))
            .map((tx) => queueIface.decodeFunctionData("setRecoveryRoute", tx.data)[0].subProduct);
        expect(routed).to.not.include(held.pool);
    });

    it("still registers a pool whose earlier route on the same key was switched off", async () => {
        const [held] = sortedPools();
        await stub.setRoute(false, LENDER, held.pool, held.asset, held.pool, true);
        const plan = await dry();
        expect(plan.skipped).to.have.length(0);
        expect(plan.transactions.map((tx) => tx.pool)).to.include(held.pool);
    });

    it("leaves a pool out and warns when another active route already covers its provenance", async () => {
        const [held] = sortedPools();
        await stub.setRoute(true, LENDER, held.pool, held.asset, owner.address, false);
        let plan;
        const output = await captureConsole(async () => {
            plan = await dry();
        });
        expect(plan.transactions.map((tx) => tx.pool)).to.not.include(held.pool);
        expect(plan.skipped).to.have.length(1);
        expect(plan.skipped[0].reason).to.equal("otherRouteActive");
        expect(output).to.match(/another active route/);
        expect(output).to.match(/perimeter:route:remove/);
    });

    it("leaves the feasibility call out when the surface already allows refund-to-pool", async () => {
        await stub.setTopUpFeasible(LENDER, true);
        let plan;
        const output = await captureConsole(async () => {
            plan = await dry();
        });
        expect(plan.transactions.map((tx) => tx.kind)).to.deep.equal(
            pools.map(() => "setRecoveryRoute")
        );
        expect(output).to.include("Refund-to-pool is already allowed on lender withdrawals");
    });

    it("sends no allow call when the surface already allows refund-to-pool", async () => {
        await stub.setTopUpFeasible(LENDER, true);
        const before = await count();
        await run();
        const stored = await storedSince(before);
        expect(stored).to.have.length(pools.length);
        for (const tx of stored) {
            expect(tx.data.startsWith(queueIface.getSighash("setTopUpFeasible"))).to.equal(false);
        }
    });

    it("submits nothing and says so when every pool is routed and the surface allows it", async () => {
        await stub.setTopUpFeasible(LENDER, true);
        for (const entry of pools) {
            await stub.setRoute(true, LENDER, entry.pool, entry.asset, entry.pool, true);
        }
        const before = await count();
        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });
        expect(plan.transactions).to.have.length(0);
        expect(plan.skipped).to.have.length(pools.length);
        expect(output).to.include("nothing to submit: every pool has its route");
        expect(await count()).to.equal(before);
    });

    it("ignores a route registered on another surface", async () => {
        const [held] = sortedPools();
        await stub.setRoute(true, BORROWER, held.pool, held.asset, held.pool, true);
        const plan = await dry();
        expect(plan.skipped).to.have.length(0);
        expect(plan.transactions).to.have.length(1 + pools.length);
    });

    it("lists every pool when the protocol holds more than one page of them", async () => {
        for (let i = 0; i < 48; i++) {
            pools.push(await deployPool(`iP${i}`, `P${i}`));
        }
        expect(pools).to.have.length(51);
        const plan = await dry();
        expect(plan.transactions).to.have.length(1 + 51);
        expect(plan.transactions.slice(1).map((tx) => tx.pool)).to.deep.equal(
            sortedPools().map((entry) => entry.pool)
        );
    });

    it("refuses a pool whose own asset differs from the one the protocol records for it", async () => {
        const other = ethers.Wallet.createRandom().address;
        await protocol.setLoanPool(pools[1].pool, other);
        const before = await count();
        const error = await rejection(run());
        expect(error, "a pool with two different assets must refuse").to.not.equal(null);
        expect(error.message).to.include(pools[1].pool);
        expect(error.message).to.match(/escrows .* the protocol records/);
        expect(await count()).to.equal(before);
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
        const before = await count();
        const error = await rejection(run());
        expect(error).to.not.equal(null);
        expect(error.message).to.match(/needs Owner on the queue/);
        expect(await count()).to.equal(before);
    });

    it("reports a pool holding its top-up route and another active route as a conflict, naming the other route and its destination", async () => {
        const [held] = sortedPools();
        await stub.setTopUpFeasible(LENDER, true);
        for (const entry of pools) {
            await stub.setRoute(true, LENDER, entry.pool, entry.asset, entry.pool, true);
        }
        const elsewhere = ethers.Wallet.createRandom().address;
        await stub.setRoute(true, LENDER, held.pool, held.asset, elsewhere, false);
        const otherId = recovery.routeIdOf(LENDER, held.pool, held.asset, elsewhere);
        const topUpId = recovery.routeIdOf(LENDER, held.pool, held.asset, held.pool);
        let plan;
        const output = await captureConsole(async () => {
            plan = await dry();
        });
        expect(plan.transactions).to.have.length(0);
        const conflicts = plan.skipped.filter((skip) => skip.reason === "otherRouteActive");
        expect(conflicts).to.have.length(1);
        expect(conflicts[0].pool).to.equal(held.pool);
        expect(conflicts[0].routeIds).to.have.members([topUpId, otherId]);
        expect(plan.skipped.filter((skip) => skip.reason === "topUpRouteActive")).to.have.length(
            pools.length - 1
        );
        expect(output).to.include(otherId);
        expect(output).to.include(elsewhere);
        expect(output).to.match(/`perimeter:refund --to pool` will refuse to choose/);
        expect(output).to.match(/perimeter:route:remove/);
        expect(output).to.not.include("every pool has its route");
        expect(output).to.match(/nothing to register, but 1 pool has conflicting active routes/);
    });

    it("says a conflict stands at the end of a run that still has routes to submit", async () => {
        const [held] = sortedPools();
        await stub.setRoute(true, LENDER, held.pool, held.asset, held.pool, true);
        await stub.setRoute(
            true,
            LENDER,
            held.pool,
            held.asset,
            ethers.Wallet.createRandom().address,
            false
        );
        let plan;
        const output = await captureConsole(async () => {
            plan = await run();
        });
        expect(plan.submitted).to.have.length(pools.length);
        expect(output).to.match(/1 pool has conflicting active routes/);
        expect(output).to.not.include("every pool has its route");
    });

    it("reads the pools and the routes at the block it records, not at a later one", async () => {
        const block = await ethers.provider.getBlockNumber();
        const added = await deployPool("iNEW", "NEW");
        await stub.setTopUpFeasible(LENDER, true);
        await stub.setRoute(true, LENDER, pools[0].pool, pools[0].asset, pools[0].pool, true);
        const plan = await lendingRoutes.prepareLendingRoutes(hre, {
            queueAddress: stub.address,
            live: await recoveryTasks.queueAt(hre, stub.address),
            protocolAddress: protocol.address,
            multisigAddress: multisig.address,
            blockNumber: block,
        });
        expect(plan.readAtBlock).to.equal(block);
        expect(plan.poolsListed).to.equal(pools.length);
        expect(plan.transactions.map((tx) => tx.pool).filter(Boolean)).to.not.include(added.pool);
        expect(plan.skipped).to.have.length(0);
        expect(plan.refundToPoolAllowed).to.equal(false);
        expect(plan.transactions).to.have.length(1 + pools.length);
    });

    it("refuses a protocol list that names one pool twice", async () => {
        await protocol.listAgain(pools[0].pool);
        const error = await rejection(run());
        expect(error).to.not.equal(null);
        expect(error.message).to.include(pools[0].pool);
        expect(error.message).to.match(/lists .* twice/);
    });

    it("lists the pools without a block argument, at the head", async () => {
        const listed = await lendingRoutes.readLendingPools(hre, protocol.address);
        expect(listed.map((entry) => entry.pool)).to.deep.equal(
            sortedPools().map((entry) => entry.pool)
        );
        expect(listed.map((entry) => entry.asset)).to.deep.equal(
            sortedPools().map((entry) => entry.asset)
        );
    });
});
