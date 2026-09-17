/**
 * Perimeter — `LoanMaintenance.reduceLoanDuration` is DELIBERATELY EXEMPT.
 *
 * The function returns prepaid interest to a borrower-chosen `receiver`. It is a
 * position adjustment, not an exit, and it is intentionally outside the
 * perimeter: no fee, no delay, no queue, in every controller state.
 *
 * The reach of the exemption is bounded and was measured. Chaining
 * `extendLoanDuration(useCollateral: true)` — which converts withdrawable
 * collateral into interest deposit — with this function moves collateral out
 * without touching a gated surface, but the maintenance margin closes the door:
 * cumulatively 16.74%, 20.09%, 21.43%, 22.77% of a position's collateral over
 * four cycles, converging there. The remaining ~77% leaves only through the
 * gated withdrawal and close surfaces.
 *
 * These tests pin the exemption so it cannot be re-routed by accident. If a
 * future change decides this surface belongs inside the perimeter, these tests
 * are the ones that must be deliberately rewritten.
 *
 * Run:
 *   npx hardhat test tests/perimeter/BorrowerExit.reduceLoanDuration.notouch.test.js
 */

const { expect } = require("chai");
const { BN, constants } = require("@openzeppelin/test-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsImplSovrynSwapLib = artifacts.require("SwapsImplSovrynSwapLib");
const MockExitFeeController = artifacts.require("MockExitFeeController");
const MockExitDelayQueue = artifacts.require("MockExitDelayQueue");

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
    linkIfUsed,
} = require("../Utils/initializer.js");

const mutexUtils = require("../../deployment/helpers/reentrancy/utils");

const ZERO = constants.ZERO_ADDRESS;
const DELAY = 3600;
const MIN_DELAY = 100;
const RATE_BPS = 25;

contract("Perimeter — reduceLoanDuration is exempt", (accounts) => {
    let owner, feeReceiver, receiver;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, sov;
    let controller, queue, loanMaintenance;

    async function deploymentAndInitFixture() {
        await mutexUtils.getOrDeployMutex();

        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();
        priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);
        sov = await getSOV(sovryn, priceFeeds, SUSD, accounts);

        loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        await set_demand_curve(loanToken);
        await lend_to_pool(loanToken, SUSD, owner);

        controller = await MockExitFeeController.new();
        await controller.setExitFeeEnabledTest(false);
        await controller.setActive(true);
        await controller.setRate(RATE_BPS);
        await controller.setFeeReceiverTest(feeReceiver);
        await sovryn.setExitFeeController(controller.address, { from: owner });

        queue = await MockExitDelayQueue.new(WRBTC.address, MIN_DELAY);
        await queue.setAllowedSource(sovryn.address, true);

        loanMaintenance = await LoanMaintenance.at(sovryn.address);
    }

    before(async () => {
        [owner, feeReceiver, receiver, ...accounts] = accounts;
        const swapsImplSovrynSwapLib = await SwapsImplSovrynSwapLib.new();
        await linkIfUsed(LoanMaintenance, swapsImplSovrynSwapLib);
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    // The perimeter events are emitted from inside a delegatecall, and Truffle
    // does not decode those into `tx.logs` here even though the ABI carries
    // them. Read the raw topics instead — that is what the chain actually holds.
    const TOPIC_APPLIED = web3.utils.keccak256(
        "ExitFeeApplied(bytes32,address,address,address,address,uint256,uint256,uint256,address)"
    );
    const TOPIC_SKIPPED = web3.utils.keccak256(
        "ExitFeeSkipped(bytes32,address,address,uint256,uint16,uint8)"
    );
    const countTopic = (tx, topic) =>
        tx.receipt.rawLogs.filter((l) => l.topics[0] === topic).length;

    /// An indefinite-term loan with prepaid interest, and a withdrawal that is a
    /// few days of that interest — the shape `reduceLoanDuration` requires.
    async function setupLoanAndAmount() {
        const [loanId, borrower] = await borrow_indefinite_loan(
            loanToken,
            sovryn,
            SUSD,
            RBTC,
            accounts
        );
        const interestData = await sovryn.getLoanInterestData(loanId);
        const withdrawAmount = interestData["interestOwedPerDay"].mul(new BN(5));
        return { loanId, borrower, withdrawAmount };
    }

    async function armDelay({ pinQueue = true } = {}) {
        await controller.setSecurityPerimeterEnabledTest(true);
        await controller.setGlobalDelaySecondsTest(DELAY);
        if (pinQueue) {
            await sovryn.setExitDelayQueue(queue.address, { from: owner });
        }
    }

    /// The surface must behave identically in every controller state — that is
    /// what "exempt" means. Each case asserts the same three things: no
    /// perimeter event, nothing escrowed, full gross to the receiver.
    async function expectUntouched({ loanId, borrower, withdrawAmount }) {
        const before = await SUSD.balanceOf(receiver);
        const feeBefore = await SUSD.balanceOf(feeReceiver);
        const tx = await loanMaintenance.reduceLoanDuration(loanId, receiver, withdrawAmount, {
            from: borrower,
        });

        expect(countTopic(tx, TOPIC_APPLIED), "must not charge").to.equal(0);
        expect(countTopic(tx, TOPIC_SKIPPED), "must not even consult the perimeter").to.equal(0);
        expect((await queue.lastRequestId()).toString(), "must not escrow").to.equal("0");
        expect(await SUSD.balanceOf(queue.address)).to.be.bignumber.equal(new BN(0));
        expect(
            (await SUSD.balanceOf(receiver)).sub(before).toString(),
            "receiver gets the full gross"
        ).to.equal(withdrawAmount.toString());
        expect((await SUSD.balanceOf(feeReceiver)).sub(feeBefore).toString()).to.equal("0");
        return tx;
    }

    it("perimeter disabled: paid in full, no perimeter event", async () => {
        await expectUntouched(await setupLoanAndAmount());
    });

    it("fee active: still no fee — the exemption is not conditional on the switch", async () => {
        await controller.setExitFeeEnabledTest(true);
        const { loanId, borrower, withdrawAmount } = await setupLoanAndAmount();

        const wouldBeFee = withdrawAmount.muln(RATE_BPS).divn(10_000);
        expect(wouldBeFee.gt(new BN(0)), "test would be vacuous with a zero rate").to.be.true;

        await expectUntouched({ loanId, borrower, withdrawAmount });
    });

    it("delay fully armed: nothing escrows and the receiver is paid immediately", async () => {
        await armDelay();
        await expectUntouched(await setupLoanAndAmount());
    });

    it("delay armed with the queue unwired: the call still succeeds", async () => {
        await armDelay({ pinQueue: false });
        const { loanId, borrower, withdrawAmount } = await setupLoanAndAmount();

        /// An exempt surface must not acquire a dependency on the queue pointer:
        /// unwiring it is exactly the fail-closed condition for gated surfaces,
        /// and this one must be indifferent to it.
        await expectUntouched({ loanId, borrower, withdrawAmount });
        expect(receiver).to.not.equal(ZERO);
    });
});
