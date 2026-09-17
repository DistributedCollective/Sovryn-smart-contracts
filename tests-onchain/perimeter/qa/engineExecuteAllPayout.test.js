/**
 * Isolated regression for `executeAll`'s payout verification.
 *
 * Before this fix, a batch release's `verify` callback checked only that
 * every id's status moved to `Executed` — never that anyone was actually
 * paid, or paid the right amount. A defective queue that flips every status
 * to `Executed` while under- or non-delivering one payout would have passed.
 * There was also no test of a SUCCESSFUL batch asserting payouts at all.
 *
 * Runs against Hardhat's own in-process network — no fork, no `--network` —
 * against a fake `s.queue` object standing in for the real ExitDelayQueue,
 * exactly the pattern `engineWithdrawPaidCheck.test.js` already uses for
 * `withdraw()`. A real TestToken is deployed for the ERC20 leg, since the
 * balance reads have to be real to prove anything.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/engineExecuteAllPayout.test.js
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const engine = require("./engine");

const ZERO_ADDRESS = ethers.constants.AddressZero;
const STATUS = { None: 0, Queued: 1, Executed: 2 };
const silent = { log: () => {} };

describe("QA scenario engine — executeAll verifies actual payouts, not just status", () => {
    let funder;
    let token;
    // `who` doubles as the batch's executor AND one of the three requests'
    // receiver, so every test also exercises the gas-normalized leg — its own
    // payout is always paid correctly here, so a fixture's own impersonation
    // funding never shows up as the reported mismatch; r1/r2 are where each
    // test's defect (or lack of one) lives.
    let who;
    let r1;
    let r2;
    let fakeS;
    let requests;

    /** A fresh fake queue over `requests` (mutated by executeExits). `payR1`/
     *  `payR2` decide whether those two legs are actually delivered; the
     *  executor's own leg is always paid, so its check never masks the one
     *  under test. */
    const buildFakeQueue = ({ payR1 = 50, payR2 = 30 } = {}) => ({
        lastRequestId: async () => ethers.BigNumber.from(requests.length),
        getRequest: async (id) => requests[id - 1],
        connect: (signer) => ({
            executeExits: async (ids) => {
                await funder.sendTransaction({ to: who, value: 100 });
                if (payR1 > 0) await funder.sendTransaction({ to: r1, value: payR1 });
                if (payR2 > 0) await (await token.connect(funder).mint(r2, payR2)).wait();
                for (const id of ids) requests[id - 1].status = STATUS.Executed;
                // The batch call itself, sent by the executor — this is what
                // gives the receipt its real gasUsed/effectiveGasPrice.
                return signer.sendTransaction({ to: funder.address, value: 0 });
            },
        }),
    });

    before(async () => {
        [funder] = await ethers.getSigners();
        token = await (await ethers.getContractFactory("TestToken")).deploy("Test", "TST", 18, 0);
        await token.deployed();
        r1 = ethers.Wallet.createRandom().address;
        r2 = ethers.Wallet.createRandom().address;
    });

    beforeEach(async () => {
        const testKey = ethers.Wallet.createRandom();
        who = testKey.address;
        // executeAll's own send goes through drivers.solventSigner, which
        // needs a JSON-RPC provider it can impersonate/fund against —
        // Hardhat's own provider works fine for that without a fork.
        fakeS = { state: { testKey }, provider: ethers.provider };
        // solventSigner impersonates `who` and restores whichever of its own
        // balance or a 10 RBTC floor is larger. Funding it comfortably above
        // that floor first makes the round trip a true no-op, the same way it
        // is for a real, already-funded QA account — otherwise a brand-new
        // zero-balance wallet would get bumped UP to the floor as a side
        // effect of impersonation, unrelated to anything this test pays out.
        await funder.sendTransaction({ to: who, value: ethers.utils.parseEther("20") });
        requests = [
            {
                token: ZERO_ADDRESS,
                receiver: who,
                amount: ethers.BigNumber.from(100),
                status: STATUS.Queued,
                originator: who,
                owner: who,
                unwrapOnDelivery: false,
            },
            {
                token: ZERO_ADDRESS,
                receiver: r1,
                amount: ethers.BigNumber.from(50),
                status: STATUS.Queued,
                originator: who,
                owner: who,
                unwrapOnDelivery: false,
            },
            // ERC20, a different asset entirely from the two native legs above.
            {
                token: token.address,
                receiver: r2,
                amount: ethers.BigNumber.from(30),
                status: STATUS.Queued,
                originator: who,
                owner: who,
                unwrapOnDelivery: false,
            },
        ];
    });

    it("fires on the defect this check exists to catch: status flips to Executed, one receiver is never paid at all", async () => {
        // Defective: r1's leg is skipped entirely, while the other two are
        // paid correctly and the status flips regardless. Before this fix,
        // `verify` checked only status and this would have reported success.
        fakeS.queue = buildFakeQueue({ payR1: 0 });

        const record = await engine.executeAll(fakeS, { ...silent, as: "test" });
        expect(record.applied, "a batch that skipped a payout must not report applied").to.equal(
            false
        );
        expect(record.note).to.include(r1);
        expect(record.note).to.match(/holds 0/);
    });

    it("fires when the batch under-delivers a single request out of several", async () => {
        // r1 is shorted by one wei — proves the check catches a partial
        // defect, not only a total one.
        fakeS.queue = buildFakeQueue({ payR1: 49 });

        const record = await engine.executeAll(fakeS, { ...silent, as: "test" });
        expect(record.applied).to.equal(false);
        expect(record.note).to.include(r1);
    });

    it("reports a clean success and delivers the exact aggregate payout per receiver, gas-normalized for the executor", async () => {
        const whoBefore = await ethers.provider.getBalance(who);
        const r1Before = await ethers.provider.getBalance(r1);
        const r2Before = await token.balanceOf(r2);

        fakeS.queue = buildFakeQueue();

        const record = await engine.executeAll(fakeS, { ...silent, as: "test" });
        expect(record.applied, record.note || "").to.equal(true);
        expect(record.ids).to.have.length(3);

        // Real, independently-read balances — not values the engine handed
        // back — so this proves delivery actually happened, gas and all.
        const receipt = await ethers.provider.getTransactionReceipt(record.txHash);
        const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        expect((await ethers.provider.getBalance(who)).toString()).to.equal(
            whoBefore.add(100).sub(gas).toString(),
            "the executor should net exactly the escrowed amount, gas included"
        );
        expect((await ethers.provider.getBalance(r1)).toString()).to.equal(
            r1Before.add(50).toString()
        );
        expect((await token.balanceOf(r2)).toString()).to.equal(r2Before.add(30).toString());
    });
});
