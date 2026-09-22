/**
 * `perimeter:route:set`, `perimeter:route:remove` and `perimeter:route:show`:
 * what they refuse, what they print, and the exact calldata they submit.
 *
 * The queue address here is any address carrying code — these tests are about
 * the task's own validation, its preview and its refusals, all of which run
 * before anything reaches a queue. The levers' behaviour against a real queue
 * is covered on a fork by tests-onchain/perimeter/qa.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/RecoveryTasks.test.js
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;

const recovery = require("../../hardhat/tasks/perimeter/recovery");
const policy = require("../../hardhat/tasks/perimeter/policy");

const MockExitFeeController = artifacts.require("MockExitFeeController");

const LENDER = policy.SURFACES.PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW;

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

const withKnownQueue = async (address, fn) => {
    const prior = await deployments.getOrNull("ExitDelayQueue");
    await deployments.save("ExitDelayQueue", { address, abi: [] });
    try {
        await fn();
    } finally {
        if (prior) await deployments.save("ExitDelayQueue", prior);
        else await deployments.delete("ExitDelayQueue");
    }
};

describe("perimeter:route:set", () => {
    let queueAddress;
    let wrongAddress;
    let multisig;
    let owner;
    let pool;
    let token;

    before(async () => {
        [owner] = await ethers.getSigners();
        queueAddress = (await MockExitFeeController.new()).address;
        wrongAddress = (await MockExitFeeController.new()).address;
        pool = (await MockExitFeeController.new()).address;
        token = (await MockExitFeeController.new()).address;
        const MultiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");
        multisig = await MultiSigWalletFactory.deploy([owner.address], 1);
        await multisig.deployed();
    });

    const run = (params) =>
        hre.run("perimeter:route:set", {
            queue: queueAddress,
            multisig: multisig.address,
            signer: owner.address,
            dryRun: true,
            ...params,
        });

    it("refuses a queue address that does not match the known deployment", async () => {
        await withKnownQueue(queueAddress, async () => {
            let raised = null;
            try {
                await hre.run("perimeter:route:set", {
                    queue: wrongAddress,
                    multisig: multisig.address,
                    signer: owner.address,
                    dryRun: true,
                    surface: "lender_withdraw",
                    mode: "address",
                    subproduct: pool,
                    token,
                    destination: owner.address,
                });
            } catch (error) {
                raised = error;
            }
            expect(raised, "a mismatched queue must refuse, not submit").to.not.equal(null);
            expect(raised.message).to.match(/does not match the known ExitDelayQueue/);
        });
    });

    it("refuses a mode that is neither topup nor address", async () => {
        let raised = null;
        try {
            await run({
                surface: "lender_withdraw",
                mode: "pool",
                subproduct: pool,
                token,
                destination: owner.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/--mode must be 'topup' or 'address'/);
    });

    it("refuses a top-up route whose destination is not the pool itself", async () => {
        let raised = null;
        try {
            await run({
                surface: "lender_withdraw",
                mode: "topup",
                subproduct: pool,
                token,
                destination: owner.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/a top-up route pays its own pool/);
    });

    it("refuses an unrecognised surface, listing the ones it knows", async () => {
        let raised = null;
        try {
            await run({
                surface: "margin_trade",
                mode: "address",
                subproduct: pool,
                token,
                destination: owner.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.include(
            "Expected one of:\n  " + Object.keys(policy.SURFACES).join("\n  ")
        );
    });

    it("prints the derived route id, the decoded call and its meaning, and submits nothing on --dry-run", async () => {
        const before = (await multisig.transactionCount()).toString();
        const output = await captureConsole(() =>
            run({
                surface: "lender_withdraw",
                mode: "address",
                subproduct: pool,
                token,
                destination: owner.address,
            })
        );
        const routeId = recovery.routeIdOf(LENDER, pool, token, owner.address);
        expect(output).to.include(`Route id:   ${routeId}`);
        expect(output).to.include("setRecoveryRoute((bool,bytes32,address,address,address,bool))");
        expect(output).to.include(
            `registers a recovery route on lender withdrawals that sends the escrowed ${token} to ${owner.address}`
        );
        expect((await multisig.transactionCount()).toString()).to.equal(before);
    });

    it("submits exactly the calldata recovery.js builds, to the queue, through the multisig", async () => {
        await hre.run("perimeter:route:set", {
            queue: queueAddress,
            multisig: multisig.address,
            signer: owner.address,
            surface: "lender_withdraw",
            mode: "address",
            subproduct: pool,
            token,
            destination: owner.address,
        });
        const txId = (await multisig.transactionCount()).sub(1);
        const tx = await multisig.transactions(txId);
        expect(tx.destination.toLowerCase()).to.equal(queueAddress.toLowerCase());
        expect(tx.value.toString()).to.equal("0");
        expect(tx.data).to.equal(
            recovery.buildRecoveryCall("setRecoveryRoute", {
                active: true,
                surfaceId: LENDER,
                subProduct: pool,
                token,
                destination: owner.address,
                topUpPool: false,
            }).data
        );
    });

    it("submits the feasibility flag FIRST, as its own transaction, when --set-feasible is given with a top-up route", async () => {
        const before = await multisig.transactionCount();
        await hre.run("perimeter:route:set", {
            queue: queueAddress,
            multisig: multisig.address,
            signer: owner.address,
            surface: "lender_withdraw",
            mode: "topup",
            subproduct: pool,
            token,
            destination: pool,
            setFeasible: true,
        });
        const after = await multisig.transactionCount();
        expect(after.sub(before).toString()).to.equal("2");
        const first = await multisig.transactions(before);
        const second = await multisig.transactions(before.add(1));
        expect(first.data).to.equal(
            recovery.buildRecoveryCall("setTopUpFeasible", {
                surfaceId: LENDER,
                feasible: true,
            }).data
        );
        expect(second.data).to.equal(
            recovery.buildRecoveryCall("setRecoveryRoute", {
                active: true,
                surfaceId: LENDER,
                subProduct: pool,
                token,
                destination: pool,
                topUpPool: true,
            }).data
        );
    });

    it("says out loud that the feasibility flag must execute before the route does", async () => {
        const output = await captureConsole(() =>
            run({
                surface: "lender_withdraw",
                mode: "topup",
                subproduct: pool,
                token,
                destination: pool,
                setFeasible: true,
            })
        );
        expect(output).to.include(
            "The route call reverts until the feasibility call has EXECUTED — confirm them in order"
        );
    });
});

describe("perimeter:route:remove", () => {
    it("refuses a route id that is not 32 bytes", async () => {
        const [owner] = await ethers.getSigners();
        const queueAddress = (await MockExitFeeController.new()).address;
        const MultiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");
        const multisig = await MultiSigWalletFactory.deploy([owner.address], 1);
        await multisig.deployed();
        let raised = null;
        try {
            await hre.run("perimeter:route:remove", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                route: "0x1234",
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/--route must be a 32-byte route id/);
    });
});

describe("perimeter:refund", () => {
    // A minimal queue stand-in: enough of the queue's reads for the task's own
    // eligibility and route checks, and nothing else. The real predicates are
    // enforced on chain and exercised on a fork.
    let queueAddress;
    let multisig;
    let owner;
    let stub;

    before(async () => {
        [owner] = await ethers.getSigners();
        const StubFactory = await ethers.getContractFactory("MockRecoveryQueue");
        stub = await StubFactory.deploy();
        await stub.deployed();
        queueAddress = stub.address;
        const MultiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");
        multisig = await MultiSigWalletFactory.deploy([owner.address], 1);
        await multisig.deployed();
    });

    it("refuses a batch with no ids", async () => {
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "",
                to: owner.address,
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/--ids names no withdrawal/);
    });

    it("refuses to build a pool refund for a request whose only blacklisted party is its receiver", async () => {
        await stub.setRequest(
            1,
            owner.address,
            owner.address,
            stub.address,
            LENDER,
            stub.address,
            stub.address,
            1
        );
        await stub.setBlockState(stub.address, 2);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "1",
                to: "pool",
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(
            /a receiver-only blacklist never authorises a refund to the pool/
        );
    });

    it("refuses either leg for a request whose only blocked party is frozen", async () => {
        await stub.setRequest(
            2,
            owner.address,
            owner.address,
            stub.address,
            LENDER,
            stub.address,
            stub.address,
            1
        );
        await stub.setBlockState(stub.address, 1);
        for (const to of ["pool", owner.address]) {
            let raised = null;
            try {
                await hre.run("perimeter:refund", {
                    queue: queueAddress,
                    multisig: multisig.address,
                    signer: owner.address,
                    ids: "2",
                    to,
                    dryRun: true,
                });
            } catch (error) {
                raised = error;
            }
            expect(raised, `--to ${to}`).to.not.equal(null);
            expect(raised.message).to.match(/no blacklisted party/);
        }
    });

    it("refuses a pool refund when no active route matches the requests' own provenance", async () => {
        await stub.setRequest(
            3,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            stub.address,
            1
        );
        await stub.setBlockState(stub.address, 2);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "3",
                to: "pool",
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/no active recovery route matches/);
    });

    it("refuses a batch that mixes two surfaces, because a route covers one", async () => {
        const BORROWER = policy.SURFACES.PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW;
        await stub.setRequest(
            4,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            stub.address,
            1
        );
        await stub.setRequest(
            5,
            stub.address,
            owner.address,
            owner.address,
            BORROWER,
            stub.address,
            stub.address,
            1
        );
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "4,5",
                to: "pool",
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/a route covers one surface, not several/);
    });

    it("submits resolveByOwner with exactly the ids and destination given, and prints what it does", async () => {
        await stub.setRequest(
            6,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            stub.address,
            1
        );
        await stub.setBlockState(stub.address, 2);
        const output = await captureConsole(() =>
            hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "6",
                to: owner.address,
            })
        );
        expect(output).to.include(
            `sends withdrawal 6 to ${owner.address}, away from its receiver`
        );
        const txId = (await multisig.transactionCount()).sub(1);
        const tx = await multisig.transactions(txId);
        expect(tx.destination.toLowerCase()).to.equal(queueAddress.toLowerCase());
        expect(tx.data).to.equal(
            recovery.buildRecoveryCall("resolveByOwner", {
                ids: [6],
                destination: owner.address,
            }).data
        );
    });

    it("prints the status each id must read afterwards, so a co-signer knows what to check", async () => {
        await stub.setRequest(
            7,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            stub.address,
            1
        );
        await stub.setBlockState(stub.address, 2);
        const output = await captureConsole(() =>
            hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "7",
                to: owner.address,
                dryRun: true,
            })
        );
        expect(output).to.include(
            "Check afterwards: withdrawal 7 reads ResolvedByOwner (status 4), and " +
                `${owner.address} holds`
        );
    });
});
