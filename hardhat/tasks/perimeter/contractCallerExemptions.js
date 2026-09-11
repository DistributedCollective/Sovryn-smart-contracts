/**
 * The addresses the owner has exempted from the perimeter, and the check that
 * the live controller carries every exemption before the withdrawal delay is
 * armed.
 *
 * WHAT AN EXEMPTION IS
 *
 * Two owner entries on the ExitFeeController for one address on one surface.
 * One without the other exempts nothing:
 *
 *   - an actor fee policy `{active: true, rateBps: 0}`. An inactive actor
 *     policy is not a zero rate: resolution falls through to the sub-product
 *     and surface tiers, so the address pays whatever the surface charges, even
 *     when the stored rate reads zero.
 *   - an actor delay bypass `{active: true, bypass: true}`. An active entry with
 *     `bypass: false` is the opposite of an exemption: it forces the global
 *     delay on the address even where a broader tier would lift it.
 *
 * Both entries are keyed on the surface as well as the address, so an entry
 * written under another surface exempts nothing here.
 *
 * The owner decides each exemption per address. Nothing in the contracts or the
 * proposals names these addresses, so this registry is the place that does, and
 * `assertContractCallersExempt` refuses to certify go-live until the controller
 * reads back both entries for every address listed.
 *
 * WHAT IS NOT LISTED
 *
 * A contract that withdraws for its users — a wrapper, a per-user borrowing
 * clone — needs no entry. The queue records it as the request's originator and
 * owner, and because that owner has code, anyone may deliver the request into
 * its recorded receiver once it unlocks.
 *
 * `bypass` is the only registration: it names the two-entry exemption above.
 * An entry marked with anything else is refused as undecided rather than
 * interpreted.
 *
 * AN UNREAD ENTRY IS A REFUSAL
 *
 * A controller read that throws — a controller that does not serve the view,
 * the wrong address, a node error — or that returns a value this module cannot
 * interpret is recorded as unread, and an unread entry refuses certification.
 * It is never taken to mean either "set" or "not set".
 */
const { ethers } = require("ethers");

const surfaceId = (name) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name));

/** The hooked surfaces, hashed the way the contracts hash them. */
const SURFACE_IDS = {
    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW: surfaceId(
        "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW"
    ),
    PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW: surfaceId(
        "PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW"
    ),
    PERIMETER_SURFACE_ZERO_WITHDRAW_COLL: surfaceId("PERIMETER_SURFACE_ZERO_WITHDRAW_COLL"),
    PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS: surfaceId("PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS"),
};

/** The one registration kind: the actor fee policy at rate zero plus the actor
 *  delay bypass, both on the entry's surface. */
const EXEMPTION = "bypass";

const CONTRACT_CALLERS = Object.freeze([
    Object.freeze({
        name: "FeeSharingCollector",
        address: "0x115cAF168c51eD15ec535727F64684D33B7b08D1",
        surface: "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW",
        registration: EXEMPTION,
        why:
            "Pays stakers their share of protocol fees. It redeems the iWRBTC it holds through " +
            "burnToBTC, a hooked lender withdrawal, and refuses a claim when nothing reaches the " +
            "receiver. Protocol fees are not funds a user placed in the system and later " +
            "removed, so the owner exempted it from both the Perimeter fee and the withdrawal " +
            "delay.",
    }),
]);

/**
 * One controller read. A throw, or a value `shape` cannot interpret, comes back
 * as `{ error }` and never as a default value.
 */
const attempt = async (read, shape) => {
    try {
        return shape(await read());
    } catch (error) {
        return { error: (error && error.message) || String(error) };
    }
};

/** A stored rate as a plain integer, or NaN for anything that is not one.
 *  `Number(null)` and `Number("")` are both 0, which would turn a missing rate
 *  into an exempt one, so neither is accepted. */
const asRate = (value) => {
    if (typeof value === "number") return Number.isInteger(value) && value >= 0 ? value : NaN;
    if (value === null || value === undefined) return NaN;
    const text = typeof value === "string" ? value : String(value);
    return /^\d+$/.test(text) ? Number(text) : NaN;
};

const feeShape = (policy) => {
    const rateBps = asRate(policy.rateBps);
    if (typeof policy.active !== "boolean" || Number.isNaN(rateBps)) {
        throw new Error(
            `actorPolicy returned a value that is not {bool active, uint16 rateBps}: ` +
                `active=${policy.active}, rateBps=${policy.rateBps}`
        );
    }
    return { active: policy.active, rateBps };
};

const delayShape = (policy) => {
    if (typeof policy.active !== "boolean" || typeof policy.bypass !== "boolean") {
        throw new Error(
            `actorBypass returned a value that is not {bool active, bool bypass}: ` +
                `active=${policy.active}, bypass=${policy.bypass}`
        );
    }
    return { active: policy.active, bypass: policy.bypass };
};

/**
 * Read what the live controller says about each listed address. Kept apart
 * from the judgement so the judgement is testable without a chain, and so a
 * caller can feed it observations gathered some other way.
 */
const readRegistrations = async (controller, callers = CONTRACT_CALLERS) => {
    const observations = [];
    for (const caller of callers) {
        const surface = SURFACE_IDS[caller.surface];
        if (!surface) {
            throw new Error(
                `Perimeter arming guard: ${caller.name} names the surface ${caller.surface}, ` +
                    "which is not one this release hooks"
            );
        }
        observations.push({
            caller,
            actorPolicy: await attempt(
                () => controller.actorPolicy(surface, caller.address),
                feeShape
            ),
            actorBypass: await attempt(
                () => controller.actorBypass(surface, caller.address),
                delayShape
            ),
        });
    }
    return observations;
};

/** An observation half that is absent, carries a read error, or does not have
 *  the fields the judgement needs. */
const unread = (half, fields) =>
    !half || half.error !== undefined || fields.some((field) => half[field] === undefined);

/**
 * Judge the observations. Pure: no chain, no I/O.
 *
 * The verdict does not depend on whether the delay is armed yet — this check
 * exists to gate arming, so a missing entry refuses certification either way.
 * `armed` and `globalDelaySeconds` only decide whether the failure is a warning
 * about the future or a report that withdrawals may already be held.
 */
const evaluateExemptions = ({ armed = false, globalDelaySeconds = 0, observations = [] } = {}) => {
    const holding = Boolean(armed) && Number(globalDelaySeconds) > 0;
    const failures = [];

    if (observations.length === 0) {
        failures.push({
            name: "(registry)",
            reason: "empty-registry",
            detail:
                "the exemption registry is empty, so this check certifies nothing. The " +
                "fee-sharing collector belongs in it.",
        });
        return { certified: false, holding, armed: Boolean(armed), failures };
    }

    for (const { caller, actorPolicy, actorBypass } of observations) {
        const where = `${caller.name} (${caller.address}) on ${caller.surface}`;
        const key = `${SURFACE_IDS[caller.surface] || caller.surface}, ${caller.address}`;
        const feeCall = `setActorPolicy(${key}, {active: true, rateBps: 0})`;
        const delayCall = `setActorBypass(${key}, {active: true, bypass: true})`;
        const owner = "as the controller owner, then read it back";

        if (caller.registration !== EXEMPTION) {
            failures.push({
                name: caller.name,
                reason: "undecided-registration",
                detail:
                    `${where} is registered as ${JSON.stringify(caller.registration)}, which is ` +
                    `not a decided registration. The only one is "${EXEMPTION}": the owner's ` +
                    "exemption of this address, written as a zero actor fee rate and an actor " +
                    "delay bypass. Record the owner's decision and mark the entry " +
                    `"${EXEMPTION}", or remove it.`,
            });
            continue;
        }

        if (unread(actorPolicy, ["active", "rateBps"])) {
            failures.push({
                name: caller.name,
                reason: "fee-entry-unread",
                detail:
                    `the actor fee policy for ${where} could not be read ` +
                    `(${(actorPolicy && actorPolicy.error) || "no observation"}). An entry ` +
                    "that cannot be read is not an exemption. Check that the address is the " +
                    "ExitFeeController and that it serves actorPolicy(bytes32,address), then " +
                    "run this again.",
            });
        } else if (actorPolicy.active !== true) {
            failures.push({
                name: caller.name,
                reason: "fee-entry-inactive",
                detail:
                    `${where} has no active actor fee policy (active=${actorPolicy.active}, ` +
                    `rateBps=${actorPolicy.rateBps}). An inactive entry falls through to the ` +
                    "sub-product and surface rates, so this address pays the Perimeter fee. " +
                    `Run ${feeCall} ${owner} before arming.`,
            });
        } else if (actorPolicy.rateBps !== 0) {
            failures.push({
                name: caller.name,
                reason: "fee-rate-not-zero",
                detail:
                    `${where} has an active actor fee policy charging ` +
                    `${actorPolicy.rateBps} bps, which is a rate, not an exemption. ` +
                    `Run ${feeCall} ${owner} before arming.`,
            });
        }

        if (unread(actorBypass, ["active", "bypass"])) {
            failures.push({
                name: caller.name,
                reason: "delay-entry-unread",
                detail:
                    `the actor delay bypass for ${where} could not be read ` +
                    `(${(actorBypass && actorBypass.error) || "no observation"}). An entry ` +
                    "that cannot be read is not an exemption. Check that the address is the " +
                    "ExitFeeController on the delay build and that it serves " +
                    "actorBypass(bytes32,address), then run this again.",
            });
        } else if (actorBypass.active !== true) {
            failures.push({
                name: caller.name,
                reason: "delay-entry-inactive",
                detail:
                    `${where} has no active actor delay bypass (active=${actorBypass.active}, ` +
                    `bypass=${actorBypass.bypass}). An inactive entry falls through to the ` +
                    "sub-product and surface tiers, so this address's withdrawals are held. " +
                    `Run ${delayCall} ${owner} before arming.`,
            });
        } else if (actorBypass.bypass !== true) {
            failures.push({
                name: caller.name,
                reason: "delay-entry-forces-delay",
                detail:
                    `${where} has an active actor delay entry with bypass=false, which forces ` +
                    "the global delay on this address instead of lifting it. " +
                    `Run ${delayCall} ${owner} before arming.`,
            });
        }
    }

    return { certified: failures.length === 0, holding, armed: Boolean(armed), failures };
};

/**
 * The check itself: read the controller, judge it, and refuse loudly.
 *
 * Run it before arming (it is the runbook's blocker step), and again from the
 * rehearsal once the delay is on, so a fixture can never hand back an armed
 * stack that holds or charges an exempted address.
 */
const assertContractCallersExempt = async (controller, { callers = CONTRACT_CALLERS } = {}) => {
    const observations = await readRegistrations(controller, callers);
    const verdict = evaluateExemptions({
        armed: await controller.securityPerimeterEnabled(),
        globalDelaySeconds: Number(await controller.globalDelaySeconds()),
        observations,
    });

    if (verdict.certified) return verdict;

    const lead = verdict.holding
        ? "the delay is ARMED and holding, and an exempted address does not carry its whole " +
          "exemption, so its withdrawals may already be charged or held"
        : "an exempted address does not carry its whole exemption, so arming the delay in this " +
          "state would charge or hold its withdrawals";

    throw new Error(
        `Perimeter arming guard: ${lead}.\n\n` +
            verdict.failures
                .map((failure) => `  - [${failure.reason}] ${failure.detail}`)
                .join("\n\n") +
            "\n\nEach entry is an owner call on the ExitFeeController. Re-run this check " +
            "after they execute."
    );
};

module.exports = {
    SURFACE_IDS,
    CONTRACT_CALLERS,
    readRegistrations,
    evaluateExemptions,
    assertContractCallersExempt,
};
