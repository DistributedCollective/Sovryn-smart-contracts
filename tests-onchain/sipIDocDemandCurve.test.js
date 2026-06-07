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

// Single source of truth for the curve params — shared with the SIP arg builder
// (sipArgs.js) so the proposed values and drift baseline cannot diverge.
const {
    CURRENT_AT_DRAFT,
    PROPOSED,
    CURVE_KEYS,
    SET_DEMAND_CURVE_SIGNATURE,
} = require("../hardhat/tasks/sips/args/idocCurveParams");

const LOCAL_RPC = "http://127.0.0.1:8545";
const directProvider = new ethers.providers.JsonRpcProvider(LOCAL_RPC);

const MAX_DURATION = ethers.BigNumber.from(24 * 60 * 60).mul(1092);
const WEI_PERCENT_PRECISION = ethers.utils.parseEther("100"); // 1e20
const ERC20_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];

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
    let timelockOwnerSigner;

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

        // TimelockOwner owns SOV (needed to mint the whale stake). Any other
        // privileged account (e.g. the staking owner for an unpause) is
        // resolved and impersonated at its point of use.
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
            let pagesReverted = 0;
            let pagesAttempted = 0;
            for (let p = 0; p < MAX_PAGES; p++) {
                pagesAttempted++;
                let page;
                try {
                    page = await protocol.getActiveLoans(p * PAGE, PAGE, false);
                } catch (e) {
                    // The ONLY tolerable revert here is a stale price feed inside
                    // _getLoan's IPriceFeeds.getCurrentMargin call ("price error").
                    // Anything else (ABI-decode mismatch, gas, a renamed selector)
                    // is a real problem and must surface, not be swallowed.
                    const msg = (e && e.message) || "";
                    if (!/price error/i.test(msg)) {
                        throw new Error(
                            `getActiveLoans(start=${p * PAGE}, count=${PAGE}) reverted with an ` +
                                `unexpected error (not price-feed staleness): ${
                                    msg.split("\n")[0]
                                }`
                        );
                    }
                    pagesReverted++;
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
                    (pagesReverted
                        ? ` (${pagesReverted} pages skipped on price-feed revert)`
                        : "") +
                    `, snapshotted ${snapshottedLoans.length} iDOC loan(s)`
            );

            if (snapshottedLoans.length === 0) {
                // Distinguish "degraded fork" from "genuinely no iDOC loans". If
                // every page we attempted reverted (e.g. a paused MoC price feed)
                // we read NOTHING — failing loudly rather than letting the headline
                // "existing loans untouched" coverage silently evaporate via skip.
                if (scanned === 0 && pagesReverted === pagesAttempted) {
                    throw new Error(
                        `getActiveLoans returned no readable pages ` +
                            `(${pagesReverted}/${pagesAttempted} reverted on price-feed staleness). ` +
                            `Cannot snapshot existing iDOC loans to verify they are untouched. ` +
                            `Re-run against a fork block with a live MoC price feed.`
                    );
                }
                // Scanned real loans but none were iDOC — a genuinely sparse fork.
                // Legitimate to skip the downstream unchanged-rate check.
                console.warn(
                    "   WARN: scanned loans but found no iDOC positions; the post-SIP " +
                        "unchanged-rate test will skip (nothing to check)."
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
                // pauseUnpause is onlyPauserOrOwner. Don't assume a hardcoded
                // multisig still holds the role — read the current owner at
                // runtime (pausers aren't enumerable) and act as that account.
                const stakingOwner = await staking.owner();
                const stakingOwnerSigner = await getImpersonatedSigner(stakingOwner);
                await staking.connect(stakingOwnerSigner).pauseUnpause(false);
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

        it("queued proposal payload matches the intended setDemandCurve call", async () => {
            // Decode what was actually queued and compare against the intended
            // call. Without this, a miscomputed abi-encode in sipArgs.js would
            // pass silently through vote/queue/execute and only surface ~200
            // lines downstream in the curve read-back — far from the cause.
            const [targets, values, signatures, calldatas] = await governorAdmin.getActions(
                post.proposalId
            );
            expect(targets.length, "exactly one action").to.equal(1);
            expect(targets[0].toLowerCase(), "target is iDOC").to.equal(
                iDOC.address.toLowerCase()
            );
            expect(values[0], "zero rBTC value").to.equal(0);
            expect(signatures[0], "setDemandCurve signature").to.equal(SET_DEMAND_CURVE_SIGNATURE);
            const expectedData = new ethers.utils.AbiCoder().encode(
                CURVE_KEYS.map(() => "uint256"),
                CURVE_KEYS.map((k) => PROPOSED[k])
            );
            expect(calldatas[0], "encoded setDemandCurve args").to.equal(expectedData);
        });

        it("votes, queues, and executes the proposal", async () => {
            const proposalId = post.proposalId;
            await mine();
            await governorAdmin.connect(deployerSigner).castVote(proposalId, true);

            let proposal = await governorAdmin.proposals(proposalId);
            // mine(n) mines n blocks (a COUNT), not up-to-block-n. endBlock is an
            // absolute number (~9M on a mainnet fork); mine only the delta — else
            // we'd mine millions of blocks and bloat the evm_revert in after().
            // Coerce endBlock with BigNumber.from (it may come back as a plain
            // number, not a BigNumber, depending on the decoded struct) and mine
            // ONE PAST it: GovernorAlpha stays Active while block <= endBlock and
            // only becomes Succeeded (queueable) once block > endBlock.
            const currentBlock = ethers.BigNumber.from(await ethers.provider.getBlockNumber());
            const endBlock = ethers.BigNumber.from(proposal.endBlock);
            const toMine = endBlock.add(1).sub(currentBlock);
            if (toMine.gt(0)) {
                await mine(toMine.toNumber());
            }
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

            // Mirror the contract's borrowAmount==0 path exactly. In
            // LoanTokenLogicStandard._nextBorrowInterestRate, when borrowAmount
            // is 0 the interestUnPaid branch is skipped and utilisation is
            // computed against _totalAssetSupply(0) = underlyingBalance +
            // totalAssetBorrow. That is NOT the public totalAssetSupply(), which
            // additionally adds accrued-but-unpaid interest — using it drifts
            // the expected util by ~the accrued interest and can exceed the
            // tolerance on a time-advanced fork.
            const docToken = await ethers.getContractAt(
                ERC20_BALANCE_ABI,
                await iDOC.loanTokenAddress()
            );
            const underlyingBalance = await docToken.balanceOf(iDOC.address);
            const tb = await iDOC.totalAssetBorrow();
            const denom = underlyingBalance.add(tb); // = _totalAssetSupply(0)
            const liveUtil = denom.isZero()
                ? ethers.BigNumber.from(0)
                : tb.mul(WEI_PERCENT_PRECISION).div(denom);
            const expected = expectedRate(liveUtil, PROPOSED);

            // Strong qualitative checks.
            expect(liveRate, "rate should be lower than pre-SIP").to.be.lt(pre.borrowRate);
            expect(liveRate, "rate >= new baseRate").to.be.gte(PROPOSED.baseRate);
            expect(liveRate, "rate <= new maxScaleRate").to.be.lte(PROPOSED.maxScaleRate);

            // Quantitative: denominators now match the contract, so only
            // integer-division residue remains. 0.005 pp tolerance.
            const tol = ethers.utils.parseEther("0.005");
            expect(
                liveRate.sub(expected).abs(),
                `nextBorrowInterestRate(0)=${fmtPct(liveRate)} ` +
                    `expected~${fmtPct(expected)} at liveUtil=${fmtPct(liveUtil)}`
            ).to.be.lte(tol);
        });

        it("hypothetical borrow sizes are priced on the new curve", async () => {
            const supplyWithInterest = await iDOC.totalAssetSupply();
            const borrowed = await iDOC.totalAssetBorrow();
            const docToken = await ethers.getContractAt(
                ERC20_BALANCE_ABI,
                await iDOC.loanTokenAddress()
            );
            const underlyingBalance = await docToken.balanceOf(iDOC.address);

            // The contract caps borrowAmount to available cash =
            // underlyingBalance + interestUnPaid = (totalAssetSupply -
            // totalAssetBorrow). Mirror that cap so an outsized sample compares
            // against the right rate.
            const available = supplyWithInterest.sub(borrowed);

            const samples = [
                ethers.BigNumber.from(0),
                ethers.utils.parseEther("1000"),
                ethers.utils.parseEther("10000"),
                ethers.utils.parseEther("100000"),
            ];
            // ALWAYS include a sample that lands in the steep (util > kink)
            // branch, so the (kink, 100%) region is exercised even when current
            // utilisation is low. Target 95% util; cap at available cash. If the
            // pool is already above 95%, `available` pins util at 100% — still
            // inside the steep branch. (The previous gated push silently skipped
            // steep-branch coverage whenever the fork sat below the target.)
            const steepTarget = supplyWithInterest
                .mul(ethers.utils.parseEther("95"))
                .div(WEI_PERCENT_PRECISION);
            samples.push(steepTarget.gt(borrowed) ? steepTarget.sub(borrowed) : available);

            const tol = ethers.utils.parseEther("0.05");
            let steepBranchCovered = false;
            for (const amount of samples) {
                const live = await iDOC.nextBorrowInterestRate(amount);
                const effective = amount.gt(available) ? available : amount;
                // Denominator matches the contract's branch: borrowAmount==0
                // skips interest accrual and uses _totalAssetSupply(0) =
                // underlyingBalance + totalAssetBorrow; borrowAmount!=0 accrues
                // interest and uses the public totalAssetSupply().
                const denom = amount.isZero()
                    ? underlyingBalance.add(borrowed)
                    : supplyWithInterest;
                const utilAfter = denom.isZero()
                    ? ethers.BigNumber.from(0)
                    : borrowed.add(effective).mul(WEI_PERCENT_PRECISION).div(denom);
                if (utilAfter.gt(PROPOSED.kinkLevel)) steepBranchCovered = true;
                const expected = expectedRate(utilAfter, PROPOSED);
                expect(
                    live.sub(expected).abs(),
                    `amount=${amount} effective=${effective} util=${fmtPct(utilAfter)} ` +
                        `live=${fmtPct(live)} expected=${fmtPct(expected)}`
                ).to.be.lte(tol);
            }
            expect(
                steepBranchCovered,
                "no sample exercised the steep (util > kink) branch — coverage gap"
            ).to.equal(true);
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
