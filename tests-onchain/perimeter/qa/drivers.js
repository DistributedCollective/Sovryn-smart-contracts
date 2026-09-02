/**
 * The four withdrawal surfaces the delay covers, each reduced to one call that
 * leaves a queued exit behind.
 *
 * A driver takes the attached stack `s` (anything carrying `queue`, `protocol`,
 * `iRBTC`, `iXUSD`, `wrbtc` and `borrowerOperations` as ethers contracts — both
 * the rehearsal fixture and the QA state file's `attachQa` do) plus the signer
 * that performs the withdrawal, and returns the request it queued.
 *
 * Every driver returns `{ id, request, receipt, before }`:
 *   `id`/`request` — the queued exit as the queue stores it. `request.amount` is
 *       the ESCROWED amount, already net of whatever charge the controller
 *       quoted; never assert against the amount that went in.
 *   `receipt`      — the receipt of the call that queued it, so a caller can
 *       subtract the gas its own actor paid.
 *   `before`       — native balances of the originator and the receiver read
 *       immediately before that call, so a caller can prove nothing was paid.
 *
 * The drivers assert only what makes the returned value meaningful (a position
 * was actually opened, exactly one request was queued, and it carries the
 * expected surface). They throw plain errors rather than using an assertion
 * library, because a hardhat task runs them too.
 */
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
    forkOps,
} = require("../perimeterSipTestHelpers");

const ZERO_ADDRESS = ethers.constants.AddressZero;
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
];

/** ExitStatus / BlockState as the queue stores them. */
const STATUS = { None: 0, Queued: 1, Executed: 2, ResolvedToProtocol: 3, ResolvedBySIP: 4 };
const BLOCK = { None: 0, Frozen: 1, Blacklisted: 2 };
/** Zero's Status.active and Status.closedByRedemption. */
const TROVE_ACTIVE = 1;
const TROVE_CLOSED_BY_REDEMPTION = 4;

const LEND_AMOUNT = ethers.utils.parseEther("1");
const LOAN_DURATION = 28 * 24 * 60 * 60;
const BORROW_AMOUNT = ethers.utils.parseEther("300");
/** The slice of collateral the borrower and Zero drivers withdraw. Small on
 *  purpose: the point is to queue an exit, not to unwind the position. */
const BORROWER_WITHDRAW_AMOUNT = ethers.utils.parseEther("0.00001");
const ZERO_WITHDRAW_AMOUNT = ethers.utils.parseEther("0.0001");
/** Zero's origination/redemption rates float; every probe below is
 *  balance-based, so the rate actually charged never enters an assertion. */
const MAX_ZERO_FEE_PERCENTAGE = ethers.utils.parseEther("0.99");

const nativeBalance = (address) => ethers.provider.getBalance(address);

const rpcProvider = (s) =>
    s.provider || new ethers.providers.JsonRpcProvider(hre.network.config.url);

/** Unlock an account without taking anything off it. `forkOps.impersonate`
 *  OVERWRITES the balance with its own float, which on a QA fork would silently
 *  undo the funding the bootstrap put on the account; this restores whichever
 *  of the two is larger. */
const solventSigner = async (s, address) => {
    const provider = rpcProvider(s);
    const held = await ethers.provider.getBalance(address);
    const signer = await forkOps.impersonate(provider, address);
    const floor = await ethers.provider.getBalance(address);
    // hexValue, not toHexString: a JSON-RPC QUANTITY is refused when it carries
    // the leading zero a 32-byte hex string keeps.
    if (held.gt(floor)) {
        await forkOps.setBalance(provider, address, ethers.utils.hexValue(held));
    }
    return signer;
};

const addressOf = async (signer) =>
    ethers.utils.getAddress(signer.address || (await signer.getAddress()));

/** The single request a surface call must have queued, with the queue's own
 *  view of it. Throws when the call queued none or more than one.
 *
 *  `opts.expectQueued === false` says the caller knows the perimeter is switched
 *  off, so the product paid on the spot; the absence of a request is then the
 *  result rather than a fault, and `{ id: null }` comes back. */
const queuedBy = async (s, label, surfaceId, lastIdBefore, opts = {}) => {
    const id = await s.queue.lastRequestId();
    const queued = id.sub(lastIdBefore);
    if (opts.expectQueued === false) {
        if (!queued.isZero()) {
            throw new Error(
                `${label}: the perimeter is switched off, yet the queue recorded ${queued} exit(s)`
            );
        }
        return { id: null, request: null };
    }
    if (!queued.eq(1)) {
        throw new Error(
            `${label}: expected exactly one queued exit, the queue recorded ${queued}`
        );
    }
    const request = await s.queue.getRequest(id);
    if (request.surfaceId !== surfaceId) {
        throw new Error(
            `${label}: the queued exit carries surface ${request.surfaceId}, not ${surfaceId}`
        );
    }
    if (request.status !== STATUS.Queued) {
        throw new Error(`${label}: the queued exit is already in status ${request.status}`);
    }
    return { id, request };
};

/**
 * Lending, lender exit. Mint an iRBTC position with native RBTC and burn it
 * straight back: with the delay armed the burn escrows WRBTC in the queue and
 * unwraps to native at delivery.
 */
const queueLenderWithdrawal = async (s, signer, opts = {}) => {
    const originator = await addressOf(signer);
    const receiver = opts.receiver || originator;
    const amount = opts.amount || LEND_AMOUNT;

    const held = await s.iRBTC.balanceOf(originator);
    await (await s.iRBTC.connect(signer).mintWithBTC(originator, false, { value: amount })).wait();
    const minted = (await s.iRBTC.balanceOf(originator)).sub(held);
    if (!minted.gt(0)) throw new Error("lender withdrawal: no iRBTC position was minted");

    const before = {
        originator: await nativeBalance(originator),
        receiver: await nativeBalance(receiver),
    };
    const lastIdBefore = await s.queue.lastRequestId();
    const receipt = await (
        await s.iRBTC.connect(signer).burnToBTC(receiver, minted, false)
    ).wait();

    const { id, request } = await queuedBy(
        s,
        "lender withdrawal",
        PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW,
        lastIdBefore,
        opts
    );
    if (!request) return { id, request, receipt, before };
    if (ethers.utils.getAddress(request.originator) !== originator) {
        throw new Error(
            `lender withdrawal: the queue recorded originator ${request.originator}, not ${originator}`
        );
    }
    if (ethers.utils.getAddress(request.receiver) !== ethers.utils.getAddress(receiver)) {
        throw new Error(
            `lender withdrawal: the queue recorded receiver ${request.receiver}, not ${receiver}`
        );
    }
    return { id, request, receipt, before };
};

const PRICE_FEEDS_ABI = [
    "function priceFeeds() view returns (address)",
    "function queryRate(address,address) view returns (uint256 rate, uint256 precision)",
    "function pricesFeeds(address) view returns (address)",
];
const MOC_FEED_ABI = [
    "function latestAnswer() view returns (uint256)",
    "function mocOracleAddress() view returns (address)",
    "function owner() view returns (address)",
    "function setMoCOracleAddress(address)",
];
const MEDIANIZER_ABI = ["function peek() view returns (bytes32,bool)"];

/**
 * Make the protocol quote a collateral price again.
 *
 * The RBTC/USD source the protocol reads is a MoC medianizer, and a medianizer
 * price expires within about a minute of the block it was published in. A fork
 * is therefore priceless for lending almost as soon as it is booted, and the
 * borrower surface cannot be reached at all. This pins the RBTC price at the
 * last value the fork saw, by rotating the live RBTC feed's oracle onto a
 * fixed-price medianizer through the feed's own owner — the authority that
 * rotates an oracle in production.
 *
 * Only the RBTC/USD source is touched. Every other feed the protocol holds,
 * and the whole feed registry, is left exactly as the fork found it, so pairs
 * that do not involve RBTC keep quoting live numbers.
 *
 * A no-op wherever the live oracle still answers.
 */
const ensureCollateralPrice = async (s, opts = {}) => {
    const log = opts.log || (() => {});
    const wrbtcAddress = s.wrbtc.address;
    const xusdAddress = (await get("XUSD")).address;
    const protocol = new ethers.Contract(s.protocol.address, PRICE_FEEDS_ABI, ethers.provider);
    const feeds = new ethers.Contract(
        await protocol.priceFeeds(),
        PRICE_FEEDS_ABI,
        ethers.provider
    );
    try {
        const live = await feeds.queryRate(xusdAddress, wrbtcAddress);
        if (live.rate.gt(0)) return { rotated: false, price: null };
    } catch (error) {
        // The feed refuses to quote — fall through and pin it.
    }

    const feed = new ethers.Contract(
        await feeds.pricesFeeds(wrbtcAddress),
        MOC_FEED_ABI,
        ethers.provider
    );
    const medianizer = new ethers.Contract(
        await feed.mocOracleAddress(),
        MEDIANIZER_ABI,
        ethers.provider
    );
    // The expired publication still carries the number it published; that is
    // the most faithful price this fork has ever seen.
    let price = ethers.BigNumber.from((await medianizer.peek())[0]);
    if (!price.gt(0)) {
        price = await (await ethers.getContract("PriceFeed")).callStatic.fetchPrice();
    }
    if (!price.gt(0)) {
        throw new Error("collateral price: the fork carries no RBTC price to pin");
    }

    const deployer = (await ethers.getSigners())[0];
    const pinned = await (
        await ethers.getContractFactory("MockMoCMedianizer", deployer)
    ).deploy(price);
    await pinned.deployed();
    const feedOwner = await solventSigner(s, await feed.owner());
    await (await feed.connect(feedOwner).setMoCOracleAddress(pinned.address)).wait();

    const after = await feeds.queryRate(xusdAddress, wrbtcAddress);
    if (!after.rate.gt(0)) {
        throw new Error("collateral price: the protocol still quotes nothing after the rotation");
    }
    log(`  collateral price pinned at ${ethers.utils.formatEther(price)} USD/RBTC`);
    return { rotated: true, price, medianizer: pinned.address };
};

/**
 * Lending, borrower exit. Open an XUSD loan against WRBTC collateral, then take
 * a slice of that collateral back out — the call the borrower surface covers.
 */
const queueBorrowerClose = async (s, signer, opts = {}) => {
    const originator = await addressOf(signer);
    const receiver = opts.receiver || originator;
    const borrowAmount = opts.borrowAmount || BORROW_AMOUNT;
    const wrbtcAddress = s.wrbtc.address;
    await ensureCollateralPrice(s, opts);

    // 20% over the quote: the collateral requirement is priced at call time and
    // the loan must open above the maintenance margin, not exactly on it.
    const collateralNeeded = (
        await s.iXUSD.getDepositAmountForBorrow(borrowAmount, LOAN_DURATION, wrbtcAddress)
    )
        .mul(120)
        .div(100);
    const borrowReceipt = await (
        await s.iXUSD
            .connect(signer)
            .borrow(
                ethers.constants.HashZero,
                borrowAmount,
                LOAN_DURATION,
                collateralNeeded,
                wrbtcAddress,
                originator,
                originator,
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
    if (!borrowEvent) throw new Error("borrower withdrawal: the borrow did not open a loan");

    const before = {
        originator: await nativeBalance(originator),
        receiver: await nativeBalance(receiver),
    };
    const lastIdBefore = await s.queue.lastRequestId();
    const receipt = await (
        await s.protocol
            .connect(signer)
            .withdrawCollateral(
                borrowEvent.args.loanId,
                receiver,
                opts.amount || BORROWER_WITHDRAW_AMOUNT
            )
    ).wait();

    const { id, request } = await queuedBy(
        s,
        "borrower withdrawal",
        PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW,
        lastIdBefore,
        opts
    );
    if (!request) return { id, request, receipt, before, loanId: borrowEvent.args.loanId };
    if (ethers.utils.getAddress(request.receiver) !== ethers.utils.getAddress(receiver)) {
        throw new Error(
            `borrower withdrawal: the queue recorded receiver ${request.receiver}, not ${receiver}`
        );
    }
    return { id, request, receipt, before, loanId: borrowEvent.args.loanId };
};

/**
 * Zero, collateral withdrawal. Open a trove with native RBTC, then take a slice
 * of the collateral back out.
 */
const queueZeroCollWithdraw = async (s, signer, opts = {}) => {
    const originator = await addressOf(signer);
    const receiver = opts.receiver || originator;
    const troveManager = await ethers.getContract("TroveManager");
    // An account may hold only one trove, so a second withdrawal from the same
    // account takes collateral out of the trove it already has.
    if (!(await troveManager.getTroveStatus(originator)).eq(TROVE_ACTIVE)) {
        const borrowAmount = (await s.borrowerOperations.MIN_NET_DEBT()).mul(2);
        await (
            await s.borrowerOperations
                .connect(signer)
                .openTrove(MAX_ZERO_FEE_PERCENTAGE, borrowAmount, originator, originator, {
                    value: opts.collateral || ONE_RBTC.mul(2),
                })
        ).wait();
    }

    const before = {
        originator: await nativeBalance(originator),
        receiver: await nativeBalance(receiver),
    };
    const lastIdBefore = await s.queue.lastRequestId();
    // Zero pays a collateral withdrawal to the trove owner; the hint arguments
    // are the re-insertion position, not a payout address.
    const receipt = await (
        await s.borrowerOperations
            .connect(signer)
            .withdrawColl(opts.amount || ZERO_WITHDRAW_AMOUNT, originator, originator)
    ).wait();

    const { id, request } = await queuedBy(
        s,
        "Zero collateral withdrawal",
        PERIMETER_SURFACE_ZERO_WITHDRAW_COLL,
        lastIdBefore,
        opts
    );
    if (!request) return { id, request, receipt, before };
    if (ethers.utils.getAddress(request.receiver) !== ethers.utils.getAddress(receiver)) {
        throw new Error(
            `Zero collateral withdrawal: the queue recorded receiver ${request.receiver}, not ` +
                `${receiver} — Zero pays the trove owner, so a different receiver is not reachable ` +
                "through this surface"
        );
    }
    return { id, request, receipt, before };
};

/** An address derived from another one, so a driver that needs a second actor
 *  gets a deterministic one instead of a random key. */
const derivedActor = (from, tag) =>
    ethers.utils.getAddress(
        ethers.utils.hexDataSlice(
            ethers.utils.keccak256(ethers.utils.concat([from, ethers.utils.toUtf8Bytes(tag)])),
            12
        )
    );

/**
 * Zero, collateral-surplus claim. A FULL redemption of the signer's trove
 * closes it and leaves the owner a claimable collateral surplus; claiming that
 * surplus is the fourth delayed surface.
 *
 * The trove has to be the system's first redeemable one, so it is opened just
 * above the live redemption queue's floor rather than at a hardcoded ratio.
 *
 * `opts.redeemer` is the account that performs the redemption (derived from the
 * signer when not given) and `opts.fundFrom` are signers whose ZUSD it may
 * spend. A redeemer that still cannot cover the redemption opens its own
 * high-ratio trove — which sits above the probe in the queue, so the probe stays
 * first — and spends that ZUSD instead.
 */
const queueSurplusClaim = async (s, signer, opts = {}) => {
    const victim = await addressOf(signer);
    const receiver = opts.receiver || victim;
    const redeemerAddress = opts.redeemer || derivedActor(victim, "perimeter-qa-redeemer");
    const fundFrom = opts.fundFrom || [];

    const troveManager = await ethers.getContract("TroveManager");
    const hintHelpers = await ethers.getContract("HintHelpers");
    const sortedTroves = await ethers.getContract("SortedTroves");
    const zeroPriceFeed = await ethers.getContract("PriceFeed");
    const zusd = new ethers.Contract((await get("ZUSDToken")).address, ERC20_ABI, ethers.provider);
    const collSurplusPool = new ethers.Contract(
        (await get("CollSurplusPool_Proxy")).address,
        collSurplusPoolFixture.abi,
        ethers.provider
    );

    // The claim needs a trove that a redemption can close, and an account may
    // hold only one, so an account already carrying one cannot reach this
    // surface until that trove is gone.
    if ((await troveManager.getTroveStatus(victim)).eq(TROVE_ACTIVE)) {
        throw new Error(
            `surplus claim: ${victim} already has an open trove — the surplus surface needs an ` +
                "account with none, so run it as a different account"
        );
    }

    const redeemer = await solventSigner(s, redeemerAddress);
    const price = await zeroPriceFeed.callStatic.fetchPrice();
    const gasCompensation = await s.borrowerOperations.ZUSD_GAS_COMPENSATION();
    const borrowAmount = (await s.borrowerOperations.MIN_NET_DEBT()).mul(2);
    const expectedDebt = borrowAmount
        .add(await troveManager.getBorrowingFeeWithDecay(borrowAmount))
        .add(gasCompensation);

    // Whatever the redeemer can already be handed — its own balance, the probe's
    // own borrow, and anything the caller offered — plus a trove of its own when
    // that is short of the probe's redeemable debt. Opened BEFORE the probe so
    // the probe is measured against a queue that already contains it.
    let available = (await zusd.balanceOf(redeemerAddress)).add(borrowAmount);
    for (const source of fundFrom) {
        available = available.add(await zusd.balanceOf(await addressOf(source)));
    }
    const redeemerHasTrove = (await troveManager.getTroveStatus(redeemerAddress)).eq(TROVE_ACTIVE);
    if (available.lt(expectedDebt.sub(gasCompensation)) && !redeemerHasTrove) {
        await (
            await s.borrowerOperations
                .connect(redeemer)
                .openTrove(
                    MAX_ZERO_FEE_PERCENTAGE,
                    borrowAmount,
                    redeemerAddress,
                    redeemerAddress,
                    { value: ONE_RBTC.mul(2) }
                )
        ).wait();
    }

    const mcr = await troveManager.MCR();
    let probeIcr = ethers.utils.parseEther("1.13");
    const floorHints = await hintHelpers.getRedemptionHints(ONE_RBTC, price, 0);
    if (floorHints.firstRedemptionHint !== ZERO_ADDRESS) {
        const floorIcr = await troveManager.getCurrentICR(floorHints.firstRedemptionHint, price);
        if (floorIcr.lte(probeIcr)) {
            const gap = floorIcr.sub(mcr);
            if (gap.lt(ethers.utils.parseEther("0.0004"))) {
                throw new Error(
                    "surplus claim: the live redemption queue's floor grazes the MCR — no room " +
                        "to open the probe trove below it"
                );
            }
            probeIcr = mcr.add(gap.div(2));
        }
    }
    await (
        await s.borrowerOperations
            .connect(signer)
            .openTrove(MAX_ZERO_FEE_PERCENTAGE, borrowAmount, victim, victim, {
                value: expectedDebt.mul(probeIcr).div(price).add(1),
            })
    ).wait();

    for (const source of [signer, ...fundFrom]) {
        const from = await addressOf(source);
        const balance = await zusd.balanceOf(from);
        if (balance.gt(0)) {
            await (await zusd.connect(source).transfer(redeemerAddress, balance)).wait();
        }
    }

    const redeemable = (await troveManager.getEntireDebtAndColl(victim)).debt.sub(gasCompensation);
    if ((await zusd.balanceOf(redeemerAddress)).lt(redeemable)) {
        throw new Error(
            "surplus claim: the redeemer cannot cover a full redemption of the probe trove"
        );
    }
    const hints = await hintHelpers.getRedemptionHints(redeemable, price, 0);
    if (ethers.utils.getAddress(hints.firstRedemptionHint) !== victim) {
        throw new Error(
            "surplus claim: the probe trove is not the system's first redeemable trove — the " +
                "redemption would consume someone else's position"
        );
    }
    const [upper, lower] = await sortedTroves.findInsertPosition(
        hints.partialRedemptionHintNICR,
        hints.firstRedemptionHint,
        hints.firstRedemptionHint
    );
    await (
        await troveManager
            .connect(redeemer)
            .redeemCollateral(
                redeemable,
                hints.firstRedemptionHint,
                upper,
                lower,
                hints.partialRedemptionHintNICR,
                0,
                MAX_ZERO_FEE_PERCENTAGE
            )
    ).wait();
    // getTroveStatus answers uint256, so compare numerically — a strict
    // comparison against the enum's number is never true.
    if (!(await troveManager.getTroveStatus(victim)).eq(TROVE_CLOSED_BY_REDEMPTION)) {
        throw new Error("surplus claim: the probe trove was not closed by the redemption");
    }
    const surplusGross = await collSurplusPool.getCollateral(victim);
    if (!surplusGross.gt(0)) throw new Error("surplus claim: the redemption left no surplus");

    const before = {
        originator: await nativeBalance(victim),
        receiver: await nativeBalance(receiver),
    };
    const lastIdBefore = await s.queue.lastRequestId();
    const receipt = await (await s.borrowerOperations.connect(signer).claimCollateral()).wait();

    const { id, request } = await queuedBy(
        s,
        "surplus claim",
        PERIMETER_SURFACE_ZERO_CLAIM_SURPLUS,
        lastIdBefore,
        opts
    );
    return { id, request, receipt, before, surplusGross, redeemer: redeemerAddress };
};

const SURFACE_DRIVERS = {
    lender: queueLenderWithdrawal,
    borrower: queueBorrowerClose,
    zero: queueZeroCollWithdraw,
    surplus: queueSurplusClaim,
};

module.exports = {
    STATUS,
    BLOCK,
    TROVE_ACTIVE,
    TROVE_CLOSED_BY_REDEMPTION,
    LEND_AMOUNT,
    LOAN_DURATION,
    MAX_ZERO_FEE_PERCENTAGE,
    ERC20_ABI,
    ensureCollateralPrice,
    queueLenderWithdrawal,
    queueBorrowerClose,
    queueZeroCollWithdraw,
    queueSurplusClaim,
    SURFACE_DRIVERS,
    solventSigner,
    derivedActor,
    addressOf,
};
