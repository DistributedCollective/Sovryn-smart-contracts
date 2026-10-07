/**
 * `contracts/mockup/perimeter/MockExitDelayQueue.sol` against the real
 * `ExitDelayQueue`'s measured-delta ingress (`recordReceivedERC20Exit`,
 * `recordReceivedNativeExit`): the record is accepted only when the surplus of
 * the queue's balance over what it already holds in escrow covers the amount,
 * and a balance that has fallen below the escrowed total has a surplus of
 * zero. The mock is a test double for this repository's own unit tests, so
 * the only thing at stake is whether a test built against it can trust an
 * accepted record.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/MockExitDelayQueue.test.js
 */

const { expect } = require("chai");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");

const MockExitDelayQueue = artifacts.require("MockExitDelayQueue");
const TestToken = artifacts.require("TestToken");
const TestWrbtc = artifacts.require("TestWrbtc");

const { setBalance } = require("../Utils/Ethereum");

const ZERO = "0x0000000000000000000000000000000000000000";
const SURFACE_ID = web3.utils.keccak256("PERIMETER_SURFACE_LENDING_BORROWER_WITHDRAW");
const MIN_DELAY = 60;
const DELAY = 3600;
const REFUSED = "MockQueue: received amount mismatch";

contract("MockExitDelayQueue — surplus check on the measured-delta ingress", (accounts) => {
    const [source, party, receiver] = accounts;
    let queue, token;

    beforeEach(async () => {
        const wrbtc = await TestWrbtc.new();
        token = await TestToken.new("Token", "TKN", 18, 0);
        queue = await MockExitDelayQueue.new(wrbtc.address, MIN_DELAY);
        await queue.setAllowedSource(source, true);
    });

    const recordErc20 = (amount) =>
        queue.recordReceivedERC20Exit(
            token.address,
            amount,
            DELAY,
            SURFACE_ID,
            party,
            party,
            party,
            receiver,
            { from: source }
        );

    const recordNative = (amount) =>
        queue.recordReceivedNativeExit(amount, DELAY, SURFACE_ID, party, party, party, receiver, {
            from: source,
        });

    const depositNative = (amount) =>
        web3.eth.sendTransaction({ from: party, to: queue.address, value: amount });

    // One record escrowed, then 40 of the 100 held leave the queue without the
    // escrow being reduced: the balance (60) is 40 below the escrowed total.
    async function escrow100ThenLose40(leg) {
        if (leg === "erc20") {
            await token.mint(queue.address, 100);
            await recordErc20(100);
            await token.burn(queue.address, 40);
        } else {
            await depositNative(100);
            await recordNative(100);
            await setBalance(queue.address, 60);
        }
    }

    const escrowed = (leg) => queue.totalEscrowed(leg === "erc20" ? token.address : ZERO);
    const deposit = (leg, amount) =>
        leg === "erc20" ? token.mint(queue.address, amount) : depositNative(amount);
    const record = (leg, amount) => (leg === "erc20" ? recordErc20(amount) : recordNative(amount));

    for (const leg of ["erc20", "native"]) {
        describe(`${leg} leg, balance below the escrowed total`, () => {
            beforeEach(async () => {
                await escrow100ThenLose40(leg);
                expect((await escrowed(leg)).toString()).to.equal("100");
                expect((await queue.lastRequestId()).toString()).to.equal("1");
            });

            it("refuses a record when the deposit since is smaller than the shortfall", async () => {
                await deposit(leg, 30); // 90 held against 100 escrowed
                await expectRevert(record(leg, 1), REFUSED);
                await expectRevert(record(leg, 30), REFUSED);
                expect((await escrowed(leg)).toString()).to.equal("100");
                expect((await queue.lastRequestId()).toString()).to.equal("1");
            });

            it("refuses a record when the deposit since is exactly the shortfall", async () => {
                await deposit(leg, 40); // 100 held against 100 escrowed: no surplus
                await expectRevert(record(leg, 1), REFUSED);
                expect((await escrowed(leg)).toString()).to.equal("100");
            });

            it("refuses a record of the whole deposit when the deposit is larger than the shortfall", async () => {
                await deposit(leg, 60); // 120 held against 100 escrowed: surplus 20
                await expectRevert(record(leg, 60), REFUSED);
                await expectRevert(record(leg, 21), REFUSED);
                expect((await escrowed(leg)).toString()).to.equal("100");
                expect((await queue.lastRequestId()).toString()).to.equal("1");
            });

            it("accepts a record up to the surplus and credits exactly that amount", async () => {
                await deposit(leg, 60); // surplus 20
                await record(leg, 20);
                expect((await escrowed(leg)).toString()).to.equal("120");
                const req = await queue.getRequest(2);
                expect(new BN(req.amount).toString()).to.equal("20");
            });
        });
    }
});
