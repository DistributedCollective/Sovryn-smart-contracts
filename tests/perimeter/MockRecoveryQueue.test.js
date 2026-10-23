/**
 * `contracts/mockup/MockRecoveryQueue.sol` against the real `ExitDelayQueue`'s
 * `getActive(party, cursor, n)` paging: a page is cut to `MAX_GET_ACTIVE_PAGE`
 * before the cursor is added to it, so any cursor and any page size, however
 * large, read a page of the set or an empty one and never wrap. The mock is a
 * test double for this repository's own unit tests, so the only thing at
 * stake is whether a test built against it can trust the page it returns.
 *
 * Run:
 *   __decryptionAlreadyDone__=TRUE npx hardhat test tests/perimeter/MockRecoveryQueue.test.js
 */

const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

const MAX_UINT256 = ethers.constants.MaxUint256;
const SURFACE_ID = ethers.utils.id("PERIMETER_SURFACE_LENDING_LENDER_WITHDRAW");
const PAGE_CAP = 500;

// A distinct, deterministic address per index.
const addr = (i) => ethers.utils.getAddress(ethers.utils.hexZeroPad(ethers.utils.hexlify(i), 20));

describe("MockRecoveryQueue — getActive paging", () => {
    let queue;
    const party = addr(0xa11ce);

    // Lists request `id` as active for `party` only: the other two roles are
    // unique to the request.
    const hold = (id) =>
        queue.setRequest(
            id,
            party,
            addr(0x10000 + id),
            addr(0x20000 + id),
            SURFACE_ID,
            party,
            party,
            1
        );

    const idsOf = (page) => page.ids.map((id) => id.toNumber());

    describe("a set of three", () => {
        beforeEach(async () => {
            queue = await (await ethers.getContractFactory("MockRecoveryQueue")).deploy();
            await queue.deployed();
            for (const id of [1, 2, 3]) await hold(id);
        });

        it("reads a page from the start", async () => {
            const page = await queue.getActive(party, 0, 2);
            expect(idsOf(page)).to.deep.equal([1, 2]);
            expect(page.nextCursor.toNumber()).to.equal(2);
        });

        it("returns an empty page and the end marker for a cursor of 2^256 - 1", async () => {
            const page = await queue.getActive(party, MAX_UINT256, 5);
            expect(idsOf(page)).to.deep.equal([]);
            expect(page.nextCursor.toNumber()).to.equal(0);
        });

        it("returns an empty page and the end marker for a cursor past the end", async () => {
            const page = await queue.getActive(party, 3, 5);
            expect(idsOf(page)).to.deep.equal([]);
            expect(page.nextCursor.toNumber()).to.equal(0);
        });

        it("returns the rest of the set for a page size of 2^256 - 1 from a cursor where the sum would wrap", async () => {
            const page = await queue.getActive(party, 1, MAX_UINT256);
            expect(idsOf(page)).to.deep.equal([2, 3]);
            expect(page.nextCursor.toNumber()).to.equal(0);
        });

        it("returns the whole set for a page size of 2^256 - 1 from the start", async () => {
            const page = await queue.getActive(party, 0, MAX_UINT256);
            expect(idsOf(page)).to.deep.equal([1, 2, 3]);
            expect(page.nextCursor.toNumber()).to.equal(0);
        });

        it("returns an empty page for a page size of zero", async () => {
            const page = await queue.getActive(party, 0, 0);
            expect(idsOf(page)).to.deep.equal([]);
            expect(page.nextCursor.toNumber()).to.equal(0);
        });
    });

    describe("a set larger than the page cap", () => {
        before(async function () {
            this.timeout(300000);
            queue = await (await ethers.getContractFactory("MockRecoveryQueue")).deploy();
            await queue.deployed();
            for (let id = 1; id <= PAGE_CAP + 1; id++) await hold(id);
        });

        it("exposes the same cap as the real queue", async () => {
            expect((await queue.MAX_GET_ACTIVE_PAGE()).toNumber()).to.equal(PAGE_CAP);
        });

        it("cuts a page size of 2^256 - 1 to the cap and points at the next page", async () => {
            const page = await queue.getActive(party, 0, MAX_UINT256);
            expect(page.ids.length).to.equal(PAGE_CAP);
            expect(page.nextCursor.toNumber()).to.equal(PAGE_CAP);
        });

        it("reads the remainder from the cursor it returned", async () => {
            const page = await queue.getActive(party, PAGE_CAP, MAX_UINT256);
            expect(idsOf(page)).to.deep.equal([PAGE_CAP + 1]);
            expect(page.nextCursor.toNumber()).to.equal(0);
        });
    });
});
