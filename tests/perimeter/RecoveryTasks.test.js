/**
 * `perimeter:route:show`, `perimeter:route:set`, `perimeter:route:remove` and
 * `perimeter:refund`: what they refuse, what they print, the exact calldata they
 * submit, and what they read back afterwards.
 *
 * The queue here is either any address carrying code, where the test is about
 * validation that runs before anything reaches a queue, or a stand-in that
 * records what each call leaves behind, where the test is about the read-back.
 * The levers' behaviour against the real queue — every predicate, every revert
 * — is covered on a fork by tests-onchain/perimeter/qa.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/RecoveryTasks.test.js
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;

const recovery = require("../../hardhat/tasks/perimeter/recovery");
const recoveryTasks = require("../../hardhat/tasks/perimeter/recoveryTasks");
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

    it("refuses a top-up route on a surface that does not allow refund-to-pool yet", async () => {
        let raised = null;
        try {
            await run({
                surface: "lender_withdraw",
                mode: "topup",
                subproduct: pool,
                token,
                destination: pool,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/refund-to-pool is not allowed on lender withdrawals yet/);
        expect(raised.message).to.match(/--set-feasible/);
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
                setFeasible: true,
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

    it("warns and proceeds when the queue does not say who its Owner is", async () => {
        const output = await captureConsole(() =>
            run({
                surface: "lender_withdraw",
                mode: "address",
                subproduct: pool,
                token,
                destination: owner.address,
            })
        );
        expect(output).to.include(
            "this call needs Owner on the queue, and the queue's owner() could not be read"
        );
    });

    it("registers an address-mode route on a surface whose escrow is native RBTC, given --token 0x0", async () => {
        const BORROWER = policy.SURFACES.PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW;
        const output = await captureConsole(() =>
            run({
                surface: "borrower_withdraw",
                mode: "address",
                subproduct: pool,
                token: "0x0",
                destination: owner.address,
            })
        );
        expect(output).to.include(
            `Route id:   ${recovery.routeIdOf(
                BORROWER,
                pool,
                ethers.constants.AddressZero,
                owner.address
            )}`
        );
        expect(output).to.include(
            `sends the escrowed ${ethers.constants.AddressZero} to ${owner.address}`
        );
    });

    it("submits exactly the calldata recovery.js builds for a native-RBTC address-mode route, given --token 0x0", async () => {
        const BORROWER = policy.SURFACES.PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW;
        await hre.run("perimeter:route:set", {
            queue: queueAddress,
            multisig: multisig.address,
            signer: owner.address,
            surface: "borrower_withdraw",
            mode: "address",
            subproduct: pool,
            token: "0x0",
            destination: owner.address,
        });
        const txId = (await multisig.transactionCount()).sub(1);
        const tx = await multisig.transactions(txId);
        expect(tx.destination.toLowerCase()).to.equal(queueAddress.toLowerCase());
        expect(tx.value.toString()).to.equal("0");
        expect(tx.data).to.equal(
            recovery.buildRecoveryCall("setRecoveryRoute", {
                active: true,
                surfaceId: BORROWER,
                subProduct: pool,
                token: ethers.constants.AddressZero,
                destination: owner.address,
                topUpPool: false,
            }).data
        );
    });

    it("refuses a --token that is neither an address nor the native shorthand, naming the task", async () => {
        let raised = null;
        try {
            await run({
                surface: "lender_withdraw",
                mode: "address",
                subproduct: pool,
                token: "iXUSD",
                destination: owner.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.equal(
            "perimeter:route:set: --token 'iXUSD' is not an asset address — pass the asset's " +
                "own address, or 0x0 for a surface that escrows native RBTC"
        );
    });

    it("refuses a --subproduct that is not an address, naming the task", async () => {
        let raised = null;
        try {
            await run({
                surface: "lender_withdraw",
                mode: "address",
                subproduct: "iXUSD",
                token,
                destination: owner.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(
            /perimeter:route:set: --subproduct 'iXUSD' is not a pool address/
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

describe("perimeter:route:show", () => {
    let stub;
    let pool;
    let asset;

    before(async () => {
        stub = await (await ethers.getContractFactory("MockRecoveryQueue")).deploy();
        await stub.deployed();
        pool = (await MockExitFeeController.new()).address;
        asset = (await MockExitFeeController.new()).address;
    });

    it("warns that a pool refund has nothing to walk while no route is registered", async () => {
        const output = await captureConsole(() =>
            hre.run("perimeter:route:show", { queue: stub.address })
        );
        expect(output).to.include("No recovery route is registered");
        expect(output).to.include(
            "Top-up on PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW: not allowed"
        );
    });

    it("lists a registered route with its surface, pool, asset, destination and both flags", async () => {
        await stub.setRoute(true, LENDER, pool, asset, pool, true);
        await stub.setTopUpFeasible(LENDER, true);
        const routeId = recovery.routeIdOf(LENDER, pool, asset, pool);
        const output = await captureConsole(() =>
            hre.run("perimeter:route:show", { queue: stub.address })
        );
        expect(output).to.include("Top-up on PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW: allowed");
        expect(output).to.include(`Route ${routeId}`);
        expect(output).to.include("active:      true");
        expect(output).to.include("surface:     lender withdrawals");
        expect(output).to.include(`pool:        ${pool}`);
        expect(output).to.include(`asset:       ${asset}`);
        expect(output).to.include(`destination: ${pool}`);
        expect(output).to.include("tops up the pool: true");
    });

    it("carries on past a surface whose feasibility flag does not answer", async () => {
        const BORROWER = policy.SURFACES.PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW;
        await stub.setFeasibilityUnreadable(BORROWER, true);
        let output;
        try {
            output = await captureConsole(() =>
                hre.run("perimeter:route:show", { queue: stub.address })
            );
        } finally {
            await stub.setFeasibilityUnreadable(BORROWER, false);
        }
        expect(output).to.include(
            "Top-up on PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW: feasibility not read"
        );
        expect(output).to.include(`Route ${recovery.routeIdOf(LENDER, pool, asset, pool)}`);
    });

    it("warns when a stored route's own fields do not hash to the id it is stored under", async () => {
        const wrongId = `0x${"33".repeat(32)}`;
        await stub.forceRoute(wrongId, true, LENDER, pool, asset, pool, false);
        const output = await captureConsole(() =>
            hre.run("perimeter:route:show", { queue: stub.address })
        );
        expect(output).to.include(
            `this route is stored under ${wrongId} but its own fields hash to ` +
                `${recovery.routeIdOf(LENDER, pool, asset, pool)}`
        );
    });

    it("says it is using the deployed queue, rather than claiming a match, when --queue is omitted", async () => {
        await withKnownQueue(stub.address, async () => {
            const output = await captureConsole(() => hre.run("perimeter:route:show", {}));
            expect(output).to.include(
                `perimeter:route:show: using the deployed ExitDelayQueue ${stub.address}`
            );
            expect(output).to.not.include("matches the deployed ExitDelayQueue");
        });
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

    describe("against a queue holding routes", () => {
        let stub;
        let multisig;
        let owner;
        let pool;
        let asset;
        let routeId;

        before(async () => {
            [owner] = await ethers.getSigners();
            stub = await (await ethers.getContractFactory("MockRecoveryQueue")).deploy();
            await stub.deployed();
            const MultiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");
            multisig = await MultiSigWalletFactory.deploy([owner.address], 1);
            await multisig.deployed();
            await stub.setRoles(multisig.address, multisig.address);
            pool = (await MockExitFeeController.new()).address;
            asset = (await MockExitFeeController.new()).address;
            routeId = recovery.routeIdOf(LENDER, pool, asset, owner.address);
            await stub.setRoute(true, LENDER, pool, asset, owner.address, false);
        });

        it("warns that removing an id this queue does not hold changes nothing", async () => {
            const unknown = `0x${"44".repeat(32)}`;
            const output = await captureConsole(() =>
                hre.run("perimeter:route:remove", {
                    queue: stub.address,
                    multisig: multisig.address,
                    signer: owner.address,
                    route: unknown,
                    dryRun: true,
                })
            );
            expect(output).to.include(`${unknown} is not an active route on this queue`);
        });

        it("names the destination and surface it removes, and submits exactly that calldata", async () => {
            const output = await captureConsole(() =>
                hre.run("perimeter:route:remove", {
                    queue: stub.address,
                    multisig: multisig.address,
                    signer: owner.address,
                    route: routeId,
                })
            );
            expect(output).to.include(
                `Removing the route to ${owner.address} on lender withdrawals`
            );
            const txId = (await multisig.transactionCount()).sub(1);
            const tx = await multisig.transactions(txId);
            expect(tx.destination.toLowerCase()).to.equal(stub.address.toLowerCase());
            expect(tx.data).to.equal(
                recovery.buildRecoveryCall("removeRecoveryRoute", { routeId }).data
            );
            expect(output).to.include(`applied: the route ${routeId} is no longer active`);
            expect((await stub.getRecoveryRoute(routeId)).active).to.equal(false);
        });

        it("refuses to remove a route from a wallet the queue does not call Owner", async () => {
            const stranger = (await MockExitFeeController.new()).address;
            await stub.setRoles(stranger, stranger);
            let raised = null;
            try {
                await hre.run("perimeter:route:remove", {
                    queue: stub.address,
                    multisig: multisig.address,
                    signer: owner.address,
                    route: routeId,
                    dryRun: true,
                });
            } catch (error) {
                raised = error;
            }
            await stub.setRoles(multisig.address, multisig.address);
            expect(raised).to.not.equal(null);
            expect(raised.message).to.match(/this call needs Owner on the queue/);
        });
    });
});

describe("perimeter:route:set against a queue holding withdrawals", () => {
    let stub;
    let multisig;
    let owner;
    let pool;
    let asset;

    before(async () => {
        [owner] = await ethers.getSigners();
        stub = await (await ethers.getContractFactory("MockRecoveryQueue")).deploy();
        await stub.deployed();
        const MultiSigWalletFactory = await ethers.getContractFactory("MultiSigWallet");
        multisig = await MultiSigWalletFactory.deploy([owner.address], 1);
        await multisig.deployed();
        await stub.setRoles(multisig.address, multisig.address);
        pool = (await MockExitFeeController.new()).address;
        asset = (await MockExitFeeController.new()).address;
        await stub.setRequest(
            1,
            owner.address,
            owner.address,
            owner.address,
            LENDER,
            pool,
            asset,
            1
        );
    });

    const run = (params) =>
        hre.run("perimeter:route:set", {
            queue: stub.address,
            multisig: multisig.address,
            signer: owner.address,
            dryRun: true,
            ...params,
        });

    it("reads surface, pool and asset off a real withdrawal with --from-request", async () => {
        const output = await captureConsole(() =>
            run({
                surface: "lender_withdraw",
                mode: "address",
                fromRequest: "1",
                destination: owner.address,
            })
        );
        expect(output).to.include(
            `Provenance read from withdrawal 1: surface lender withdrawals, pool ${pool}, ` +
                `asset ${asset}`
        );
        expect(output).to.include(
            `Route id:   ${recovery.routeIdOf(LENDER, pool, asset, owner.address)}`
        );
    });

    it("refuses when --surface disagrees with the withdrawal --from-request names", async () => {
        let raised = null;
        try {
            await run({
                surface: "zero_withdraw_coll",
                mode: "address",
                fromRequest: "1",
                destination: owner.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(
            /--surface says PERIMETER_SURFACE_ZERO_WITHDRAW_COLL but withdrawal 1 is on lender withdrawals/
        );
    });

    it("refuses a withdrawal id the queue does not hold", async () => {
        let raised = null;
        try {
            await run({
                surface: "lender_withdraw",
                mode: "address",
                fromRequest: "77",
                destination: owner.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/the queue holds no withdrawal 77/);
    });

    it("refuses without --subproduct and --token when no withdrawal is named", async () => {
        let raised = null;
        try {
            await run({ surface: "lender_withdraw", mode: "address", destination: owner.address });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(
            /pass --subproduct and --token, or --from-request <id> to read both off a real withdrawal/
        );
    });

    it("submits the route alone when the surface already allows refund-to-pool", async () => {
        await stub.setTopUpFeasible(LENDER, true);
        const before = await multisig.transactionCount();
        await hre.run("perimeter:route:set", {
            queue: stub.address,
            multisig: multisig.address,
            signer: owner.address,
            surface: "lender_withdraw",
            mode: "topup",
            subproduct: pool,
            token: asset,
            destination: pool,
            setFeasible: true,
        });
        const after = await multisig.transactionCount();
        expect(after.sub(before).toString()).to.equal("1");
        expect(
            (await stub.getRecoveryRoute(recovery.routeIdOf(LENDER, pool, asset, pool))).topUpPool
        ).to.equal(true);
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
        await stub.setRoles(multisig.address, multisig.address);
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

    it("refuses a withdrawal id the queue does not hold", async () => {
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "404",
                to: owner.address,
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/the queue holds no withdrawal 404/);
    });

    it("refuses a withdrawal that has already settled, naming the status it reads", async () => {
        await stub.setRequest(
            40,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            stub.address,
            2
        );
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "40",
                to: owner.address,
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(
            /withdrawal 40 is Executed, not Queued — it has already settled/
        );
    });

    it("submits nothing on --dry-run", async () => {
        await stub.setRequest(
            41,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            (await MockExitFeeController.new()).address,
            1
        );
        await stub.setBlockState(stub.address, 2);
        const before = (await multisig.transactionCount()).toString();
        await hre.run("perimeter:refund", {
            queue: queueAddress,
            multisig: multisig.address,
            signer: owner.address,
            ids: "41",
            to: owner.address,
            dryRun: true,
        });
        expect((await multisig.transactionCount()).toString()).to.equal(before);
        expect(Number((await stub.getRequest(41)).status)).to.equal(1);
    });

    it("refuses a batch that names the same withdrawal twice, before anything is submitted", async () => {
        const before = (await multisig.transactionCount()).toString();
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "6,6",
                to: owner.address,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/withdrawal 6 is named twice/);
        expect((await multisig.transactionCount()).toString()).to.equal(before);
    });

    it("refuses a batch whose withdrawals escrow two different assets, on either leg", async () => {
        const assetA = (await MockExitFeeController.new()).address;
        const assetB = (await MockExitFeeController.new()).address;
        await stub.setRequest(
            12,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            assetA,
            1
        );
        await stub.setRequest(
            13,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            assetB,
            1
        );
        await stub.setBlockState(stub.address, 2);
        for (const to of ["pool", owner.address]) {
            let raised = null;
            try {
                await hre.run("perimeter:refund", {
                    queue: queueAddress,
                    multisig: multisig.address,
                    signer: owner.address,
                    ids: "12,13",
                    to,
                    dryRun: true,
                });
            } catch (error) {
                raised = error;
            }
            expect(raised, `--to ${to}`).to.not.equal(null);
            expect(raised.message).to.match(/cannot mix requests holding two assets/);
            expect(raised.message).to.include(assetA);
            expect(raised.message).to.include(assetB);
        }
    });

    it("refuses a pool refund whose withdrawals come from two different pools, naming both", async () => {
        const poolA = (await MockExitFeeController.new()).address;
        const poolB = (await MockExitFeeController.new()).address;
        const asset = (await MockExitFeeController.new()).address;
        await stub.setRequest(
            14,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            poolA,
            asset,
            1
        );
        await stub.setRequest(
            15,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            poolB,
            asset,
            1
        );
        await stub.setBlockState(stub.address, 2);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "14,15",
                to: "pool",
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/a route covers one pool, not several/);
        expect(raised.message).to.include(poolA);
        expect(raised.message).to.include(poolB);
    });

    it("refuses a pool refund whose only matching active route pays an address instead of the pool", async () => {
        const pool = (await MockExitFeeController.new()).address;
        const asset = (await MockExitFeeController.new()).address;
        const elsewhere = (await MockExitFeeController.new()).address;
        await stub.setRequest(
            20,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            pool,
            asset,
            1
        );
        await stub.setBlockState(stub.address, 2);
        await stub.setRoute(true, LENDER, pool, asset, elsewhere, false);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "20",
                to: "pool",
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.include(recovery.routeIdOf(LENDER, pool, asset, elsewhere));
        expect(raised.message).to.include(elsewhere);
        expect(raised.message).to.match(/does not top up the pool/);
    });

    it("refuses a pool refund when two active routes match, naming both rather than picking one", async () => {
        const pool = (await MockExitFeeController.new()).address;
        const asset = (await MockExitFeeController.new()).address;
        const treasury = (await MockExitFeeController.new()).address;
        await stub.setRequest(
            21,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            pool,
            asset,
            1
        );
        await stub.setBlockState(stub.address, 2);
        await stub.setRoute(true, LENDER, pool, asset, pool, true);
        await stub.setRoute(true, LENDER, pool, asset, treasury, false);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "21",
                to: "pool",
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/more than one active recovery route matches/);
        expect(raised.message).to.include(recovery.routeIdOf(LENDER, pool, asset, pool));
        expect(raised.message).to.include(recovery.routeIdOf(LENDER, pool, asset, treasury));
        expect(raised.message).to.include(treasury);
    });

    it("submits resolveToProtocol along the one top-up route that matches, and names where it sends", async () => {
        const pool = (await MockExitFeeController.new()).address;
        const asset = (await MockExitFeeController.new()).address;
        await stub.setRequest(
            22,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            pool,
            asset,
            1
        );
        await stub.setBlockState(stub.address, 2);
        await stub.setRoute(true, LENDER, pool, asset, pool, true);
        const routeId = recovery.routeIdOf(LENDER, pool, asset, pool);
        const output = await captureConsole(() =>
            hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "22",
                to: "pool",
            })
        );
        expect(output).to.include(`Route:      ${routeId}`);
        expect(output).to.include(`destination:      ${pool}`);
        expect(output).to.include("tops up the pool: true");
        const txId = (await multisig.transactionCount()).sub(1);
        const tx = await multisig.transactions(txId);
        expect(tx.destination.toLowerCase()).to.equal(queueAddress.toLowerCase());
        expect(tx.value.toString()).to.equal("0");
        expect(tx.data).to.equal(
            recovery.buildRecoveryCall("resolveToProtocol", { ids: [22], routeId }).data
        );
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

    it("refuses the queue's own address as a refund destination, before anything is built", async () => {
        const before = (await multisig.transactionCount()).toString();
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "6",
                to: queueAddress,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/refund destination: must not be the queue itself/);
        expect((await multisig.transactionCount()).toString()).to.equal(before);
    });

    it("refuses the zero address as a refund destination", async () => {
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "6",
                to: ethers.constants.AddressZero,
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/refund destination: must not be the zero address/);
    });

    it("refuses WRBTC as a refund destination, because an unwrap payout would be swallowed", async () => {
        const wrbtc = (await MockExitFeeController.new()).address;
        await stub.setWrbtc(wrbtc);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "6",
                to: wrbtc,
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        await stub.setWrbtc(ethers.constants.AddressZero);
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/refund destination: must not be WRBTC/);
    });

    it("refuses a refund destination that is an asset one of the withdrawals escrowed", async () => {
        const asset = (await MockExitFeeController.new()).address;
        await stub.setRequest(
            8,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            asset,
            1
        );
        await stub.setBlockState(stub.address, 2);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "8",
                to: asset,
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        expect(raised).to.not.equal(null);
        expect(raised.message).to.equal(
            `refund destination: must not be ${asset}, the asset withdrawal 8 escrowed`
        );
    });

    it("says which role the call needs and that the multisig holds it", async () => {
        await stub.setRequest(
            24,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            (await MockExitFeeController.new()).address,
            1
        );
        await stub.setBlockState(stub.address, 2);
        const output = await captureConsole(() =>
            hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "24",
                to: owner.address,
                dryRun: true,
            })
        );
        expect(output).to.include(`Role:       needs Owner; ${multisig.address} holds Owner`);
    });

    it("refuses the owner's leg when the multisig holds only Admin on the queue", async () => {
        await stub.setRoles(multisig.address, owner.address);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "24",
                to: owner.address,
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        await stub.setRoles(multisig.address, multisig.address);
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/this call needs Owner on the queue/);
        expect(raised.message).to.match(/OwnableUnauthorizedAccount/);
    });

    it("prints Admin as the role held for the pool leg's preflight when the multisig holds only Admin (proves the preflight's own text; the stand-in queue enforces no role check to confirm the leg would actually be accepted)", async () => {
        const pool = (await MockExitFeeController.new()).address;
        const asset = (await MockExitFeeController.new()).address;
        await stub.setRequest(
            23,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            pool,
            asset,
            1
        );
        await stub.setBlockState(stub.address, 2);
        await stub.setRoute(true, LENDER, pool, asset, pool, true);
        await stub.setRoles(multisig.address, owner.address);
        let output;
        try {
            output = await captureConsole(() =>
                hre.run("perimeter:refund", {
                    queue: queueAddress,
                    multisig: multisig.address,
                    signer: owner.address,
                    ids: "23",
                    to: "pool",
                    dryRun: true,
                })
            );
        } finally {
            await stub.setRoles(multisig.address, multisig.address);
        }
        expect(output).to.include(
            `Role:       needs Admin or Owner; ${multisig.address} holds Admin`
        );
    });

    it("refuses the pool leg when the multisig holds neither role, naming both holders", async () => {
        const stranger = (await MockExitFeeController.new()).address;
        await stub.setRoles(stranger, stranger);
        let raised = null;
        try {
            await hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "23",
                to: "pool",
                dryRun: true,
            });
        } catch (error) {
            raised = error;
        }
        await stub.setRoles(multisig.address, multisig.address);
        expect(raised).to.not.equal(null);
        expect(raised.message).to.match(/this call needs Admin or Owner on the queue/);
        expect(raised.message).to.include(`Owner is ${stranger} and Admin is ${stranger}`);
        expect(raised.message).to.match(/NotAdminOrOwner/);
    });

    it("reads the queue back when the wallet executed the refund at once, and says it applied", async () => {
        await stub.setRequest(
            30,
            stub.address,
            owner.address,
            owner.address,
            LENDER,
            stub.address,
            (await MockExitFeeController.new()).address,
            1
        );
        await stub.setBlockState(stub.address, 2);
        const output = await captureConsole(() =>
            hre.run("perimeter:refund", {
                queue: queueAddress,
                multisig: multisig.address,
                signer: owner.address,
                ids: "30",
                to: owner.address,
            })
        );
        expect(output).to.include(
            "applied: withdrawal 30 reads ResolvedByOwner, and no longer sits in the active " +
                "list of any party to it"
        );
        expect(Number((await stub.getRequest(30)).status)).to.equal(4);
    });

    it("says executed but not verified when the queue did not end up where the call meant to", async () => {
        const inert = await (await ethers.getContractFactory("MockRecoveryQueue")).deploy();
        await inert.deployed();
        await inert.setRoles(multisig.address, multisig.address);
        await inert.setRequest(
            31,
            inert.address,
            owner.address,
            owner.address,
            LENDER,
            inert.address,
            (await MockExitFeeController.new()).address,
            1
        );
        await inert.setBlockState(inert.address, 2);
        // The wallet's own transaction succeeds; what it carries is built
        // against a different queue, so the state this one reads is unchanged.
        const built = recovery.buildRecoveryCall("resolveByOwner", {
            ids: [31],
            destination: owner.address,
        });
        await (
            await multisig.connect(owner).submitTransaction(stub.address, 0, built.data)
        ).wait();
        const live = await recoveryTasks.queueAt(hre, inert.address);
        const output = await captureConsole(() =>
            recoveryTasks.reportPostcondition(live, built.data)
        );
        expect(output).to.include(
            "executed, not verified: withdrawal 31 reads Queued, not ResolvedByOwner"
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
