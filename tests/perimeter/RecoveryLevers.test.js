/**
 * The pure encode/decode/guard logic behind the Perimeter recovery tasks
 * (`perimeter:route:*`, `perimeter:refund`).
 *
 * Nothing here touches a chain: `hardhat/tasks/perimeter/recovery.js` takes no
 * hardhat runtime and does no I/O, so every export is tested directly against
 * known inputs and outputs, including the exact selector each signature hashes
 * to and the exact route id the queue computes for the same four fields.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/RecoveryLevers.test.js
 */
const { expect } = require("chai");
const { ethers } = require("ethers");

const recovery = require("../../hardhat/tasks/perimeter/recovery");
const policy = require("../../hardhat/tasks/perimeter/policy");

const LENDER = policy.SURFACES.PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW;
const IUSDT = "0x849C47f9C259E9D62F289BF1b2729039698D8387";
const USDT = "0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96";
const QUEUE = "0x2BEe6167f91D10db23252e03de039Da6b9047D49";
const WRBTC = "0x542fDA317318eBF1d3DEAf76E0b632741A7e677d";
const TREASURY = "0x115cAF168c51eD15ec535727F64684D33B7b08D1";
const ZERO = ethers.constants.AddressZero;

describe("Perimeter recovery — signatures and selectors", () => {
    it("names exactly the six calls the queue exposes for recovery", () => {
        expect(Object.keys(recovery.RECOVERY_LEVERS)).to.deep.equal([
            "resolveToProtocol(uint256[],bytes32)",
            "resolveByOwner(uint256[],address)",
            "setRecoveryRoute((bool,bytes32,address,address,address,bool))",
            "removeRecoveryRoute(bytes32)",
            "setTopUpFeasible(bytes32,bool)",
            "recoverStuckExit(uint256,address)",
        ]);
    });

    it("hashes each bare signature to the same selector its named ABI does", () => {
        const iface = new ethers.utils.Interface(recovery.QUEUE_RECOVERY_ABI);
        for (const signature of Object.keys(recovery.RECOVERY_LEVERS)) {
            expect(iface.getSighash(iface.getFunction(signature))).to.equal(
                ethers.utils.id(signature).slice(0, 10)
            );
        }
    });
});

describe("Perimeter recovery — routeIdOf", () => {
    // keccak256(abi.encode(surfaceId, subProduct, token, destination)) for the
    // four constants above, written out rather than recomputed: a derivation
    // compared against itself pins nothing.
    const LENDER_IUSDT_USDT_IUSDT =
        "0x627e83dcfa2fbb550e29a460acdb6d0690cfcfcd798df0bfaf9821743a528e22";

    it("hashes the four fields the queue hashes, and only those four", () => {
        expect(recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT)).to.equal(LENDER_IUSDT_USDT_IUSDT);
    });

    it("gives one id to two routes that disagree only about topping up the pool", () => {
        const idOf = (topUpPool) =>
            recovery.postconditionFor(
                recovery.buildRecoveryCall("setRecoveryRoute", {
                    active: true,
                    surfaceId: LENDER,
                    subProduct: IUSDT,
                    token: USDT,
                    destination: IUSDT,
                    topUpPool,
                }).data
            ).routeId;
        expect(idOf(true)).to.equal(LENDER_IUSDT_USDT_IUSDT);
        expect(idOf(false)).to.equal(LENDER_IUSDT_USDT_IUSDT);
    });

    it("checksums the addresses it is given before hashing, so case cannot change the id", () => {
        expect(
            recovery.routeIdOf(
                LENDER,
                IUSDT.toLowerCase(),
                USDT.toUpperCase().replace("0X", "0x"),
                IUSDT
            )
        ).to.equal(recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT));
    });
});

describe("Perimeter recovery — requireRouteDestination", () => {
    const base = { token: USDT, subProduct: IUSDT, queue: QUEUE, wrbtc: WRBTC };

    it("accepts a plain route to an unrelated address", () => {
        expect(
            recovery.requireRouteDestination({ ...base, destination: TREASURY, topUpPool: false })
        ).to.equal(TREASURY);
    });

    it("refuses the zero address", () => {
        expect(() =>
            recovery.requireRouteDestination({ ...base, destination: ZERO, topUpPool: false })
        ).to.throw(/must not be the zero address/);
    });

    it("refuses the queue itself, which would trap the escrow", () => {
        expect(() =>
            recovery.requireRouteDestination({ ...base, destination: QUEUE, topUpPool: false })
        ).to.throw(/the queue itself/);
    });

    it("refuses the escrowed token", () => {
        expect(() =>
            recovery.requireRouteDestination({ ...base, destination: USDT, topUpPool: false })
        ).to.throw(/the escrowed token/);
    });

    it("refuses WRBTC, which would swallow an unwrap payout", () => {
        expect(() =>
            recovery.requireRouteDestination({ ...base, destination: WRBTC, topUpPool: false })
        ).to.throw(/WRBTC/);
    });

    it("refuses a top-up route whose destination is not the pool itself", () => {
        expect(() =>
            recovery.requireRouteDestination({ ...base, destination: TREASURY, topUpPool: true })
        ).to.throw(/a top-up route pays its own pool/);
    });

    it("refuses a top-up route on an infeasible surface first, the way the queue checks it first", () => {
        expect(() =>
            recovery.requireRouteDestination({
                ...base,
                token: ZERO,
                destination: TREASURY,
                topUpPool: true,
                surfaceId: LENDER,
                topUpFeasible: false,
            })
        ).to.throw(/refund-to-pool is not allowed on lender withdrawals yet/);
    });

    it("leaves the other top-up arms alone once the surface is feasible", () => {
        expect(() =>
            recovery.requireRouteDestination({
                ...base,
                destination: TREASURY,
                topUpPool: true,
                surfaceId: LENDER,
                topUpFeasible: true,
            })
        ).to.throw(/a top-up route pays its own pool/);
    });

    it("refuses a top-up route on a native surface", () => {
        expect(() =>
            recovery.requireRouteDestination({
                ...base,
                token: ZERO,
                subProduct: ZERO,
                destination: TREASURY,
                topUpPool: true,
            })
        ).to.throw(/native RBTC/);
    });

    it("accepts a top-up route that pays its own pool", () => {
        expect(
            recovery.requireRouteDestination({ ...base, destination: IUSDT, topUpPool: true })
        ).to.equal(IUSDT);
    });
});

describe("Perimeter recovery — buildRecoveryCall / decodeRecoveryCall", () => {
    it("round-trips a pool refund and says what it does", () => {
        const routeId = recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT);
        const built = recovery.buildRecoveryCall("resolveToProtocol", { ids: [7, 8], routeId });
        expect(built.signature).to.equal("resolveToProtocol(uint256[],bytes32)");
        expect(built.meaning).to.equal(
            `sends withdrawals 7, 8 to the destination route ${routeId} names, away from their receivers`
        );
        const decoded = recovery.decodeRecoveryCall(built.data);
        expect(decoded.target).to.equal("queue");
        expect(decoded.kind).to.equal("resolveToProtocol(uint256[],bytes32)");
        expect(decoded.fields).to.deep.equal([
            { name: "ids", type: "uint256[]", value: "(7, 8)" },
            { name: "routeId", type: "bytes32", value: routeId },
        ]);
        expect(decoded.meaning).to.equal(built.meaning);
    });

    it("round-trips an owner refund and names the destination", () => {
        const built = recovery.buildRecoveryCall("resolveByOwner", {
            ids: [9],
            destination: TREASURY,
        });
        expect(built.signature).to.equal("resolveByOwner(uint256[],address)");
        expect(built.meaning).to.equal(
            `sends withdrawal 9 to ${TREASURY}, away from its receiver`
        );
        expect(recovery.decodeRecoveryCall(built.data).meaning).to.equal(built.meaning);
    });

    it("round-trips a route registration as the single tuple argument the queue takes", () => {
        const built = recovery.buildRecoveryCall("setRecoveryRoute", {
            active: true,
            surfaceId: LENDER,
            subProduct: IUSDT,
            token: USDT,
            destination: IUSDT,
            topUpPool: true,
        });
        expect(built.signature).to.equal(
            "setRecoveryRoute((bool,bytes32,address,address,address,bool))"
        );
        expect(built.meaning).to.equal(
            `registers a recovery route on lender withdrawals that tops up the pool ${IUSDT} with the escrowed ${USDT}`
        );
        const decoded = recovery.decodeRecoveryCall(built.data);
        expect(decoded.fields).to.deep.equal([
            { name: "route.active", type: "bool", value: "true" },
            { name: "route.surfaceId", type: "bytes32", value: LENDER },
            { name: "route.subProduct", type: "address", value: IUSDT },
            { name: "route.token", type: "address", value: USDT },
            { name: "route.destination", type: "address", value: IUSDT },
            { name: "route.topUpPool", type: "bool", value: "true" },
        ]);
    });

    it("describes a route whose active flag is off as a deactivation, not a registration", () => {
        const built = recovery.buildRecoveryCall("setRecoveryRoute", {
            active: false,
            surfaceId: LENDER,
            subProduct: IUSDT,
            token: USDT,
            destination: TREASURY,
            topUpPool: false,
        });
        expect(built.meaning).to.equal(
            `deactivates the recovery route on lender withdrawals to ${TREASURY} — a refund ` +
                "along it is refused until it is registered again"
        );
        expect(recovery.decodeRecoveryCall(built.data).meaning).to.equal(built.meaning);
    });

    it("describes an inactive top-up route as a deactivation too, naming the pool it would have paid", () => {
        const built = recovery.buildRecoveryCall("setRecoveryRoute", {
            active: false,
            surfaceId: LENDER,
            subProduct: IUSDT,
            token: USDT,
            destination: IUSDT,
            topUpPool: true,
        });
        expect(built.meaning).to.equal(
            `deactivates the recovery route on lender withdrawals to ${IUSDT} — a refund ` +
                "along it is refused until it is registered again"
        );
    });

    it("round-trips a plain route and says where it sends instead of to a pool", () => {
        const built = recovery.buildRecoveryCall("setRecoveryRoute", {
            active: true,
            surfaceId: LENDER,
            subProduct: IUSDT,
            token: USDT,
            destination: TREASURY,
            topUpPool: false,
        });
        expect(built.meaning).to.equal(
            `registers a recovery route on lender withdrawals that sends the escrowed ${USDT} to ${TREASURY}`
        );
    });

    it("round-trips a route removal and a feasibility flag", () => {
        const routeId = recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT);
        expect(recovery.buildRecoveryCall("removeRecoveryRoute", { routeId }).meaning).to.equal(
            `removes the recovery route ${routeId}`
        );
        expect(
            recovery.buildRecoveryCall("setTopUpFeasible", { surfaceId: LENDER, feasible: true })
                .meaning
        ).to.equal("allows a refund-to-pool route to be registered on lender withdrawals");
        expect(
            recovery.buildRecoveryCall("setTopUpFeasible", { surfaceId: LENDER, feasible: false })
                .meaning
        ).to.equal("stops any new refund-to-pool route being registered on lender withdrawals");
    });

    it("returns undefined for a selector that is not a recovery call", () => {
        expect(
            recovery.decodeRecoveryCall(
                new ethers.utils.Interface(["function freeze(address)"]).encodeFunctionData(
                    "freeze",
                    [TREASURY]
                )
            )
        ).to.equal(undefined);
        expect(recovery.decodeRecoveryCall("0x")).to.equal(undefined);
        expect(recovery.decodeRecoveryCall("not hex")).to.equal(undefined);
    });

    it("refuses to build a refund with no ids, the way the queue refuses EmptyIds", () => {
        expect(() =>
            recovery.buildRecoveryCall("resolveByOwner", { ids: [], destination: TREASURY })
        ).to.throw(/names no withdrawal/);
    });

    it("refuses an unknown kind and lists the ones it knows", () => {
        expect(() => recovery.buildRecoveryCall("resolveBySIP", {})).to.throw(
            /unknown recovery call 'resolveBySIP'/
        );
    });
});

describe("Perimeter recovery — parseRequestIds", () => {
    it("reads a comma-separated list, trimming blanks", () => {
        expect(recovery.parseRequestIds(" 7, 8 ,", "perimeter:refund")).to.deep.equal(["7", "8"]);
    });

    it("refuses a list that names no withdrawal", () => {
        expect(() => recovery.parseRequestIds(" , ", "perimeter:refund")).to.throw(
            /names no withdrawal/
        );
    });

    it("refuses an id that is not a whole number", () => {
        expect(() => recovery.parseRequestIds("7,eight", "perimeter:refund")).to.throw(
            /'eight' is not a withdrawal id/
        );
        expect(() => recovery.parseRequestIds("-1", "perimeter:refund")).to.throw(
            /'-1' is not a withdrawal id/
        );
    });

    it("refuses id 0, because the queue counts from 1", () => {
        expect(() => recovery.parseRequestIds("0", "perimeter:refund")).to.throw(/ids start at 1/);
    });

    it("refuses a withdrawal named twice, which the queue would refuse as already terminal", () => {
        expect(() => recovery.parseRequestIds("7,7", "perimeter:refund")).to.throw(
            /withdrawal 7 is named twice/
        );
    });
});

describe("Perimeter recovery — requireOwnerDestination", () => {
    const base = { queue: QUEUE, wrbtc: WRBTC };

    it("accepts an address unrelated to the queue, its assets and WRBTC", () => {
        expect(recovery.requireOwnerDestination({ ...base, destination: TREASURY })).to.equal(
            TREASURY
        );
    });

    it("refuses the zero address", () => {
        expect(() => recovery.requireOwnerDestination({ ...base, destination: ZERO })).to.throw(
            /must not be the zero address/
        );
    });

    it("refuses the queue itself, which would trap the escrow", () => {
        expect(() => recovery.requireOwnerDestination({ ...base, destination: QUEUE })).to.throw(
            /the queue itself/
        );
    });

    it("refuses WRBTC, which would swallow an unwrap payout", () => {
        expect(() => recovery.requireOwnerDestination({ ...base, destination: WRBTC })).to.throw(
            /WRBTC/
        );
    });

    it("still refuses the queue when WRBTC could not be read", () => {
        expect(() =>
            recovery.requireOwnerDestination({ queue: QUEUE, destination: QUEUE })
        ).to.throw(/the queue itself/);
    });

    it("refuses an asset one of the withdrawals escrowed, naming the withdrawal", () => {
        expect(() => recovery.requireOwnerDestinationAsset(USDT, USDT, 7)).to.throw(
            `refund destination: must not be ${USDT}, the asset withdrawal 7 escrowed`
        );
    });

    it("accepts a destination that is not the asset the withdrawal escrowed", () => {
        expect(() => recovery.requireOwnerDestinationAsset(TREASURY, USDT, 7)).to.not.throw();
    });

    it("leaves a native-escrow withdrawal's asset check alone", () => {
        expect(() => recovery.requireOwnerDestinationAsset(TREASURY, ZERO, 7)).to.not.throw();
    });
});

describe("Perimeter recovery — describeRoute", () => {
    const routeId = "0x" + "ab".repeat(32);

    it("says an active top-up route tops up its own pool, and on which surface", () => {
        expect(
            recovery.describeRoute(routeId, {
                active: true,
                surfaceId: LENDER,
                subProduct: IUSDT,
                token: USDT,
                destination: IUSDT,
                topUpPool: true,
            })
        ).to.equal(
            `the route ${routeId} is active on lender withdrawals and tops up the pool ${IUSDT} ` +
                `with the escrowed ${USDT}`
        );
    });

    it("names the address an active address-mode route pays", () => {
        expect(
            recovery.describeRoute(routeId, {
                active: true,
                surfaceId: LENDER,
                subProduct: IUSDT,
                token: USDT,
                destination: TREASURY,
                topUpPool: false,
            })
        ).to.equal(
            `the route ${routeId} is active on lender withdrawals and sends the escrowed ` +
                `${USDT} to ${TREASURY}`
        );
    });

    it("says a registered route is not active, and what a refund along it would do", () => {
        expect(
            recovery.describeRoute(routeId, {
                active: false,
                surfaceId: LENDER,
                subProduct: IUSDT,
                token: USDT,
                destination: TREASURY,
                topUpPool: false,
            })
        ).to.equal(
            `the route ${routeId} is registered on lender withdrawals and sends the escrowed ` +
                `${USDT} to ${TREASURY}, but it is NOT active — a refund along it reverts ` +
                "RouteInactive"
        );
    });

    it("says an id the queue holds nothing for is not registered at all", () => {
        expect(
            recovery.describeRoute(routeId, {
                active: false,
                surfaceId: ethers.constants.HashZero,
                subProduct: ZERO,
                token: ZERO,
                destination: ZERO,
                topUpPool: false,
            })
        ).to.equal(
            `the route ${routeId} is not registered on this queue — a refund along it reverts ` +
                "RouteInactive"
        );
    });
});

describe("Perimeter recovery — postconditionFor", () => {
    const check = (built) => recovery.postconditionFor(built.data);

    it("derives the status a pool refund must leave each id in", () => {
        const routeId = recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT);
        expect(
            check(recovery.buildRecoveryCall("resolveToProtocol", { ids: [7, 8], routeId }))
        ).to.deep.equal({
            kind: "refundResolved",
            ids: ["7", "8"],
            status: "ResolvedToProtocol",
        });
    });

    it("derives the status the owner's refund must leave each id in", () => {
        expect(
            check(
                recovery.buildRecoveryCall("resolveByOwner", { ids: [9], destination: TREASURY })
            )
        ).to.deep.equal({ kind: "refundResolved", ids: ["9"], status: "ResolvedByOwner" });
    });

    it("derives the route id a registration stores under, and both of its flags", () => {
        expect(
            check(
                recovery.buildRecoveryCall("setRecoveryRoute", {
                    active: true,
                    surfaceId: LENDER,
                    subProduct: IUSDT,
                    token: USDT,
                    destination: IUSDT,
                    topUpPool: true,
                })
            )
        ).to.deep.equal({
            kind: "routeStored",
            routeId: recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT),
            active: true,
            topUpPool: true,
        });
    });

    it("derives a deactivation as the route reading inactive, not as a removal", () => {
        expect(
            check(
                recovery.buildRecoveryCall("setRecoveryRoute", {
                    active: false,
                    surfaceId: LENDER,
                    subProduct: IUSDT,
                    token: USDT,
                    destination: TREASURY,
                    topUpPool: false,
                })
            )
        ).to.deep.equal({
            kind: "routeStored",
            routeId: recovery.routeIdOf(LENDER, IUSDT, USDT, TREASURY),
            active: false,
            topUpPool: false,
        });
    });

    it("derives a removal and a feasibility flag", () => {
        const routeId = recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT);
        expect(
            check(recovery.buildRecoveryCall("removeRecoveryRoute", { routeId }))
        ).to.deep.equal({ kind: "routeRemoved", routeId });
        expect(
            check(
                recovery.buildRecoveryCall("setTopUpFeasible", {
                    surfaceId: LENDER,
                    feasible: true,
                })
            )
        ).to.deep.equal({ kind: "topUpFeasible", surfaceId: LENDER, feasible: true });
    });

    it("has nothing to read back for a call it does not recognise", () => {
        expect(recovery.postconditionFor("0xdeadbeef")).to.equal(undefined);
    });

    it("says in words what each postcondition checks", () => {
        const routeId = recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT);
        expect(
            recovery.describePostcondition({
                kind: "refundResolved",
                ids: ["7"],
                status: "ResolvedByOwner",
            })
        ).to.equal(
            "withdrawal 7 reads ResolvedByOwner, and no longer sits in the active list of any " +
                "party to it"
        );
        expect(
            recovery.describePostcondition({
                kind: "routeStored",
                routeId,
                active: true,
                topUpPool: false,
            })
        ).to.equal(`the route ${routeId} reads active=true and topUpPool=false`);
        expect(recovery.describePostcondition({ kind: "routeRemoved", routeId })).to.equal(
            `the route ${routeId} is no longer active`
        );
        expect(
            recovery.describePostcondition({
                kind: "topUpFeasible",
                surfaceId: LENDER,
                feasible: true,
            })
        ).to.equal("a refund-to-pool route may be registered on lender withdrawals");
    });
});

describe("Perimeter recovery — refundLegFor", () => {
    const NONE = 0;
    const FROZEN = 1;
    const BLACKLISTED = 2;

    it("offers both legs when the originator is blacklisted", () => {
        expect(
            recovery.refundLegFor({
                originatorState: BLACKLISTED,
                ownerState: NONE,
                receiverState: NONE,
            })
        ).to.equal("pool");
    });

    it("offers both legs when the owner is blacklisted", () => {
        expect(
            recovery.refundLegFor({
                originatorState: NONE,
                ownerState: BLACKLISTED,
                receiverState: NONE,
            })
        ).to.equal("pool");
    });

    it("offers only the owner's leg when the receiver alone is blacklisted", () => {
        expect(
            recovery.refundLegFor({
                originatorState: NONE,
                ownerState: NONE,
                receiverState: BLACKLISTED,
            })
        ).to.equal("address");
    });

    it("offers nothing when the only blocked party is frozen", () => {
        expect(
            recovery.refundLegFor({
                originatorState: FROZEN,
                ownerState: FROZEN,
                receiverState: FROZEN,
            })
        ).to.equal(null);
    });

    it("offers nothing when no party is blocked", () => {
        expect(
            recovery.refundLegFor({ originatorState: NONE, ownerState: NONE, receiverState: NONE })
        ).to.equal(null);
    });
});

describe("Perimeter recovery — decoded through policy.decodeCall", () => {
    it("decodes a recovery lever as a queue call, with its own meaning", () => {
        const built = recovery.buildRecoveryCall("setTopUpFeasible", {
            surfaceId: LENDER,
            feasible: true,
        });
        const decoded = policy.decodeCall(built.data);
        expect(decoded.target).to.equal("queue");
        expect(decoded.signature).to.equal("setTopUpFeasible(bytes32,bool)");
        expect(decoded.meaning).to.equal(
            "allows a refund-to-pool route to be registered on lender withdrawals"
        );
    });

    it("does not shadow a block lever with a recovery one", () => {
        const freeze = new ethers.utils.Interface(["function freeze(address)"]).encodeFunctionData(
            "freeze",
            [TREASURY]
        );
        expect(policy.decodeCall(freeze).meaning).to.equal("freeze one account");
    });
});
