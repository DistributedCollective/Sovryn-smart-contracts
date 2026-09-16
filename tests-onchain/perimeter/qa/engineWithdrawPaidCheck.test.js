/**
 * Regression for CON-R2-5's sibling gap in the QA engine: `withdraw` computed
 * `paidNow`, the receiver's balance delta, unconditionally, but only ever
 * surfaced or checked it on the direct-pay branch. On the QUEUED branch the
 * function logged "QUEUED" and returned without comparing `paidNow` to zero
 * at all — a hook that both queues a request and pays the receiver would
 * report a clean "QUEUED" from this tool while the attacker already had the
 * funds, and freezing the queued request would accomplish nothing.
 *
 * Isolated from the real QA fork on purpose: a fake surface driver is
 * registered directly into `drivers.SURFACE_DRIVERS`, so this runs against
 * Hardhat's own in-process network (no `--network`, no fork, nothing sent to
 * a real chain) rather than requiring `perimeter:qa up` against a live RPC.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/engineWithdrawPaidCheck.test.js
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const drivers = require("./drivers");
const engine = require("./engine");

describe("QA scenario engine — withdraw refuses to report a clean QUEUED when the receiver was paid", () => {
    let receiver;
    let funder;
    let fakeS;

    before(async () => {
        [funder] = await ethers.getSigners();
        receiver = ethers.Wallet.createRandom().address;
        // withdraw() only ever reads securityPerimeterEnabled() off s.controller
        // and never touches s.queue before the paidNow check runs, so a minimal
        // fake stack is enough to drive it in isolation.
        fakeS = { controller: { securityPerimeterEnabled: async () => true } };
    });

    beforeEach(() => {
        // withdraw() resolves opts.as === "test" through a bare ethers.Wallet
        // over the current provider — any valid key works, funded or not,
        // since nothing here ever sends a transaction FROM it.
        fakeS.state = { testKey: ethers.Wallet.createRandom() };
    });

    it("rejects a driver that queues AND pays the receiver, instead of printing a clean QUEUED", async () => {
        drivers.SURFACE_DRIVERS.__qaTestQueueAndPay = async (s, signer, opts) => {
            const before = await ethers.provider.getBalance(opts.receiver);
            // The defect this pins: a hook that both records a queued exit
            // AND, in the same call, pays the receiver directly.
            await (
                await funder.sendTransaction({
                    to: opts.receiver,
                    value: ethers.utils.parseEther("1"),
                })
            ).wait();
            return { id: 1, before: { receiver: before } };
        };

        let raised = null;
        try {
            await engine.withdraw(fakeS, {
                surface: "__qaTestQueueAndPay",
                as: "test",
                receiver,
                log: () => {},
            });
        } catch (error) {
            raised = error;
        }
        expect(
            raised,
            "withdraw() must not resolve when the receiver was paid on a queued exit"
        ).to.not.equal(null);
        expect(raised.message).to.match(/queued but ALSO paid/);
        expect(raised.message).to.include(receiver);

        delete drivers.SURFACE_DRIVERS.__qaTestQueueAndPay;
    });

    it('still reports a clean QUEUED, with receiverDelta "0", for a driver that only queues', async () => {
        drivers.SURFACE_DRIVERS.__qaTestQueueOnly = async (s, signer, opts) => {
            const before = await ethers.provider.getBalance(opts.receiver);
            return { id: 1, before: { receiver: before } };
        };
        // describeRequest() is reached once paidNow is confirmed <= 0, so the
        // fake queue stack has to answer it for this (happy-path) case only.
        fakeS.queue = {
            getRequest: async () => ({
                unlockAt: ethers.BigNumber.from(Math.floor(Date.now() / 1000) + 3600),
                surfaceId: ethers.constants.HashZero,
                status: 0,
                originator: receiver,
                owner: receiver,
                receiver,
                token: ethers.constants.AddressZero,
                subProduct: ethers.constants.AddressZero,
                amount: ethers.BigNumber.from(0),
                unwrapOnDelivery: false,
            }),
            blockStateOf: async () => 0,
        };

        const record = await engine.withdraw(fakeS, {
            surface: "__qaTestQueueOnly",
            as: "test",
            receiver,
            log: () => {},
        });
        expect(record.queued).to.equal(true);
        expect(record.receiverDelta).to.equal("0");

        delete drivers.SURFACE_DRIVERS.__qaTestQueueOnly;
    });
});
