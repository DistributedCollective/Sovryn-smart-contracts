/**
 * The go-live check that stands between the delay and the contracts that
 * withdraw on somebody else's behalf.
 *
 * A hooked withdrawal initiated by a contract produces a queue request whose
 * only permitted executors are that contract, and most such contracts read the
 * withdrawal's return value as cash that arrived in the same transaction. Arm
 * the delay with one of them unexempted and it pays its user out of money that
 * belongs to somebody else, while the user's own money sits in an escrow that
 * nobody on chain can release. The remedy is configuration, so the failure is
 * silent by construction: nothing in the contracts, the proposals or the
 * activation ordering notices.
 *
 * This is what notices. The registry below names each such contract and how it
 * must be registered; the check reads the live controller and refuses to
 * certify go-live until the chain agrees.
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
const COLLECTOR = "0x115cAF168c51eD15ec535727F64684D33B7b08D1";
const WRAPPER = "0x00000000000000000000000000000000000000A1";

/** A registry of one, so the test never depends on the live list's contents. */
const bypassCaller = (address = COLLECTOR) => [
    {
        name: "TestCollector",
        address,
        surface: LENDER_WITHDRAW,
        registration: "bypass",
        why: "reads the burn's return value as cash",
    },
];

const passthroughCaller = (address = WRAPPER) => [
    {
        name: "TestWrapper",
        address,
        surface: LENDER_WITHDRAW,
        registration: "passthrough",
        why: "names the end user as the receiver",
    },
];

const reasons = (failures) => failures.map((f) => f.reason);

describe("Perimeter — the arming guard for contract-initiated withdrawals", () => {
    let controller;

    beforeEach(async () => {
        controller = await MockExitFeeController.new();
        await controller.setGlobalDelaySecondsTest(3600);
        await controller.setSecurityPerimeterEnabledTest(true);
    });

    describe("the registry the release ships with", () => {
        it("names the fee-sharing collector as a bypass on the lender-withdraw surface", () => {
            const collector = CONTRACT_CALLERS.find((c) => c.name === "FeeSharingCollector");
            expect(collector, "the collector is the known case and must not be dropped").to.exist;
            expect(collector.surface).to.equal(LENDER_WITHDRAW);
            expect(collector.registration).to.equal("bypass");
            expect(ethers.utils.getAddress(collector.address)).to.equal(
                ethers.utils.getAddress(COLLECTOR)
            );
        });

        it("gives every entry a decided registration, a known surface and a reason", () => {
            expect(CONTRACT_CALLERS.length).to.be.greaterThan(0);
            for (const caller of CONTRACT_CALLERS) {
                expect(["bypass", "passthrough"], `${caller.name}`).to.include(
                    caller.registration
                );
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

    describe("a caller that must be bypassed", () => {
        it("refuses go-live while the bypass is missing", async () => {
            const observations = await readRegistrations(controller, bypassCaller());
            const { failures } = evaluateExemptions({
                armed: true,
                globalDelaySeconds: 3600,
                observations,
            });
            expect(reasons(failures)).to.deep.equal(["not-exempt"]);
        });

        it("refuses go-live while the bypass is registered but switched off", async () => {
            await controller.setActorBypassTest(
                SURFACE_IDS[LENDER_WITHDRAW],
                COLLECTOR,
                false,
                true
            );
            const observations = await readRegistrations(controller, bypassCaller());
            expect(
                reasons(evaluateExemptions({ armed: true, observations }).failures)
            ).to.deep.equal(["not-exempt"]);
        });

        it("refuses go-live on an active policy that delays rather than bypasses", async () => {
            await controller.setActorBypassTest(
                SURFACE_IDS[LENDER_WITHDRAW],
                COLLECTOR,
                true,
                false
            );
            const observations = await readRegistrations(controller, bypassCaller());
            expect(
                reasons(evaluateExemptions({ armed: true, observations }).failures)
            ).to.deep.equal(["not-exempt"]);
        });

        it("certifies go-live once the bypass is active and bypassing", async () => {
            await controller.setActorBypassTest(
                SURFACE_IDS[LENDER_WITHDRAW],
                COLLECTOR,
                true,
                true
            );
            const observations = await readRegistrations(controller, bypassCaller());
            const { failures, certified } = evaluateExemptions({ armed: true, observations });
            expect(failures).to.be.empty;
            expect(certified).to.be.true;
        });

        it("refuses a passthrough standing in for the bypass, even a complete one", async () => {
            // The mistake the review calls easy and silent: a passthrough resolves
            // the actor to the receiver, and on the collector's own path the
            // receiver IS the collector, so nothing changes and the actor bypass
            // — keyed on the raw caller — is never consulted.
            await controller.setActorBypassTest(
                SURFACE_IDS[LENDER_WITHDRAW],
                COLLECTOR,
                true,
                true
            );
            await controller.setPassthroughActorTest(
                SURFACE_IDS[LENDER_WITHDRAW],
                COLLECTOR,
                true
            );
            const observations = await readRegistrations(controller, bypassCaller());
            expect(
                reasons(evaluateExemptions({ armed: true, observations }).failures)
            ).to.deep.equal(["bypass-shadowed-by-passthrough"]);
        });
    });

    describe("a caller that must be a passthrough", () => {
        it("refuses go-live while the passthrough is missing", async () => {
            const observations = await readRegistrations(controller, passthroughCaller());
            expect(
                reasons(evaluateExemptions({ armed: true, observations }).failures)
            ).to.deep.equal(["not-passthrough"]);
        });

        it("certifies go-live once the passthrough is registered", async () => {
            await controller.setPassthroughActorTest(SURFACE_IDS[LENDER_WITHDRAW], WRAPPER, true);
            const observations = await readRegistrations(controller, passthroughCaller());
            expect(evaluateExemptions({ armed: true, observations }).failures).to.be.empty;
        });

        it("refuses a dead actor bypass sitting beside the passthrough", async () => {
            await controller.setPassthroughActorTest(SURFACE_IDS[LENDER_WITHDRAW], WRAPPER, true);
            await controller.setActorBypassTest(SURFACE_IDS[LENDER_WITHDRAW], WRAPPER, true, true);
            const observations = await readRegistrations(controller, passthroughCaller());
            expect(
                reasons(evaluateExemptions({ armed: true, observations }).failures)
            ).to.deep.equal(["unreachable-actor-bypass"]);
        });
    });

    describe("what the registry itself must not become", () => {
        it("refuses an entry whose registration nobody decided", () => {
            const { failures } = evaluateExemptions({
                armed: true,
                observations: [
                    {
                        caller: { name: "Undecided", address: WRAPPER, surface: LENDER_WITHDRAW },
                        actorBypass: { active: false, bypass: false },
                        passthrough: false,
                    },
                ],
            });
            expect(reasons(failures)).to.deep.equal(["undecided-registration"]);
        });

        it("refuses an empty registry — an empty list certifies nothing", () => {
            const { failures } = evaluateExemptions({ armed: true, observations: [] });
            expect(reasons(failures)).to.deep.equal(["empty-registry"]);
        });
    });

    describe("the switch state", () => {
        it("refuses whether or not the delay is already armed — the check gates arming", async () => {
            const observations = await readRegistrations(controller, bypassCaller());
            expect(evaluateExemptions({ armed: false, observations }).failures).to.have.lengthOf(
                1
            );
            expect(evaluateExemptions({ armed: true, observations }).failures).to.have.lengthOf(1);
        });

        it("says so when the perimeter is already holding money", async () => {
            const observations = await readRegistrations(controller, bypassCaller());
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
        it("throws, naming the contract, the surface and the call that fixes it", async () => {
            let error = null;
            try {
                await assertContractCallersExempt(controller, { callers: bypassCaller() });
            } catch (thrown) {
                error = thrown;
            }
            expect(error, "an unexempt caller must refuse certification").to.not.be.null;
            expect(error.message).to.include("TestCollector");
            expect(error.message).to.include(COLLECTOR);
            expect(error.message).to.include(LENDER_WITHDRAW);
            expect(error.message).to.include("setActorBypass");
        });

        it("returns quietly once the chain agrees with the registry", async () => {
            await controller.setActorBypassTest(
                SURFACE_IDS[LENDER_WITHDRAW],
                COLLECTOR,
                true,
                true
            );
            const result = await assertContractCallersExempt(controller, {
                callers: bypassCaller(),
            });
            expect(result.certified).to.be.true;
        });
    });
});
