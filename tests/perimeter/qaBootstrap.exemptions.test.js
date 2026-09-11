/**
 * Perimeter — the QA fork writes the owner's exemptions before it arms.
 *
 * `perimeter:qa up` arms the withdrawal delay on a local fork. The fee-sharing
 * collector redeems the iWRBTC it holds through a hooked lender withdrawal, so a
 * fork armed without the collector's exemption charges it the Perimeter fee and
 * holds its redemptions, and every staker claim that redeems iWRBTC refuses.
 *
 * The bootstrap writes each exemption the arming guard's registry names, in the
 * runbook's order:
 *   - on a fork it upgrades: the actor fee policy `{active: true, rateBps: 0}`
 *     on the fee build before the upgrade, read back there and again on the
 *     delay build; then the actor delay bypass `{active: true, bypass: true}`
 *     with the upgrade, both halves read back;
 *   - on every fork: both halves read back before the hold is armed, any
 *     missing half written first, so a fork attached to after the upgrade gets
 *     its exemption too and a pair already written is left alone;
 *   - an entry that does not read back as the exemption, or cannot be read at
 *     all, stops the bootstrap before it upgrades or arms.
 *
 * Driven here against the mock controller through a wrapper that records every
 * call and, until the upgrade runs, refuses the functions the fee build does not
 * serve. No fork is needed.
 *
 * Run:
 *   npx hardhat test tests/perimeter/qaBootstrap.exemptions.test.js
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
    upgradeWithExemptions,
    armWithExemptions,
} = require("../../tests-onchain/perimeter/qa/bootstrap");
const {
    SURFACE_IDS,
    CONTRACT_CALLERS,
} = require("../../hardhat/tasks/perimeter/contractCallerExemptions");

const MockExitFeeController = artifacts.require("MockExitFeeController");

/** Functions only the delay build serves. */
const DELAY_BUILD_ONLY = [
    "actorBypass",
    "setActorBypass",
    "securityPerimeterEnabled",
    "globalDelaySeconds",
    "setSecurityPerimeterEnabled",
    "setGlobalDelaySeconds",
];
const RECORDED = [
    "actorPolicy",
    "setActorPolicy",
    "exitFeeEnabled",
    "setExitFeeEnabled",
    ...DELAY_BUILD_ONLY,
];
/** The two calls that put a hold in place. */
const ARMING = ["setGlobalDelaySeconds", "setSecurityPerimeterEnabled"];
const DELAY_SECONDS = 120;
const silent = () => {};

const rejection = async (promise) => {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    return null;
};

describe("Perimeter — the QA fork writes the owner's exemptions before it arms", () => {
    const [collector] = CONTRACT_CALLERS;
    const surface = SURFACE_IDS[collector.surface];

    let mock;
    let calls;
    let servesDelayBuild;

    /**
     * The mock as the bootstrap reaches it. `storesDelayWrite: false` accepts the
     * delay entry without storing it; `feeReadFails: true` makes every fee read
     * throw, whatever is stored.
     */
    const controllerSeenByBootstrap = ({ storesDelayWrite = true, feeReadFails = false } = {}) => {
        const target = {};
        for (const name of RECORDED) {
            target[name] = async (...args) => {
                calls.push({ name, args });
                if (!servesDelayBuild && DELAY_BUILD_ONLY.includes(name)) {
                    throw new Error(
                        "function selector was not recognized and there's no fallback function"
                    );
                }
                if (feeReadFails && name === "actorPolicy") {
                    throw new Error("missing revert data in call exception");
                }
                if (!storesDelayWrite && name === "setActorBypass") {
                    return { wait: async () => ({}) };
                }
                return mock[name](...args);
            };
        }
        return target;
    };

    const upgrade = async () => {
        calls.push({ name: "upgrade", args: [] });
        servesDelayBuild = true;
        return { implementation: "the delay build" };
    };

    const names = () => calls.map((call) => call.name);
    const firstArming = () =>
        Math.min(...ARMING.map((name) => names().indexOf(name)).filter((index) => index >= 0));
    const arm = (target, extra = {}, log = silent) =>
        armWithExemptions(
            target,
            { delaySeconds: DELAY_SECONDS, fee: true, foundHolding: false, ...extra },
            log
        );

    const writeStoredPair = async ({ rateBps = 0, bypass = true } = {}) => {
        await (await mock.setActorFeePolicyTest(surface, collector.address, true, rateBps)).wait();
        await (await mock.setActorBypassTest(surface, collector.address, true, bypass)).wait();
    };
    const expectWholeExemptionStored = async () => {
        const fee = await mock.actorPolicy(surface, collector.address);
        const delay = await mock.actorBypass(surface, collector.address);
        expect([fee.active, Number(fee.rateBps)], "stored fee entry").to.deep.equal([true, 0]);
        expect([delay.active, delay.bypass], "stored delay entry").to.deep.equal([true, true]);
    };
    const expectNotArmed = async () => {
        expect(
            names().filter((name) => ARMING.includes(name)),
            "no arming call is sent"
        ).to.be.empty;
        expect(await mock.securityPerimeterEnabled(), "the perimeter stays off").to.be.false;
    };

    beforeEach(async () => {
        const deployed = await MockExitFeeController.new();
        mock = await ethers.getContractAt("MockExitFeeController", deployed.address);
        calls = [];
        servesDelayBuild = false;
    });

    describe("a fork this run upgrades", () => {
        it("writes the fee entry on the fee build before the upgrade and the delay entry after it, reading each back", async () => {
            const result = await upgradeWithExemptions(
                controllerSeenByBootstrap(),
                upgrade,
                silent
            );
            expect(result.implementation).to.equal("the delay build");

            const order = names();
            const feeWrite = order.indexOf("setActorPolicy");
            const upgraded = order.indexOf("upgrade");
            const delayWrite = order.indexOf("setActorBypass");
            expect(feeWrite, "the fee entry is written").to.be.greaterThan(-1);
            expect(feeWrite, "the fee entry goes in on the fee build").to.be.lessThan(upgraded);
            expect(order.slice(feeWrite + 1, upgraded), "read back on the fee build").to.include(
                "actorPolicy"
            );
            expect(delayWrite, "the delay entry goes in on the delay build").to.be.greaterThan(
                upgraded
            );
            expect(
                order.slice(upgraded + 1, delayWrite),
                "the fee entry is read back on the delay build first"
            ).to.include("actorPolicy");
            expect(order.slice(delayWrite + 1), "both halves read back").to.include.members([
                "actorPolicy",
                "actorBypass",
            ]);
            expect(
                order.filter((name) => name === "setActorPolicy"),
                "the fee entry is written once"
            ).to.have.lengthOf(1);

            // The registry's address and surface, with the exemption's values.
            expect(calls[feeWrite].args.slice(0, 2)).to.deep.equal([surface, collector.address]);
            expect(calls[feeWrite].args[2]).to.deep.equal({ active: true, rateBps: 0 });
            expect(calls[delayWrite].args.slice(0, 2)).to.deep.equal([surface, collector.address]);
            expect(calls[delayWrite].args[2]).to.deep.equal({ active: true, bypass: true });
            await expectWholeExemptionStored();
        });

        it("leaves a fee entry already written on the fee build alone", async () => {
            await (await mock.setActorFeePolicyTest(surface, collector.address, true, 0)).wait();

            await upgradeWithExemptions(controllerSeenByBootstrap(), upgrade, silent);

            expect(names()).to.not.include("setActorPolicy");
            expect(names()).to.include("setActorBypass");
            await expectWholeExemptionStored();
        });

        it("does not upgrade past a fee entry it cannot read back", async () => {
            const error = await rejection(
                upgradeWithExemptions(
                    controllerSeenByBootstrap({ feeReadFails: true }),
                    upgrade,
                    silent
                )
            );
            expect(error, "an unread fee entry stops the upgrade").to.not.be.null;
            expect(error.message).to.include(collector.name);
            expect(error.message).to.include("could not be read");
            expect(names()).to.not.include("upgrade");
        });
    });

    describe("arming", () => {
        beforeEach(() => {
            servesDelayBuild = true;
        });

        it("on a fork attached to after the upgrade, writes the fee entry, then the delay entry, and arms only once both read back", async () => {
            await arm(controllerSeenByBootstrap());

            const order = names();
            const feeWrite = order.indexOf("setActorPolicy");
            const delayWrite = order.indexOf("setActorBypass");
            const armedAt = firstArming();
            expect(feeWrite, "the fee entry is written").to.be.greaterThan(-1);
            expect(feeWrite, "the fee entry goes in first").to.be.lessThan(delayWrite);
            expect(delayWrite, "both entries go in before the hold").to.be.lessThan(armedAt);
            expect(
                order.slice(delayWrite + 1, armedAt),
                "both halves read back before the hold"
            ).to.include.members(["actorPolicy", "actorBypass"]);

            await expectWholeExemptionStored();
            expect(await mock.securityPerimeterEnabled()).to.be.true;
            expect(await mock.globalDelaySeconds()).to.equal(DELAY_SECONDS);
            expect(await mock.exitFeeEnabled()).to.be.true;
        });

        it("leaves a pair already written alone and still reads both halves back before arming", async () => {
            await writeStoredPair();

            await arm(controllerSeenByBootstrap());

            const order = names();
            expect(order).to.not.include("setActorPolicy");
            expect(order).to.not.include("setActorBypass");
            expect(order.slice(0, firstArming())).to.include.members([
                "actorPolicy",
                "actorBypass",
            ]);
            expect(await mock.securityPerimeterEnabled()).to.be.true;
        });

        it("rewrites an entry that is active but is not the exemption", async () => {
            await writeStoredPair({ rateBps: 10, bypass: false });

            await arm(controllerSeenByBootstrap());

            expect(names()).to.include.members(["setActorPolicy", "setActorBypass"]);
            await expectWholeExemptionStored();
        });

        it("refuses to arm when the delay entry does not read back", async () => {
            const error = await rejection(
                arm(controllerSeenByBootstrap({ storesDelayWrite: false }))
            );
            expect(error, "an exemption that does not read back stops arming").to.not.be.null;
            expect(error.message).to.include(collector.name);
            expect(error.message).to.include("actorBypass");
            await expectNotArmed();
        });

        it("refuses to arm when an entry cannot be read, even with the pair stored", async () => {
            await writeStoredPair();

            const error = await rejection(arm(controllerSeenByBootstrap({ feeReadFails: true })));
            expect(error, "an unread entry is never taken as written").to.not.be.null;
            expect(error.message).to.include("could not be read");
            await expectNotArmed();
        });

        it("refuses to arm without being told whether the fork was already holding", async () => {
            const error = await rejection(
                armWithExemptions(
                    controllerSeenByBootstrap(),
                    { delaySeconds: DELAY_SECONDS, fee: true },
                    silent
                )
            );
            expect(error, "an unknown arming state is never taken as not armed").to.not.be.null;
            expect(error.message).to.include("foundHolding");
            expect(names(), "nothing is written or armed").to.be.empty;
            expect(await mock.securityPerimeterEnabled()).to.be.false;
        });

        it("says so when it writes an exemption on a fork that was already holding", async () => {
            await (await mock.setGlobalDelaySeconds(DELAY_SECONDS)).wait();
            await (await mock.setSecurityPerimeterEnabled(true)).wait();

            const first = [];
            await arm(controllerSeenByBootstrap(), { foundHolding: true }, (line) =>
                first.push(line)
            );
            expect(first.join("\n")).to.include("WARNING");
            expect(first.join("\n")).to.include(collector.name);
            await expectWholeExemptionStored();

            const second = [];
            await arm(controllerSeenByBootstrap(), { foundHolding: true }, (line) =>
                second.push(line)
            );
            expect(
                second.join("\n"),
                "nothing to warn about once the pair is written"
            ).to.not.include("WARNING");
        });
    });
});
