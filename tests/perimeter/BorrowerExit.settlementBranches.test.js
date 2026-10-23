/** Positive borrower refunds and favorable-fill surplus settle through the public close paths. */
const { expect } = require("chai");
const { BN } = require("@openzeppelin/test-helpers");
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanToken,
    getLoanTokenWRBTC,
    loan_pool_setup,
    set_demand_curve,
    lend_to_pool,
    getPriceFeeds,
    getSovryn,
    getSOV,
    borrow_indefinite_loan,
    open_margin_trade_position,
} = require("../Utils/initializer");
const mutexUtils = require("../../deployment/helpers/reentrancy/utils");
const Controller = artifacts.require("MockExitFeeController");
const Queue = artifacts.require("MockExitDelayQueue");
const Network = artifacts.require("TestSovrynSwapOverfill");
const State = artifacts.require("sovrynProtocol");
const E = new BN("1000000000000000000");
const DELAY = 3600;
const BPS = 25;
const serial = (x) => {
    if (x === null || typeof x !== "object") return String(x);
    if (BN.isBN(x)) return x.toString();
    return Object.fromEntries(
        Object.entries(x)
            .filter(([k]) => Number.isNaN(Number(k)))
            .map(([k, v]) => [k, serial(v)])
    );
};
const bn = (x) => new BN(x.toString());
const diff = (after, before) => bn(after).sub(bn(before));

contract("Perimeter — positive public close settlement", (accounts) => {
    const [admin, receiver, borrower, feeReceiver, manager] = accounts;
    let sovryn,
        state,
        SUSD,
        RBTC,
        WRBTC,
        BZRX,
        SOV,
        priceFeeds,
        pool,
        wrbtcPool,
        controller,
        queue,
        network;
    async function fixture() {
        await mutexUtils.getOrDeployMutex();
        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        state = await State.at(sovryn.address);
        SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
        pool = await getLoanToken(admin, sovryn, WRBTC, SUSD);
        wrbtcPool = await getLoanTokenWRBTC(admin, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, admin, RBTC, WRBTC, SUSD, pool, wrbtcPool);
        await set_demand_curve(pool);
        await lend_to_pool(pool, SUSD, admin);
        controller = await Controller.new();
        await controller.setActive(true);
        await controller.setRate(BPS);
        await controller.setExitFeeEnabledTest(true);
        await controller.setFeeReceiverTest(feeReceiver);
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY);
        await sovryn.setExitFeeController(controller.address, { from: admin });
        queue = await Queue.new(WRBTC.address, 60);
        await queue.setAllowedSource(sovryn.address, true);
        await sovryn.setExitDelayQueue(queue.address, { from: admin });
        network = await Network.new(priceFeeds.address);
    }
    beforeEach(async () => {
        await loadFixture(fixture);
    });
    async function snapshot(id) {
        const result = {
            loan: serial(await state.loans(id)),
            interest: serial(await state.loanInterest(id)),
            lenderInterest: serial(await state.lenderInterest(pool.address, SUSD.address)),
            lendingFeeHeld: (await state.lendingFeeTokensHeld(SUSD.address)).toString(),
            tradingFeeHeldSUSD: (await state.tradingFeeTokensHeld(SUSD.address)).toString(),
            tradingFeeHeldRBTC: (await state.tradingFeeTokensHeld(RBTC.address)).toString(),
            sharesSupply: (await pool.totalSupply()).toString(),
            requests: (await queue.lastRequestId()).toString(),
            SUSD: {},
            RBTC: {},
            SOV: {},
            escrowSUSD: (await queue.totalEscrowed(SUSD.address)).toString(),
            escrowRBTC: (await queue.totalEscrowed(RBTC.address)).toString(),
        };
        for (const [name, asset] of [
            ["SUSD", SUSD],
            ["RBTC", RBTC],
            ["SOV", SOV],
        ]) {
            for (const [label, who] of [
                ["protocol", sovryn.address],
                ["queue", queue.address],
                ["fee", feeReceiver],
                ["borrower", borrower],
                ["receiver", receiver],
                ["pool", pool.address],
            ])
                result[name][label] = (await asset.balanceOf(who)).toString();
            result[name].supply = (await asset.totalSupply()).toString();
            result[name].swapAllowance = (
                await asset.allowance(sovryn.address, network.address)
            ).toString();
        }
        return result;
    }
    async function minedRevert(call, reason) {
        const priorBlock = await web3.eth.getBlockNumber();
        try {
            await call();
            throw new Error("expected revert");
        } catch (e) {
            expect(e.message).to.include(reason);
        }
        const last = await web3.eth.getBlock("latest");
        expect(
            Number(last.number),
            "rejected record was a mined transaction, not estimation failure"
        ).to.equal(priorBlock + 1);
        expect(last.transactions, "one failed transaction mined").to.have.length(1);
        const receipt = await web3.eth.getTransactionReceipt(last.transactions[0]);
        expect(receipt.status, "failed receipt").to.equal(false);
        return {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            status: receipt.status,
        };
    }
    function eq(actual, expected, label) {
        expect(actual.toString(), label).to.equal(expected.toString());
    }
    async function assertLenderSettlement(before, after, tx, refund, principal) {
        const block = await web3.eth.getBlock(tx.receipt.blockNumber);
        let accrued = bn(block.timestamp)
            .sub(bn(before.lenderInterest.updatedTimestamp))
            .mul(bn(before.lenderInterest.owedPerDay))
            .divn(86400);
        if (accrued.gt(bn(before.lenderInterest.owedTotal)))
            accrued = bn(before.lenderInterest.owedTotal);
        const lendingFee = accrued.mul(bn(await state.lendingFeePercent())).div(E.muln(100));
        eq(
            diff(after.SUSD.pool, before.SUSD.pool),
            principal.add(accrued).sub(lendingFee),
            "lender receives exact principal plus accrued interest less lending fee"
        );
        eq(
            diff(after.lendingFeeHeld, before.lendingFeeHeld),
            lendingFee,
            "independently computed accrued lending fee"
        );
        eq(
            diff(after.lenderInterest.paidTotal, before.lenderInterest.paidTotal),
            accrued,
            "exact paidTotal increment"
        );
        const remaining = bn(before.lenderInterest.owedTotal).sub(accrued);
        eq(
            after.lenderInterest.owedTotal,
            remaining.gt(refund) ? remaining.sub(refund) : new BN(0),
            "exact remaining lender prepaid interest"
        );
        eq(
            after.lenderInterest.principalTotal,
            bn(before.lenderInterest.principalTotal).sub(principal),
            "principalTotal reduced exactly"
        );
        const dailyRefund = principal.eq(bn(before.loan.principal))
            ? bn(before.interest.owedPerDay)
            : bn(before.interest.owedPerDay).mul(principal).div(bn(before.loan.principal));
        eq(
            after.lenderInterest.owedPerDay,
            bn(before.lenderInterest.owedPerDay).sub(dailyRefund),
            "closed portion daily accrual removed exactly"
        );
        return { accrued: accrued.toString(), lendingFee: lendingFee.toString() };
    }
    async function assertRequests(grossByAsset, expectedReceivers, originator = borrower) {
        const closeBlock = await web3.eth.getBlock("latest");
        const n = Number((await queue.lastRequestId()).toString());
        expect(n, "both positive payouts recorded").to.equal(2);
        const seen = {};
        for (let i = 1; i <= n; i++) {
            const q = await queue.getRequest(i);
            const key = q.token.toLowerCase();
            seen[key] = { id: i, q };
            eq(
                q.amount,
                bn(grossByAsset[key]).sub(bn(grossByAsset[key]).muln(BPS).divn(10000)),
                "request equals independently known gross minus fee"
            );
            expect(q.originator.toLowerCase()).to.equal(originator.toLowerCase());
            expect(q.surfaceId).to.equal(
                web3.utils.keccak256("PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW")
            );
            expect(q.owner.toLowerCase()).to.equal(borrower.toLowerCase());
            expect(q.receiver.toLowerCase()).to.equal(expectedReceivers[key].toLowerCase());
            expect(q.subProduct.toLowerCase()).to.equal(pool.address.toLowerCase());
            expect(q.unwrapOnDelivery).to.equal(false);
            eq(
                q.unlockAt,
                new BN(closeBlock.timestamp).addn(DELAY),
                "exact quoted unlock timestamp"
            );
        }
        expect(Object.keys(seen).sort()).to.deep.equal(Object.keys(grossByAsset).sort());
        return seen;
    }
    async function openOverage() {
        const [id] = await borrow_indefinite_loan(pool, sovryn, SUSD, RBTC, accounts);
        const loan = await sovryn.getLoan(id);
        const principal = bn(loan.principal);
        const extra = principal.muln(3);
        await SUSD.mint(borrower, extra);
        await SUSD.approve(sovryn.address, extra, { from: borrower });
        // Real authorized extension, using the borrower's own deposit. This
        // establishes prepaid interest greater than principal without seeding storage.
        await sovryn.extendLoanDuration(id, extra, false, "0x", { from: borrower });
        return { id, principal };
    }
    async function overageQuote(id, principal) {
        const loan = await state.loans(id);
        const interest = await state.loanInterest(id);
        const block = await web3.eth.getBlock("latest");
        const timestamp = Number(block.timestamp) + 10;
        const dailyRefund = principal.eq(bn(loan.principal))
            ? bn(interest.owedPerDay)
            : bn(interest.owedPerDay).mul(principal).div(bn(loan.principal));
        const refund = bn(loan.endTimestamp).sub(new BN(timestamp)).mul(dailyRefund).divn(86400);
        const overage = refund.sub(principal);
        expect(overage.gt(principal), "strictly positive overage larger than principal").to.equal(
            true
        );
        await hre.network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
        return {
            timestamp,
            refund,
            overage,
            collateral: bn(loan.collateral).mul(principal).div(bn(loan.principal)),
        };
    }
    it("prepaid-interest overage: fee + queue net conserve both positive payouts and lender principal", async () => {
        const { id, principal } = await openOverage();
        const before = await snapshot(id);
        const quote = await overageQuote(id, principal);
        const tx = await sovryn.closeWithDeposit(id, receiver, principal, {
            from: borrower,
            gas: 6000000,
        });
        const after = await snapshot(id);
        eq(
            diff(after.SUSD.receiver, before.SUSD.receiver),
            0,
            "interest overage never paid directly"
        );
        eq(diff(after.RBTC.receiver, before.RBTC.receiver), 0, "collateral never paid directly");
        const fee = quote.overage.muln(BPS).divn(10000),
            net = quote.overage.sub(fee);
        eq(diff(after.SUSD.fee, before.SUSD.fee), fee, "overage fee");
        eq(diff(after.SUSD.queue, before.SUSD.queue), net, "overage net backing");
        eq(diff(after.escrowSUSD, before.escrowSUSD), net, "overage escrow accounting");
        eq(
            diff(before.SUSD.protocol, after.SUSD.protocol),
            diff(after.SUSD.pool, before.SUSD.pool).add(fee).add(net),
            "independent protocol decrement equals lender plus fee plus queue"
        );
        await assertLenderSettlement(before, after, tx, quote.refund, principal);
        eq(
            diff(after.SUSD.borrower, before.SUSD.borrower),
            0,
            "interest fully covers principal without extra borrower deposit"
        );
        const collateralFee = quote.collateral.muln(BPS).divn(10000);
        eq(diff(after.RBTC.fee, before.RBTC.fee), collateralFee, "collateral fee");
        eq(
            diff(after.RBTC.queue, before.RBTC.queue),
            quote.collateral.sub(collateralFee),
            "collateral net"
        );
        eq(
            diff(after.escrowRBTC, before.escrowRBTC),
            quote.collateral.sub(collateralFee),
            "collateral escrow accounting"
        );
        eq(
            diff(before.RBTC.protocol, after.RBTC.protocol),
            quote.collateral,
            "all collateral accounted"
        );
        eq(after.loan.principal, 0, "closed principal");
        eq(after.loan.collateral, 0, "closed collateral");
        expect(after.loan.active).to.equal("false");
        eq(after.interest.owedPerDay, 0, "closed interest rate");
        eq(after.interest.depositTotal, 0, "closed prepaid deposit");
        const seen = await assertRequests(
            {
                [SUSD.address.toLowerCase()]: quote.overage,
                [RBTC.address.toLowerCase()]: quote.collateral,
            },
            { [SUSD.address.toLowerCase()]: receiver, [RBTC.address.toLowerCase()]: receiver }
        );
        await hre.network.provider.send("evm_increaseTime", [DELAY + 1]);
        await hre.network.provider.send("evm_mine");
        for (const { id: requestId } of Object.values(seen))
            await queue.executeExit(requestId, { from: borrower });
        eq(
            diff(await SUSD.balanceOf(receiver), after.SUSD.receiver),
            net,
            "overage delivered after delay"
        );
        eq(
            diff(await RBTC.balanceOf(receiver), after.RBTC.receiver),
            quote.collateral.sub(collateralFee),
            "collateral delivered after delay"
        );
        eq(await queue.totalEscrowed(SUSD.address), 0, "no remaining interest escrow");
        eq(await queue.totalEscrowed(RBTC.address), 0, "no collateral escrow");
    });
    it("prepaid-interest overage: record rejection rolls back the real close and all balances", async () => {
        const { id, principal } = await openOverage();
        await queue.setAllowedSource(sovryn.address, false);
        const before = await snapshot(id);
        const quote = await overageQuote(id, principal);
        await minedRevert(
            () =>
                sovryn.closeWithDeposit(id, receiver, principal, { from: borrower, gas: 6000000 }),
            "MockQueue: unregistered source"
        );
        expect(
            await snapshot(id),
            "loan, lender/borrower interest, token mint/burn, fees, queue and recipients rolled back"
        ).to.deep.equal(before);
    });
    async function openOverfill() {
        const [id] = await open_margin_trade_position(pool, RBTC, WRBTC, SUSD, borrower);
        await sovryn.setSovrynSwapContractRegistryAddress(network.address, { from: admin });
        await network.setOverfillBps(100); // at most 1%, inside unchanged oracle disagreement guard
        return { id, loan: await sovryn.getLoan(id) };
    }
    it("favorable exact-output overfill: positive loan-token surplus obeys fee + delay with full lender repayment", async () => {
        const { id, loan } = await openOverfill();
        const before = await snapshot(id);
        const tx = await sovryn.closeWithSwap(id, receiver, loan.collateral, true, "0x", {
            from: borrower,
            gas: 6000000,
        });
        const after = await snapshot(id);
        const excessLog = tx.logs.find((l) => l.event === "swapExcess");
        expect(excessLog, "surplus branch emits its threshold decision").not.to.equal(undefined);
        const overfill = bn(excessLog.args.amount || excessLog.args[1]);
        expect(overfill.gtn(0), "strictly positive overfill").to.equal(true);
        expect(
            excessLog.args.shouldRefund || excessLog.args[0],
            "surplus above threshold"
        ).to.equal(true);
        const swap = tx.logs.find((l) => l.event === "LoanSwap");
        expect(swap).not.to.equal(undefined);
        const used = bn(swap.args.sourceAmount || swap.args[4]);
        const received = bn(swap.args.destAmount || swap.args[5]);
        const closeBlock = await web3.eth.getBlock(tx.receipt.blockNumber);
        const prepaidRefund = bn(before.loan.endTimestamp)
            .sub(bn(closeBlock.timestamp))
            .mul(bn(before.interest.owedPerDay))
            .divn(86400);
        const principalNeeded = bn(loan.principal).sub(prepaidRefund);
        eq(
            overfill,
            received.sub(principalNeeded),
            "overfill independently reconstructed from actual swap destination minus required principal"
        );
        const collateralGross = bn(loan.collateral).sub(used);
        expect(collateralGross.gtn(0), "positive unused collateral").to.equal(true);
        const fee = overfill.muln(BPS).divn(10000),
            net = overfill.sub(fee);
        eq(diff(after.SUSD.borrower, before.SUSD.borrower), 0, "overfill never paid directly");
        eq(diff(after.SUSD.fee, before.SUSD.fee), fee, "overfill fee");
        eq(diff(after.SUSD.queue, before.SUSD.queue), net, "overfill net backing");
        eq(diff(after.escrowSUSD, before.escrowSUSD), net, "overfill escrow accounting");
        eq(
            diff(after.RBTC.fee, before.RBTC.fee),
            collateralGross.muln(BPS).divn(10000),
            "unused collateral fee"
        );
        eq(
            diff(after.RBTC.queue, before.RBTC.queue),
            collateralGross.sub(collateralGross.muln(BPS).divn(10000)),
            "unused collateral backing"
        );
        eq(
            diff(after.RBTC.receiver, before.RBTC.receiver),
            0,
            "unused collateral never paid directly"
        );
        eq(
            diff(after.escrowRBTC, before.escrowRBTC),
            collateralGross.sub(collateralGross.muln(BPS).divn(10000)),
            "unused collateral escrow accounting"
        );
        eq(
            diff(before.RBTC.protocol, after.RBTC.protocol),
            used.add(collateralGross),
            "swapped collateral plus borrower payout accounts for full collateral"
        );
        // Independent swap mint minus transfers, rather than fee-event arithmetic.
        const minted = diff(after.SUSD.supply, before.SUSD.supply);
        eq(
            diff(after.SUSD.pool, before.SUSD.pool)
                .add(fee)
                .add(net)
                .add(diff(after.SUSD.protocol, before.SUSD.protocol)),
            minted,
            "loan-token mint equals lender plus fee plus queue plus protocol residual"
        );
        await assertLenderSettlement(before, after, tx, prepaidRefund, bn(loan.principal));
        eq(after.loan.principal, 0, "closed principal");
        eq(after.loan.collateral, 0, "closed collateral");
        expect(after.loan.active).to.equal("false");
        const seen = await assertRequests(
            {
                [SUSD.address.toLowerCase()]: overfill,
                [RBTC.address.toLowerCase()]: collateralGross,
            },
            { [SUSD.address.toLowerCase()]: borrower, [RBTC.address.toLowerCase()]: receiver }
        );
        await hre.network.provider.send("evm_increaseTime", [DELAY + 1]);
        await hre.network.provider.send("evm_mine");
        for (const { id: requestId } of Object.values(seen))
            await queue.executeExit(requestId, { from: borrower });
        eq(
            diff(await SUSD.balanceOf(borrower), after.SUSD.borrower),
            net,
            "overfill delivered after delay"
        );
        eq(await queue.totalEscrowed(SUSD.address), 0, "no surplus escrow");
        eq(await queue.totalEscrowed(RBTC.address), 0, "no collateral escrow");
    });
    it("favorable exact-output overfill: record rejection rolls back swap mint/burn, loan and both payouts", async () => {
        const { id, loan } = await openOverfill();
        await queue.setAllowedSource(sovryn.address, false);
        const before = await snapshot(id);
        await minedRevert(
            () =>
                sovryn.closeWithSwap(id, receiver, loan.collateral, true, "0x", {
                    from: borrower,
                    gas: 6000000,
                }),
            "MockQueue: unregistered source"
        );
        expect(
            await snapshot(id),
            "all storage, swap token supplies, fees, backing, allowances and balances rolled back"
        ).to.deep.equal(before);
    });

    it("delegated partial deposit close conserves a positive interest overage and leaves the loan active", async () => {
        const { id, principal } = await openOverage();
        await sovryn.setDelegatedManager(id, manager, true, { from: borrower });
        const closePrincipal = principal.divn(2);
        const before = await snapshot(id);
        const quote = await overageQuote(id, closePrincipal);
        const tx = await sovryn.closeWithDeposit(id, receiver, closePrincipal, {
            from: manager,
            gas: 6000000,
        });
        const after = await snapshot(id);
        const fee = quote.overage.muln(BPS).divn(10000);
        const net = quote.overage.sub(fee);
        eq(diff(after.SUSD.receiver, before.SUSD.receiver), 0, "partial overage held");
        eq(diff(after.SUSD.fee, before.SUSD.fee), fee, "partial overage fee");
        eq(diff(after.SUSD.queue, before.SUSD.queue), net, "partial overage backing");
        eq(diff(after.escrowSUSD, before.escrowSUSD), net, "partial overage reserved");
        eq(
            diff(before.SUSD.protocol, after.SUSD.protocol),
            diff(after.SUSD.pool, before.SUSD.pool).add(fee).add(net),
            "partial lender and borrower loan-token conservation"
        );
        await assertLenderSettlement(before, after, tx, quote.refund, closePrincipal);
        eq(after.loan.principal, principal.sub(closePrincipal), "principal remains open");
        eq(
            after.loan.collateral,
            bn(before.loan.collateral).sub(quote.collateral),
            "only proportionate collateral removed"
        );
        expect(after.loan.active).to.equal("true");
        eq(
            after.interest.depositTotal,
            bn(before.interest.depositTotal).sub(quote.refund),
            "remaining prepaid interest conserved"
        );
        const collateralFee = quote.collateral.muln(BPS).divn(10000);
        const collateralNet = quote.collateral.sub(collateralFee);
        eq(diff(after.RBTC.receiver, before.RBTC.receiver), 0, "partial collateral held");
        eq(diff(after.RBTC.fee, before.RBTC.fee), collateralFee, "partial collateral fee");
        eq(diff(after.RBTC.queue, before.RBTC.queue), collateralNet, "partial collateral backing");
        eq(
            diff(after.escrowRBTC, before.escrowRBTC),
            collateralNet,
            "partial collateral reserved"
        );
        eq(
            diff(before.RBTC.protocol, after.RBTC.protocol),
            quote.collateral,
            "proportionate collateral conservation"
        );
        await assertRequests(
            {
                [SUSD.address.toLowerCase()]: quote.overage,
                [RBTC.address.toLowerCase()]: quote.collateral,
            },
            { [SUSD.address.toLowerCase()]: receiver, [RBTC.address.toLowerCase()]: receiver },
            manager
        );
    });

    it("delegated partial exact-output swap holds positive surplus and proportionate collateral", async () => {
        const { id, loan } = await openOverfill();
        await sovryn.setDelegatedManager(id, manager, true, { from: borrower });
        const swapAmount = bn(loan.collateral).divn(2);
        const closePrincipal = bn(loan.principal).mul(swapAmount).div(bn(loan.collateral));
        const before = await snapshot(id);
        const tx = await sovryn.closeWithSwap(id, receiver, swapAmount, true, "0x", {
            from: manager,
            gas: 6000000,
        });
        const after = await snapshot(id);
        const swap = tx.logs.find((l) => l.event === "LoanSwap");
        const used = bn(swap.args.sourceAmount);
        const received = bn(swap.args.destAmount);
        const block = await web3.eth.getBlock(tx.receipt.blockNumber);
        const dailyRefund = bn(before.interest.owedPerDay)
            .mul(closePrincipal)
            .div(bn(before.loan.principal));
        const refund = bn(before.loan.endTimestamp)
            .sub(bn(block.timestamp))
            .mul(dailyRefund)
            .divn(86400);
        const surplus = received.sub(closePrincipal.sub(refund));
        const worth = tx.logs.find((l) => l.event === "swapExcess");
        expect(surplus.gtn(0)).to.equal(true);
        expect(worth.args.shouldRefund).to.equal(true);
        eq(worth.args.amount, surplus, "actual partial surplus matches swap receipts");
        const fee = surplus.muln(BPS).divn(10000);
        const net = surplus.sub(fee);
        const collateralGross = swapAmount.sub(used);
        expect(collateralGross.gtn(0)).to.equal(true);
        eq(
            diff(after.SUSD.borrower, before.SUSD.borrower),
            0,
            "partial surplus held for borrower"
        );
        eq(diff(after.SUSD.fee, before.SUSD.fee), fee, "partial surplus fee");
        eq(diff(after.SUSD.queue, before.SUSD.queue), net, "partial surplus backing");
        eq(diff(after.escrowSUSD, before.escrowSUSD), net, "partial surplus reserved");
        const minted = diff(after.SUSD.supply, before.SUSD.supply);
        eq(
            diff(after.SUSD.pool, before.SUSD.pool)
                .add(fee)
                .add(net)
                .add(diff(after.SUSD.protocol, before.SUSD.protocol)),
            minted,
            "partial swap loan-token conservation"
        );
        await assertLenderSettlement(before, after, tx, refund, closePrincipal);
        const collateralFee = collateralGross.muln(BPS).divn(10000);
        const collateralNet = collateralGross.sub(collateralFee);
        eq(diff(after.RBTC.receiver, before.RBTC.receiver), 0, "partial unused collateral held");
        eq(diff(after.RBTC.fee, before.RBTC.fee), collateralFee, "partial unused collateral fee");
        eq(
            diff(after.RBTC.queue, before.RBTC.queue),
            collateralNet,
            "partial unused collateral backing"
        );
        eq(
            diff(after.escrowRBTC, before.escrowRBTC),
            collateralNet,
            "partial unused collateral reserved"
        );
        eq(
            diff(before.RBTC.protocol, after.RBTC.protocol),
            used.add(collateralGross),
            "partial swap collateral conservation"
        );
        eq(
            after.loan.principal,
            bn(before.loan.principal).sub(closePrincipal),
            "partial principal stays active"
        );
        eq(
            after.loan.collateral,
            bn(before.loan.collateral).sub(swapAmount),
            "partial collateral stays active"
        );
        expect(after.loan.active).to.equal("true");
        eq(
            after.interest.depositTotal,
            bn(before.interest.depositTotal).sub(refund),
            "partial prepaid deposit remains"
        );
        await assertRequests(
            {
                [SUSD.address.toLowerCase()]: surplus,
                [RBTC.address.toLowerCase()]: collateralGross,
            },
            { [SUSD.address.toLowerCase()]: borrower, [RBTC.address.toLowerCase()]: receiver },
            manager
        );
    });
});
