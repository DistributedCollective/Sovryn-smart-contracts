/**
 * The go-live check for the addresses the owner has exempted from the perimeter.
 *
 * An exemption is two owner entries on the controller for one address on one
 * surface: an actor fee policy `{active: true, rateBps: 0}` and an actor delay
 * bypass `{active: true, bypass: true}`. One without the other exempts nothing,
 * and each half has a wrong way round that reads almost right: an inactive fee
 * policy with a zero rate falls through to the surface rate, and an active delay
 * entry with `bypass: false` forces the delay. Nothing in the contracts or the
 * proposals notices either mistake.
 *
 * This is what notices. The registry names each exempted address; the check
 * reads both entries from the live controller and refuses to certify go-live
 * until both read back as the exemption, and whenever either cannot be read.
 *
 * It also asks the controller itself which delay bypasses actually exist, at
 * every tier, rather than only walking the registry's own list: a bypass
 * written at the surface or sub-product tier, or at the actor tier for an
 * address the registry never named, makes withdrawals on that surface (or
 * that pool, or that address) instant while the switch still reads on. The
 * check enumerates every active bypass from `bypassSurfaceIds()` outward and
 * refuses to certify one the registry cannot account for.
 *
 * Run:
 *   npx hardhat test tests/perimeter/ArmingGuard.contractCallers.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const {
    SURFACE_IDS,
    CONTRACT_CALLERS,
    SWITCH_UNREAD,
    readRegistrations,
    readActiveBypasses,
    evaluateExemptions,
    evaluateActiveBypasses,
    assertContractCallersExempt,
} = require("../../hardhat/tasks/perimeter/contractCallerExemptions");

const MockExitFeeController = artifacts.require("MockExitFeeController");

const LENDER_WITHDRAW = "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW";
const BORROWER_WITHDRAW = "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW";
const COLLECTOR = "0x115cAF168c51eD15ec535727F64684D33B7b08D1";
const NO_CODE = "0x00000000000000000000000000000000000000A1";
/** What ethers throws for a view the target does not serve. The guard's refusal
 *  must say which view it could not read in its own words, never this text. */
const RAW_LIBRARY_ERROR =
    'call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="globalDelaySeconds()", data="0x", errorArgs=null, errorName=null, errorSignature=null, reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)';

/** The view signatures the operator task reads the live controller through. */
const CONTROLLER_VIEWS = [
    "function securityPerimeterEnabled() view returns (bool)",
    "function globalDelaySeconds() view returns (uint32)",
    "function actorPolicy(bytes32,address) view returns (tuple(bool active, uint16 rateBps))",
    "function actorBypass(bytes32,address) view returns (tuple(bool active, bool bypass))",
];

/** A registry of one, so the test never depends on the live list's contents. */
const exemptCaller = ({ registration = "bypass", surface = LENDER_WITHDRAW } = {}) => [
    {
        name: "TestCollector",
        address: COLLECTOR,
        surface,
        registration,
        why: "redeems a position it holds and is exempted by the owner",
    },
];

/** A controller whose reads are scripted, for the reads a deployed mock cannot fail. */
const scriptedController = ({
    actorPolicy = async () => ({ active: true, rateBps: 0 }),
    actorBypass = async () => ({ active: true, bypass: true }),
} = {}) => ({
    actorPolicy,
    actorBypass,
    securityPerimeterEnabled: async () => true,
    globalDelaySeconds: async () => 3600,
});

const reasons = (failures) => failures.map((f) => f.reason);

describe("Perimeter — the arming guard for exempted addresses", () => {
    let controller;

    const writeFee = (active, rateBps, surface = LENDER_WITHDRAW) =>
        controller.setActorFeePolicyTest(SURFACE_IDS[surface], COLLECTOR, active, rateBps);
    const writeDelay = (active, bypass, surface = LENDER_WITHDRAW) =>
        controller.setActorBypassTest(SURFACE_IDS[surface], COLLECTOR, active, bypass);
    const writePair = async (surface = LENDER_WITHDRAW) => {
        await writeFee(true, 0, surface);
        await writeDelay(true, true, surface);
    };
    const verdictOn = async (target, callers = exemptCaller()) =>
        evaluateExemptions({
            armed: true,
            globalDelaySeconds: 3600,
            observations: await readRegistrations(target, callers),
        });

    beforeEach(async () => {
        controller = await MockExitFeeController.new();
        await controller.setGlobalDelaySecondsTest(3600);
        await controller.setSecurityPerimeterEnabledTest(true);
    });

    describe("the registry the release ships with", () => {
        it("registers exactly one exemption: the fee-sharing collector on lender-withdraw", () => {
            expect(CONTRACT_CALLERS.map((c) => c.name)).to.deep.equal(["FeeSharingCollector"]);
            const [collector] = CONTRACT_CALLERS;
            expect(collector.surface).to.equal(LENDER_WITHDRAW);
            expect(collector.registration).to.equal("bypass");
            expect(ethers.utils.getAddress(collector.address)).to.equal(
                ethers.utils.getAddress(COLLECTOR)
            );
        });

        it("gives every entry the one decided registration, a known surface and a reason", () => {
            for (const caller of CONTRACT_CALLERS) {
                expect(caller.registration, `${caller.name}`).to.equal("bypass");
                expect(SURFACE_IDS[caller.surface], `${caller.name} surface`).to.exist;
                expect(ethers.utils.isAddress(caller.address), `${caller.name} address`).to.be
                    .true;
                expect(caller.why, `${caller.name} reason`).to.be.a("string").and.not.empty;
            }
        });

        it("hashes the surface names the contracts hash", () => {
            expect(SURFACE_IDS[LENDER_WITHDRAW]).to.equal(
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes(LENDER_WITHDRAW))
            );
        });
    });

    describe("the fee half", () => {
        beforeEach(async () => {
            await writeDelay(true, true);
        });

        it("refuses while no actor fee policy is written", async () => {
            expect(reasons((await verdictOn(controller)).failures)).to.deep.equal([
                "fee-entry-inactive",
            ]);
        });

        it("refuses an inactive fee policy even at rate zero — it falls through to the surface rate", async () => {
            await writeFee(false, 0);
            expect(reasons((await verdictOn(controller)).failures)).to.deep.equal([
                "fee-entry-inactive",
            ]);
        });

        it("refuses an active fee policy that charges a non-zero rate", async () => {
            await writeFee(true, 10);
            const { failures } = await verdictOn(controller);
            expect(reasons(failures)).to.deep.equal(["fee-rate-not-zero"]);
            expect(failures[0].detail).to.include("10 bps");
        });
    });

    describe("the delay half", () => {
        beforeEach(async () => {
            await writeFee(true, 0);
        });

        it("refuses while no actor delay bypass is written", async () => {
            expect(reasons((await verdictOn(controller)).failures)).to.deep.equal([
                "delay-entry-inactive",
            ]);
        });

        it("refuses an inactive delay entry even with bypass set", async () => {
            await writeDelay(false, true);
            expect(reasons((await verdictOn(controller)).failures)).to.deep.equal([
                "delay-entry-inactive",
            ]);
        });

        it("refuses an active delay entry with bypass false — it forces the delay", async () => {
            await writeDelay(true, false);
            expect(reasons((await verdictOn(controller)).failures)).to.deep.equal([
                "delay-entry-forces-delay",
            ]);
        });
    });

    describe("the pair", () => {
        it("certifies once both entries read back as the exemption", async () => {
            await writePair();
            const { failures, certified } = await verdictOn(controller);
            expect(failures).to.be.empty;
            expect(certified).to.be.true;
        });

        it("reports both halves when neither is written", async () => {
            const { failures, certified } = await verdictOn(controller);
            expect(reasons(failures)).to.deep.equal([
                "fee-entry-inactive",
                "delay-entry-inactive",
            ]);
            expect(certified).to.be.false;
        });

        it("does not count a pair written under another surface", async () => {
            await writePair(BORROWER_WITHDRAW);
            expect(reasons((await verdictOn(controller)).failures)).to.deep.equal([
                "fee-entry-inactive",
                "delay-entry-inactive",
            ]);
        });
    });

    describe("an entry that cannot be read", () => {
        it("refuses when the fee read throws, even with the delay half in place", async () => {
            const target = scriptedController({
                actorPolicy: async () => {
                    throw new Error("call revert exception");
                },
            });
            const { failures, certified } = await verdictOn(target);
            expect(reasons(failures)).to.deep.equal(["fee-entry-unread"]);
            expect(failures[0].detail).to.include("call revert exception");
            expect(certified).to.be.false;
        });

        it("refuses when the delay read throws, even with the fee half in place", async () => {
            const target = scriptedController({
                actorBypass: async () => {
                    throw new Error("function selector was not recognized");
                },
            });
            expect(reasons((await verdictOn(target)).failures)).to.deep.equal([
                "delay-entry-unread",
            ]);
        });

        it("refuses a controller that does not serve the views at all", async () => {
            expect(reasons((await verdictOn({})).failures)).to.deep.equal([
                "fee-entry-unread",
                "delay-entry-unread",
            ]);
        });

        it("refuses an address with no controller behind it", async () => {
            const target = new ethers.Contract(NO_CODE, CONTROLLER_VIEWS, ethers.provider);
            expect(reasons((await verdictOn(target)).failures)).to.deep.equal([
                "fee-entry-unread",
                "delay-entry-unread",
            ]);
        });

        it("refuses a read it cannot interpret instead of reading a missing rate as zero", async () => {
            for (const rateBps of [null, undefined, "", "0x"]) {
                const target = scriptedController({
                    actorPolicy: async () => ({ active: true, rateBps }),
                });
                expect(
                    reasons((await verdictOn(target)).failures),
                    `rateBps=${JSON.stringify(rateBps)}`
                ).to.deep.equal(["fee-entry-unread"]);
            }
            const noFlag = scriptedController({ actorBypass: async () => ({ bypass: true }) });
            expect(reasons((await verdictOn(noFlag)).failures)).to.deep.equal([
                "delay-entry-unread",
            ]);
        });

        it("refuses an observation handed in without either half", () => {
            const { failures } = evaluateExemptions({
                armed: true,
                observations: [{ caller: exemptCaller()[0] }],
            });
            expect(reasons(failures)).to.deep.equal(["fee-entry-unread", "delay-entry-unread"]);
        });
    });

    describe("an observation gathered some other way, not through readRegistrations", () => {
        const observationWith = (actorPolicy, actorBypass) => [
            { caller: exemptCaller()[0], actorPolicy, actorBypass },
        ];

        it("certifies a rate that reads back as a real ethers BigNumber zero", () => {
            const { failures, certified } = evaluateExemptions({
                armed: true,
                observations: observationWith(
                    { active: true, rateBps: ethers.BigNumber.from(0) },
                    { active: true, bypass: true }
                ),
            });
            expect(failures).to.be.empty;
            expect(certified).to.be.true;
        });

        it('certifies a rate handed in as the numeral string "0"', () => {
            const { failures, certified } = evaluateExemptions({
                armed: true,
                observations: observationWith(
                    { active: true, rateBps: "0" },
                    { active: true, bypass: true }
                ),
            });
            expect(failures).to.be.empty;
            expect(certified).to.be.true;
        });

        it("refuses a rate asRate cannot parse as unread, not as a charge", () => {
            for (const rateBps of [null, "abc", "0x"]) {
                const { failures } = evaluateExemptions({
                    armed: true,
                    observations: observationWith(
                        { active: true, rateBps },
                        { active: true, bypass: true }
                    ),
                });
                expect(reasons(failures), `rateBps=${JSON.stringify(rateBps)}`).to.deep.equal([
                    "fee-entry-unread",
                ]);
            }
        });

        it("refuses a fee flag that is not a boolean as unread, not as inactive", () => {
            const { failures } = evaluateExemptions({
                armed: true,
                observations: observationWith(
                    { active: "true", rateBps: 0 },
                    { active: true, bypass: true }
                ),
            });
            expect(reasons(failures)).to.deep.equal(["fee-entry-unread"]);
        });

        it("refuses a delay flag that is not a boolean as unread, not as forcing the delay", () => {
            const { failures } = evaluateExemptions({
                armed: true,
                observations: observationWith(
                    { active: true, rateBps: 0 },
                    { active: true, bypass: "false" }
                ),
            });
            expect(reasons(failures)).to.deep.equal(["delay-entry-unread"]);
        });
    });

    describe("what the registry itself must not become", () => {
        for (const registration of ["passthrough", "structural", "", "Bypass", undefined]) {
            // the first two are retired kinds
            it(`refuses an entry registered as ${JSON.stringify(registration)} as undecided, even with the pair on chain`, async () => {
                await writePair();
                // Spread rather than the helper's default parameter, which would
                // turn `undefined` back into "bypass".
                const { failures, certified } = await verdictOn(controller, [
                    { ...exemptCaller()[0], registration },
                ]);
                expect(reasons(failures)).to.deep.equal(["undecided-registration"]);
                expect(failures[0].detail).to.include("TestCollector");
                expect(certified).to.be.false;
            });
        }

        it("refuses an empty registry — an empty list certifies nothing", () => {
            const { failures } = evaluateExemptions({ armed: true, observations: [] });
            expect(reasons(failures)).to.deep.equal(["empty-registry"]);
        });
    });

    describe("the switch state", () => {
        it("refuses whether or not the delay is already armed — the check gates arming", async () => {
            await writeDelay(true, true);
            const observations = await readRegistrations(controller, exemptCaller());
            expect(evaluateExemptions({ armed: false, observations }).failures).to.have.lengthOf(
                1
            );
            expect(evaluateExemptions({ armed: true, observations }).failures).to.have.lengthOf(1);
        });

        it("says so when the perimeter is already holding money", async () => {
            const observations = await readRegistrations(controller, exemptCaller());
            const armed = evaluateExemptions({
                armed: true,
                globalDelaySeconds: 3600,
                observations,
            });
            expect(armed.holding).to.be.true;
            const inert = evaluateExemptions({ armed: true, globalDelaySeconds: 0, observations });
            expect(inert.holding).to.be.false;
        });

        it("never certifies a switch read on one view only, whichever view answered", async () => {
            await writePair();
            const observations = await readRegistrations(controller, exemptCaller());
            const cases = [
                {
                    armed: SWITCH_UNREAD,
                    globalDelaySeconds: 0,
                    unread: "securityPerimeterEnabled()",
                },
                {
                    armed: SWITCH_UNREAD,
                    globalDelaySeconds: 3600,
                    unread: "securityPerimeterEnabled()",
                },
                {
                    armed: false,
                    globalDelaySeconds: SWITCH_UNREAD,
                    unread: "globalDelaySeconds()",
                },
                { armed: true, globalDelaySeconds: SWITCH_UNREAD, unread: "globalDelaySeconds()" },
            ];
            for (const { armed, globalDelaySeconds, unread } of cases) {
                const label = `armed=${armed}, globalDelaySeconds=${globalDelaySeconds}`;
                const verdict = evaluateExemptions({ armed, globalDelaySeconds, observations });
                expect(verdict.certified, label).to.be.false;
                expect(verdict.holding, label).to.be.false;
                expect(reasons(verdict.failures), label).to.deep.equal(["arming-state-unread"]);
                expect(verdict.failures[0].detail, label).to.include(
                    `${unread} could not be read on this controller`
                );
            }
        });
    });

    describe("the assertion an operator and the rehearsal both run", () => {
        const thrownBy = async (target, callers = exemptCaller()) => {
            try {
                await assertContractCallersExempt(target, { callers });
            } catch (thrown) {
                return thrown;
            }
            return null;
        };

        it("throws, naming the address, the surface and both calls that fix it", async () => {
            const error = await thrownBy(controller);
            expect(error, "a missing exemption must refuse certification").to.not.be.null;
            expect(error.message).to.include("TestCollector");
            expect(error.message).to.include(COLLECTOR);
            expect(error.message).to.include(LENDER_WITHDRAW);
            expect(error.message).to.include(
                `setActorPolicy(${SURFACE_IDS[LENDER_WITHDRAW]}, ${COLLECTOR}, {active: true, rateBps: 0})`
            );
            expect(error.message).to.include(
                `setActorBypass(${SURFACE_IDS[LENDER_WITHDRAW]}, ${COLLECTOR}, {active: true, bypass: true})`
            );
        });

        it("throws when only the delay half is written", async () => {
            await writeDelay(true, true);
            const error = await thrownBy(controller);
            expect(error).to.not.be.null;
            expect(error.message).to.include("[fee-entry-inactive]");
            expect(error.message).to.not.include("[delay-entry-inactive]");
        });

        it("throws when a read fails, naming the unread entry", async () => {
            const error = await thrownBy(
                scriptedController({
                    actorBypass: async () => {
                        throw new Error("missing revert data in call exception");
                    },
                })
            );
            expect(error).to.not.be.null;
            expect(error.message).to.include("[delay-entry-unread]");
        });

        it("refuses when the controller lacks the delay switch views, even with every exemption written", async () => {
            await writePair();
            const target = {
                actorPolicy: (...args) => controller.actorPolicy(...args),
                actorBypass: (...args) => controller.actorBypass(...args),
            };
            const error = await thrownBy(target);
            expect(error, "an unread switch must refuse certification").to.not.be.null;
            expect(error.message).to.include("[arming-state-unread]");
            expect(error.message).to.include(
                "securityPerimeterEnabled() and globalDelaySeconds() could not be read on this controller"
            );
            expect(error.message).to.not.include("is not a function");
        });

        /** A controller that serves the written pair, with each switch view
         *  answering or throwing as the case needs. */
        const halfReadSwitch = ({ securityPerimeterEnabled, globalDelaySeconds }) => ({
            actorPolicy: (...args) => controller.actorPolicy(...args),
            actorBypass: (...args) => controller.actorBypass(...args),
            securityPerimeterEnabled,
            globalDelaySeconds,
        });
        const libraryError = () => {
            throw new Error(RAW_LIBRARY_ERROR);
        };

        it("refuses when securityPerimeterEnabled() throws and globalDelaySeconds() answers, naming the view it could not read", async () => {
            await writePair();
            const error = await thrownBy(
                halfReadSwitch({
                    securityPerimeterEnabled: async () => libraryError(),
                    globalDelaySeconds: async () => 3600,
                })
            );
            expect(error, "a switch read on one view only must refuse certification").to.not.be
                .null;
            expect(error.message).to.include("[arming-state-unread]");
            expect(error.message).to.include(
                "securityPerimeterEnabled() could not be read on this controller"
            );
            expect(error.message).to.not.include("globalDelaySeconds() could not be read");
            expect(error.message).to.not.include("CALL_EXCEPTION");
            expect(error.message).to.not.include("does not carry its whole exemption");
        });

        it("refuses when globalDelaySeconds() throws, even though securityPerimeterEnabled() answers false", async () => {
            await writePair();
            const error = await thrownBy(
                halfReadSwitch({
                    securityPerimeterEnabled: async () => false,
                    globalDelaySeconds: async () => libraryError(),
                })
            );
            expect(error, "a switch that reads off on one view only must refuse certification").to
                .not.be.null;
            expect(error.message).to.include("[arming-state-unread]");
            expect(error.message).to.include(
                "globalDelaySeconds() could not be read on this controller"
            );
            expect(error.message).to.not.include("securityPerimeterEnabled() could not be read");
            expect(error.message).to.not.include("CALL_EXCEPTION");
            expect(error.message).to.not.include("does not carry its whole exemption");
        });

        it("returns quietly once the chain carries the pair", async () => {
            await writePair();
            const result = await assertContractCallersExempt(controller, {
                callers: exemptCaller(),
            });
            expect(result.certified).to.be.true;
        });
    });

    describe("bypasses the controller carries that the registry does not name", () => {
        const thrownBy = async (target, callers = exemptCaller()) => {
            try {
                await assertContractCallersExempt(target, { callers });
            } catch (thrown) {
                return thrown;
            }
            return null;
        };

        const SUBPRODUCT = ethers.utils.getAddress(`0x${"11".repeat(20)}`);
        const UNREGISTERED_ACTOR = ethers.utils.getAddress(`0x${"22".repeat(20)}`);

        it("refuses an active surface-tier bypass nobody registered, naming the surface", async () => {
            await writePair();
            await controller.setSurfaceBypassTest(SURFACE_IDS[LENDER_WITHDRAW], true, true);
            const error = await thrownBy(controller);
            expect(error, "an unregistered surface bypass must refuse certification").to.not.be
                .null;
            expect(error.message).to.include("[unregistered-surface-bypass]");
            expect(error.message).to.include(LENDER_WITHDRAW);
            expect(error.message).to.include(
                "Every withdrawal on this surface pays out with no hold"
            );
        });

        it("refuses an active sub-product-tier bypass nobody registered, naming the pool", async () => {
            await writePair();
            await controller.setSubProductBypassTest(
                SURFACE_IDS[LENDER_WITHDRAW],
                SUBPRODUCT,
                true,
                true
            );
            const error = await thrownBy(controller);
            expect(error, "an unregistered sub-product bypass must refuse certification").to.not.be
                .null;
            expect(error.message).to.include("[unregistered-subproduct-bypass]");
            expect(error.message).to.include(SUBPRODUCT);
        });

        it("refuses an active actor-tier bypass for an address the registry does not name", async () => {
            await writePair();
            await controller.setActorBypassTest(
                SURFACE_IDS[LENDER_WITHDRAW],
                UNREGISTERED_ACTOR,
                true,
                true
            );
            const error = await thrownBy(controller);
            expect(error, "an unregistered actor bypass must refuse certification").to.not.be.null;
            expect(error.message).to.include("[unregistered-actor-bypass]");
            expect(error.message).to.include(UNREGISTERED_ACTOR);
        });

        it("does not confuse the registered collector's own bypass with an unregistered one", async () => {
            await writePair();
            // The registered pair alone must never trip the new check — this
            // is the same state "returns quietly once the chain carries the
            // pair" certifies, re-asserted here against the bypass judgement
            // directly rather than only the combined certification.
            const { entries, unreadable } = await readActiveBypasses(controller);
            const verdict = evaluateActiveBypasses({
                entries,
                unreadable,
                callers: exemptCaller(),
            });
            expect(verdict.certified, JSON.stringify(verdict.failures)).to.be.true;
        });

        it("refuses when an enumeration view throws, never reading it as no bypasses", async () => {
            await writePair();
            const target = {
                actorPolicy: (...args) => controller.actorPolicy(...args),
                actorBypass: (...args) => controller.actorBypass(...args),
                securityPerimeterEnabled: () => controller.securityPerimeterEnabled(),
                globalDelaySeconds: () => controller.globalDelaySeconds(),
                bypassSurfaceIds: async () => {
                    throw new Error("call revert exception");
                },
            };
            const error = await thrownBy(target);
            expect(error, "an unreadable enumeration view must refuse certification").to.not.be
                .null;
            expect(error.message).to.include("[bypass-enumeration-unread]");
            expect(error.message).to.include("bypassSurfaceIds()");
            expect(error.message).to.not.include("is not a function");
        });

        it("still certifies the configuration it is supposed to accept", async () => {
            await writePair();
            const result = await assertContractCallersExempt(controller, {
                callers: exemptCaller(),
            });
            expect(result.certified).to.be.true;
        });
    });
});

describe("Perimeter — perimeter:verify-arming's --controller resolution", () => {
    // An explicitly supplied --controller and an omitted one must not be
    // treated the same way: only an omitted value may fall back to the saved
    // deployment record. A mistyped address passed deliberately must refuse
    // outright, not silently certify whatever the saved deployment happens to
    // point at instead.
    const thrownBy = async (params) => {
        try {
            await hre.run("perimeter:verify-arming", params);
        } catch (thrown) {
            return thrown;
        }
        return null;
    };

    it("throws on an explicitly supplied --controller that is not a valid address", async () => {
        const error = await thrownBy({ controller: "not-an-address" });
        expect(error, "a malformed --controller must refuse, not fall back").to.not.be.null;
        expect(error.message).to.match(/not a valid address/);
    });

    it("throws on an explicitly supplied EMPTY --controller instead of falling back (RV-1)", async () => {
        const error = await thrownBy({ controller: "" });
        expect(error, "an empty --controller must refuse, not fall back").to.not.be.null;
        expect(error.message).to.match(/not a valid address/);
    });

    it("still falls back to the saved deployment record when --controller is omitted", async () => {
        const error = await thrownBy({});
        // No ExitFeeController deployment is saved for this test network, so
        // the fallback path fails too - but on ITS OWN error, proving the
        // omitted case never reaches the "not a valid address" refusal above.
        expect(error, "an omitted --controller must still attempt the deployment fallback").to.not
            .be.null;
        expect(error.message).to.not.match(/not a valid address/);
    });
});
