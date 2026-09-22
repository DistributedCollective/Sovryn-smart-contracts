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

/** The reverse of `SURFACE_IDS`, for naming a surface discovered by id off
 *  the controller's own enumeration rather than looked up by name. */
const SURFACE_NAME_BY_ID = Object.freeze(
    Object.fromEntries(
        Object.entries(SURFACE_IDS).map(([name, id]) => [String(id).toLowerCase(), name])
    )
);
const surfaceNameOrId = (id) => SURFACE_NAME_BY_ID[String(id).toLowerCase()] || String(id);

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

/** Whether one field of an observation half is unusable: `rateBps` must be a
 *  value `asRate` can parse (a plain integer, a digit string, or an ethers
 *  BigNumber — not a string `asRate` rejects, and not `null`); every other
 *  field is a flag and must be an actual boolean, never a string like
 *  `"false"`, which is truthy and would otherwise read as set. */
const fieldUnread = (half, field) =>
    field === "rateBps" ? Number.isNaN(asRate(half[field])) : typeof half[field] !== "boolean";

/** An observation half that is absent, carries a read error, or carries a
 *  field the judgement cannot use as read. */
const unread = (half, fields) =>
    !half || half.error !== undefined || fields.some((field) => fieldUnread(half, field));

/** Sentinel for a delay-switch read (`securityPerimeterEnabled` or
 *  `globalDelaySeconds`) that threw or returned something uninterpretable.
 *  Never a boolean or a number, so it can never be silently read as "off". */
const SWITCH_UNREAD = "unread";

/**
 * Read the delay switch the same guarded way the entries are read: a throw or
 * an uninterpretable value comes back as `SWITCH_UNREAD`, never as a default.
 */
const readSwitch = async (controller) => {
    const armed = await attempt(
        () => controller.securityPerimeterEnabled(),
        (value) => {
            if (typeof value !== "boolean") {
                throw new Error(
                    `securityPerimeterEnabled returned a value that is not a bool: ${value}`
                );
            }
            return value;
        }
    );
    const globalDelaySeconds = await attempt(
        () => controller.globalDelaySeconds(),
        (value) => {
            const seconds = asRate(value);
            if (Number.isNaN(seconds)) {
                throw new Error(
                    "globalDelaySeconds returned a value that is not a non-negative integer: " +
                        `${value}`
                );
            }
            return seconds;
        }
    );
    return {
        armed: armed && armed.error !== undefined ? SWITCH_UNREAD : armed,
        globalDelaySeconds:
            globalDelaySeconds && globalDelaySeconds.error !== undefined
                ? SWITCH_UNREAD
                : globalDelaySeconds,
    };
};

/** A shape check for an enumeration view that must return an array — the
 *  surface, sub-product-key and actor-key lists. A throw or a non-array
 *  comes back through `attempt` as `{ error }`, the same as every other
 *  guarded read. */
const asArray = (label) => (value) => {
    if (!Array.isArray(value)) {
        throw new Error(`${label} returned a value that is not an array: ${value}`);
    }
    return value;
};

/**
 * Read every ACTIVE delay bypass the live controller actually carries, at
 * every tier — discovered from the controller itself rather than assumed
 * from a list. `bypassSurfaceIds()` is the any-tier master set every bypass
 * writer adds to (`setSurfaceBypass`, `setSubProductBypass` and
 * `setActorBypass` all add to it), so walking it and then, for each surface,
 * its sub-product and actor key sets reaches every bypass entry that exists
 * on the controller, registered or not.
 *
 * An entry is kept only when it reads `{active: true, bypass: true}` — an
 * inactive or non-bypassing entry is retained in the enumeration on
 * soft-retire and is not a live bypass.
 *
 * A throw or an uninterpretable value from any enumeration or entry read is
 * recorded in `unreadable` and never folded into "no bypasses", the same
 * rule `readRegistrations` and `readSwitch` follow. Once the master list
 * itself cannot be read, nothing under it can be either, so enumeration
 * stops there.
 */
const readActiveBypasses = async (controller) => {
    const entries = [];
    const unreadable = [];

    const surfaceIds = await attempt(
        () => controller.bypassSurfaceIds(),
        asArray("bypassSurfaceIds()")
    );
    if (surfaceIds.error !== undefined) {
        unreadable.push({ where: "bypassSurfaceIds()" });
        return { entries, unreadable };
    }

    for (const surfaceId of surfaceIds) {
        const surfaceEntry = await attempt(() => controller.surfaceBypass(surfaceId), delayShape);
        if (surfaceEntry.error !== undefined) {
            unreadable.push({ where: `surfaceBypass(${surfaceId})` });
        } else if (surfaceEntry.active === true && surfaceEntry.bypass === true) {
            entries.push({ tier: "surface", surfaceId, address: undefined });
        }

        const subProductKeys = await attempt(
            () => controller.subProductBypassKeys(surfaceId),
            asArray(`subProductBypassKeys(${surfaceId})`)
        );
        if (subProductKeys.error !== undefined) {
            unreadable.push({ where: `subProductBypassKeys(${surfaceId})` });
        } else {
            for (const subProduct of subProductKeys) {
                const entry = await attempt(
                    () => controller.subProductBypass(surfaceId, subProduct),
                    delayShape
                );
                if (entry.error !== undefined) {
                    unreadable.push({ where: `subProductBypass(${surfaceId}, ${subProduct})` });
                } else if (entry.active === true && entry.bypass === true) {
                    entries.push({ tier: "sub-product", surfaceId, address: subProduct });
                }
            }
        }

        const actorKeys = await attempt(
            () => controller.actorBypassKeys(surfaceId),
            asArray(`actorBypassKeys(${surfaceId})`)
        );
        if (actorKeys.error !== undefined) {
            unreadable.push({ where: `actorBypassKeys(${surfaceId})` });
        } else {
            for (const actor of actorKeys) {
                const entry = await attempt(
                    () => controller.actorBypass(surfaceId, actor),
                    delayShape
                );
                if (entry.error !== undefined) {
                    unreadable.push({ where: `actorBypass(${surfaceId}, ${actor})` });
                } else if (entry.active === true && entry.bypass === true) {
                    entries.push({ tier: "actor", surfaceId, address: actor });
                }
            }
        }
    }

    return { entries, unreadable };
};

/** The only tier a registered entry can ever name — `CONTRACT_CALLERS`
 *  registers an owner's exemption, and an exemption is an actor-tier pair.
 *  A surface- or sub-product-tier bypass is never something the registry
 *  can account for, by the registry's own shape. */
const REGISTERED_TIER = "actor";

/** A stable key for matching a discovered bypass entry against the registry:
 *  tier, surface and address, address lower-cased so a checksum difference
 *  is never mistaken for a different address. */
const bypassKey = (tier, surfaceId, address) =>
    `${tier}|${String(surfaceId).toLowerCase()}|${address ? String(address).toLowerCase() : ""}`;

/**
 * Judge the bypasses the controller actually carries against the registry.
 * Pure: no chain, no I/O.
 *
 * A surface- or sub-product-tier bypass always fails, whatever it names —
 * the registry has no way to account for one, so its mere existence, active,
 * is unregistered by definition. An actor-tier bypass fails unless its
 * (surface, address) is a registered exemption.
 *
 * An unreadable enumeration view refuses on its own: it is never taken to
 * mean the controller carries no bypasses.
 */
const evaluateActiveBypasses = ({
    entries = [],
    unreadable = [],
    callers = CONTRACT_CALLERS,
} = {}) => {
    const failures = [];

    for (const { where } of unreadable) {
        failures.push({
            name: "(bypass enumeration)",
            reason: "bypass-enumeration-unread",
            detail:
                `${where} could not be read on this controller. An enumeration view that ` +
                "cannot be read is never taken to mean the controller carries no bypasses — " +
                "check that the address is the ExitFeeController on the delay build, then run " +
                "this again.",
        });
    }
    if (unreadable.length > 0) {
        return { certified: false, failures };
    }

    const registered = new Set(
        callers
            .filter((caller) => caller.registration === EXEMPTION && SURFACE_IDS[caller.surface])
            .map((caller) =>
                bypassKey(REGISTERED_TIER, SURFACE_IDS[caller.surface], caller.address)
            )
    );

    for (const entry of entries) {
        if (registered.has(bypassKey(entry.tier, entry.surfaceId, entry.address))) continue;
        const surfaceName = surfaceNameOrId(entry.surfaceId);

        if (entry.tier === "actor") {
            failures.push({
                name: "(unregistered bypass)",
                reason: "unregistered-actor-bypass",
                detail:
                    `an active delay bypass exists at the actor tier for ${entry.address} on ` +
                    `${surfaceName}, and the registry does not name it. This address's ` +
                    "withdrawals on this surface pay out with no hold. Record the owner's " +
                    "decision in DECISIONS.md and add it to the registry before it is written, " +
                    `or remove the bypass with removeActorBypass(${entry.surfaceId}, ` +
                    `${entry.address}).`,
            });
        } else if (entry.tier === "sub-product") {
            failures.push({
                name: "(unregistered bypass)",
                reason: "unregistered-subproduct-bypass",
                detail:
                    `an active delay bypass exists at the sub-product tier for ${entry.address} ` +
                    `on ${surfaceName}, and the registry has no entry at that tier at all. Every ` +
                    "withdrawal from this pool pays out with no hold. Record the owner's " +
                    "decision in DECISIONS.md and add it to the registry before it is written, " +
                    `or remove the bypass with removeSubProductBypass(${entry.surfaceId}, ` +
                    `${entry.address}).`,
            });
        } else {
            failures.push({
                name: "(unregistered bypass)",
                reason: "unregistered-surface-bypass",
                detail:
                    `an active delay bypass exists at the surface tier on ${surfaceName}, and ` +
                    "the registry has no entry at that tier at all. Every withdrawal on this " +
                    "surface pays out with no hold, whatever any pool or address entry says. " +
                    "Record the owner's decision in DECISIONS.md and add it to the registry " +
                    `before it is written, or remove the bypass with ` +
                    `removeSurfaceBypass(${entry.surfaceId}).`,
            });
        }
    }

    return { certified: failures.length === 0, failures };
};

/**
 * Judge the observations. Pure: no chain, no I/O.
 *
 * The verdict does not depend on whether the delay is armed yet — this check
 * exists to gate arming, so a missing entry refuses certification either way.
 * `armed` and `globalDelaySeconds` only decide whether the failure is a warning
 * about the future or a report that withdrawals may already be held. Either
 * one may come in as `SWITCH_UNREAD`, which certifies nothing and is never
 * treated as "not armed".
 */
const evaluateExemptions = ({ armed = false, globalDelaySeconds = 0, observations = [] } = {}) => {
    const switchUnread = armed === SWITCH_UNREAD || globalDelaySeconds === SWITCH_UNREAD;
    const holding = !switchUnread && Boolean(armed) && Number(globalDelaySeconds) > 0;
    const failures = [];

    if (observations.length === 0) {
        failures.push({
            name: "(registry)",
            reason: "empty-registry",
            detail:
                "the exemption registry is empty, so this check certifies nothing. The " +
                "fee-sharing collector belongs in it.",
        });
    } else {
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
                        `${where} is registered as ${JSON.stringify(caller.registration)}, ` +
                        `which is not a decided registration. The only one is "${EXEMPTION}": ` +
                        "the owner's exemption of this address, written as a zero actor fee " +
                        "rate and an actor delay bypass. Record the owner's decision and mark " +
                        `the entry "${EXEMPTION}", or remove it.`,
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
            } else {
                const feeRateBps = asRate(actorPolicy.rateBps);
                if (feeRateBps !== 0) {
                    failures.push({
                        name: caller.name,
                        reason: "fee-rate-not-zero",
                        detail:
                            `${where} has an active actor fee policy charging ` +
                            `${feeRateBps} bps, which is a rate, not an exemption. ` +
                            `Run ${feeCall} ${owner} before arming.`,
                    });
                }
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
                        `${where} has an active actor delay entry with bypass=false, which ` +
                        "forces the global delay on this address instead of lifting it. " +
                        `Run ${delayCall} ${owner} before arming.`,
                });
            }
        }
    }

    if (switchUnread) {
        // Names the views, never the read's own error text: the reason a view
        // could not be read belongs to the node or the library, and the operator
        // needs to know which view to check.
        const unreadViews = [
            armed === SWITCH_UNREAD ? "securityPerimeterEnabled()" : null,
            globalDelaySeconds === SWITCH_UNREAD ? "globalDelaySeconds()" : null,
        ].filter(Boolean);
        failures.push({
            name: "(switch)",
            reason: "arming-state-unread",
            detail:
                `${unreadViews.join(" and ")} could not be read on this controller. An unread ` +
                "delay switch is never taken to mean the delay is off, so nothing certifies " +
                "until it reads back. Check that the address is the ExitFeeController on the " +
                "delay build, then run this again.",
        });
    }

    return {
        certified: failures.length === 0,
        holding,
        armed: switchUnread ? SWITCH_UNREAD : Boolean(armed),
        failures,
    };
};

/** Reasons that mean "this check could not tell", never "here is what is
 *  wrong" — an unread switch or an unread bypass enumeration. Grouped so the
 *  lead sentence never claims a specific defect it could not actually see. */
const UNVERIFIABLE_REASONS = new Set(["arming-state-unread", "bypass-enumeration-unread"]);

/** Reasons that mean the controller carries a bypass the registry cannot
 *  account for — the fail-open direction: something extra is exempt that
 *  should not be. */
const UNEXPECTED_BYPASS_REASONS = new Set([
    "unregistered-actor-bypass",
    "unregistered-subproduct-bypass",
    "unregistered-surface-bypass",
]);

/**
 * The check itself: read the controller, judge it, and refuse loudly.
 *
 * Two independent judgements feed one certification: `evaluateExemptions`
 * asks whether every registered address carries both halves of its
 * exemption, and `evaluateActiveBypasses` asks the controller itself which
 * delay bypasses actually exist and refuses any the registry does not
 * account for. Either can refuse on its own; both must certify for this to
 * certify.
 *
 * Run it before arming (it is the runbook's blocker step), and again from the
 * rehearsal once the delay is on, so a fixture can never hand back an armed
 * stack that holds or charges an exempted address, or that carries a bypass
 * nobody decided on.
 */
const assertContractCallersExempt = async (controller, { callers = CONTRACT_CALLERS } = {}) => {
    const observations = await readRegistrations(controller, callers);
    const { armed, globalDelaySeconds } = await readSwitch(controller);
    const exemptionVerdict = evaluateExemptions({ armed, globalDelaySeconds, observations });

    const { entries, unreadable } = await readActiveBypasses(controller);
    const bypassVerdict = evaluateActiveBypasses({ entries, unreadable, callers });

    const failures = [...exemptionVerdict.failures, ...bypassVerdict.failures];
    if (failures.length === 0) {
        return {
            certified: true,
            holding: exemptionVerdict.holding,
            armed: exemptionVerdict.armed,
            failures: [],
        };
    }

    const onlyUnverifiable = failures.every((failure) => UNVERIFIABLE_REASONS.has(failure.reason));
    const hasUnexpectedBypass = failures.some((failure) =>
        UNEXPECTED_BYPASS_REASONS.has(failure.reason)
    );
    const hasMissingExemption = failures.some(
        (failure) =>
            !UNVERIFIABLE_REASONS.has(failure.reason) &&
            !UNEXPECTED_BYPASS_REASONS.has(failure.reason)
    );

    let lead;
    if (onlyUnverifiable) {
        lead =
            "the delay switch or the bypass enumeration could not be read, so this check cannot " +
            "tell what the controller actually carries, and it certifies nothing";
    } else if (hasUnexpectedBypass && !hasMissingExemption) {
        lead = exemptionVerdict.holding
            ? "the delay is ARMED and holding, and the controller carries an active delay " +
              "bypass this registry does not account for, so some withdrawals may already be " +
              "paying out with no hold"
            : "the controller carries an active delay bypass this registry does not account " +
              "for, and arming the delay in this state would let those withdrawals pay out " +
              "with no hold";
    } else {
        lead = exemptionVerdict.holding
            ? "the delay is ARMED and holding, and an exempted address does not carry its whole " +
              "exemption, so its withdrawals may already be charged or held"
            : "an exempted address does not carry its whole exemption, so arming the delay in " +
              "this state would charge or hold its withdrawals";
    }

    throw new Error(
        `Perimeter arming guard: ${lead}.\n\n` +
            failures.map((failure) => `  - [${failure.reason}] ${failure.detail}`).join("\n\n") +
            "\n\nEach entry is an owner call on the ExitFeeController. Re-run this check " +
            "after they execute."
    );
};

module.exports = {
    SURFACE_IDS,
    CONTRACT_CALLERS,
    SWITCH_UNREAD,
    readRegistrations,
    readSwitch,
    readActiveBypasses,
    evaluateExemptions,
    evaluateActiveBypasses,
    assertContractCallersExempt,
};
