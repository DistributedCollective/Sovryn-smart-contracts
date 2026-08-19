/**
 * SIP-0094 Part 3 — disable the Zero Stability Pool SOV subsidy — fork execution test.
 *
 * Sibling of perimeterActivationSips.test.js: same fork rehearsal machinery, but a
 * different governor. `ZeroCommunityIssuance.setAPR` is gated by
 * `onlyRewardManager`, and the live reward manager is TimelockAdmin — NOT the
 * TimelockOwner that `getOwner()` reports for the proxy — so this proposal runs
 * through GovernorAdmin. That is the single most mistakeable fact about this
 * SIP, so the test asserts the wiring before it asserts the effect.
 *
 * What is proven, in values rather than occurrences:
 *   - the proposal carries exactly one action, on the CommunityIssuance,
 *     `setAPR(uint256)` with calldata decoding to 0;
 *   - POSITIVE CONTROL first: with the subsidy live (APR != 0), letting time
 *     pass and triggering issuance grows `totalSOVIssued` AND actually pays SOV
 *     to a Stability Pool depositor;
 *   - after execution `APR()` reads back as exactly 0, and the same elapsed-time
 *     probe now grows `totalSOVIssued` by exactly 0 and pays the depositor
 *     exactly 0 — the no-op case, with the control above proving the probe can
 *     detect accrual when there is any;
 *   - `setAPR` settles the accrual earned at the OLD rate during execution
 *     rather than dropping it;
 *   - the proposal changes nothing else on the contract (reward manager,
 *     stability pool pointer, SOV token pointer).
 *
 * Nothing in the SIP is irreversible: `setAPR` stays callable, so re-enabling
 * the subsidy is another short GovernorAdmin proposal.
 *
 * first run a local forked mainnet node in a separate terminal window:
 *     npx hardhat node --fork https://mainnet-dev.sovryn.app/rpc --no-deploy
 * now run the test:
 *     __decryptionAlreadyDone__=TRUE npx hardhat test tests-onchain/perimeter/sip0094Part3ZeroSubsidySip.test.js --network rskForkedMainnet
 */
const { expect } = require("chai");
const { time, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");
const {
    ONE_RBTC,
    FORK_URL,
    forkBlock,
    getImpersonatedSigner,
    stubOutZeroPriceFeed,
    createAndQueueSip,
    executeQueuedSip,
    setupGovernanceContext,
} = require("./perimeterSipTestHelpers");

const {
    ethers,
    deployments: { get },
} = hre;

const FORK_BLOCK = forkBlock(9056400);
// Tolerance for Zero's dynamic origination fee (raised well above the floor on
// mainnet); test-only — the probe trove is funded from balance, not budgeted.
const MAX_ZERO_FEE_PERCENTAGE = ethers.utils.parseEther("0.99");
// Deliberately small: the depositor's SOV gain is
// deposit x APR x elapsed/1y (pool size cancels out), and it is paid from the
// CommunityIssuance's real mainnet SOV balance. A small deposit over a short
// window keeps the payout far inside that balance.
const SP_DEPOSIT = ethers.utils.parseEther("50");
const ACCRUAL_WINDOW = 14 * 24 * 3600;

describe("SIP-0094 Part 3 — disable the Zero Stability Pool SOV subsidy (GovernorAdmin)", () => {
    it("zeroes the CommunityIssuance APR through the ADMIN governor and stops SOV accrual", async () => {
        if (!hre.network.tags["forked"]) {
            // Throw, don't return: a bare return would mark this test PASSED
            // with zero assertions on a mis-invoked run.
            throw new Error(
                "sip0094Part3ZeroSubsidySip must run on a forked mainnet (rskForkedMainnet); " +
                    "no fork tag on this network"
            );
        }
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [{ forking: { jsonRpcUrl: FORK_URL, blockNumber: FORK_BLOCK } }],
        });

        const ctx = await setupGovernanceContext();
        const { deployerSigner, timelockAdmin } = ctx;

        const communityIssuance = await ethers.getContract(
            "ZeroCommunityIssuance",
            deployerSigner
        );
        const stabilityPool = await ethers.getContract("StabilityPool", deployerSigner);
        const borrowerOperations = await ethers.getContract("BorrowerOperations", deployerSigner);
        const erc20Abi = [
            "function balanceOf(address) view returns (uint256)",
            "function transfer(address,uint256) returns (bool)",
        ];
        const sov = new ethers.Contract((await get("SOV")).address, erc20Abi, deployerSigner);
        const wrbtc = await get("WRBTC");

        // ── Governor selection is the load-bearing fact ────────────────────
        // setAPR is onlyRewardManager. The proxy's getOwner() is TimelockOwner
        // and would be the natural (wrong) choice; pin both so a future
        // rewiring of either role fails here rather than on mainnet.
        const rewardManager = await communityIssuance.rewardManager();
        expect(rewardManager, "setAPR is gated by the ADMIN timelock").to.equal(
            timelockAdmin.address
        );
        expect(
            await communityIssuance.getOwner(),
            "…while the proxy owner is the OWNER timelock — different role, different governor"
        ).to.equal(ctx.timelockOwner.address);
        expect(rewardManager).to.not.equal(ctx.timelockOwner.address);

        // ── Fork artifacts: two price feeds have to be made time-insensitive
        // The governance flow jumps the clock by days; Zero's own PriceFeed and
        // the Sovryn PriceFeeds the CommunityIssuance prices SOV with are both
        // MoC-backed and expire. Swap both for settable local ones, using each
        // contract's real owner — the same authority that would rotate a feed
        // in production — and hand the CommunityIssuance's back at the end.
        await stubOutZeroPriceFeed(deployerSigner);

        const priceFeedsLocalFactory = await ethers.getContractFactory(
            "PriceFeedsLocal",
            deployerSigner
        );
        const localFeeds = await priceFeedsLocalFactory.deploy(
            wrbtc.address,
            (await get("SOV")).address
        );
        await localFeeds.deployed();
        const communityIssuanceOwner = await getImpersonatedSigner(
            await communityIssuance.getOwner()
        );
        await setBalance(communityIssuanceOwner.address, ONE_RBTC);
        const originalCommunityIssuanceFeed = await communityIssuance.priceFeed();
        await (
            await communityIssuance
                .connect(communityIssuanceOwner)
                .setPriceFeed(localFeeds.address)
        ).wait();

        // ── A real Stability Pool depositor to observe the subsidy on ──────
        const depositor = await getImpersonatedSigner(
            "0x00000000000000000000000000000000c01fee95"
        );
        await setBalance(depositor.address, ONE_RBTC.mul(10));
        const zeroBorrowAmount = (await borrowerOperations.MIN_NET_DEBT()).mul(2);
        await (
            await borrowerOperations
                .connect(depositor)
                .openTrove(
                    MAX_ZERO_FEE_PERCENTAGE,
                    zeroBorrowAmount,
                    depositor.address,
                    depositor.address,
                    { value: ONE_RBTC.mul(2) }
                )
        ).wait();
        await (
            await stabilityPool
                .connect(depositor)
                .provideToSP(SP_DEPOSIT, ethers.constants.AddressZero)
        ).wait();
        expect(
            (await stabilityPool.getTotalZUSDDeposits()).gt(0),
            "the pool must hold deposits for the subsidy to be measurable"
        ).to.be.true;
        expect(
            (await sov.balanceOf(communityIssuance.address)).gt(0),
            "the CommunityIssuance must hold SOV to pay gains with"
        ).to.be.true;

        // ── POSITIVE CONTROL: the subsidy is live and measurable ───────────
        const aprBeforeSip = await communityIssuance.APR();
        expect(aprBeforeSip.gt(0), "the subsidy must be ON before the SIP, or this proves nothing")
            .to.be.true;

        let totalIssuedMark = await communityIssuance.totalSOVIssued();
        let depositorSovMark = await sov.balanceOf(depositor.address);
        await time.increase(ACCRUAL_WINDOW);
        // withdrawFromSP(0) is the claim-only path: it triggers issuance and
        // pays out accrued SOV without moving any ZUSD.
        await (await stabilityPool.connect(depositor).withdrawFromSP(0)).wait();

        const issuedWhileOn = (await communityIssuance.totalSOVIssued()).sub(totalIssuedMark);
        const paidWhileOn = (await sov.balanceOf(depositor.address)).sub(depositorSovMark);
        expect(issuedWhileOn.gt(0), "with APR != 0 the pool must accrue SOV over time").to.be.true;
        expect(paidWhileOn.gt(0), "with APR != 0 a depositor must actually be paid SOV").to.be
            .true;

        // ── The proposal ───────────────────────────────────────────────────
        const { proposalId } = await createAndQueueSip(
            ctx,
            "getArgsSip0094Part3",
            "governorAdmin"
        );
        // Positional destructuring, NOT `.values`: on an ethers Result the
        // `values` key is shadowed by Array.prototype.values.
        const [actionTargets, actionValues, actionSignatures, actionCalldatas] =
            await ctx.governorAdmin.getActions(proposalId);
        expect(actionTargets.length, "SIP-0094 Part 3 action count").to.equal(1);
        expect(ethers.utils.getAddress(actionTargets[0])).to.equal(
            ethers.utils.getAddress(communityIssuance.address)
        );
        expect(actionSignatures[0]).to.equal("setAPR(uint256)");
        expect(actionValues[0], "the action must carry no RBTC").to.equal(0);
        const [proposedAPR] = new ethers.utils.AbiCoder().decode(["uint256"], actionCalldatas[0]);
        expect(proposedAPR, "the proposal must set the APR to exactly zero").to.equal(0);

        const totalIssuedBeforeExecution = await communityIssuance.totalSOVIssued();
        await executeQueuedSip(ctx, proposalId, "governorAdmin");

        // ── The effect, read back ──────────────────────────────────────────
        expect(await communityIssuance.APR(), "APR must read back as exactly 0").to.equal(0);
        // setAPR settles what was earned at the OLD rate first — the subsidy is
        // switched off going forward, not clawed back.
        expect(
            (await communityIssuance.totalSOVIssued()).gt(totalIssuedBeforeExecution),
            "setAPR must settle the accrual earned at the old rate during execution"
        ).to.be.true;
        // …and nothing else on the contract moved.
        expect(await communityIssuance.rewardManager()).to.equal(rewardManager);
        expect(await communityIssuance.stabilityPoolAddress()).to.equal(stabilityPool.address);
        expect(await communityIssuance.sovToken()).to.equal(sov.address);

        // ── THE NO-OP CASE: the same probe that just detected accrual ──────
        // Drain first. `setAPR` settles CommunityIssuance-side accounting
        // (totalSOVIssued, lastIssuanceTime) but does NOT run the pool's
        // _updateG, so whatever is still claimable at the old rate has to be
        // taken off the books before the zero-delta window starts. This claim's
        // size is deliberately not asserted — only that the window AFTER it is
        // flat.
        await (await stabilityPool.connect(depositor).withdrawFromSP(0)).wait();

        totalIssuedMark = await communityIssuance.totalSOVIssued();
        depositorSovMark = await sov.balanceOf(depositor.address);
        await time.increase(ACCRUAL_WINDOW);
        await (await stabilityPool.connect(depositor).withdrawFromSP(0)).wait();

        expect(
            await communityIssuance.totalSOVIssued(),
            "with APR == 0 an identical elapsed window must issue exactly nothing"
        ).to.equal(totalIssuedMark);
        expect(
            await sov.balanceOf(depositor.address),
            "with APR == 0 the depositor must be paid exactly nothing"
        ).to.equal(depositorSovMark);
        // The pool itself still works — the subsidy stopped, the product did not.
        expect(
            (await stabilityPool.deposits(depositor.address)).initialValue.gt(0),
            "the depositor's Stability Pool position must survive the subsidy switch-off"
        ).to.be.true;

        // Hygiene: hand the real price feed back.
        await (
            await communityIssuance
                .connect(communityIssuanceOwner)
                .setPriceFeed(originalCommunityIssuanceFeed)
        ).wait();
    });
});
