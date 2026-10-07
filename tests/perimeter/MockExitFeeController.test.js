/**
 * `contracts/mockup/perimeter/MockExitFeeController.sol` against the real
 * controller's own documented behaviour for the three surfaces this mock
 * mirrors: `revokeExemption`, the surface-tier bypass enumeration
 * (`surfaceBypassKeys` versus the any-tier `bypassSurfaceIds`), and
 * `quoteExitDelay`'s actor/sub-product/surface resolution order. The mock is
 * a test double for this repository's own unit tests — never deployed, never
 * in a live withdrawal's path — so the only thing at stake is whether a test
 * built against it can trust what it reports.
 *
 * Run:
 *   npx hardhat test tests/perimeter/MockExitFeeController.test.js
 */

const { expect } = require("chai");

const policy = require("../../hardhat/tasks/perimeter/policy");

const MockExitFeeController = artifacts.require("MockExitFeeController");

const LENDER_WITHDRAW = "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW";
const BORROWER_WITHDRAW = "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW";
const SURFACE_ID = policy.SURFACES[LENDER_WITHDRAW];
const OTHER_SURFACE_ID = policy.SURFACES[BORROWER_WITHDRAW];
const ACTOR = "0x2BEe6167f91D10db23252e03de039Da6b9047D49";
const SUB_PRODUCT = "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE";

describe("MockExitFeeController — revokeExemption", () => {
    let controller;

    beforeEach(async () => {
        controller = await MockExitFeeController.new();
        await controller.grantExemption(SURFACE_ID, ACTOR);
    });

    it("clears the fee entry to inactive", async () => {
        await controller.revokeExemption(SURFACE_ID, ACTOR);
        const fee = await controller.actorPolicy(SURFACE_ID, ACTOR);
        expect(fee.active).to.equal(false);
    });

    it("sets the delay entry active with no bypass — held, not falling through", async () => {
        await controller.revokeExemption(SURFACE_ID, ACTOR);
        const delay = await controller.actorBypass(SURFACE_ID, ACTOR);
        expect([delay.active, delay.bypass]).to.deep.equal([true, false]);
    });

    it("keeps the actor in the delay-bypass enumeration — retained, not dropped", async () => {
        await controller.revokeExemption(SURFACE_ID, ACTOR);
        const keys = await controller.actorBypassKeys(SURFACE_ID);
        expect(keys.map((a) => a.toLowerCase())).to.include(ACTOR.toLowerCase());
    });

    it("keeps the surface in the any-tier bypass enumeration", async () => {
        await controller.revokeExemption(SURFACE_ID, ACTOR);
        const ids = await controller.bypassSurfaceIds();
        expect(ids.map((id) => id.toLowerCase())).to.include(SURFACE_ID.toLowerCase());
    });

    it("a test built against it can observe the exemption actually withdrawn", async () => {
        // Before the fix this was an empty no-op: grant, then revoke, then
        // read back — and the exemption still read active on both halves.
        let fee = await controller.actorPolicy(SURFACE_ID, ACTOR);
        let delay = await controller.actorBypass(SURFACE_ID, ACTOR);
        expect([fee.active, delay.active, delay.bypass], "granted").to.deep.equal([
            true,
            true,
            true,
        ]);

        await controller.revokeExemption(SURFACE_ID, ACTOR);

        fee = await controller.actorPolicy(SURFACE_ID, ACTOR);
        delay = await controller.actorBypass(SURFACE_ID, ACTOR);
        expect([fee.active, delay.active, delay.bypass], "revoked").to.deep.equal([
            false,
            true,
            false,
        ]);
    });
});

describe("MockExitFeeController — surfaceBypassKeys versus bypassSurfaceIds", () => {
    let controller;

    beforeEach(async () => {
        controller = await MockExitFeeController.new();
    });

    it("does not list a surface whose only bypass is actor-tier (grantExemption)", async () => {
        await controller.grantExemption(SURFACE_ID, ACTOR);
        const surfaceKeys = await controller.surfaceBypassKeys();
        expect(surfaceKeys.map((id) => id.toLowerCase())).to.not.include(SURFACE_ID.toLowerCase());
        // The any-tier master set still names it — that is what the arming
        // guard's discovery reads.
        const anyTierIds = await controller.bypassSurfaceIds();
        expect(anyTierIds.map((id) => id.toLowerCase())).to.include(SURFACE_ID.toLowerCase());
    });

    it("does not list a surface whose only bypass is actor-tier (setActorBypass)", async () => {
        await controller.setActorBypass(SURFACE_ID, ACTOR, { active: true, bypass: true });
        const surfaceKeys = await controller.surfaceBypassKeys();
        expect(surfaceKeys.map((id) => id.toLowerCase())).to.not.include(SURFACE_ID.toLowerCase());
    });

    it("does not list a surface whose only bypass is sub-product-tier", async () => {
        await controller.setSubProductBypass(SURFACE_ID, SUB_PRODUCT, {
            active: true,
            bypass: true,
        });
        const surfaceKeys = await controller.surfaceBypassKeys();
        expect(surfaceKeys.map((id) => id.toLowerCase())).to.not.include(SURFACE_ID.toLowerCase());
    });

    it("lists a surface once its own surface-tier bypass is written", async () => {
        await controller.setSurfaceBypass(SURFACE_ID, { active: true, bypass: true });
        const surfaceKeys = await controller.surfaceBypassKeys();
        expect(surfaceKeys.map((id) => id.toLowerCase())).to.include(SURFACE_ID.toLowerCase());
    });

    it("keeps the two enumerations independent across multiple surfaces", async () => {
        await controller.setSurfaceBypass(SURFACE_ID, { active: true, bypass: true });
        await controller.grantExemption(OTHER_SURFACE_ID, ACTOR);

        const surfaceKeys = (await controller.surfaceBypassKeys()).map((id) => id.toLowerCase());
        const anyTierIds = (await controller.bypassSurfaceIds()).map((id) => id.toLowerCase());

        expect(surfaceKeys).to.deep.equal([SURFACE_ID.toLowerCase()]);
        expect(anyTierIds.sort()).to.deep.equal(
            [SURFACE_ID.toLowerCase(), OTHER_SURFACE_ID.toLowerCase()].sort()
        );
    });
});

describe("MockExitFeeController — quoteExitDelay resolution order", () => {
    let controller;
    const DELAY_SECONDS = 3600;

    beforeEach(async () => {
        controller = await MockExitFeeController.new();
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY_SECONDS);
    });

    it("returns the global delay with nothing configured at any tier", async () => {
        const delay = await controller.quoteExitDelay(SURFACE_ID, SUB_PRODUCT, ACTOR);
        expect(Number(delay)).to.equal(DELAY_SECONDS);
    });

    it("returns 0 when the perimeter is switched off, whatever the tiers say", async () => {
        await controller.setActorBypassTest(SURFACE_ID, ACTOR, true, true);
        await controller.setSecurityPerimeterEnabledTest(false);
        const delay = await controller.quoteExitDelay(SURFACE_ID, SUB_PRODUCT, ACTOR);
        expect(Number(delay)).to.equal(0);
    });

    it("surface-tier bypass applies when neither sub-product nor actor is configured", async () => {
        await controller.setSurfaceBypassTest(SURFACE_ID, true, true);
        const delay = await controller.quoteExitDelay(SURFACE_ID, SUB_PRODUCT, ACTOR);
        expect(Number(delay)).to.equal(0);
    });

    it("an active surface-tier entry with no bypass forces the delay", async () => {
        await controller.setSurfaceBypassTest(SURFACE_ID, true, false);
        const delay = await controller.quoteExitDelay(SURFACE_ID, SUB_PRODUCT, ACTOR);
        expect(Number(delay)).to.equal(DELAY_SECONDS);
    });

    it("sub-product-tier bypass overrides an active surface-tier entry", async () => {
        await controller.setSurfaceBypassTest(SURFACE_ID, true, false); // held at the surface
        await controller.setSubProductBypassTest(SURFACE_ID, SUB_PRODUCT, true, true);
        const delay = await controller.quoteExitDelay(SURFACE_ID, SUB_PRODUCT, ACTOR);
        expect(Number(delay)).to.equal(0);
    });

    it("actor-tier bypass overrides both sub-product- and surface-tier entries", async () => {
        await controller.setSurfaceBypassTest(SURFACE_ID, true, true); // not held at the surface
        await controller.setSubProductBypassTest(SURFACE_ID, SUB_PRODUCT, true, false); // held at the sub-product
        await controller.setActorBypassTest(SURFACE_ID, ACTOR, true, true); // not held for this actor
        const delay = await controller.quoteExitDelay(SURFACE_ID, SUB_PRODUCT, ACTOR);
        expect(Number(delay)).to.equal(0);
    });

    it("an active actor-tier entry with no bypass forces the delay even under a wider bypass", async () => {
        await controller.setSurfaceBypassTest(SURFACE_ID, true, true);
        await controller.setActorBypassTest(SURFACE_ID, ACTOR, true, false);
        const delay = await controller.quoteExitDelay(SURFACE_ID, SUB_PRODUCT, ACTOR);
        expect(Number(delay)).to.equal(DELAY_SECONDS);
    });

    it("skips the sub-product tier when subProduct is the zero address, even if something is stored there", async () => {
        const zeroAddress = `0x${"0".repeat(40)}`;
        // An entry stored at the zero-address key would force the delay if
        // consulted — the surface-tier bypass below must win instead, since
        // "no sub-product" is not the same as "sub-product zero-address".
        await controller.setSubProductBypassTest(SURFACE_ID, zeroAddress, true, false);
        await controller.setSurfaceBypassTest(SURFACE_ID, true, true);
        const delay = await controller.quoteExitDelay(SURFACE_ID, zeroAddress, ACTOR);
        expect(Number(delay)).to.equal(0);
    });
});
