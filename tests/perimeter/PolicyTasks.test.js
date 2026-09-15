/**
 * The pure decision and encoding logic behind the Perimeter policy tasks
 * (`perimeter:policy:show`, `perimeter:exemption`, `perimeter:fee:*`).
 *
 * Nothing here touches a chain: `hardhat/tasks/perimeter/policy.js` takes no
 * hardhat runtime and does no I/O, so everything it exports — surface
 * resolution, rate parsing, calldata encode/decode, and the exemption/revoke
 * planning — is tested directly against known inputs and outputs, including
 * the exact calldata of the transaction that already executed on mainnet.
 *
 * Run:
 *   npx hardhat test tests/perimeter/PolicyTasks.test.js
 */

const { expect } = require("chai");
const { ethers } = require("ethers");

const policy = require("../../hardhat/tasks/perimeter/policy");

const LENDER_WITHDRAW = "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW";
const COLLECTOR = "0x115cAF168c51eD15ec535727F64684D33B7b08D1";
const OTHER = "0x2BEe6167f91D10db23252e03de039Da6b9047D49";

const COLLECTOR_FEE_EXEMPTION_CALLDATA =
    "0xeeb57de7d4896528a9fba849e3d3db442dea05ef8f08c93e00cc760acac34c42a7dacffe000000000000000000000000115caf168c51ed15ec535727f64684d33b7b08d100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000";

describe("Perimeter policy — surface resolution", () => {
    it("hashes every surface the way the controller hashes it", () => {
        for (const [name, id] of Object.entries(policy.SURFACES)) {
            expect(id).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name)));
        }
    });

    it("resolves the exact name", () => {
        expect(policy.resolveSurface(LENDER_WITHDRAW).name).to.equal(LENDER_WITHDRAW);
    });

    it("resolves a name case-insensitively", () => {
        expect(policy.resolveSurface(LENDER_WITHDRAW.toLowerCase()).name).to.equal(
            LENDER_WITHDRAW
        );
    });

    it("resolves a unique case-insensitive suffix", () => {
        expect(policy.resolveSurface("lender_withdraw").name).to.equal(LENDER_WITHDRAW);
        expect(policy.resolveSurface("LENDER_WITHDRAW").name).to.equal(LENDER_WITHDRAW);
    });

    it("resolves a 0x-prefixed 32-byte id", () => {
        const resolved = policy.resolveSurface(policy.SURFACES[LENDER_WITHDRAW]);
        expect(resolved.name).to.equal(LENDER_WITHDRAW);
        expect(resolved.id).to.equal(policy.SURFACES[LENDER_WITHDRAW]);
    });

    it("throws, listing the known names, on an ambiguous suffix", () => {
        expect(() => policy.resolveSurface("WITHDRAW")).to.throw(/more than one surface/);
    });

    it("throws, listing the known names, on an unknown input", () => {
        try {
            policy.resolveSurface("not-a-surface");
            expect.fail("expected resolveSurface to throw");
        } catch (e) {
            for (const name of Object.keys(policy.SURFACES)) {
                expect(e.message).to.include(name);
            }
        }
    });
});

describe("Perimeter policy — parseRate", () => {
    it("accepts 0, 10 and 10000 bps", () => {
        expect(policy.parseRate(0)).to.deep.equal({ active: true, rateBps: 0 });
        expect(policy.parseRate(10)).to.deep.equal({ active: true, rateBps: 10 });
        expect(policy.parseRate(10000)).to.deep.equal({ active: true, rateBps: 10000 });
    });

    it("accepts 'inactive', case-insensitively", () => {
        expect(policy.parseRate("inactive")).to.deep.equal({ active: false, rateBps: 0 });
        expect(policy.parseRate("INACTIVE")).to.deep.equal({ active: false, rateBps: 0 });
    });

    it("rejects a rate above 10000 bps", () => {
        expect(() => policy.parseRate(10001)).to.throw();
    });

    it("rejects a negative rate", () => {
        expect(() => policy.parseRate(-1)).to.throw();
    });

    it("rejects a non-integer rate", () => {
        expect(() => policy.parseRate(1.5)).to.throw();
    });

    it("rejects a percentage, and says bps are meant", () => {
        expect(() => policy.parseRate("1%")).to.throw(/basis points|bps/);
    });
});

describe("Perimeter policy — buildCall / decodeCall", () => {
    const argsFor = (kind) =>
        ({
            setExitFeeEnabled: { enabled: true },
            setFeeReceiver: { address: COLLECTOR },
            setSurfacePolicy: { surface: LENDER_WITHDRAW, rate: { active: true, rateBps: 25 } },
            setSubProductPolicy: {
                surface: LENDER_WITHDRAW,
                subProduct: OTHER,
                rate: { active: true, rateBps: 20 },
            },
            setActorPolicy: {
                surface: LENDER_WITHDRAW,
                actor: COLLECTOR,
                rate: { active: true, rateBps: 0 },
            },
            removeSubProductPolicy: { surface: LENDER_WITHDRAW, subProduct: OTHER },
            removeActorPolicy: { surface: LENDER_WITHDRAW, actor: COLLECTOR },
            setActorBypass: {
                surface: LENDER_WITHDRAW,
                actor: COLLECTOR,
                bypass: { active: true, bypass: true },
            },
            removeActorBypass: { surface: LENDER_WITHDRAW, actor: COLLECTOR },
            revokeExemption: { surface: LENDER_WITHDRAW, actor: COLLECTOR },
        })[kind];

    for (const kind of policy.CALL_KINDS) {
        it(`round-trips ${kind} through encode and decode`, () => {
            const built = policy.buildCall(kind, argsFor(kind));
            expect(built.signature).to.be.a("string").and.not.empty;
            expect(built.data).to.match(/^0x[0-9a-fA-F]+$/);
            expect(built.meaning).to.be.a("string").and.not.empty;

            const decoded = policy.decodeCall(built.data);
            expect(decoded, `decodeCall must recognise its own ${kind} calldata`).to.exist;
            expect(decoded.signature).to.equal(built.signature);
            expect(decoded.meaning).to.equal(built.meaning);
        });
    }

    it("returns undefined for a selector that is not a controller policy call", () => {
        expect(policy.decodeCall("0x12345678")).to.be.undefined;
        expect(policy.decodeCall("0xdeadbeef" + "00".repeat(64))).to.be.undefined;
    });

    it("encodes the collector's fee half on the lender-withdraw surface to the exact mainnet calldata", () => {
        const built = policy.buildCall("setActorPolicy", {
            surface: LENDER_WITHDRAW,
            actor: COLLECTOR,
            rate: { active: true, rateBps: 0 },
        });
        expect(built.data.toLowerCase()).to.equal(COLLECTOR_FEE_EXEMPTION_CALLDATA.toLowerCase());
    });

    describe("every meaning names the address it affects", () => {
        const addressBearing = [
            ["setFeeReceiver", { address: COLLECTOR }],
            [
                "setSubProductPolicy",
                {
                    surface: LENDER_WITHDRAW,
                    subProduct: OTHER,
                    rate: { active: true, rateBps: 5 },
                },
            ],
            [
                "setActorPolicy",
                { surface: LENDER_WITHDRAW, actor: COLLECTOR, rate: { active: true, rateBps: 0 } },
            ],
            ["removeSubProductPolicy", { surface: LENDER_WITHDRAW, subProduct: OTHER }],
            ["removeActorPolicy", { surface: LENDER_WITHDRAW, actor: COLLECTOR }],
            [
                "setActorBypass",
                {
                    surface: LENDER_WITHDRAW,
                    actor: COLLECTOR,
                    bypass: { active: true, bypass: true },
                },
            ],
            ["removeActorBypass", { surface: LENDER_WITHDRAW, actor: COLLECTOR }],
            ["revokeExemption", { surface: LENDER_WITHDRAW, actor: COLLECTOR }],
        ];

        for (const [kind, args] of addressBearing) {
            it(`${kind} names the address`, () => {
                const built = policy.buildCall(kind, args);
                const address = args.address || args.subProduct || args.actor;
                expect(built.meaning).to.be.a("string").and.not.empty;
                expect(built.meaning).to.include(address);
            });
        }
    });
});

describe("Perimeter policy — planExemption", () => {
    it("plans both halves, in order fee then delay, on the delay build when neither is written", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "both",
            fee: { active: false, rateBps: 0 },
            bypass: { active: false, bypass: false },
            build: "delay",
        });
        expect(alreadyDone).to.be.empty;
        expect(calls.map((c) => c.half)).to.deep.equal(["fee", "delay"]);
        expect(calls.map((c) => c.kind)).to.deep.equal(["setActorPolicy", "setActorBypass"]);
    });

    it("skips the fee half once it already reads {true, 0}", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "both",
            fee: { active: true, rateBps: 0 },
            bypass: { active: false, bypass: false },
            build: "delay",
        });
        expect(alreadyDone).to.deep.equal(["fee"]);
        expect(calls.map((c) => c.half)).to.deep.equal(["delay"]);
    });

    it("skips the delay half once it already reads {true, true}", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "both",
            fee: { active: false, rateBps: 0 },
            bypass: { active: true, bypass: true },
            build: "delay",
        });
        expect(alreadyDone).to.deep.equal(["delay"]);
        expect(calls.map((c) => c.half)).to.deep.equal(["fee"]);
    });

    it("skips everything once both halves already read exempt", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "both",
            fee: { active: true, rateBps: 0 },
            bypass: { active: true, bypass: true },
            build: "delay",
        });
        expect(calls).to.be.empty;
        expect(alreadyDone.sort()).to.deep.equal(["delay", "fee"]);
    });

    it("plans the fee half alone on the fee-only build", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "fee",
            fee: { active: false, rateBps: 0 },
            build: "fee-only",
        });
        expect(alreadyDone).to.be.empty;
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].kind).to.equal("setActorPolicy");
    });

    it("throws for the delay half alone on the fee-only build", () => {
        expect(() =>
            policy.planExemption({
                half: "delay",
                fee: { active: false, rateBps: 0 },
                build: "fee-only",
            })
        ).to.throw(/fee-only build/);
    });

    it("throws for 'both' on the fee-only build, because the delay half is included", () => {
        expect(() =>
            policy.planExemption({
                half: "both",
                fee: { active: false, rateBps: 0 },
                build: "fee-only",
            })
        ).to.throw(/fee-only build/);
    });

    it("rejects an unknown half", () => {
        expect(() => policy.planExemption({ half: "bogus", build: "delay" })).to.throw();
    });
});

describe("Perimeter policy — planRevoke", () => {
    it("picks revokeExemption on the delay build", () => {
        const { calls, alreadyDone } = policy.planRevoke({
            build: "delay",
            fee: { active: true, rateBps: 0 },
            bypass: { active: true, bypass: true },
        });
        expect(alreadyDone).to.be.empty;
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].kind).to.equal("revokeExemption");
    });

    it("skips on the delay build once already withdrawn", () => {
        const { calls, alreadyDone } = policy.planRevoke({
            build: "delay",
            fee: { active: false, rateBps: 0 },
            bypass: { active: true, bypass: false },
        });
        expect(calls).to.be.empty;
        expect(alreadyDone.sort()).to.deep.equal(["delay", "fee"]);
    });

    it("picks removeActorPolicy on the fee-only build, noting the delay half does not exist", () => {
        const { calls, alreadyDone } = policy.planRevoke({
            build: "fee-only",
            fee: { active: true, rateBps: 0 },
        });
        expect(alreadyDone).to.be.empty;
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].kind).to.equal("removeActorPolicy");
        expect(calls[0].note).to.match(/delay half does not exist/);
    });

    it("skips on the fee-only build once the fee entry is already inactive", () => {
        const { calls, alreadyDone } = policy.planRevoke({
            build: "fee-only",
            fee: { active: false, rateBps: 0 },
        });
        expect(calls).to.be.empty;
        expect(alreadyDone).to.deep.equal(["fee"]);
    });

    it("rejects an unknown build", () => {
        expect(() => policy.planRevoke({ build: "bogus" })).to.throw();
    });
});

describe("Perimeter policy — describeFeeEntry / describeDelayEntry", () => {
    it("describes an active fee entry with its rate", () => {
        expect(policy.describeFeeEntry({ active: true, rateBps: 10 }, "actor")).to.include(
            "10 bps"
        );
    });

    it("describes an inactive fee entry as falling through", () => {
        expect(policy.describeFeeEntry({ active: false, rateBps: 0 }, "actor")).to.match(
            /falls through/
        );
    });

    it("describes an active bypass as not held", () => {
        expect(policy.describeDelayEntry({ active: true, bypass: true }, "actor")).to.match(
            /not held/
        );
    });

    it("describes an active non-bypass as held", () => {
        expect(policy.describeDelayEntry({ active: true, bypass: false }, "actor")).to.match(
            /held/
        );
    });
});
