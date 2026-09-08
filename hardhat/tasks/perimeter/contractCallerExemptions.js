/**
 * Contracts that withdraw on somebody else's behalf, and the registration each
 * one needs before the delay is armed.
 *
 * WHY THIS EXISTS
 *
 * A hooked exit derives the queue request's executor set from `msg.sender` at
 * the product. When a contract burns a user's position for them, that contract
 * becomes both originator and owner of the escrow request, and the receiver is
 * deliberately never an executor. If the contract has no code that calls
 * `executeExit` — almost none does — the user's money sits in an escrow nobody
 * on chain can release, recoverable only by an owner resolution.
 *
 * Worse, such a contract usually reads the withdrawal's return value as cash
 * that arrived in the same transaction. Under a hold no cash arrives and the
 * gross is returned anyway, so the contract pays its user out of whatever it
 * already holds — other users' money — until that balance is gone.
 *
 * The remedy is configuration, which is exactly why it is easy to miss: no
 * contract, no proposal and no deployment record mentions these addresses. This
 * module is the thing that mentions them. `assertContractCallersExempt` reads
 * the live controller and refuses to certify go-live until the chain agrees
 * with the registry below.
 *
 * BYPASS OR PASSTHROUGH — NOT INTERCHANGEABLE
 *
 * `passthrough` rewrites the effective originator and owner to the RECEIVER, so
 * the end user becomes the executor and keeps their hold. Right for a wrapper
 * that names the user as receiver.
 *
 * `bypass` gives the raw caller a zero delay, so nothing is escrowed at all.
 * Right for a contract that names ITSELF as receiver and then pays the user on
 * its own — where a passthrough would resolve the actor back to that same
 * contract and change nothing.
 *
 * Getting this backwards is silent: the transaction succeeds and the problem
 * only surfaces at unlock time. The checks below refuse both directions of the
 * mistake, including an actor bypass that a passthrough registration has made
 * unreachable.
 *
 * WHAT THIS DOES NOT KNOW
 *
 * Only what is listed. Enumerating every remaining integrator that calls a
 * hooked withdrawal for a user is its own piece of work; each one it finds is
 * added here with its decided registration, and this check then holds the chain
 * to it.
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

const CONTRACT_CALLERS = Object.freeze([
    Object.freeze({
        name: "FeeSharingCollector",
        address: "0x115cAF168c51eD15ec535727F64684D33B7b08D1",
        surface: "PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW",
        registration: "bypass",
        why:
            "Stakers claim protocol fees in RBTC. The collector redeems its own iWRBTC position by " +
            "calling burnToBTC and treats the returned figure as RBTC in hand, paying the claimant " +
            "out of the pooled balance it holds for every other staker. Under a hold nothing " +
            "arrives and the claimant's own money escrows to a request only the collector could " +
            "execute — and it has no code that does. It names ITSELF as the receiver, so a " +
            "passthrough would resolve the actor straight back to it and change nothing.",
    }),
]);

const REGISTRATIONS = ["bypass", "passthrough"];

/**
 * Read what the live controller says about each caller. Kept apart from the
 * judgement so the judgement is testable without a chain, and so a caller can
 * feed it observations gathered some other way.
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
        const policy = await controller.actorBypass(surface, caller.address);
        observations.push({
            caller,
            actorBypass: { active: policy.active, bypass: policy.bypass },
            passthrough: await controller.passthroughActor(surface, caller.address),
        });
    }
    return observations;
};

/**
 * Judge the observations. Pure: no chain, no I/O.
 *
 * The verdict does not depend on whether the delay is armed yet — this check
 * exists to gate arming, so an unexempt caller refuses certification either
 * way. `armed` and `globalDelaySeconds` only decide whether the failure is a
 * warning about the future or a report that money may already be stranding.
 */
const evaluateExemptions = ({ armed = false, globalDelaySeconds = 0, observations = [] } = {}) => {
    const holding = Boolean(armed) && Number(globalDelaySeconds) > 0;
    const failures = [];

    if (observations.length === 0) {
        failures.push({
            name: "(registry)",
            reason: "empty-registry",
            detail:
                "the contract-caller registry is empty, so this check certifies nothing. At least " +
                "the fee-sharing collector belongs in it.",
        });
        return { certified: false, holding, armed: Boolean(armed), failures };
    }

    for (const { caller, actorBypass, passthrough } of observations) {
        const where = `${caller.name} (${caller.address}) on ${caller.surface}`;
        const exempt = Boolean(actorBypass.active) && Boolean(actorBypass.bypass);

        if (!REGISTRATIONS.includes(caller.registration)) {
            failures.push({
                name: caller.name,
                reason: "undecided-registration",
                detail:
                    `${where} has no decided registration. Read its source: a contract that names ` +
                    "the end user as receiver needs a passthrough, one that names itself needs an " +
                    "actor bypass, and the two are not interchangeable.",
            });
            continue;
        }

        if (caller.registration === "bypass") {
            if (passthrough) {
                failures.push({
                    name: caller.name,
                    reason: "bypass-shadowed-by-passthrough",
                    detail:
                        `${where} is registered as a passthrough. A passthrough resolves the ` +
                        "effective actor to the receiver, so the actor bypass keyed on the caller " +
                        "itself is never consulted, and this contract names itself as receiver in " +
                        "any case. Run setPassthroughActor(surface, address, false).",
                });
            } else if (!exempt) {
                failures.push({
                    name: caller.name,
                    reason: "not-exempt",
                    detail:
                        `${where} is not delay-exempt (actorBypass active=${actorBypass.active}, ` +
                        `bypass=${actorBypass.bypass}). Run setActorBypass(surface, address, ` +
                        "{active: true, bypass: true}) as the controller owner before arming.",
                });
            }
            continue;
        }

        // passthrough
        if (!passthrough) {
            failures.push({
                name: caller.name,
                reason: "not-passthrough",
                detail:
                    `${where} is not registered as a passthrough, so a withdrawal it initiates ` +
                    "escrows with itself as the only executor. Run " +
                    "setPassthroughActor(surface, address, true) as the controller owner before arming.",
            });
        } else if (actorBypass.active) {
            failures.push({
                name: caller.name,
                reason: "unreachable-actor-bypass",
                detail:
                    `${where} carries an actor bypass that can never be consulted: the passthrough ` +
                    "already resolves the effective actor to the receiver, so the policy is keyed " +
                    "on an address the resolver never looks up. Whoever set it believed this " +
                    "address was exempt. Clear it, or decide again which of the two it needs.",
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
 * stack that would strand a claimant's money.
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
        ? "the delay is ARMED and holding, so withdrawals through these contracts may already be " +
          "paying out of other users' money and escrowing to requests nobody can execute"
        : "arming the delay in this state would strand withdrawals made through these contracts";

    throw new Error(
        `Perimeter arming guard: ${lead}.\n\n` +
            verdict.failures
                .map((failure) => `  - [${failure.reason}] ${failure.detail}`)
                .join("\n\n") +
            "\n\nEach registration is an owner call on the ExitFeeController. Re-run this check " +
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
