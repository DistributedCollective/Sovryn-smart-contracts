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
    it("hashes the four fields the queue hashes, and only those four", () => {
        expect(recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT)).to.equal(
            ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "address", "address", "address"],
                    [LENDER, IUSDT, USDT, IUSDT]
                )
            )
        );
    });

    it("gives the same id for the same four fields whatever topUpPool would be", () => {
        expect(recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT)).to.equal(
            recovery.routeIdOf(LENDER, IUSDT, USDT, IUSDT)
        );
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
        expect(decoded.fields[0].value).to.equal(
            `(true, ${LENDER}, ${IUSDT}, ${USDT}, ${IUSDT}, true)`
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
