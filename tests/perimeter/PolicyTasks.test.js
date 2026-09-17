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

    it("accepts a well-formed id that matches no known surface, name null, id normalized", () => {
        const unknown = "0x" + "AB".repeat(32);
        const resolved = policy.resolveSurface(unknown);
        expect(resolved.name).to.be.null;
        expect(resolved.id).to.equal(unknown.toLowerCase());
    });
});

describe("Perimeter policy — defaultSurfaceNames", () => {
    // Regression for TOB-R-3: policy:show's default (no --surface) loop
    // enumerated only the five known names, so a bypass the controller
    // carries under a sixth surfaceId went unseen with no way to ask for it
    // directly either. defaultSurfaceNames is the fix's decision logic,
    // tested here without a controller or the hardhat task around it.
    it("returns just the five known names when bypassSurfaceIds is empty", () => {
        expect(policy.defaultSurfaceNames([])).to.deep.equal(Object.keys(policy.SURFACES));
    });

    it("defaults to the five known names when no ids are passed at all", () => {
        expect(policy.defaultSurfaceNames()).to.deep.equal(Object.keys(policy.SURFACES));
    });

    it("does not duplicate a bypass id that already names a known surface", () => {
        const result = policy.defaultSurfaceNames([policy.SURFACES[LENDER_WITHDRAW]]);
        expect(result).to.deep.equal(Object.keys(policy.SURFACES));
    });

    it("appends an unknown bypass id, unresolved, after the five known names", () => {
        const unknown = "0x" + "cd".repeat(32);
        const result = policy.defaultSurfaceNames([unknown]);
        expect(result).to.deep.equal([...Object.keys(policy.SURFACES), unknown]);
    });

    it("appends more than one unknown id, in the order the controller gave them", () => {
        const first = "0x" + "11".repeat(32);
        const second = "0x" + "22".repeat(32);
        const result = policy.defaultSurfaceNames([first, second]);
        expect(result.slice(-2)).to.deep.equal([first, second]);
    });

    it("normalizes an unknown id's case the same way resolveSurface does", () => {
        const unknown = "0x" + "EF".repeat(32);
        const result = policy.defaultSurfaceNames([unknown]);
        expect(result[result.length - 1]).to.equal(unknown.toLowerCase());
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

    it("rejects an empty string instead of reading it as an active zero-rate entry", () => {
        expect(() => policy.parseRate("")).to.throw(/no rate was given/);
    });

    it("rejects a whitespace-only string instead of reading it as an active zero-rate entry", () => {
        expect(() => policy.parseRate("   ")).to.throw(/no rate was given/);
    });

    it("rejects null instead of reading it as an active zero-rate entry", () => {
        expect(() => policy.parseRate(null)).to.throw(/no rate was given/);
    });

    it("rejects a hex spelling instead of reading it through numeric coercion", () => {
        expect(() => policy.parseRate("0x0a")).to.throw(/plain decimal integer/);
    });

    it("rejects a binary spelling instead of reading it through numeric coercion", () => {
        expect(() => policy.parseRate("0b11")).to.throw(/plain decimal integer/);
    });

    it("rejects an exponent spelling instead of reading it through numeric coercion", () => {
        expect(() => policy.parseRate("1e2")).to.throw(/plain decimal integer/);
    });

    it("rejects a decimal-point spelling of a whole number of bps", () => {
        expect(() => policy.parseRate("25.0")).to.throw(/plain decimal integer/);
    });

    it("rejects an explicit leading-sign spelling of the rate", () => {
        expect(() => policy.parseRate("+25")).to.throw(/plain decimal integer/);
    });

    it("still accepts a decimal string with a redundant leading zero", () => {
        expect(policy.parseRate("010")).to.deep.equal({ active: true, rateBps: 10 });
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
            grantExemption: { surface: LENDER_WITHDRAW, actor: COLLECTOR },
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
            ["grantExemption", { surface: LENDER_WITHDRAW, actor: COLLECTOR }],
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
    // --half "both" (the default) on the delay build plans exactly one call,
    // grantExemption, never the old two-separate-multisig-transactions shape
    // — the whole point being that no on-chain state can ever read only one
    // half applied. Regression for CON-R2-1: granting an exemption through
    // two separate calls left a real window where the actor was fee-exempt
    // but still held, or paid instantly with no hold at all while still
    // being charged, between the two executing.
    it("plans the single atomic grantExemption call on the delay build when neither half is written", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "both",
            fee: { active: false, rateBps: 0 },
            bypass: { active: false, bypass: false },
            build: "delay",
        });
        expect(alreadyDone).to.be.empty;
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].kind).to.equal("grantExemption");
    });

    it("still plans the atomic grantExemption call when only the fee half already reads exempt", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "both",
            fee: { active: true, rateBps: 0 },
            bypass: { active: false, bypass: false },
            build: "delay",
        });
        expect(alreadyDone).to.be.empty;
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].kind).to.equal("grantExemption");
    });

    it("still plans the atomic grantExemption call when only the delay half already reads exempt", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "both",
            fee: { active: false, rateBps: 0 },
            bypass: { active: true, bypass: true },
            build: "delay",
        });
        expect(alreadyDone).to.be.empty;
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].kind).to.equal("grantExemption");
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

    it("plans the fee half alone on the fee-only build, no confirmHalf needed", () => {
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

    // --half "fee" / "delay" alone, on the delay build, is the narrow
    // repair path for finishing an already half-applied exemption — it must
    // not be reachable as an ordinary grant mode.
    it("refuses --half fee alone on the delay build without confirmHalf", () => {
        expect(() =>
            policy.planExemption({
                half: "fee",
                fee: { active: false, rateBps: 0 },
                bypass: { active: false, bypass: false },
                build: "delay",
            })
        ).to.throw(/half-applied/);
    });

    it("refuses --half delay alone on the delay build without confirmHalf", () => {
        expect(() =>
            policy.planExemption({
                half: "delay",
                fee: { active: false, rateBps: 0 },
                bypass: { active: false, bypass: false },
                build: "delay",
            })
        ).to.throw(/half-applied/);
    });

    it("accepts --half fee alone on the delay build with confirmHalf, for finishing a partial grant", () => {
        const { calls, alreadyDone } = policy.planExemption({
            half: "fee",
            fee: { active: false, rateBps: 0 },
            bypass: { active: true, bypass: true }, // the delay half already landed
            build: "delay",
            confirmHalf: true,
        });
        expect(alreadyDone).to.be.empty;
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].kind).to.equal("setActorPolicy");
    });

    it("does not require confirmHalf for 'both', even on the delay build", () => {
        expect(() =>
            policy.planExemption({
                half: "both",
                fee: { active: false, rateBps: 0 },
                bypass: { active: false, bypass: false },
                build: "delay",
            })
        ).to.not.throw();
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

describe("Perimeter policy — unionAddresses", () => {
    // Regression for CON-R2-2: policy:show enumerated sub-products and
    // actors solely through the fee-tier key list, so an address with an
    // active delay bypass and no fee-tier entry (the FeeSharingCollector's
    // own shape once its fee half is later removed) was invisible to the
    // default inventory - visible only if the operator already knew the
    // address and passed it explicitly.
    it("includes an address present only in the bypass list", () => {
        const result = policy.unionAddresses([COLLECTOR], [OTHER]);
        expect(result.map((a) => a.toLowerCase())).to.have.members([
            COLLECTOR.toLowerCase(),
            OTHER.toLowerCase(),
        ]);
    });

    it("dedupes an address present in both lists, case-insensitively", () => {
        const result = policy.unionAddresses([COLLECTOR], [COLLECTOR.toLowerCase()]);
        expect(result).to.have.lengthOf(1);
        expect(ethers.utils.getAddress(result[0])).to.equal(ethers.utils.getAddress(COLLECTOR));
    });

    it("returns checksummed addresses", () => {
        const result = policy.unionAddresses([COLLECTOR.toLowerCase()]);
        expect(result[0]).to.equal(ethers.utils.getAddress(COLLECTOR));
    });

    it("handles empty or missing lists", () => {
        expect(policy.unionAddresses([], [])).to.deep.equal([]);
        expect(policy.unionAddresses()).to.deep.equal([]);
        expect(policy.unionAddresses([COLLECTOR], undefined)).to.deep.equal([
            ethers.utils.getAddress(COLLECTOR),
        ]);
    });

    it("preserves first-seen order across lists", () => {
        const result = policy.unionAddresses([OTHER], [COLLECTOR, OTHER]);
        expect(result).to.deep.equal([
            ethers.utils.getAddress(OTHER),
            ethers.utils.getAddress(COLLECTOR),
        ]);
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

describe("Perimeter policy — buildFromCode", () => {
    const SECURITY_PERIMETER_ENABLED_SELECTOR = ethers.utils
        .id("securityPerimeterEnabled()")
        .slice(2, 10);

    // Synthetic bytecode carrying every FEE_BUILD_REQUIRED_SELECTORS entry,
    // the way real PUSH4-dispatch bytecode carries a function's selector
    // as a literal 4-byte constant.
    const feeOnlyCode =
        "0x6080604052348015600f57600080fd5b50" +
        policy.FEE_BUILD_REQUIRED_SELECTORS.map((s) => `${s}14`).join("") +
        "6101a057";

    it("reads as 'delay' when the bytecode contains the securityPerimeterEnabled selector", () => {
        const code = `0x600035${SECURITY_PERIMETER_ENABLED_SELECTOR}146101a057`;
        expect(policy.buildFromCode(code)).to.equal("delay");
    });

    it("reads as 'delay' regardless of case", () => {
        const code = `0x600035${SECURITY_PERIMETER_ENABLED_SELECTOR.toUpperCase()}146101a057`;
        expect(policy.buildFromCode(code)).to.equal("delay");
    });

    // Regression for CON-R2-4: buildFromCode used to classify ANY bytecode
    // lacking the delay selector as "fee-only" unconditionally - a bad
    // upgrade, a wrong slot read, or a future third build all silently read
    // as the less-protected build, and an operator "revoking" an exemption
    // under that false read would have removed only the fee half, leaving
    // any real delay bypass live.
    it("reads as 'fee-only' only when every one of its own required selectors is present", () => {
        expect(policy.buildFromCode(feeOnlyCode)).to.equal("fee-only");
    });

    it("throws for bytecode carrying neither the delay selector nor the full fee-build selector set", () => {
        expect(() => policy.buildFromCode("0x6080604052348015600f57600080fd5b50")).to.throw(
            /matches neither/
        );
    });

    it("throws when only some of the fee-build selectors are present, not all", () => {
        const partial =
            "0x6080604052" +
            policy.FEE_BUILD_REQUIRED_SELECTORS.slice(0, 2).join("") +
            "146101a057";
        expect(() => policy.buildFromCode(partial)).to.throw(/matches neither/);
    });

    it("throws for empty or missing code, rather than defaulting to 'fee-only'", () => {
        expect(() => policy.buildFromCode("0x")).to.throw(/matches neither/);
        expect(() => policy.buildFromCode(undefined)).to.throw(/matches neither/);
    });
});

describe("Perimeter policy — implementationFromSlot", () => {
    it("reads a zero word as undefined — not an ERC-1967 proxy", () => {
        expect(policy.implementationFromSlot(`0x${"0".repeat(64)}`)).to.be.undefined;
    });

    it("reads the low 20 bytes as the checksummed implementation address", () => {
        const slotValue = `0x${"0".repeat(24)}50ec5c1c156cfa7e3007a0b0c97298e4f58a552d`;
        expect(policy.implementationFromSlot(slotValue)).to.equal(
            ethers.utils.getAddress("0x50ec5c1c156cfa7e3007a0b0c97298e4f58a552d")
        );
    });

    it("throws on a value that is not a 32-byte hex word", () => {
        expect(() => policy.implementationFromSlot("0x1234")).to.throw(/32-byte hex word/);
        expect(() => policy.implementationFromSlot(undefined)).to.throw(/32-byte hex word/);
    });

    it("throws when the upper 12 bytes are not zero — not a plausible ERC-1967 slot", () => {
        const slotValue = `0x${"1".repeat(24)}50ec5c1c156cfa7e3007a0b0c97298e4f58a552d`;
        expect(() => policy.implementationFromSlot(slotValue)).to.throw(/not a plausible/);
    });
});

describe("Perimeter policy — survivingBypassWarning", () => {
    const activeBypass = { active: true, bypass: true };
    const surfaceId = policy.SURFACES[LENDER_WITHDRAW];

    it("warns that the actor still bypasses the delay when the fee-tier tasks touch it on the delay build", () => {
        const warning = policy.survivingBypassWarning({
            build: "delay",
            bypass: activeBypass,
            actor: COLLECTOR,
            surfaceId,
        });
        expect(warning).to.be.a("string");
        expect(warning).to.include(COLLECTOR);
        expect(warning).to.match(/withdrawal delay/);
        expect(warning).to.match(/perimeter:exemption --action revoke/);
    });

    it("says nothing on the fee-only build, even with an active bypass shape passed in", () => {
        expect(
            policy.survivingBypassWarning({
                build: "fee-only",
                bypass: activeBypass,
                actor: COLLECTOR,
                surfaceId,
            })
        ).to.be.undefined;
    });

    it("says nothing when the bypass entry is inactive", () => {
        expect(
            policy.survivingBypassWarning({
                build: "delay",
                bypass: { active: false, bypass: true },
                actor: COLLECTOR,
                surfaceId,
            })
        ).to.be.undefined;
    });

    it("says nothing when the bypass entry is active without bypass set — that forces the delay, not lifts it", () => {
        expect(
            policy.survivingBypassWarning({
                build: "delay",
                bypass: { active: true, bypass: false },
                actor: COLLECTOR,
                surfaceId,
            })
        ).to.be.undefined;
    });

    it("says nothing when there is no bypass entry at all", () => {
        expect(
            policy.survivingBypassWarning({
                build: "delay",
                bypass: undefined,
                actor: COLLECTOR,
                surfaceId,
            })
        ).to.be.undefined;
    });
});

describe("Perimeter policy — pairingViolationAfterCall", () => {
    // Regression for CON-R2-3: perimeter:policy:check-tx decoded a submitted
    // transaction and printed its meaning, but never evaluated whether
    // executing it would leave the actor's fee/delay pair half-applied - a
    // co-signer reading a clean decode had a description, not a guarantee.
    const notHeld = { active: true, bypass: true }; // bypassing
    const held = { active: true, bypass: false }; // active, no bypass
    const noDelayEntry = { active: false, bypass: false };
    const exemptFee = { active: true, rateBps: 0 };
    const chargedFee = { active: true, rateBps: 25 };
    const noFeeEntry = { active: false, rateBps: 0 };

    it("flags setActorPolicy granting a zero rate while the delay is not bypassing", () => {
        const violates = policy.pairingViolationAfterCall({
            kind: "setActorPolicy",
            args: [null, null, [true, 0]],
            currentFee: chargedFee,
            currentBypass: held,
        });
        expect(violates).to.equal(true);
    });

    it("does not flag setActorPolicy granting a zero rate while the delay already bypasses", () => {
        const violates = policy.pairingViolationAfterCall({
            kind: "setActorPolicy",
            args: [null, null, [true, 0]],
            currentFee: chargedFee,
            currentBypass: notHeld,
        });
        expect(violates).to.equal(false);
    });

    it("flags setActorPolicy charging a real rate while the delay already bypasses - paid but not held", () => {
        const violates = policy.pairingViolationAfterCall({
            kind: "setActorPolicy",
            args: [null, null, [true, 25]],
            currentFee: exemptFee,
            currentBypass: notHeld,
        });
        expect(violates).to.equal(true);
    });

    it("flags removeActorPolicy falling through to charged while the delay already bypasses", () => {
        const violates = policy.pairingViolationAfterCall({
            kind: "removeActorPolicy",
            args: [null, null],
            currentFee: exemptFee,
            currentBypass: notHeld,
        });
        expect(violates).to.equal(true);
    });

    it("flags setActorBypass granting bypass while the fee is not exempt", () => {
        const violates = policy.pairingViolationAfterCall({
            kind: "setActorBypass",
            args: [null, null, [true, true]],
            currentFee: chargedFee,
            currentBypass: noDelayEntry,
        });
        expect(violates).to.equal(true);
    });

    it("does not flag setActorBypass granting bypass while the fee is already exempt", () => {
        const violates = policy.pairingViolationAfterCall({
            kind: "setActorBypass",
            args: [null, null, [true, true]],
            currentFee: exemptFee,
            currentBypass: held,
        });
        expect(violates).to.equal(false);
    });

    it("flags removeActorBypass falling through to held while the fee stays exempt", () => {
        const violates = policy.pairingViolationAfterCall({
            kind: "removeActorBypass",
            args: [null, null],
            currentFee: exemptFee,
            currentBypass: notHeld,
        });
        expect(violates).to.equal(true);
    });

    it("does not flag an ordinary (non-exempt) actor left ordinary", () => {
        const violates = policy.pairingViolationAfterCall({
            kind: "setActorPolicy",
            args: [null, null, [true, 25]],
            currentFee: noFeeEntry,
            currentBypass: noDelayEntry,
        });
        expect(violates).to.equal(false);
    });

    for (const kind of ["grantExemption", "revokeExemption"]) {
        it(`says ${kind} carries no pairing to assess - it writes both halves atomically`, () => {
            expect(
                policy.pairingViolationAfterCall({
                    kind,
                    args: [null, null],
                    currentFee: chargedFee,
                    currentBypass: held,
                })
            ).to.be.undefined;
        });
    }

    for (const kind of [
        "setSurfacePolicy",
        "setSubProductPolicy",
        "setExitFeeEnabled",
        "setFeeReceiver",
    ]) {
        it(`says ${kind} carries no actor-tier pairing to assess`, () => {
            expect(
                policy.pairingViolationAfterCall({
                    kind,
                    args: [null, null, [true, 0]],
                    currentFee: chargedFee,
                    currentBypass: held,
                })
            ).to.be.undefined;
        });
    }
});

describe("Perimeter policy — ACTOR_TIER_PAIR_CALLS", () => {
    // Regression within CON-R2-3's own fix: policy:check-tx used
    // decoded.args[0]/[1] as (surfaceId, actor) for EVERY recognized call
    // kind, not only the ones actually shaped that way. setSurfacePolicy's
    // second arg is a rate tuple, setSubProductPolicy/removeSubProductPolicy's
    // second arg is a sub-product address (not an actor), and
    // setExitFeeEnabled/setFeeReceiver do not carry a surfaceId at all -
    // querying the controller with those as (surfaceId, actor) would have
    // crashed check-tx outright for exactly the calls the arming guard and
    // the fee tasks submit most often. This set is what check-tx gates on
    // before attempting that query.
    it("contains exactly the six calls whose first two args are (surfaceId, actor)", () => {
        expect([...policy.ACTOR_TIER_PAIR_CALLS].sort()).to.deep.equal(
            [
                "setActorPolicy",
                "removeActorPolicy",
                "setActorBypass",
                "removeActorBypass",
                "grantExemption",
                "revokeExemption",
            ].sort()
        );
    });

    for (const kind of [
        "setSurfacePolicy",
        "setSubProductPolicy",
        "removeSubProductPolicy",
        "setExitFeeEnabled",
        "setFeeReceiver",
    ]) {
        it(`excludes ${kind} - its args are not (surfaceId, actor)`, () => {
            expect(policy.ACTOR_TIER_PAIR_CALLS.has(kind)).to.be.false;
        });
    }
});
