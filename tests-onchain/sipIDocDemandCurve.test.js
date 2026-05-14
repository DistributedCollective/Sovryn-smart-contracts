// On-chain (forked-mainnet) test for the iDOC demand-curve SIP.
//
// Setup (separate terminal):
//     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
//
// Run:
//     npx hardhat test tests-onchain/sipIDocDemandCurve.test.js --network rskForkedMainnet
//
// The test imitates the ammV2PauseViaOracle.test.js pattern: a light `before()`,
// many small `it()` blocks that share state and run sequentially, with the SIP
// execution itself broken out as its own `it()` so failures are localised.

const { expect } = require("chai");
const { mine, time } = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

const {
    ethers,
    deployments: { get },
} = hre;

const LOCAL_RPC = "http://127.0.0.1:8545";
const directProvider = new ethers.providers.JsonRpcProvider(LOCAL_RPC);

const MAX_DURATION = ethers.BigNumber.from(24 * 60 * 60).mul(1092);
const WEI_PERCENT_PRECISION = ethers.utils.parseEther("100"); // 1e20

// Proposed values — must mirror getArgsSipIDocDemandCurve in sipArgs.js.
const PROPOSED = {
    baseRate: ethers.utils.parseEther("2"),
    rateMultiplier: ethers.utils.parseEther("10"),
    lowUtilBaseRate: ethers.utils.parseEther("2"),
    lowUtilRateMultiplier: ethers.utils.parseEther("10"),
    targetLevel: ethers.BigNumber.from(0),
    kinkLevel: ethers.utils.parseEther("90"),
    maxScaleRate: ethers.utils.parseEther("30"),
};

// On-chain mainnet values at the time the SIP was drafted. Used as a sanity
// guard so the test fails loudly with a clear message if an interim SIP has
// already mutated the curve OR a previous test run left the fork in post-SIP
// state without `evm_revert` firing.
const CURRENT_AT_DRAFT = {
    baseRate: ethers.utils.parseEther("6"),
    rateMultiplier: ethers.utils.parseEther("15"),
    lowUtilBaseRate: ethers.utils.parseEther("6"),
    lowUtilRateMultiplier: ethers.utils.parseEther("15"),
    targetLevel: ethers.BigNumber.from(0),
    kinkLevel: ethers.utils.parseEther("75"),
    maxScaleRate: ethers.utils.parseEther("150"),
};

const CURVE_KEYS = Object.keys(PROPOSED);

const IDOC_ABI = [
    "function admin() view returns (address)",
    "function owner() view returns (address)",
    "function loanTokenAddress() view returns (address)",
    "function baseRate() view returns (uint256)",
    "function rateMultiplier() view returns (uint256)",
    "function lowUtilBaseRate() view returns (uint256)",
    "function lowUtilRateMultiplier() view returns (uint256)",
    "function targetLevel() view returns (uint256)",
    "function kinkLevel() view returns (uint256)",
    "function maxScaleRate() view returns (uint256)",
    "function borrowInterestRate() view returns (uint256)",
    "function nextBorrowInterestRate(uint256) view returns (uint256)",
    "function tokenPrice() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function totalAssetSupply() view returns (uint256)",
    "function totalAssetBorrow() view returns (uint256)",
];

const PROTOCOL_ABI = [
    "function liquidationIncentivePercent() view returns (uint256)",
    "function getActiveLoans(uint256,uint256,bool) view returns (tuple(bytes32 loanId, address loanToken, address collateralToken, uint256 principal, uint256 collateral, uint256 interestOwedPerDay, uint256 interestDepositRemaining, uint256 startRate, uint256 startMargin, uint256 maintenanceMargin, uint256 currentMargin, uint256 maxLoanTerm, uint256 endTimestamp, uint256 maxLiquidatable, uint256 maxSeizable)[])",
    // Direct mapping getters — bypass IPriceFeeds (which can revert "price
    // error" once fork time advances during the proposal queue delay).
    "function loans(bytes32) view returns (bytes32 id, bytes32 loanParamsId, bytes32 pendingTradesId, bool active, uint256 principal, uint256 collateral, uint256 startTimestamp, uint256 endTimestamp, uint256 startMargin, uint256 startRate, address borrower, address lender)",
    "function loanInterest(bytes32) view returns (uint256 owedPerDay, uint256 depositTotal, uint256 updatedTimestamp)",
];

// Sovryn's rskForkedMainnet config wraps the default provider in an
// HDWalletProvider; ethers.getSigner(addr) routes through it and rejects any
// non-mnemonic address with HH103. Bypass by talking directly to the local
// hardhat node, which honours hardhat_impersonateAccount regardless. Note
// 127.0.0.1 (not localhost) — macOS resolves localhost to IPv6 first but the
// hardhat node binds IPv4 only.
//
// We also fund the account with 100 RBTC. Some impersonated addresses are
// smart contracts (e.g. TimelockOwner) that hold no gas RBTC on chain, so a
// plain impersonation isn't enough — they can't pay gas to send txs.
// hardhat_setBalance can briefly 502 if the upstream fork RPC is overloaded;
// retry once after a short pause to absorb that.
async function getImpersonatedSigner(addr) {
    await directProvider.send("hardhat_impersonateAccount", [addr]);
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await directProvider.send("hardhat_setBalance", [
                addr,
                "0x56BC75E2D63100000", // 100 RBTC
            ]);
            return directProvider.getSigner(addr);
        } catch (e) {
            if (attempt === 2 || !/502|Bad Gateway/.test(e.message || "")) {
                throw e;
            }
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
}

// Curve formula — mirrors _nextBorrowInterestRate2 in LoanTokenLogicStandard.
function expectedRate(util, p) {
    if (util.lt(p.targetLevel)) util = p.targetLevel;
    if (util.lte(p.kinkLevel)) {
        let rate = util.mul(p.rateMultiplier).div(WEI_PERCENT_PRECISION).add(p.baseRate);
        const max = p.rateMultiplier.add(p.baseRate);
        if (rate.lt(p.baseRate)) rate = p.baseRate;
        if (rate.gt(max)) rate = max;
        return rate;
    }
    const range = WEI_PERCENT_PRECISION.sub(p.kinkLevel);
    let above = util.sub(p.kinkLevel);
    if (above.gt(range)) above = range;
    const rateAtKink = p.kinkLevel
        .mul(p.rateMultiplier)
        .div(WEI_PERCENT_PRECISION)
        .add(p.baseRate);
    return above.mul(p.maxScaleRate.sub(rateAtKink)).div(range).add(rateAtKink);
}

const fmtPct = (x) => `${ethers.utils.formatEther(x)}%`;

describe("SIP iDOC Demand-Curve adjustment (forked mainnet)", function () {
    this.timeout(15 * 60 * 1000);

    // Shared across it() blocks.
    let deployer, deployerSigner;
    let iDOC, protocol, governorAdmin, staking;
    let timelockOwnerSigner, multisigSigner;

    const pre = {}; // pre-SIP snapshot
    const post = {}; // post-SIP snapshot
    let snapshottedLoans = []; // existing iDOC loans captured before SIP
    let forkSnapshotId; // for evm_revert in after()

    before(async function () {
        expect(hre.network.tags["forked"], "must run on a forked net").to.equal(true);

        [deployerSigner] = await ethers.getSigners();
        deployer = deployerSigner.address;
        // Fund the deployer (test account from the mnemonic; no upstream fetch
        // triggered for local mnemonic addresses).
        await directProvider.send("hardhat_setBalance", [
            deployer,
            "0x56BC75E2D63100000", // 100 RBTC
        ]);

        const iDOCAddr = (await get("LoanToken_iDOC")).address;
        iDOC = await ethers.getContractAt(IDOC_ABI, iDOCAddr);

        const protocolAddr = (await get("SovrynProtocol")).address;
        protocol = await ethers.getContractAt(PROTOCOL_ABI, protocolAddr);

        const gaDep = await get("GovernorAdmin");
        governorAdmin = await ethers.getContractAt("GovernorAlpha", gaDep.address, deployerSigner);

        staking = await ethers.getContract("Staking", deployerSigner);

        // Impersonate. Real mainnet addresses (Sovryn multisig, TimelockOwner)
        // hold real RBTC on chain so no extra funding required.
        const multisigAddr = (await get("MultiSigWallet")).address;
        multisigSigner = await getImpersonatedSigner(multisigAddr);

        const timelockOwner = await ethers.getContract("TimelockOwner");
        timelockOwnerSigner = await getImpersonatedSigner(timelockOwner.address);
    });

    after(async () => {
        if (forkSnapshotId) {
            try {
                await directProvider.send("evm_revert", [forkSnapshotId]);
            } catch (e) {
                console.warn(`   evm_revert failed (non-fatal): ${e.message}`);
            }
        }
    });

    // ────────────────────────── Pre-SIP baseline ────────────────────────────
    describe("pre-SIP baseline (fork's current state)", () => {
        it("iDOC curve parameters match the draft baseline", async () => {
            const observed = {};
            for (const k of CURVE_KEYS) observed[k] = await iDOC[k]();
            pre.curve = observed;

            for (const k of CURVE_KEYS) {
                if (!observed[k].eq(CURRENT_AT_DRAFT[k])) {
                    throw new Error(
                        `pre-SIP ${k} drift: got ${observed[k]} expected ${CURRENT_AT_DRAFT[k]}. ` +
                            `Your fork is probably in post-SIP state from a prior run that ` +
                            `didn't revert. Restart \`npx hardhat node --fork ... --no-deploy\` ` +
                            `and re-run.`
                    );
                }
            }
        });

        it("captures pre-SIP pool / protocol invariants", async () => {
            pre.borrowRate = await iDOC.borrowInterestRate();
            pre.tokenPrice = await iDOC.tokenPrice();
            pre.iDocErc20Supply = await iDOC.totalSupply();
            pre.totalAssetSupply = await iDOC.totalAssetSupply();
            pre.totalAssetBorrow = await iDOC.totalAssetBorrow();
            pre.util = pre.totalAssetSupply.isZero()
                ? ethers.BigNumber.from(0)
                : pre.totalAssetBorrow.mul(WEI_PERCENT_PRECISION).div(pre.totalAssetSupply);
            pre.liquidationIncentive = await protocol.liquidationIncentivePercent();

            console.log(
                `   borrowRate=${fmtPct(pre.borrowRate)}  ` +
                    `tokenPrice=${ethers.utils.formatEther(pre.tokenPrice)}  ` +
                    `util=${fmtPct(pre.util)}`
            );

            expect(pre.liquidationIncentive, "liquidationIncentive draft baseline").to.equal(
                ethers.utils.parseEther("5")
            );
        });

        it("snapshots up to 5 existing iDOC loans for the post-SIP unchanged-rate check", async function () {
            // Conservative scan: small page (so a single price-feed-stale loan
            // doesn't sink a whole page) and small total budget (so a fork
            // with sparse iDOC loans doesn't make the test take forever).
            const docUnderlying = (await iDOC.loanTokenAddress()).toLowerCase();
            const PAGE = 10;
            const MAX_PAGES = 10;
            let scanned = 0;
            let skipped = 0;
            for (let p = 0; p < MAX_PAGES; p++) {
                let page;
                try {
                    page = await protocol.getActiveLoans(p * PAGE, PAGE, false);
                } catch (e) {
                    skipped++;
                    continue;
                }
                scanned += page.length;
                for (const l of page) {
                    if (l.loanToken.toLowerCase() === docUnderlying) {
                        snapshottedLoans.push({
                            loanId: l.loanId,
                            principal: l.principal,
                            interestOwedPerDay: l.interestOwedPerDay,
                            startRate: l.startRate,
                            startMargin: l.startMargin,
                            endTimestamp: l.endTimestamp,
                        });
                    }
                }
                if (page.length < PAGE) break; // end of activeLoansSet
                if (snapshottedLoans.length >= 5) break;
            }
            console.log(
                `   scanned ${scanned} active loans` +
                    (skipped ? ` (${skipped} pages skipped on revert)` : "") +
                    `, snapshotted ${snapshottedLoans.length} iDOC loan(s)`
            );

            if (snapshottedLoans.length === 0) {
                console.warn(
                    "   WARN: no iDOC loans snapshotted; the post-SIP unchanged-rate test will skip"
                );
                this.skip();
            }
        });
    });

    // ───────────────────────── SIP execution flow ───────────────────────────
    describe("SIP execution via GovernorAdmin", () => {
        before(async () => {
            // Snapshot the clean baseline so `after` can revert and leave the
            // node re-runnable.
            forkSnapshotId = await directProvider.send("evm_snapshot", []);
        });

        it("stakes a SOV whale and submits the proposal", async () => {
            const sov = await ethers.getContract("SOV", timelockOwnerSigner);
            const whaleAmount = (await sov.totalSupply()).mul(5);
            await sov.mint(deployer, whaleAmount);
            await sov.connect(deployerSigner).approve(staking.address, whaleAmount);
            if (await staking.paused()) {
                await staking.connect(multisigSigner).pauseUnpause(false);
            }
            // Date.now() returns ms; Staking.stake's `until` expects seconds.
            // The contract appears to clamp internally so the test passes either
            // way, but use the correct unit for correctness.
            const nowSec = Math.floor(Date.now() / 1000);
            await staking.stake(
                whaleAmount,
                ethers.BigNumber.from(nowSec).add(MAX_DURATION),
                deployer,
                deployer
            );
            await mine();

            const proposalIdBefore = await governorAdmin.latestProposalIds(deployer);
            await hre.run("sips:create", {
                argsFunc: "getArgsSipIDocDemandCurve",
            });
            const proposalId = await governorAdmin.latestProposalIds(deployer);
            expect(
                proposalId,
                "proposal not created — check sipArgs.js export and signature"
            ).is.gt(proposalIdBefore);
            post.proposalId = proposalId;
        });

        it("votes, queues, and executes the proposal", async () => {
            const proposalId = post.proposalId;
            await mine();
            await governorAdmin.connect(deployerSigner).castVote(proposalId, true);

            let proposal = await governorAdmin.proposals(proposalId);
            await mine(proposal.endBlock);
            await governorAdmin.queue(proposalId);

            proposal = await governorAdmin.proposals(proposalId);
            await time.increaseTo(proposal.eta);
            await expect(governorAdmin.execute(proposalId))
                .to.emit(governorAdmin, "ProposalExecuted")
                .withArgs(proposalId);
            expect((await governorAdmin.proposals(proposalId)).executed).to.be.true;
        });

        it("captures post-SIP pool / protocol invariants", async () => {
            const observed = {};
            for (const k of CURVE_KEYS) observed[k] = await iDOC[k]();
            post.curve = observed;
            post.borrowRate = await iDOC.borrowInterestRate();
            post.tokenPrice = await iDOC.tokenPrice();
            post.iDocErc20Supply = await iDOC.totalSupply();
            post.totalAssetSupply = await iDOC.totalAssetSupply();
            post.totalAssetBorrow = await iDOC.totalAssetBorrow();
            post.util = post.totalAssetSupply.isZero()
                ? ethers.BigNumber.from(0)
                : post.totalAssetBorrow.mul(WEI_PERCENT_PRECISION).div(post.totalAssetSupply);
            post.liquidationIncentive = await protocol.liquidationIncentivePercent();
            console.log(
                `   borrowRate=${fmtPct(post.borrowRate)}  ` +
                    `tokenPrice=${ethers.utils.formatEther(post.tokenPrice)}  ` +
                    `util=${fmtPct(post.util)}`
            );
        });
    });

    // ──────────────────────── Post-SIP assertions ───────────────────────────
    describe("post-SIP curve update", () => {
        it("all 7 curve storage params equal the proposed values", () => {
            for (const k of CURVE_KEYS) {
                expect(post.curve[k], `${k} mismatch`).to.equal(PROPOSED[k]);
            }
        });
    });

    describe("post-SIP: protocol & pool invariants unchanged", () => {
        it("protocol-wide liquidationIncentivePercent stays at 5%", () => {
            expect(post.liquidationIncentive).to.equal(pre.liquidationIncentive);
            expect(post.liquidationIncentive).to.equal(ethers.utils.parseEther("5"));
        });

        it("iDOC ERC-20 totalSupply unchanged (no mint/burn from SIP)", () => {
            expect(post.iDocErc20Supply).to.equal(pre.iDocErc20Supply);
        });

        it("iDOC tokenPrice did not decrease", () => {
            expect(post.tokenPrice).to.be.gte(pre.tokenPrice);
        });

        it("iDOC totalAssetBorrow unchanged (SIP does not open/close loans)", () => {
            expect(post.totalAssetBorrow).to.equal(pre.totalAssetBorrow);
        });
    });

    describe("post-SIP: existing loans untouched", () => {
        it("every snapshotted iDOC loan retains its locked terms", async function () {
            if (snapshottedLoans.length === 0) {
                console.warn("   SKIPPED — no loans were snapshotted pre-SIP");
                this.skip();
                return;
            }
            for (const before of snapshottedLoans) {
                const loanAfter = await protocol.loans(before.loanId);
                const interestAfter = await protocol.loanInterest(before.loanId);

                expect(loanAfter.principal, `principal moved for loan ${before.loanId}`).to.equal(
                    before.principal
                );
                expect(
                    interestAfter.owedPerDay,
                    `LOCKED rate (interestOwedPerDay) moved for loan ${before.loanId} — ` +
                        `SIP must not retroactively reprice existing loans!`
                ).to.equal(before.interestOwedPerDay);
                expect(loanAfter.startRate, `startRate moved for loan ${before.loanId}`).to.equal(
                    before.startRate
                );
                expect(
                    loanAfter.startMargin,
                    `startMargin moved for loan ${before.loanId}`
                ).to.equal(before.startMargin);
                expect(
                    loanAfter.endTimestamp,
                    `endTimestamp moved for loan ${before.loanId}`
                ).to.equal(before.endTimestamp);
            }
        });
    });

    describe("post-SIP: new borrows use the new curve", () => {
        it("rate at current utilisation matches the new-curve formula", async () => {
            const liveRate = await iDOC.nextBorrowInterestRate(0);
            const ts = await iDOC.totalAssetSupply();
            const tb = await iDOC.totalAssetBorrow();
            const liveUtil = ts.isZero()
                ? ethers.BigNumber.from(0)
                : tb.mul(WEI_PERCENT_PRECISION).div(ts);
            const expected = expectedRate(liveUtil, PROPOSED);

            // Strong qualitative checks.
            expect(liveRate, "rate should be lower than pre-SIP").to.be.lt(pre.borrowRate);
            expect(liveRate, "rate >= new baseRate").to.be.gte(PROPOSED.baseRate);
            expect(liveRate, "rate <= new maxScaleRate").to.be.lte(PROPOSED.maxScaleRate);

            // Quantitative: 0.05 pp tolerance for interest-accrual micro-drift.
            const tol = ethers.utils.parseEther("0.05");
            expect(
                liveRate.sub(expected).abs(),
                `nextBorrowInterestRate(0)=${fmtPct(liveRate)} ` +
                    `expected~${fmtPct(expected)} at liveUtil=${fmtPct(liveUtil)}`
            ).to.be.lte(tol);
        });

        it("hypothetical borrow sizes are priced on the new curve", async () => {
            const supply = await iDOC.totalAssetSupply();
            const borrowed = await iDOC.totalAssetBorrow();
            // LoanTokenLogicStandard._nextBorrowInterestRate caps borrowAmount
            // to available cash = underlyingBalance + interestUnPaid, which
            // equals (totalAssetSupply - totalAssetBorrow). We mirror that cap
            // when computing the expected util, otherwise an outsized sample
            // would compare against the wrong rate.
            const available = supply.sub(borrowed);
            const samples = [
                ethers.BigNumber.from(0),
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("10000"),
                ethers.utils.parseEther("100000"),
            ];
            // Push util past the new 90 % kink for one sample to exercise the
            // steep branch (already bounded by available since target < supply).
            const target = supply.mul(ethers.utils.parseEther("92")).div(WEI_PERCENT_PRECISION);
            if (target.gt(borrowed)) samples.push(target.sub(borrowed));

            const tol = ethers.utils.parseEther("0.05");
            for (const amount of samples) {
                const live = await iDOC.nextBorrowInterestRate(amount);
                const effective = amount.gt(available) ? available : amount;
                const utilAfter = borrowed.add(effective).mul(WEI_PERCENT_PRECISION).div(supply);
                const expected = expectedRate(utilAfter, PROPOSED);
                expect(
                    live.sub(expected).abs(),
                    `amount=${amount} effective=${effective} util=${fmtPct(utilAfter)} ` +
                        `live=${fmtPct(live)} expected=${fmtPct(expected)}`
                ).to.be.lte(tol);
            }
        });

        it("rate curve is monotone non-decreasing across utilisation samples (formula self-check)", () => {
            const samples = ["0", "50", "75", "90", "95", "99"];
            let prev = ethers.BigNumber.from(0);
            for (const u of samples) {
                const r = expectedRate(ethers.utils.parseEther(u), PROPOSED);
                expect(r, `non-monotone at util=${u}%`).to.be.gte(prev);
                prev = r;
            }
            expect(expectedRate(ethers.utils.parseEther("100"), PROPOSED)).to.equal(
                PROPOSED.maxScaleRate
            );
        });
    });
});
