/**
 * The scenario engine, driven end to end against a bootstrapped QA fork.
 *
 * This walks the queue through every state a dapp or the operator console has
 * to draw — held, frozen, released, paused, unpaused, executed, pass-through
 * with the perimeter off, recovered into a pool, recovered to an address — and
 * checks each one by reading the contracts, never by reading a printed table.
 *
 * It WRITES to the fork and does not put anything back: the states it leaves
 * are the point. Run it once per `perimeter:qa up`; to run it again, restart
 * the node and bootstrap it afresh.
 *
 *     PERIMETER_QA_PORT=8547 scripts/perimeter/qa-node.sh --detach
 *     PERIMETER_QA_RPC=http://127.0.0.1:8547 __decryptionAlreadyDone__=TRUE \
 *       npx hardhat perimeter:qa up --delay 120 --network rskForkedMainnetQa
 *     PERIMETER_QA_RPC=http://127.0.0.1:8547 __decryptionAlreadyDone__=TRUE \
 *       npx hardhat test tests-onchain/perimeter/qa/engine.test.js \
 *       --network rskForkedMainnetQa
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const { attachQa } = require("./bootstrap");
const drivers = require("./drivers");
const engine = require("./engine");

const { STATUS, BLOCK } = drivers;
const ZERO_ADDRESS = ethers.constants.AddressZero;
const HALF_HOUR = 30 * 60 * 1000;
const silent = { log: () => {} };

/** Assert a call fails, and hand back the queue's own name for the refusal. */
const expectRevert = async (queue, call) => {
    let raised = null;
    try {
        const tx = await call();
        await tx.wait();
    } catch (error) {
        raised = error;
    }
    expect(raised, "the call was expected to fail, and did not").to.not.equal(null);
    return engine.revertReason(queue, raised);
};

describe("QA scenario engine", () => {
    let s;
    let delaySeconds;
    /** Every request the engine has been asked to take, by the label this test
     *  refers to it by. */
    const ids = {};

    before(async function () {
        this.timeout(HALF_HOUR);
        if (!hre.network.tags.qa) {
            // Throw, never return: a bare return marks a security rehearsal
            // PASSED with zero assertions.
            throw new Error("run with --network rskForkedMainnetQa");
        }
        await engine.assertQa();
        s = await attachQa(hre);
        delaySeconds = Number(await s.controller.globalDelaySeconds());
        expect(delaySeconds, "the fork is not armed with a hold").to.be.greaterThan(0);
        expect(
            (await s.queue.lastRequestId()).toNumber(),
            "the queue already holds requests — this test needs a freshly bootstrapped fork"
        ).to.equal(0);
    });

    it("takes a withdrawal on every surface and holds all five", async function () {
        this.timeout(HALF_HOUR);
        // Surplus before Zero: the surplus claim needs an account with no open
        // trove, and the Zero withdrawal opens one.
        for (const surface of ["lender", "borrower", "surplus", "zero"]) {
            const record = await engine.withdraw(s, { ...silent, surface, as: "test" });
            expect(record.queued, `${surface} was not held`).to.equal(true);
            expect(record.surface).to.equal(surface);
            ids[surface] = record.id;
        }
        const suspect1 = await engine.withdraw(s, {
            ...silent,
            surface: "lender",
            as: "suspect1",
        });
        ids.suspect1Lender = suspect1.id;

        const queued = await engine.status(s);
        expect(queued.lastRequestId).to.equal(5);
        expect(queued.requests.filter((r) => r.status === "Queued")).to.have.length(5);
        expect(queued.paused).to.equal(false);
        expect(queued.perimeterEnabled).to.equal(true);

        // The escrow is the amount the queue recorded, which is already net of
        // the charge — the amount that went in never enters an assertion.
        for (const request of queued.requests) {
            const onChain = await s.queue.getRequest(request.id);
            expect(onChain.status).to.equal(STATUS.Queued);
            expect(onChain.amount.gt(0), `request ${request.id} escrowed nothing`).to.be.true;
        }
        const escrowed = {};
        for (const request of queued.requests) {
            const onChain = await s.queue.getRequest(request.id);
            escrowed[onChain.token] = (escrowed[onChain.token] || ethers.constants.Zero).add(
                onChain.amount
            );
        }
        for (const [token, total] of Object.entries(escrowed)) {
            expect(await s.queue.totalEscrowed(token), `escrow for ${token}`).to.equal(total);
        }
    });

    it("freezes a party off one request and lets it go again", async function () {
        this.timeout(HALF_HOUR);
        const suspect1 = ethers.utils.getAddress(s.state.suspects[0]);
        const frozen = await engine.freeze(s, [ids.suspect1Lender], silent);
        expect(frozen.applied, frozen.note || "").to.equal(true);
        expect(await s.queue.blockStateOf(suspect1)).to.equal(BLOCK.Frozen);
        expect(await s.queue.blockTrigger(suspect1)).to.equal(ids.suspect1Lender);

        const signer = await engine.signerFor(s, "suspect1");
        const why = await expectRevert(s.queue, () =>
            s.queue.connect(signer).executeExit(ids.suspect1Lender)
        );
        expect(why, "the queue paid a frozen party").to.match(/ActorBlocked|NotUnlocked/);
        expect((await s.queue.getRequest(ids.suspect1Lender)).status).to.equal(STATUS.Queued);

        const released = await engine.release(s, suspect1, { ...silent, blacklisted: false });
        expect(released.applied, released.note || "").to.equal(true);
        expect(await s.queue.blockStateOf(suspect1)).to.equal(BLOCK.None);
    });

    it("pauses every payout without stopping ingress or blocking", async function () {
        this.timeout(HALF_HOUR);
        const paused = await engine.pause(s, silent);
        expect(paused.applied, paused.note || "").to.equal(true);
        expect(await s.queue.securityPerimeterPaused()).to.equal(true);

        const signer = await engine.signerFor(s, "test");
        const why = await expectRevert(s.queue, () =>
            s.queue.connect(signer).executeExit(ids.lender)
        );
        expect(why, "the queue paid while paused").to.match(/QueuePaused|NotUnlocked/);
        expect((await s.queue.getRequest(ids.lender)).status).to.equal(STATUS.Queued);

        // Ingress stays live under the pause.
        const before = await s.queue.lastRequestId();
        const ingress = await engine.withdraw(s, {
            ...silent,
            surface: "lender",
            as: "suspect2",
        });
        expect(ingress.queued).to.equal(true);
        expect(await s.queue.lastRequestId()).to.equal(before.add(1));
        ids.suspect2Lender = ingress.id;

        // And so does blocking — the pause buys time, it does not spend it.
        const blocked = await engine.blacklist(s, [ids.suspect2Lender], silent);
        expect(blocked.applied, blocked.note || "").to.equal(true);
        expect(await s.queue.blockStateOf(s.state.suspects[1])).to.equal(BLOCK.Blacklisted);

        const unpaused = await engine.unpause(s, silent);
        expect(unpaused.applied, unpaused.note || "").to.equal(true);
        expect(await s.queue.securityPerimeterPaused()).to.equal(false);
    });

    it("pays the receiver to the wei once the hold has run out", async function () {
        this.timeout(HALF_HOUR);
        const chainBefore = (await ethers.provider.getBlock("latest")).timestamp;
        const advanced = await engine.advance(s, delaySeconds + 1, silent);
        expect(advanced.chainTimeAfter).to.be.greaterThan(chainBefore + delaySeconds);

        const request = await s.queue.getRequest(ids.lender);
        const receiverBefore = await ethers.provider.getBalance(request.receiver);
        const result = await engine.execute(s, ids.lender, silent);
        expect(result.applied, result.note || "").to.equal(true);
        expect((await s.queue.getRequest(ids.lender)).status).to.equal(STATUS.Executed);

        // The lender exit unwraps on delivery and the executor is the receiver,
        // so the wei-exact expectation is the escrow less the gas it paid.
        const receipt = await ethers.provider.getTransactionReceipt(result.txHash);
        const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        expect(await ethers.provider.getBalance(request.receiver)).to.equal(
            receiverBefore.add(request.amount).sub(gas)
        );
    });

    it("passes a withdrawal straight through with the perimeter switched off", async function () {
        this.timeout(HALF_HOUR);
        const off = await engine.kill(s, false, silent);
        expect(off.applied, off.note || "").to.equal(true);
        expect(await s.controller.securityPerimeterEnabled()).to.equal(false);
        // The switch stops the delay being quoted; it does not erase it.
        expect(Number(await s.controller.globalDelaySeconds())).to.equal(delaySeconds);

        const receiver = drivers.derivedActor(s.state.testKey.address, "pass-through");
        const lastBefore = await s.queue.lastRequestId();
        const balanceBefore = await ethers.provider.getBalance(receiver);
        const record = await engine.withdraw(s, {
            ...silent,
            surface: "lender",
            as: "suspect3",
            receiver,
        });
        expect(record.queued, "a disabled perimeter still queued").to.equal(false);
        expect(await s.queue.lastRequestId()).to.equal(lastBefore);
        expect(
            (await ethers.provider.getBalance(receiver)).sub(balanceBefore).gt(0),
            "the pass-through payout never arrived"
        ).to.be.true;

        // Everything taken before the switch is still held to its own unlock.
        for (const id of [ids.borrower, ids.surplus, ids.zero, ids.suspect1Lender]) {
            expect((await s.queue.getRequest(id)).status).to.equal(STATUS.Queued);
        }

        const on = await engine.kill(s, true, silent);
        expect(on.applied, on.note || "").to.equal(true);
        expect(await s.controller.securityPerimeterEnabled()).to.equal(true);
    });

    it("sends blacklisted escrow back to the pool it came from", async function () {
        this.timeout(HALF_HOUR);
        // The lending lender surface is the one whose escrow is an ERC20 held
        // against a sub-product pool, so it is the one a top-up route can serve.
        const request = await s.queue.getRequest(ids.suspect2Lender);
        expect(await s.queue.blockStateOf(request.originator)).to.equal(BLOCK.Blacklisted);

        const route = await engine.route(s, "lender", "topup", undefined, silent);
        expect(route.applied, JSON.stringify(route.steps)).to.equal(true);
        expect(await s.queue.topUpFeasible(engine.SURFACE_IDS.lender)).to.equal(true);
        const registered = await s.queue.getRecoveryRoute(route.routeId);
        expect(registered.active).to.equal(true);
        expect(registered.topUpPool).to.equal(true);
        expect(ethers.utils.getAddress(registered.destination)).to.equal(
            ethers.utils.getAddress(request.subProduct)
        );

        const pool = new ethers.Contract(request.token, drivers.ERC20_ABI, ethers.provider);
        const poolBefore = await pool.balanceOf(request.subProduct);
        const refund = await engine.refund(s, [ids.suspect2Lender], "pool", silent);
        expect(refund.applied, refund.note || "").to.equal(true);
        expect((await s.queue.getRequest(ids.suspect2Lender)).status).to.equal(
            STATUS.ResolvedToProtocol
        );
        expect(await pool.balanceOf(request.subProduct)).to.equal(poolBefore.add(request.amount));
    });

    it("recovers a Zero exit along a plain route and a lending exit to an address", async function () {
        this.timeout(HALF_HOUR);
        const testKey = ethers.utils.getAddress(s.state.testKey.address);
        const blocked = await engine.blacklist(s, [ids.zero], silent);
        expect(blocked.applied, blocked.note || "").to.equal(true);
        expect(await s.queue.blockStateOf(testKey)).to.equal(BLOCK.Blacklisted);

        // A Zero collateral exit carries no sub-product and escrows native
        // RBTC, so there is no pool to top up; it is recovered along a plain
        // route to a named destination instead.
        const zeroRequest = await s.queue.getRequest(ids.zero);
        expect(zeroRequest.subProduct).to.equal(ZERO_ADDRESS);
        expect(zeroRequest.token).to.equal(ZERO_ADDRESS);
        const treasury = drivers.derivedActor(testKey, "zero-recovery");
        const route = await engine.route(s, "zero", "address", treasury, silent);
        expect(route.applied, JSON.stringify(route.steps)).to.equal(true);

        const treasuryBefore = await ethers.provider.getBalance(treasury);
        const toProtocol = await engine.refund(s, [ids.zero], "pool", silent);
        expect(toProtocol.applied, toProtocol.note || "").to.equal(true);
        expect((await s.queue.getRequest(ids.zero)).status).to.equal(STATUS.ResolvedToProtocol);
        expect(await ethers.provider.getBalance(treasury)).to.equal(
            treasuryBefore.add(zeroRequest.amount)
        );

        // The owner's catch-all needs no route at all.
        const borrowerRequest = await s.queue.getRequest(ids.borrower);
        const named = drivers.derivedActor(testKey, "sip-destination");
        const namedBefore = await ethers.provider.getBalance(named);
        const bySip = await engine.refund(s, [ids.borrower], named, silent);
        expect(bySip.applied, bySip.note || "").to.equal(true);
        expect((await s.queue.getRequest(ids.borrower)).status).to.equal(STATUS.ResolvedBySIP);
        expect(await ethers.provider.getBalance(named)).to.equal(
            namedBefore.add(borrowerRequest.amount)
        );
    });

    it("refuses a top-up route on a surface that has no pool to top up", async function () {
        this.timeout(HALF_HOUR);
        const refused = await engine.route(s, "zero", "topup", undefined, silent);
        expect(refused.applied).to.equal(false);
        const failed = refused.steps.find((step) => !step.applied);
        expect(failed.note, "the refusal was not reported with the queue's own reason").to.match(
            /InvalidDestination|TopUpInfeasibleSurface/
        );
    });

    it("prints a lever's calldata instead of sending it", async function () {
        this.timeout(HALF_HOUR);
        const pendingBefore = (await s.multisig.transactionCount()).toNumber();
        const printed = await engine.freeze(s, [ids.suspect1Lender], {
            ...silent,
            viaConsole: true,
        });
        expect(printed.sent).to.equal(false);
        expect(printed.selector).to.equal(
            ethers.utils.id("freezeFromRequest(uint256[],bool,bytes32)").slice(0, 10)
        );
        expect(printed.calldata).to.equal(
            s.queue.interface.encodeFunctionData("freezeFromRequest(uint256[],bool,bytes32)", [
                [ids.suspect1Lender],
                false,
                engine.REASON_QA,
            ])
        );
        expect(printed.multisigCalldata).to.equal(
            s.multisig.interface.encodeFunctionData("submitTransaction", [
                s.queue.address,
                0,
                printed.calldata,
            ])
        );
        // Nothing was sent: neither the wallet nor the party moved.
        expect((await s.multisig.transactionCount()).toNumber()).to.equal(pendingBefore);
        expect(await s.queue.blockStateOf(s.state.suspects[0])).to.equal(BLOCK.None);
    });

    it("leaves a lever pending above threshold 1 and confirms it through", async function () {
        this.timeout(HALF_HOUR);
        // The wallet's own threshold, raised through the wallet: one signature
        // is then no longer enough, which is what a fork booted with
        // --keep-threshold looks like.
        const raised = await engine.viaMultisig(
            s,
            "threshold 2",
            s.multisig.address,
            s.multisig,
            "changeRequirement(uint256)",
            [2],
            silent
        );
        expect(raised.applied, raised.note || "").to.equal(true);
        expect((await s.multisig.required()).toNumber()).to.equal(2);

        // A lever now stops at the wallet: pending, not swallowed.
        const paused = await engine.pause(s, silent);
        expect(paused.applied).to.equal(false);
        expect(paused.pending).to.equal(true);
        expect(paused.note).to.match(/threshold is 2/);
        expect(await s.queue.securityPerimeterPaused()).to.equal(false);

        const confirmed = await engine.confirm(s, paused.txId, silent);
        expect(confirmed.applied, "the confirmations did not carry the lever through").to.equal(
            true
        );
        expect(confirmed.confirmations).to.be.at.least(2);
        expect(await s.queue.securityPerimeterPaused()).to.equal(true);

        // Put the pause and the threshold back, both the same way.
        const unpaused = await engine.unpause(s, silent);
        expect((await engine.confirm(s, unpaused.txId, silent)).applied).to.equal(true);
        expect(await s.queue.securityPerimeterPaused()).to.equal(false);
        const lowered = await engine.viaMultisig(
            s,
            "threshold 1",
            s.multisig.address,
            s.multisig,
            "changeRequirement(uint256)",
            [1],
            silent
        );
        expect((await engine.confirm(s, lowered.txId, silent)).applied).to.equal(true);
        expect((await s.multisig.required()).toNumber()).to.equal(1);
    });

    it("puts the queue back where a snapshot found it", async function () {
        this.timeout(HALF_HOUR);
        const before = (await s.queue.lastRequestId()).toNumber();
        const snap = await engine.snapshot(s, silent);
        const taken = await engine.withdraw(s, { ...silent, surface: "lender", as: "suspect1" });
        expect(taken.queued).to.equal(true);
        expect((await s.queue.lastRequestId()).toNumber()).to.equal(before + 1);

        const reverted = await engine.revert(s, snap.snapshot, silent);
        expect(reverted.applied).to.equal(true);
        expect((await s.queue.lastRequestId()).toNumber()).to.equal(before);
        expect((await s.queue.getRequest(before + 1)).status).to.equal(STATUS.None);
    });
});
