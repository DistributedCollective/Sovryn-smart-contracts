/**
 * `ensureOperator`'s --second-owner behavior, isolated: a real
 * MultiSigWallet deployed on the default in-process hardhat network, no fork
 * and no --network flag needed. `forkOps.impersonate`/`setBalance` only ever
 * need a provider with `.send()`/`.getSigner()` — hardhat's own
 * `ethers.provider` already satisfies that, so this drives the exact same
 * code path bootstrapQa uses against a QA fork, just without one.
 *
 * Run:
 *   npx hardhat test tests-onchain/perimeter/qa/bootstrapEnsureOperator.test.js
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const { ensureOperator, bootstrapQa, TEST_KEY } = require("./bootstrap");

const deployMultisig = async (owners, required) => {
    const factory = await ethers.getContractFactory("MultiSigWallet");
    const multisig = await factory.deploy(owners, required);
    await multisig.deployed();
    return multisig;
};

describe("QA bootstrap — ensureOperator --second-owner", () => {
    let realOwner;
    let secondOwner;

    before(async () => {
        const signers = await ethers.getSigners();
        // Neither is TEST_KEY: ensureOperator must add it regardless of who
        // already owns the wallet.
        realOwner = signers[5].address;
        secondOwner = signers[6].address;
    });

    it("with no --second-owner: seats the test key and drops the requirement to 1", async () => {
        const multisig = await deployMultisig([realOwner], 1);
        const result = await ensureOperator(
            { ethers },
            ethers.provider,
            multisig,
            false,
            undefined
        );
        expect(result.required).to.equal(1);
        expect(await multisig.isOwner(TEST_KEY.address)).to.be.true;
        expect(await multisig.isOwner(realOwner)).to.be.true;
        expect(await multisig.isOwner(secondOwner)).to.be.false;
    });

    it("--keep-threshold with no --second-owner: seats the test key, leaves the requirement alone", async () => {
        const multisig = await deployMultisig([realOwner, secondOwner], 2);
        const result = await ensureOperator(
            { ethers },
            ethers.provider,
            multisig,
            true,
            undefined
        );
        expect(result.required).to.equal(2);
        expect(await multisig.isOwner(TEST_KEY.address)).to.be.true;
    });

    it("--second-owner: seats both the test key and the second address, sets the requirement to 2", async () => {
        const multisig = await deployMultisig([realOwner], 1);
        const result = await ensureOperator(
            { ethers },
            ethers.provider,
            multisig,
            false,
            secondOwner
        );
        expect(result.required).to.equal(2);
        expect(await multisig.isOwner(TEST_KEY.address)).to.be.true;
        expect(await multisig.isOwner(secondOwner)).to.be.true;
        expect(await multisig.isOwner(realOwner)).to.be.true;
        expect(result.owners.map((a) => a.toLowerCase())).to.have.members(
            [realOwner, TEST_KEY.address, secondOwner].map((a) => a.toLowerCase())
        );
    });

    it("--second-owner: idempotent — a second run adds nothing and leaves the requirement at 2", async () => {
        const multisig = await deployMultisig([realOwner], 1);
        await ensureOperator({ ethers }, ethers.provider, multisig, false, secondOwner);
        const before = (await multisig.getOwners()).length;
        const result = await ensureOperator(
            { ethers },
            ethers.provider,
            multisig,
            false,
            secondOwner
        );
        expect(result.required).to.equal(2);
        expect((await multisig.getOwners()).length).to.equal(before);
    });

    it("--second-owner already seated as the real owner: still sets the requirement to 2", async () => {
        const multisig = await deployMultisig([realOwner, secondOwner], 1);
        const result = await ensureOperator(
            { ethers },
            ethers.provider,
            multisig,
            false,
            secondOwner
        );
        expect(result.required).to.equal(2);
        expect(await multisig.isOwner(TEST_KEY.address)).to.be.true;
    });
});

describe("QA bootstrap — bootstrapQa --second-owner input validation", () => {
    // Both guards throw before assertLocalQaFork ever runs (see bootstrap.js:
    // "refused before any fork read, the same shape --delay already uses"),
    // so these need no real network at all — a bare { ethers } stands in for
    // hre.
    const expectRejects = async (promise, pattern) => {
        let raised = null;
        try {
            await promise;
        } catch (error) {
            raised = error;
        }
        expect(raised, "expected an upfront refusal").to.not.equal(null);
        expect(raised.message).to.match(pattern);
    };

    it("refuses a --second-owner that is not an address", async () => {
        await expectRejects(
            bootstrapQa({ ethers }, { secondOwner: "not-an-address" }),
            /--second-owner must be an address/
        );
    });

    it("refuses --second-owner together with --keep-threshold", async () => {
        const [, , , someone] = await ethers.getSigners();
        await expectRejects(
            bootstrapQa({ ethers }, { secondOwner: someone.address, keepThreshold: true }),
            /--second-owner .* --keep-threshold .* pick one/
        );
    });
});
