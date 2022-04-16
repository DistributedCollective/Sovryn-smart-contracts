const { expect } = require("chai");
const BigNumber = require("bignumber.js");
const {
    expectRevert,
    expectEvent,
    constants,
    BN,
    balance,
    time,
} = require("@openzeppelin/test-helpers");

const Timelock = artifacts.require("TimelockHarness");

const {
    encodeParameters,
    etherUnsigned,
    setTime,
    keccak256,
    setNextBlockTimestamp,
    increaseTime,
} = require("./Utils/Ethereum");

const oneWeekInSeconds = etherUnsigned(7 * 24 * 60 * 60);
const zero = etherUnsigned(0);
const gracePeriod = oneWeekInSeconds.multipliedBy(2);

contract("Timelock", (accounts) => {
    let root, notAdmin, newAdmin;
    let blockTimestamp;
    let timelock;
    let delay = oneWeekInSeconds;
    let newDelay = delay.multipliedBy(2);
    let target;
    let value = zero;
    let signature = "setDelay(uint256)";
    let data = encodeParameters(["uint256"], [newDelay.toFixed()]);
    let revertData = encodeParameters(["uint256"], [etherUnsigned(60 * 60).toFixed()]);
    let eta;
    let queuedTxHash;

    beforeEach(async () => {
        [root, notAdmin, newAdmin] = accounts;
        timelock = await Timelock.new(root, delay);

        blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
        target = timelock.address;
        eta = blockTimestamp.plus(delay);

        queuedTxHash = keccak256(
            encodeParameters(
                ["address", "uint256", "string", "bytes", "uint256"],
                [target, value.toString(), signature, data, eta.toString()]
            )
        );
    });

    describe("constructor", () => {
        it("sets address of admin", async () => {
            let configuredAdmin = await timelock.admin.call();
            expect(configuredAdmin).to.be.equal(root);
        });

        it("sets delay", async () => {
            let configuredDelay = await timelock.delay.call();
            expect(configuredDelay).to.be.bignumber.equal(delay.toString());
        });
    });

    describe("setDelay", () => {
        it("requires msg.sender to be Timelock", async () => {
            await expectRevert(
                timelock.setDelay(delay, { from: root }),
                "Timelock::setDelay: Call must come from Timelock."
            );
        });
    });

    describe("setPendingAdmin", () => {
        it("requires msg.sender to be Timelock", async () => {
            await expectRevert(
                timelock.setPendingAdmin(newAdmin, { from: root }),
                "Timelock::setPendingAdmin: Call must come from Timelock."
            );
        });
    });

    describe("acceptAdmin", () => {
        afterEach(async () => {
            await timelock.harnessSetAdmin(root, { from: root });
        });

        it("requires msg.sender to be pendingAdmin", async () => {
            await expectRevert(
                timelock.acceptAdmin({ from: notAdmin }),
                "Timelock::acceptAdmin: Call must come from pendingAdmin."
            );
        });

        it("sets pendingAdmin to address 0 and changes admin", async () => {
            await timelock.harnessSetPendingAdmin(newAdmin, { from: root });
            const pendingAdminBefore = await timelock.pendingAdmin.call();
            expect(pendingAdminBefore).to.be.equal(newAdmin);

            const result = await timelock.acceptAdmin({ from: newAdmin });
            const pendingAdminAfter = await timelock.pendingAdmin.call();
            expect(pendingAdminAfter).to.be.equal("0x0000000000000000000000000000000000000000");

            const timelockAdmin = await timelock.admin.call();
            expect(timelockAdmin).to.be.equal(newAdmin);

            expectEvent(result, "NewAdmin", { newAdmin: newAdmin });
        });
    });

    describe("queueTransaction", () => {
        beforeEach(async () => {
            const configuredDelay = await timelock.delay.call();
            delay = etherUnsigned(configuredDelay);

            blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
            setNextBlockTimestamp(blockTimestamp.plus(100).toNumber());
            eta = blockTimestamp.plus(delay).plus(100);

            queuedTxHash = keccak256(
                encodeParameters(
                    ["address", "uint256", "string", "bytes", "uint256"],
                    [target, value.toString(), signature, data, eta.toString()]
                )
            );
        });

        it("requires admin to be msg.sender", async () => {
            await expectRevert(
                timelock.queueTransaction(target, value, signature, data, eta, { from: notAdmin }),
                "Timelock::queueTransaction: Call must come from admin."
            );
        });

        it("requires eta to exceed delay", async () => {
            const etaLessThanDelay = blockTimestamp.plus(delay).minus(1);

            await expectRevert(
                timelock.queueTransaction(target, value, signature, data, etaLessThanDelay, {
                    from: root,
                }),
                "Timelock::queueTransaction: Estimated execution block must satisfy delay."
            );
        });

        it("sets hash as true in queuedTransactions mapping", async () => {
            const queueTransactionsHashValueBefore = await timelock.queuedTransactions.call(
                queuedTxHash
            );
            expect(queueTransactionsHashValueBefore).to.be.equal(false);

            await timelock.queueTransaction(target, value, signature, data, eta, { from: root });

            const queueTransactionsHashValueAfter = await timelock.queuedTransactions.call(
                queuedTxHash
            );
            expect(queueTransactionsHashValueAfter).to.be.equal(true);
        });

        it("should emit QueueTransaction event", async () => {
            const result = await timelock.queueTransaction(target, value, signature, data, eta, {
                from: root,
            });

            expectEvent(result, "QueueTransaction", {
                data: data,
                signature: signature,
                target: target,
                eta: eta.toString(),
                txHash: queuedTxHash,
                value: value.toString(),
            });
        });
    });

    describe("cancelTransaction", () => {
        beforeEach(async () => {
            const configuredDelay = await timelock.delay.call();
            delay = etherUnsigned(configuredDelay);
            blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
            setNextBlockTimestamp(blockTimestamp.plus(100).toNumber());
            eta = blockTimestamp.plus(delay).plus(100);
            queuedTxHash = keccak256(
                encodeParameters(
                    ["address", "uint256", "string", "bytes", "uint256"],
                    [target, value.toString(), signature, data, eta.toString()]
                )
            );
            await timelock.queueTransaction(target, value, signature, data, eta, { from: root });
        });

        it("requires admin to be msg.sender", async () => {
            await expectRevert(
                timelock.cancelTransaction(target, value, signature, data, eta, {
                    from: notAdmin,
                }),
                "Timelock::cancelTransaction: Call must come from admin."
            );
        });

        it("sets hash from true to false in queuedTransactions mapping", async () => {
            const queueTransactionsHashValueBefore = await timelock.queuedTransactions.call(
                queuedTxHash
            );
            expect(queueTransactionsHashValueBefore).to.be.equal(true);

            await timelock.cancelTransaction(target, value, signature, data, eta, { from: root });

            const queueTransactionsHashValueAfter = await timelock.queuedTransactions.call(
                queuedTxHash
            );
            expect(queueTransactionsHashValueAfter).to.be.equal(false);
        });

        it("should emit CancelTransaction event", async () => {
            const result = await timelock.cancelTransaction(target, value, signature, data, eta, {
                from: root,
            });

            expectEvent(result, "CancelTransaction", {
                data: data,
                signature: signature,
                target: target,
                eta: eta.toString(),
                txHash: queuedTxHash,
                value: value.toString(),
            });
        });
    });

    describe("queue and cancel empty", () => {
        beforeEach(async () => {
            const configuredDelay = await timelock.delay.call();
            delay = etherUnsigned(configuredDelay);
            blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
            setNextBlockTimestamp(blockTimestamp.plus(100).toNumber());
            eta = blockTimestamp.plus(delay).plus(100);
        });

        it("can queue and cancel an empty signature and data", async () => {
            const txHash = keccak256(
                encodeParameters(
                    ["address", "uint256", "string", "bytes", "uint256"],
                    [target, value.toString(), "", "0x", eta.toString()]
                )
            );
            expect(await timelock.queuedTransactions.call(txHash)).to.be.equal(false);
            await timelock.queueTransaction(target, value, "", "0x", eta, { from: root });
            expect(await timelock.queuedTransactions.call(txHash)).to.be.equal(true);
            await timelock.cancelTransaction(target, value, "", "0x", eta, { from: root });
            expect(await timelock.queuedTransactions(txHash)).to.be.equal(false);
        });
    });

    describe("executeTransaction (setDelay)", () => {
        beforeEach(async () => {
            const configuredDelay = await timelock.delay.call();
            delay = etherUnsigned(configuredDelay);
            blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);

            setNextBlockTimestamp(blockTimestamp.plus(100).toNumber());
            eta = blockTimestamp.plus(delay).plus(100);

            // Queue transaction that will succeed
            await timelock.queueTransaction(target, value, signature, data, eta, {
                from: root,
            });

            blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
            queuedTxHash = keccak256(
                encodeParameters(
                    ["address", "uint256", "string", "bytes", "uint256"],
                    [target, value.toString(), signature, data, eta.toString()]
                )
            );
        });

        it("requires admin to be msg.sender", async () => {
            await expectRevert(
                timelock.executeTransaction(target, value, signature, data, eta, {
                    from: notAdmin,
                }),
                "Timelock::executeTransaction: Call must come from admin."
            );
        });

        it("requires transaction to be queued", async () => {
            const differentEta = eta.plus(1);
            await expectRevert(
                timelock.executeTransaction(target, value, signature, data, differentEta, {
                    from: root,
                }),
                "Timelock::executeTransaction: Transaction hasn't been queued."
            );
        });

        it("requires timestamp to be greater than or equal to eta", async () => {
            await expectRevert(
                timelock.executeTransaction(target, value, signature, data, eta, { from: root }),
                "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
            );
        });

        it("requires timestamp to be less than eta plus gracePeriod", async () => {
            await setNextBlockTimestamp(
                blockTimestamp.plus(delay).plus(gracePeriod).plus(1).toNumber()
            );
            await expectRevert(
                timelock.executeTransaction(target, value, signature, data, eta, { from: root }),
                "Timelock::executeTransaction: Transaction is stale."
            );
        });

        it("requires target.call transaction to succeed", async () => {
            setNextBlockTimestamp(blockTimestamp.plus(100).toNumber());
            eta = blockTimestamp.plus(delay).plus(100);
            await timelock.queueTransaction(target, value, signature, revertData, eta, {
                from: root,
            });

            //await setTime(eta.toNumber());
            //blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
            setNextBlockTimestamp(eta.toNumber());
            //eta = blockTimestamp.plus(delay).plus(100);
            await expectRevert(
                timelock.executeTransaction(target, value, signature, revertData, eta, {
                    from: root,
                }),
                "Timelock::executeTransaction: Timelock::setDelay: Delay must exceed minimum delay."
            );
        });

        it("sets hash from true to false in queuedTransactions mapping, updates delay, and emits ExecuteTransaction event", async () => {
            const configuredDelayBefore = await timelock.delay.call();
            expect(configuredDelayBefore.toString()).to.be.equal(delay.toString());

            const queueTransactionsHashValueBefore = await timelock.queuedTransactions.call(
                queuedTxHash
            );
            expect(queueTransactionsHashValueBefore).to.be.equal(true);

            const newBlockTimestamp = blockTimestamp.plus(delay).plus(1);

            //await setTime(newBlockTimestamp.toNumber());
            await time.increaseTo(newBlockTimestamp.toNumber());

            const result = await timelock.executeTransaction(target, value, signature, data, eta, {
                from: root,
            });

            const queueTransactionsHashValueAfter = await timelock.queuedTransactions.call(
                queuedTxHash
            );
            expect(queueTransactionsHashValueAfter).to.be.equal(false);

            const configuredDelayAfter = await timelock.delay.call();
            expect(configuredDelayAfter.toString()).to.be.equal(newDelay.toString());

            expectEvent(result, "ExecuteTransaction", {
                data: data,
                signature: signature,
                target: target,
                eta: eta.toString(),
                txHash: queuedTxHash,
                value: value.toString(),
            });

            expectEvent(result, "NewDelay", {
                newDelay: newDelay.toString(),
            });
        });
    });

    describe("executeTransaction (setPendingAdmin)", () => {
        beforeEach(async () => {
            const configuredDelay = await timelock.delay.call();
            delay = etherUnsigned(configuredDelay);
            signature = "setPendingAdmin(address)";
            data = encodeParameters(["address"], [newAdmin]);
            //blockTimestamp = etherUnsigned(100);
            //await setTime(blockTimestamp.toNumber());
            blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
            setNextBlockTimestamp(blockTimestamp.plus(100).toNumber());
            eta = blockTimestamp.plus(delay).plus(100);

            queuedTxHash = keccak256(
                encodeParameters(
                    ["address", "uint256", "string", "bytes", "uint256"],
                    [target, value.toString(), signature, data, eta.toString()]
                )
            );

            await timelock.queueTransaction(target, value, signature, data, eta, {
                from: root,
            });

            blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
        });

        it("requires admin to be msg.sender", async () => {
            await expectRevert(
                timelock.executeTransaction(target, value, signature, data, eta, {
                    from: notAdmin,
                }),
                "Timelock::executeTransaction: Call must come from admin."
            );
        });

        it("requires transaction to be queued", async () => {
            const differentEta = eta.plus(1);
            await expectRevert(
                timelock.executeTransaction(target, value, signature, data, differentEta, {
                    from: root,
                }),
                "Timelock::executeTransaction: Transaction hasn't been queued."
            );
        });

        it("requires timestamp to be greater than or equal to eta", async () => {
            await expectRevert(
                timelock.executeTransaction(target, value, signature, data, eta, { from: root }),
                "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
            );
        });

        it("requires timestamp to be less than eta plus gracePeriod", async () => {
            //await setTime(blockTimestamp.plus(delay).plus(gracePeriod).plus(1).toNumber());
            //await mineBlock();
            //blockTimestamp = new BigNumber((await ethers.provider.getBlock("latest")).timestamp);
            //blockTimestamp = new BigNumber(await time.latest());
            //eta = blockTimestamp.plus(delay);
            await setNextBlockTimestamp(
                blockTimestamp.plus(delay).plus(gracePeriod).plus(1).toNumber()
            );

            await expectRevert(
                timelock.executeTransaction(target, value, signature, data, eta, { from: root }),
                "Timelock::executeTransaction: Transaction is stale."
            );
        });

        it("sets hash from true to false in queuedTransactions mapping, updates admin, and emits ExecuteTransaction event", async () => {
            const configuredPendingAdminBefore = await timelock.pendingAdmin.call();
            expect(configuredPendingAdminBefore).to.be.equal(
                "0x0000000000000000000000000000000000000000"
            );

            const queueTransactionsHashValueBefore = await timelock.queuedTransactions.call(
                queuedTxHash
            );
            expect(queueTransactionsHashValueBefore).to.be.equal(true);

            const newBlockTimestamp = blockTimestamp.plus(delay).plus(1);
            //await setTime(newBlockTimestamp.toNumber());

            //await time.advanceBlock();
            //blockTimestamp = new BigNumber(await time.latest());
            //eta = blockTimestamp.plus(delay);
            //await setNextBlockTimestamp(blockTimestamp.plus(delay).plus(gracePeriod).plus(1).toNumber());
            await time.increaseTo(newBlockTimestamp.toNumber());

            const result = await timelock.executeTransaction(target, value, signature, data, eta, {
                from: root,
            });

            const queueTransactionsHashValueAfter = await timelock.queuedTransactions.call(
                queuedTxHash
            );
            expect(queueTransactionsHashValueAfter).to.be.equal(false);

            const configuredPendingAdminAfter = await timelock.pendingAdmin.call();
            expect(configuredPendingAdminAfter).to.be.equal(newAdmin);

            expectEvent(result, "ExecuteTransaction", {
                data: data,
                signature: signature,
                target: target,
                eta: eta.toString(),
                txHash: queuedTxHash,
                value: value.toString(),
            });

            expectEvent(result, "NewPendingAdmin", {
                newPendingAdmin: newAdmin,
            });
        });
    });
});
