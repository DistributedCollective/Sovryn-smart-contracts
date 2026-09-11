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
 * Run:
 *   npx hardhat test tests/perimeter/ArmingGuard.contractCallers.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
    SURFACE_IDS,
    CONTRACT_CALLERS,
    readRegistrations,
    evaluateExemptions,
    assertContractCallersExempt,
} = require("../../hardhat/tasks/perimeter/contractCallerExemptions");

const MockExitFeeController = artifacts.require("MockExitFeeController");

const LENDER_WITHDRAW = "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW";
const BORROWER_WITHDRAW = "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW";
const COLLECTOR = "0x115cAF168c51eD15ec535727F64684D33B7b08D1";
const NO_CODE = "0x00000000000000000000000000000000000000A1";

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

    describe("what the registry itself must not become", () => {
        for (const registration of ["passthrough", "structural", "", "Bypass", undefined]) {
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

        it("returns quietly once the chain carries the pair", async () => {
            await writePair();
            const result = await assertContractCallersExempt(controller, {
                callers: exemptCaller(),
            });
            expect(result.certified).to.be.true;
        });
    });
});
