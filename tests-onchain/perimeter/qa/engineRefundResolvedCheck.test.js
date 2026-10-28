/**
 * Isolated regression for `refund`'s own postcondition, `refundResolved`.
 *
 * Every request-status check it runs was already sound; what it measured
 * afterwards was not: an exact-equality native balance check with no gas
 * add-back, unlike the sibling check for a direct-pay withdrawal in the same
 * file (`paidNow`), which the fix wave already gas-normalizes. `refund`'s own
 * multisig submission (and any confirmation it needs) is paid for by
 * whichever account signs it — if an operator refunds INTO that same
 * account (a realistic choice in a rehearsal: "refund to an arbitrary
 * address" commonly reuses the operator's own funded test key), the gas it
 * spent submitting/confirming is debited from the very balance this check
 * reads, and a genuinely correct refund reports as failed.
 *
 * `POSTCONDITIONS.refundResolved` is exercised directly through
 * `engine.runPostcondition`, the same entry point `confirm()` re-runs a
 * persisted postcondition through — pure apart from the two view calls its
 * descriptor names (`getRequest`, and a balance read), so this runs against a
 * fake queue on Hardhat's own in-process network — no fork, no `--network`.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/engineRefundResolvedCheck.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const engine = require("./engine");
const drivers = require("./drivers");
const gas = require("./gas");

const ZERO_ADDRESS = ethers.constants.AddressZero;
const STATUS_NAME = "ResolvedByOwner";

describe("QA scenario engine — refund's postcondition is gas-normalized for a self-paying destination", () => {
    let funder;
    let fakeQueue;

    before(async () => {
        [funder] = await ethers.getSigners();
        fakeQueue = {
            getRequest: async () => ({ status: drivers.STATUS[STATUS_NAME] }),
        };
    });

    it("still fires on a genuine shortfall smaller than the destination's own gas cost", async () => {
        // The defect this check exists to catch, unchanged by the fix: a
        // refund that under-delivers by less than the destination's own gas
        // cost must not be masked by the very credit that now excuses gas.
        const destination = ethers.Wallet.createRandom().connect(ethers.provider);
        await funder.sendTransaction({
            to: destination.address,
            value: ethers.utils.parseEther("1"),
        });
        const before = await ethers.provider.getBalance(destination.address);

        // Stands in for the multisig submission this destination paid for.
        const submissionReceipt = await (
            await destination.sendTransaction({ to: funder.address, value: 0 })
        ).wait();

        const total = ethers.BigNumber.from(1_000_000);
        // Shorted by 1 wei relative to `total` — a real defect, far smaller
        // than any transaction's own gas cost, so the OLD ungrounded check
        // would have caught it too; this proves the new one still does.
        await funder.sendTransaction({ to: destination.address, value: total.sub(1) });

        const held = await engine.runPostcondition(
            { queue: fakeQueue },
            {
                kind: "refundResolved",
                args: {
                    ids: [1],
                    wantStatus: STATUS_NAME,
                    token: ZERO_ADDRESS,
                    destination: destination.address,
                    before: before.toString(),
                    total: total.toString(),
                    gasCharges: [gas.chargeOf(submissionReceipt)],
                },
            }
        );
        expect(held, "a real shortfall must still be reported").to.not.equal(true);
        expect(held).to.match(/holds/);
    });

    it("reports a genuinely correct refund as satisfied when the destination also paid to submit it", async () => {
        // Before the fix: `got` read `before - gas + total`, strictly less
        // than `before + total`, so this exact — correct — refund reported
        // as failed.
        const destination = ethers.Wallet.createRandom().connect(ethers.provider);
        await funder.sendTransaction({
            to: destination.address,
            value: ethers.utils.parseEther("1"),
        });
        const before = await ethers.provider.getBalance(destination.address);

        const submissionReceipt = await (
            await destination.sendTransaction({ to: funder.address, value: 0 })
        ).wait();

        const total = ethers.BigNumber.from(1_000_000);
        await funder.sendTransaction({ to: destination.address, value: total });

        const held = await engine.runPostcondition(
            { queue: fakeQueue },
            {
                kind: "refundResolved",
                args: {
                    ids: [1],
                    wantStatus: STATUS_NAME,
                    token: ZERO_ADDRESS,
                    destination: destination.address,
                    before: before.toString(),
                    total: total.toString(),
                    gasCharges: [gas.chargeOf(submissionReceipt)],
                },
            }
        );
        expect(held, held === true ? undefined : held).to.equal(true);
    });

    it("still reports satisfied, ungrounded in gas at all, when the destination never paid for anything", async () => {
        // No `gasCharges` at all — the ordinary case, where the destination
        // is a plain third party. Confirms the fix is additive, not a
        // regression on every refund that came before it.
        const destination = ethers.Wallet.createRandom().address;
        const before = await ethers.provider.getBalance(destination);
        const total = ethers.BigNumber.from(1_000_000);
        await funder.sendTransaction({ to: destination, value: total });

        const held = await engine.runPostcondition(
            { queue: fakeQueue },
            {
                kind: "refundResolved",
                args: {
                    ids: [1],
                    wantStatus: STATUS_NAME,
                    token: ZERO_ADDRESS,
                    destination,
                    before: before.toString(),
                    total: total.toString(),
                },
            }
        );
        expect(held).to.equal(true);
    });

    it("never credits gas back to an ERC20 destination, even when it also paid the submission's own (native) gas", async () => {
        const TestToken = await ethers.getContractFactory("TestToken");
        const token = await TestToken.deploy("Test", "TST", 18, 0);
        await token.deployed();

        const destination = ethers.Wallet.createRandom().connect(ethers.provider);
        await funder.sendTransaction({
            to: destination.address,
            value: ethers.utils.parseEther("1"),
        });
        const submissionReceipt = await (
            await destination.sendTransaction({ to: funder.address, value: 0 })
        ).wait();

        const before = await token.balanceOf(destination.address);
        const total = ethers.BigNumber.from(1_000_000);
        await (await token.connect(funder).mint(destination.address, total)).wait();

        const held = await engine.runPostcondition(
            { queue: fakeQueue },
            {
                kind: "refundResolved",
                args: {
                    ids: [1],
                    wantStatus: STATUS_NAME,
                    token: token.address,
                    destination: destination.address,
                    before: before.toString(),
                    total: total.toString(),
                    // If this were wrongly applied to an ERC20 balance it
                    // would only ever ADD an unearned credit, so an exact,
                    // fully-delivered ERC20 refund passing either way cannot
                    // by itself prove the gate holds — the shortfall test
                    // above closes that: mint one wei LESS than `total` and
                    // the check must still fire despite carrying a charge.
                    gasCharges: [gas.chargeOf(submissionReceipt)],
                },
            }
        );
        expect(held).to.equal(true);

        const short = await engine.runPostcondition(
            { queue: fakeQueue },
            {
                kind: "refundResolved",
                args: {
                    ids: [1],
                    wantStatus: STATUS_NAME,
                    token: token.address,
                    destination: destination.address,
                    before: before.toString(),
                    total: total.add(1).toString(),
                    gasCharges: [gas.chargeOf(submissionReceipt)],
                },
            }
        );
        expect(
            short,
            "an ERC20 shortfall must fire even though the destination carries a gas charge"
        ).to.not.equal(true);
    });
});
