/**
 * The operator's rehearsal of the withdrawal delay, end to end on a fork.
 *
 * The shared fixture builds the activated world once — the release that is
 * already live, the deployed controller upgraded to the delay build, a queue
 * owned and administered by the multisig, both products wired through real
 * governance, and the delay armed. The six scenarios below run against that one
 * build, in order, and each restores what it changed so the next one starts on a
 * clean queue.
 *
 * Every operator lever runs through the multisig at its real threshold: a lever
 * the operator cannot actually reach on the day is not rehearsed by calling it
 * from a test account.
 *
 * Run a forked mainnet node in another terminal first:
 *     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
 * then:
 *     __decryptionAlreadyDone__=TRUE npx hardhat test \
 *       tests-onchain/perimeter/perimeterDelayE2E.test.js --network rskForkedMainnet
 */
const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, deployments } = hre;
const { get } = deployments;

const {
    ONE_RBTC,
    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
    PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
    PERIMETER_SURFACE_ZERO_WITHDRAW_COLL,
    PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS,
    collSurplusPoolFixture,
    getSingleExitFeeApplied,
    forkOps,
} = require("./perimeterSipTestHelpers");
const { setupPhase2Stack } = require("./phase2Stack");

const ZERO_ADDRESS = ethers.constants.AddressZero;
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
];

/** ExitStatus / BlockState as the queue stores them. */
const STATUS = { None: 0, Queued: 1, Executed: 2, ResolvedToProtocol: 3, ResolvedBySIP: 4 };
const BLOCK = { None: 0, Frozen: 1, Blacklisted: 2 };
/** Zero's Status.closedByRedemption. */
const TROVE_CLOSED_BY_REDEMPTION = 4;

const REASON_E2E = ethers.utils.id("e2e");
/** The reason hash the admin page stamps on every block it submits. */
const REASON_ADMIN_PAGE = ethers.utils.id("admin-page");

const LEND_AMOUNT = ethers.utils.parseEther("1");
const LOAN_DURATION = 28 * 24 * 60 * 60;
/** Zero's origination/redemption rates float; the probes below are all
 *  balance-based, so the rate actually charged does not enter an assertion. */
const MAX_ZERO_FEE_PERCENTAGE = ethers.utils.parseEther("0.99");

/** A fresh actor, funded by the fork. Every scenario uses its own so none
 *  inherits another's position, allowance or block state. */
const actor = (tag) => ethers.utils.getAddress(ethers.utils.hexZeroPad("0x" + tag, 20));

const S1 = {
    lender: actor("e2e51001"),
    lenderReceiver: actor("e2e51002"),
    borrower: actor("e2e51003"),
    borrowerReceiver: actor("e2e51004"),
    zeroColl: actor("e2e51005"),
    surplusVictim: actor("e2e51006"),
    redeemer: actor("e2e51007"),
};
const S2 = { a: actor("e2e52001"), b: actor("e2e52002"), receiver: actor("e2e52003") };
const S3 = { c: actor("e2e53001"), d: actor("e2e53002") };
const S4 = {
    held: actor("e2e54001"),
    passThrough: actor("e2e54002"),
    receiver: actor("e2e54003"),
};
const S5 = {
    blacklisted: actor("e2e55001"),
    clean: actor("e2e55002"),
    arbitrary: actor("e2e55003"),
};
const S6 = { party: actor("e2e56001") };

/** The revert payload the node attached to a failed call, looked for only where
 *  a node puts it — never in the transaction's own `data`, which would decode
 *  as the call that failed rather than the reason it failed. */
const errorDataOf = (error) => {
    const candidates = [];
    let node = error;
    for (let depth = 0; node && typeof node === "object" && depth < 8; depth++) {
        if (typeof node.data === "string") candidates.push(node.data);
        else if (node.data && typeof node.data.data === "string") candidates.push(node.data.data);
        if (typeof node.body === "string") {
            try {
                const parsed = JSON.parse(node.body);
                const payload = parsed && parsed.error && parsed.error.data;
                if (typeof payload === "string") candidates.push(payload);
                else if (payload && typeof payload.data === "string")
                    candidates.push(payload.data);
            } catch (e) {
                // not a JSON-RPC body
            }
        }
        node = node.error;
    }
    return candidates.find((candidate) => /^0x[0-9a-fA-F]{8,}$/.test(candidate)) || null;
};

/** Assert a call fails, and fails with the NAMED custom error and arguments.
 *  The revert data is decoded against the contract's own ABI rather than left
 *  as "it reverted": which guard fired is the whole content of these
 *  assertions, and two different guards would otherwise look identical. */
const expectCustomError = async (send, contract, name, args = null) => {
    let raised = null;
    try {
        const tx = await send();
        await tx.wait();
    } catch (error) {
        raised = error;
    }
    expect(raised, `expected ${name}, but the call succeeded`).to.not.equal(null);
    const data = errorDataOf(raised);
    expect(data, `${name} expected, but the revert carried no data: ${raised.message}`).to.be.a(
        "string"
    );
    const decoded = contract.interface.parseError(data);
    expect(decoded.name, `reverted with ${decoded.name} instead of ${name}`).to.equal(name);
    if (args !== null) {
        expect(decoded.args.length, `${name} argument count`).to.equal(args.length);
        args.forEach((expected, index) => {
            const actual = decoded.args[index];
            const same =
                typeof expected === "string" && ethers.utils.isAddress(expected)
                    ? ethers.utils.getAddress(actual)
                    : actual.toString();
            const want =
                typeof expected === "string" && ethers.utils.isAddress(expected)
                    ? ethers.utils.getAddress(expected)
                    : expected.toString();
            expect(same, `${name} argument ${index}`).to.equal(want);
        });
    }
    return decoded;
};

const nativeBalance = (address) => ethers.provider.getBalance(address);
const gasSpent = (receipt) => receipt.gasUsed.mul(receipt.effectiveGasPrice);

describe("Withdrawal-delay perimeter — the operator's levers on a fork", () => {
    let s;
    let wrbtcAddress;
    /** The protocol's own price feed, put back by the `after` below. */
    let originalPriceFeeds;
    /** Every scenario's fresh actors, impersonated and funded once. */
    const signers = {};

    const signerFor = async (address) => {
        if (!signers[address]) signers[address] = await forkOps.impersonate(s.provider, address);
        return signers[address];
    };

    /** Mint an iRBTC position with native RBTC and burn it straight back. The
     *  burn is the lender exit: with the delay armed it escrows WRBTC in the
     *  queue and unwraps to native at delivery. */
    const queueLenderWithdrawal = async (address, receiver = address, amount = LEND_AMOUNT) => {
        const signer = await signerFor(address);
        const held = await s.iRBTC.balanceOf(address);
        await (
            await s.iRBTC.connect(signer).mintWithBTC(address, false, { value: amount })
        ).wait();
        const minted = (await s.iRBTC.balanceOf(address)).sub(held);
        expect(minted.gt(0), "iRBTC position minted").to.be.true;

        const before = await s.queue.lastRequestId();
        await (await s.iRBTC.connect(signer).burnToBTC(receiver, minted, false)).wait();
        const id = await s.queue.lastRequestId();
        expect(id.sub(before), "the lender withdrawal was not held").to.equal(1);

        const request = await s.queue.getRequest(id);
        expect(request.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW);
        expect(request.originator).to.equal(address);
        expect(request.receiver).to.equal(receiver);
        expect(request.status).to.equal(STATUS.Queued);
        return { id, request };
    };

    /** Release one request and prove the receiver was paid to the wei. */
    const executeAndExpectPaid = async (id, executor) => {
        const request = await s.queue.getRequest(id);
        const native = request.token === ZERO_ADDRESS || request.unwrapOnDelivery;
        const token = native
            ? null
            : new ethers.Contract(request.token, ERC20_ABI, ethers.provider);
        const balanceOf = async () =>
            native ? nativeBalance(request.receiver) : token.balanceOf(request.receiver);

        const before = await balanceOf();
        const signer = await signerFor(executor);
        const receipt = await (await s.queue.connect(signer).executeExit(id)).wait();
        const paidGas =
            native && executor.toLowerCase() === request.receiver.toLowerCase()
                ? gasSpent(receipt)
                : ethers.constants.Zero;

        expect(await balanceOf(), "the receiver was not paid the escrowed amount").to.equal(
            before.add(request.amount).sub(paidGas)
        );
        expect((await s.queue.getRequest(id)).status).to.equal(STATUS.Executed);
        return { receipt, amount: request.amount };
    };

    /** One operator action, submitted and confirmed at the multisig's real
     *  threshold, asserted to have actually executed. */
    const operatorCall = async (target, contract, signature, args) => {
        const data = contract.interface.encodeFunctionData(signature, args);
        const result = await s.viaMultisig(target, data);
        expect(result.executed, `the multisig did not execute ${signature}`).to.be.true;
        return result;
    };

    const onQueue = (signature, args) => operatorCall(s.queue.address, s.queue, signature, args);
    const onController = (signature, args) =>
        operatorCall(s.stack.controller.address, s.stack.controller, signature, args);

    before(async function () {
        if (!hre.network.tags["forked"]) {
            // Throw, never return: a bare return marks a security rehearsal
            // PASSED with zero assertions.
            throw new Error(
                "the delay rehearsal must run on a forked mainnet (rskForkedMainnet); " +
                    "no fork tag on this network"
            );
        }

        // The lending borrower surface prices collateral through the protocol's
        // price feed, and the production WRBTC feed expires — the governance
        // clock jumps inside the fixture push block.timestamp well past any
        // oracle update. Read the live rate BEFORE the jumps, then serve it from
        // a settable feed installed by the protocol's own owner, which is the
        // authority that rotates a feed in production.
        const protocolAddress = (await get("SovrynProtocol")).address;
        const xusdAddress = (await get("XUSD")).address;
        const liveWrbtcAddress = (await get("WRBTC")).address;
        originalPriceFeeds = await new ethers.Contract(
            protocolAddress,
            ["function priceFeeds() view returns (address)"],
            ethers.provider
        ).priceFeeds();
        const liveFeeds = new ethers.Contract(
            originalPriceFeeds,
            ["function queryRate(address,address) view returns (uint256 rate, uint256 precision)"],
            ethers.provider
        );
        const liveRate = (await liveFeeds.queryRate(xusdAddress, liveWrbtcAddress)).rate;
        expect(liveRate.gt(0), "the live price feed quotes no XUSD/WRBTC rate").to.be.true;

        s = await setupPhase2Stack();
        wrbtcAddress = s.wrbtc.address;

        const localFeeds = await (
            await ethers.getContractFactory("PriceFeedsLocal", s.ctx.deployerSigner)
        ).deploy(liveWrbtcAddress, (await get("SOV")).address);
        await localFeeds.deployed();
        await (await localFeeds.setRates(xusdAddress, liveWrbtcAddress, liveRate)).wait();
        await (
            await s.protocol
                .connect(s.ctx.timelockOwnerSigner)
                .setPriceFeedContract(localFeeds.address)
        ).wait();

        // Nothing is escrowed before the first scenario queues anything.
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);
        expect(await s.queue.totalEscrowed(ZERO_ADDRESS)).to.equal(0);
    });

    /** Hand the real price feeds back. The settable one installed above is
     *  seeded with a single pair, so anything else that runs on the same node
     *  would inherit a protocol that quotes nothing for every other token. */
    after(async () => {
        if (!s || !originalPriceFeeds) return;
        await (
            await s.protocol
                .connect(s.ctx.timelockOwnerSigner)
                .setPriceFeedContract(originalPriceFeeds)
        ).wait();
    });

    it("S1: holds and releases a withdrawal on every delayed surface", async () => {
        const queued = [];

        // ── Lending, lender exit ───────────────────────────────────────────
        const lenderReceiverBefore = await nativeBalance(S1.lenderReceiver);
        const lender = await queueLenderWithdrawal(S1.lender, S1.lenderReceiver);
        expect(lender.request.token.toLowerCase()).to.equal(wrbtcAddress.toLowerCase());
        expect(lender.request.unwrapOnDelivery, "native exits unwrap at delivery").to.be.true;
        expect(lender.request.subProduct.toLowerCase()).to.equal(s.iRBTC.address.toLowerCase());
        expect(
            await nativeBalance(S1.lenderReceiver),
            "the lender's receiver was paid despite the hold"
        ).to.equal(lenderReceiverBefore);
        queued.push({ ...lender, executor: S1.lender });

        // ── Lending, borrower exit ─────────────────────────────────────────
        const borrower = await signerFor(S1.borrower);
        const borrowAmount = ethers.utils.parseEther("300");
        const collateralNeeded = (
            await s.iXUSD.getDepositAmountForBorrow(borrowAmount, LOAN_DURATION, wrbtcAddress)
        )
            .mul(120)
            .div(100);
        const borrowReceipt = await (
            await s.iXUSD
                .connect(borrower)
                .borrow(
                    ethers.constants.HashZero,
                    borrowAmount,
                    LOAN_DURATION,
                    collateralNeeded,
                    wrbtcAddress,
                    S1.borrower,
                    S1.borrower,
                    "0x",
                    { value: collateralNeeded }
                )
        ).wait();
        const borrowEvent = borrowReceipt.logs
            .map((log) => {
                try {
                    return s.protocol.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            })
            .find((parsed) => parsed && parsed.name === "Borrow");
        expect(borrowEvent, "the borrow did not open a loan").to.not.be.undefined;

        const borrowerReceiverBefore = await nativeBalance(S1.borrowerReceiver);
        const borrowerQueuedBefore = await s.queue.lastRequestId();
        await (
            await s.protocol
                .connect(borrower)
                .withdrawCollateral(
                    borrowEvent.args.loanId,
                    S1.borrowerReceiver,
                    ethers.utils.parseEther("0.00001")
                )
        ).wait();
        const borrowerId = await s.queue.lastRequestId();
        expect(
            borrowerId.sub(borrowerQueuedBefore),
            "the collateral withdrawal was not held"
        ).to.equal(1);
        const borrowerRequest = await s.queue.getRequest(borrowerId);
        expect(borrowerRequest.surfaceId).to.equal(PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW);
        expect(borrowerRequest.receiver).to.equal(S1.borrowerReceiver);
        expect(
            await nativeBalance(S1.borrowerReceiver),
            "the borrower's receiver was paid despite the hold"
        ).to.equal(borrowerReceiverBefore);
        queued.push({ id: borrowerId, request: borrowerRequest, executor: S1.borrower });

        // ── Zero, collateral withdrawal ────────────────────────────────────
        const zeroColl = await signerFor(S1.zeroColl);
        const zeroBorrowAmount = (await s.borrowerOperations.MIN_NET_DEBT()).mul(2);
        await (
            await s.borrowerOperations
                .connect(zeroColl)
                .openTrove(MAX_ZERO_FEE_PERCENTAGE, zeroBorrowAmount, S1.zeroColl, S1.zeroColl, {
                    value: ONE_RBTC.mul(2),
                })
        ).wait();

        const zeroCollBefore = await nativeBalance(S1.zeroColl);
        const zeroQueuedBefore = await s.queue.lastRequestId();
        const withdrawCollReceipt = await (
            await s.borrowerOperations
                .connect(zeroColl)
                .withdrawColl(ethers.utils.parseEther("0.0001"), S1.zeroColl, S1.zeroColl)
        ).wait();
        const zeroCollId = await s.queue.lastRequestId();
        expect(zeroCollId.sub(zeroQueuedBefore), "the Zero withdrawal was not held").to.equal(1);
        const zeroCollRequest = await s.queue.getRequest(zeroCollId);
        expect(zeroCollRequest.surfaceId).to.equal(PERIMETER_SURFACE_ZERO_WITHDRAW_COLL);
        expect(zeroCollRequest.receiver).to.equal(S1.zeroColl);
        // The withdrawer pays gas and receives nothing: the collateral is held.
        expect(
            await nativeBalance(S1.zeroColl),
            "Zero paid the collateral despite the hold"
        ).to.equal(zeroCollBefore.sub(gasSpent(withdrawCollReceipt)));
        queued.push({ id: zeroCollId, request: zeroCollRequest, executor: S1.zeroColl });

        // ── Zero, collateral-surplus claim ─────────────────────────────────
        // A FULL redemption of a deterministic probe trove leaves its owner a
        // claimable surplus, and claiming it is the fourth delayed surface. The
        // probe opens as the system's first redeemable trove, derived from the
        // live queue floor rather than a hardcoded ratio.
        const troveManager = await ethers.getContract("TroveManager");
        const hintHelpers = await ethers.getContract("HintHelpers");
        const sortedTroves = await ethers.getContract("SortedTroves");
        const zeroPriceFeed = await ethers.getContract("PriceFeed");
        const zusd = new ethers.Contract(
            (await get("ZUSDToken")).address,
            ERC20_ABI,
            s.ctx.deployerSigner
        );
        const collSurplusPool = new ethers.Contract(
            (await get("CollSurplusPool_Proxy")).address,
            collSurplusPoolFixture.abi,
            s.ctx.deployerSigner
        );

        const victim = await signerFor(S1.surplusVictim);
        const redeemer = await signerFor(S1.redeemer);
        const price = await zeroPriceFeed.callStatic.fetchPrice();
        const gasCompensation = await s.borrowerOperations.ZUSD_GAS_COMPENSATION();
        const expectedDebt = zeroBorrowAmount
            .add(await troveManager.getBorrowingFeeWithDecay(zeroBorrowAmount))
            .add(gasCompensation);
        const mcr = await troveManager.MCR();
        let probeIcr = ethers.utils.parseEther("1.13");
        const floorHints = await hintHelpers.getRedemptionHints(ONE_RBTC, price, 0);
        if (floorHints.firstRedemptionHint !== ZERO_ADDRESS) {
            const floorIcr = await troveManager.getCurrentICR(
                floorHints.firstRedemptionHint,
                price
            );
            if (floorIcr.lte(probeIcr)) {
                const gap = floorIcr.sub(mcr);
                expect(
                    gap.gte(ethers.utils.parseEther("0.0004")),
                    "the live redemption queue's floor grazes the MCR — no room to open the " +
                        "probe trove below it"
                ).to.be.true;
                probeIcr = mcr.add(gap.div(2));
            }
        }
        await (
            await s.borrowerOperations
                .connect(victim)
                .openTrove(
                    MAX_ZERO_FEE_PERCENTAGE,
                    zeroBorrowAmount,
                    S1.surplusVictim,
                    S1.surplusVictim,
                    { value: expectedDebt.mul(probeIcr).div(price).add(1) }
                )
        ).wait();

        // The probe's own ZUSD plus the Zero prober's fund the redeemer.
        await (
            await zusd
                .connect(victim)
                .transfer(S1.redeemer, await zusd.balanceOf(S1.surplusVictim))
        ).wait();
        await (
            await zusd.connect(zeroColl).transfer(S1.redeemer, await zusd.balanceOf(S1.zeroColl))
        ).wait();
        const redeemable = (await troveManager.getEntireDebtAndColl(S1.surplusVictim)).debt.sub(
            gasCompensation
        );
        expect(
            (await zusd.balanceOf(S1.redeemer)).gte(redeemable),
            "the redeemer cannot cover a full redemption of the probe trove"
        ).to.be.true;

        const surplusHints = await hintHelpers.getRedemptionHints(redeemable, price, 0);
        expect(
            surplusHints.firstRedemptionHint,
            "the probe trove must be the system's first redeemable trove"
        ).to.equal(S1.surplusVictim);
        const [surplusUpper, surplusLower] = await sortedTroves.findInsertPosition(
            surplusHints.partialRedemptionHintNICR,
            surplusHints.firstRedemptionHint,
            surplusHints.firstRedemptionHint
        );
        await (
            await troveManager
                .connect(redeemer)
                .redeemCollateral(
                    redeemable,
                    surplusHints.firstRedemptionHint,
                    surplusUpper,
                    surplusLower,
                    surplusHints.partialRedemptionHintNICR,
                    0,
                    MAX_ZERO_FEE_PERCENTAGE
                )
        ).wait();
        expect(await troveManager.getTroveStatus(S1.surplusVictim)).to.equal(
            TROVE_CLOSED_BY_REDEMPTION
        );
        const surplusGross = await collSurplusPool.getCollateral(S1.surplusVictim);
        expect(surplusGross.gt(0), "a full redemption must leave a surplus").to.be.true;

        const victimBefore = await nativeBalance(S1.surplusVictim);
        const surplusQueuedBefore = await s.queue.lastRequestId();
        const claimReceipt = await (
            await s.borrowerOperations.connect(victim).claimCollateral()
        ).wait();
        const surplusId = await s.queue.lastRequestId();
        expect(surplusId.sub(surplusQueuedBefore), "the surplus claim was not held").to.equal(1);
        const surplusRequest = await s.queue.getRequest(surplusId);
        expect(surplusRequest.surfaceId).to.equal(PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS);
        expect(surplusRequest.receiver).to.equal(S1.surplusVictim);
        expect(
            await nativeBalance(S1.surplusVictim),
            "the surplus was paid despite the hold"
        ).to.equal(victimBefore.sub(gasSpent(claimReceipt)));
        expect(await collSurplusPool.getCollateral(S1.surplusVictim)).to.equal(0);
        queued.push({ id: surplusId, request: surplusRequest, executor: S1.surplusVictim });

        // ── All four escrowed, none paid ───────────────────────────────────
        const escrowed = {};
        for (const { request } of queued) {
            escrowed[request.token] = (escrowed[request.token] || ethers.constants.Zero).add(
                request.amount
            );
        }
        for (const [token, total] of Object.entries(escrowed)) {
            expect(await s.queue.totalEscrowed(token), `escrow for ${token}`).to.equal(total);
        }

        // Before the delay elapses the queue refuses to pay, naming the unlock.
        await expectCustomError(
            () => s.queue.connect(signers[S1.lender]).executeExit(queued[0].id),
            s.queue,
            "NotUnlocked",
            [queued[0].id, queued[0].request.unlockAt]
        );

        // ── And the hold ends ──────────────────────────────────────────────
        await forkOps.increaseTime(s.provider, s.DELAY_SECONDS + 1);
        for (const { id, executor } of queued) {
            await executeAndExpectPaid(id, executor);
        }
        for (const token of Object.keys(escrowed)) {
            expect(
                await s.queue.totalEscrowed(token),
                `escrow for ${token} after release`
            ).to.equal(0);
        }
    });

    it("S2: a freeze off one queued withdrawal holds every request of the same parties", async () => {
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);

        const a1 = await queueLenderWithdrawal(S2.a, S2.receiver);
        const a2 = await queueLenderWithdrawal(S2.a);
        const b1 = await queueLenderWithdrawal(S2.b);
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(
            a1.request.amount.add(a2.request.amount).add(b1.request.amount)
        );

        // One request id is the whole evidence the operator needs.
        await onQueue("freezeFromRequest(uint256[],bool,bytes32)", [[a1.id], false, REASON_E2E]);
        expect(await s.queue.blockStateOf(S2.a)).to.equal(BLOCK.Frozen);
        expect(await s.queue.blockTrigger(S2.a)).to.equal(a1.id);
        // freezeReceiver was false, so the payout address is untouched.
        expect(await s.queue.blockStateOf(S2.receiver)).to.equal(BLOCK.None);
        expect(await s.queue.blockStateOf(S2.b)).to.equal(BLOCK.None);

        await forkOps.increaseTime(s.provider, s.DELAY_SECONDS + 1);

        // The freeze reaches BOTH of A's requests, not just the one it named.
        for (const held of [a1, a2]) {
            await expectCustomError(
                () => s.queue.connect(signers[S2.a]).executeExit(held.id),
                s.queue,
                "ActorBlocked",
                [S2.a, BLOCK.Frozen]
            );
        }
        // An unrelated party is unaffected.
        await executeAndExpectPaid(b1.id, S2.b);

        // ── The way back ───────────────────────────────────────────────────
        await onQueue("unfreeze(address[])", [[S2.a]]);
        expect(await s.queue.blockStateOf(S2.a)).to.equal(BLOCK.None);
        await executeAndExpectPaid(a2.id, S2.a);

        // ── Escalation, and this time the receiver goes too ────────────────
        await onQueue("blacklistFromRequest(uint256[],bool,bytes32)", [[a1.id], true, REASON_E2E]);
        expect(await s.queue.blockStateOf(S2.a)).to.equal(BLOCK.Blacklisted);
        expect(await s.queue.blockStateOf(S2.receiver)).to.equal(BLOCK.Blacklisted);
        await expectCustomError(
            () => s.queue.connect(signers[S2.a]).executeExit(a1.id),
            s.queue,
            "ActorBlocked",
            [S2.a, BLOCK.Blacklisted]
        );

        // Restore: release both addresses and let the last request through.
        await onQueue("unblacklist(address[])", [[S2.a, S2.receiver]]);
        expect(await s.queue.blockStateOf(S2.a)).to.equal(BLOCK.None);
        expect(await s.queue.blockStateOf(S2.receiver)).to.equal(BLOCK.None);
        await executeAndExpectPaid(a1.id, S2.a);
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);
    });

    it("S3: the pause stops every payout without stopping ingress or blocking", async () => {
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);

        const c1 = await queueLenderWithdrawal(S3.c);
        const d1 = await queueLenderWithdrawal(S3.d);
        await forkOps.increaseTime(s.provider, s.DELAY_SECONDS + 1);

        await onQueue("setSecurityPerimeterPaused(bool)", [true]);
        expect(await s.queue.securityPerimeterPaused()).to.be.true;

        // Unlocked, unblocked, and still unpayable.
        for (const [party, held] of [
            [S3.c, c1],
            [S3.d, d1],
        ]) {
            await expectCustomError(
                () => s.queue.connect(signers[party]).executeExit(held.id),
                s.queue,
                "QueuePaused",
                []
            );
        }

        // Ingress stays live: a withdrawal taken during the pause still escrows.
        const escrowedBefore = await s.queue.totalEscrowed(wrbtcAddress);
        const c2 = await queueLenderWithdrawal(S3.c);
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(
            escrowedBefore.add(c2.request.amount)
        );

        // And so does blocking — the pause buys time, it does not spend it.
        await onQueue("freezeFromRequest(uint256[],bool,bytes32)", [[c1.id], false, REASON_E2E]);
        expect(await s.queue.blockStateOf(S3.c)).to.equal(BLOCK.Frozen);

        await onQueue("setSecurityPerimeterPaused(bool)", [false]);
        expect(await s.queue.securityPerimeterPaused()).to.be.false;

        // Unpausing releases the unblocked and leaves the blocked held.
        await executeAndExpectPaid(d1.id, S3.d);
        await expectCustomError(
            () => s.queue.connect(signers[S3.c]).executeExit(c1.id),
            s.queue,
            "ActorBlocked",
            [S3.c, BLOCK.Frozen]
        );

        // Restore.
        await onQueue("unfreeze(address[])", [[S3.c]]);
        await forkOps.increaseTime(s.provider, s.DELAY_SECONDS + 1);
        await executeAndExpectPaid(c1.id, S3.c);
        await executeAndExpectPaid(c2.id, S3.c);
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);
    });

    it("S4: the kill switch makes the queue pass-through while existing holds stand", async () => {
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);

        const held = await queueLenderWithdrawal(S4.held);
        const escrowedUnderHold = await s.queue.totalEscrowed(wrbtcAddress);

        await onController("setSecurityPerimeterEnabled(bool)", [false]);
        expect(await s.stack.controller.securityPerimeterEnabled()).to.be.false;
        // The switch stops the delay from being quoted; it does not erase it.
        expect(await s.stack.controller.globalDelaySeconds()).to.equal(s.DELAY_SECONDS);

        // A withdrawal taken now is paid on the spot and records nothing.
        const passThrough = await signerFor(S4.passThrough);
        await (
            await s.iRBTC
                .connect(passThrough)
                .mintWithBTC(S4.passThrough, false, { value: LEND_AMOUNT })
        ).wait();
        const minted = await s.iRBTC.balanceOf(S4.passThrough);
        const requestIdBefore = await s.queue.lastRequestId();
        const receiverBefore = await nativeBalance(S4.receiver);
        const burnReceipt = await (
            await s.iRBTC.connect(passThrough).burnToBTC(S4.receiver, minted, false)
        ).wait();
        expect(await s.queue.lastRequestId(), "a disabled perimeter still queued").to.equal(
            requestIdBefore
        );
        const applied = getSingleExitFeeApplied(burnReceipt);
        expect(await nativeBalance(S4.receiver), "the pass-through payout is not net").to.equal(
            receiverBefore.add(applied.netAmount)
        );
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(escrowedUnderHold);

        // The request taken BEFORE the switch is still held to its own unlock:
        // the queue never consults the controller.
        await expectCustomError(
            () => s.queue.connect(signers[S4.held]).executeExit(held.id),
            s.queue,
            "NotUnlocked",
            [held.id, held.request.unlockAt]
        );
        await forkOps.increaseTime(s.provider, s.DELAY_SECONDS + 1);
        await executeAndExpectPaid(held.id, S4.held);

        // Re-arm, and holds resume.
        await onController("setSecurityPerimeterEnabled(bool)", [true]);
        expect(await s.stack.controller.securityPerimeterEnabled()).to.be.true;
        const resumed = await queueLenderWithdrawal(S4.passThrough);
        await forkOps.increaseTime(s.provider, s.DELAY_SECONDS + 1);
        await executeAndExpectPaid(resumed.id, S4.passThrough);
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);
    });

    it("S5: blacklisted escrow goes back to its pool by route, or to an address by the owner", async () => {
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);

        const first = await queueLenderWithdrawal(S5.blacklisted);
        const second = await queueLenderWithdrawal(S5.blacklisted);
        const untouched = await queueLenderWithdrawal(S5.clean);
        const escrowedBefore = await s.queue.totalEscrowed(wrbtcAddress);

        await onQueue("blacklistFromRequest(uint256[],bool,bytes32)", [
            [first.id],
            false,
            REASON_E2E,
        ]);
        expect(await s.queue.blockStateOf(S5.blacklisted)).to.equal(BLOCK.Blacklisted);

        // ── The pre-approved route back into the pool the exit came from ───
        await onQueue("setTopUpFeasible(bytes32,bool)", [
            PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
            true,
        ]);
        const routeResult = await onQueue(
            "setRecoveryRoute((bool,bytes32,address,address,address,bool))",
            [
                [
                    true,
                    PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
                    s.iRBTC.address,
                    wrbtcAddress,
                    s.iRBTC.address,
                    true,
                ],
            ]
        );
        const routeSet = routeResult.receipt.logs
            .map((log) => {
                try {
                    return s.queue.interface.parseLog(log);
                } catch (e) {
                    return null;
                }
            })
            .find((parsed) => parsed && parsed.name === "RecoveryRouteSet");
        expect(routeSet, "the route was not registered").to.not.be.undefined;
        const routeId = routeSet.args.routeId;
        expect(routeId, "the route id is not the provenance the contract derives").to.equal(
            ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "address", "address", "address"],
                    [
                        PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
                        s.iRBTC.address,
                        wrbtcAddress,
                        s.iRBTC.address,
                    ]
                )
            )
        );
        expect((await s.queue.getRecoveryRoute(routeId)).active).to.be.true;

        // ── Leg 2: back to the pool ────────────────────────────────────────
        const poolBefore = await s.wrbtc.balanceOf(s.iRBTC.address);
        await onQueue("resolveToProtocol(uint256[],bytes32)", [[first.id], routeId]);
        expect(await s.wrbtc.balanceOf(s.iRBTC.address), "the pool was not topped up").to.equal(
            poolBefore.add(first.request.amount)
        );
        expect((await s.queue.getRequest(first.id)).status).to.equal(STATUS.ResolvedToProtocol);

        // ── Leg 3: the owner's catch-all ───────────────────────────────────
        expect(await s.wrbtc.balanceOf(S5.arbitrary)).to.equal(0);
        await onQueue("resolveBySIP(uint256[],address)", [[second.id], S5.arbitrary]);
        expect(await s.wrbtc.balanceOf(S5.arbitrary), "the named address was not paid").to.equal(
            second.request.amount
        );
        expect((await s.queue.getRequest(second.id)).status).to.equal(STATUS.ResolvedBySIP);

        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(
            escrowedBefore.sub(first.request.amount).sub(second.request.amount)
        );

        // ── The route is not a way to take anyone's funds ──────────────────
        // The multisig swallows a failed inner call, so the refusal is read
        // both ways: the queue names the guard, and the wallet records that
        // the transaction did not execute.
        await expectCustomError(
            () =>
                s.queue
                    .connect(s.exchequer.signer)
                    .callStatic.resolveToProtocol([untouched.id], routeId),
            s.queue,
            "SourceNotBlacklisted",
            [S5.clean]
        );
        const refused = await s.viaMultisig(
            s.queue.address,
            s.queue.interface.encodeFunctionData("resolveToProtocol(uint256[],bytes32)", [
                [untouched.id],
                routeId,
            ])
        );
        expect(refused.executed, "the queue let a clean party's escrow be taken").to.be.false;
        expect((await s.queue.getRequest(untouched.id)).status).to.equal(STATUS.Queued);

        // Restore: retire the route and the block, and pay the clean party.
        await onQueue("removeRecoveryRoute(bytes32)", [routeId]);
        expect((await s.queue.getRecoveryRoute(routeId)).active).to.be.false;
        await onQueue("setTopUpFeasible(bytes32,bool)", [
            PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
            false,
        ]);
        await onQueue("unblacklist(address[])", [[S5.blacklisted]]);
        expect(await s.queue.blockStateOf(S5.blacklisted)).to.equal(BLOCK.None);
        await forkOps.increaseTime(s.provider, s.DELAY_SECONDS + 1);
        await executeAndExpectPaid(untouched.id, S5.clean);
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);
    });

    it("S6: the admin page's own call data goes through the multisig", async () => {
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);
        const multisig = await ethers.getContractAt("MultiSigWallet", s.exchequer.address);
        const held = await queueLenderWithdrawal(S6.party);

        // The page's encoders, re-derived here from the same signatures; the
        // bytes themselves are pinned by the unit test beside
        // Sovryn-Admin-Panel/src/app/containers/PerimeterPage/calls.ts.
        const page = new ethers.utils.Interface([
            "function freezeFromRequest(uint256[] requestIds, bool freezeReceiver, bytes32 reasonHash)",
            "function unfreeze(address[] a)",
            "function setSecurityPerimeterPaused(bool p)",
            "function setSecurityPerimeterEnabled(bool enabled)",
        ]);
        const controls = [
            {
                target: s.queue.address,
                signature: "freezeFromRequest(uint256[],bool,bytes32)",
                args: [[held.id], false, REASON_ADMIN_PAGE],
                observe: async () => {
                    expect(await s.queue.blockStateOf(S6.party)).to.equal(BLOCK.Frozen);
                    // The hold is recorded against the request the page was
                    // looking at, so the reason for it stays traceable.
                    expect(await s.queue.blockTrigger(S6.party)).to.equal(held.id);
                },
            },
            {
                target: s.queue.address,
                signature: "unfreeze(address[])",
                args: [[S6.party]],
                observe: async () =>
                    expect(await s.queue.blockStateOf(S6.party)).to.equal(BLOCK.None),
            },
            {
                target: s.queue.address,
                signature: "setSecurityPerimeterPaused(bool)",
                args: [true],
                observe: async () => expect(await s.queue.securityPerimeterPaused()).to.be.true,
            },
            {
                target: s.queue.address,
                signature: "setSecurityPerimeterPaused(bool)",
                args: [false],
                observe: async () => expect(await s.queue.securityPerimeterPaused()).to.be.false,
            },
            {
                target: s.stack.controller.address,
                signature: "setSecurityPerimeterEnabled(bool)",
                args: [false],
                observe: async () =>
                    expect(await s.stack.controller.securityPerimeterEnabled()).to.be.false,
            },
            {
                target: s.stack.controller.address,
                signature: "setSecurityPerimeterEnabled(bool)",
                args: [true],
                observe: async () =>
                    expect(await s.stack.controller.securityPerimeterEnabled()).to.be.true,
            },
        ];

        for (const control of controls) {
            const data = page.encodeFunctionData(control.signature, control.args);
            expect(data.slice(0, 10), `${control.signature} selector`).to.equal(
                ethers.utils.id(control.signature).slice(0, 10)
            );
            const result = await s.viaMultisig(control.target, data);
            expect(result.executed, `the multisig did not execute ${control.signature}`).to.be
                .true;
            expect(
                result.txId,
                `${control.signature} did not take the wallet's next transaction id`
            ).to.equal((await multisig.transactionCount()).toNumber() - 1);
            await control.observe();
        }

        await forkOps.increaseTime(s.provider, s.DELAY_SECONDS + 1);
        await executeAndExpectPaid(held.id, S6.party);
        expect(await s.queue.totalEscrowed(wrbtcAddress)).to.equal(0);
    });
});
