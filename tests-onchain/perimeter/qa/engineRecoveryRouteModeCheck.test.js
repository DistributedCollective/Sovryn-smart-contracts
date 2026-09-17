/**
 * Isolated regression for `route`'s own postcondition, `recoveryRouteActive`.
 *
 * `routeId` hashes only surface, sub-product, token and destination — the
 * four fields the real queue keys its own storage on — so those four
 * genuinely cannot land wrong without this postcondition catching it. The
 * fifth field the same struct carries, `topUpPool` (whether recovered escrow
 * goes back to the pool it came from, or to a plain address), is NOT part of
 * that hash and was not re-checked at all: a route registered active at the
 * right id but the wrong mode still read `active: true`, satisfied.
 *
 * `POSTCONDITIONS.recoveryRouteActive` is exercised directly through
 * `engine.runPostcondition` — pure apart from the one view call its
 * descriptor names, so this runs against a fake queue on Hardhat's own
 * in-process network — no fork, no `--network`.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/engineRecoveryRouteModeCheck.test.js
 */
const { expect } = require("chai");

const engine = require("./engine");

const ROUTE_ID = "0x" + "ab".repeat(32);

const held = (args, route) =>
    engine.runPostcondition(
        { queue: { getRecoveryRoute: async () => route } },
        { kind: "recoveryRouteActive", args }
    );

describe("QA scenario engine — route's postcondition also confirms its own top-up-vs-address mode", () => {
    it("still fires when the route is not active at all, regardless of mode", async () => {
        const result = await held(
            { routeId: ROUTE_ID, topUpPool: true },
            { active: false, topUpPool: true }
        );
        expect(result).to.not.equal(true);
        expect(result).to.match(/is not active/);
    });

    it("fires when a route is active at the right id but registered in the OTHER mode", async () => {
        // The exact gap this check closes: a second registration that hashes
        // to the same routeId (same surface/sub-product/token/destination)
        // but flips `topUpPool` overwrites the stored mode unconditionally,
        // and the old check — `active` alone — read this as satisfied.
        const result = await held(
            { routeId: ROUTE_ID, topUpPool: true },
            { active: true, topUpPool: false }
        );
        expect(result, "a mode mismatch must not read as satisfied").to.not.equal(true);
        expect(result).to.match(/topUpPool=false/);
    });

    it("fires the other direction too: expected a plain address, registered as top-up", async () => {
        const result = await held(
            { routeId: ROUTE_ID, topUpPool: false },
            { active: true, topUpPool: true }
        );
        expect(result).to.not.equal(true);
        expect(result).to.match(/topUpPool=true/);
    });

    it("passes when the route is active and its mode matches what was submitted — top-up", async () => {
        const result = await held(
            { routeId: ROUTE_ID, topUpPool: true },
            { active: true, topUpPool: true }
        );
        expect(result).to.equal(true);
    });

    it("passes when the route is active and its mode matches what was submitted — a plain address", async () => {
        const result = await held(
            { routeId: ROUTE_ID, topUpPool: false },
            { active: true, topUpPool: false }
        );
        expect(result).to.equal(true);
    });

    it("stays backward-compatible with a persisted postcondition that carries no topUpPool at all", async () => {
        // A state-file entry written before this fix has no `topUpPool` in
        // its args — `undefined` must not be treated as "expected false".
        const result = await held({ routeId: ROUTE_ID }, { active: true, topUpPool: true });
        expect(result).to.equal(true);
    });
});
