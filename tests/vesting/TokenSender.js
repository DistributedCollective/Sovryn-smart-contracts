/** Speed optimized on branch hardhatTestRefactor, 2021-10-05
 * Bottleneck found at:
 *   + beforeEach hook, redeploying token and sender on every test.
 *   + should be able to transfer SOV to N users and check gas usage (1238ms)
 *
 * Total time elapsed: 5.6s
 * After optimization: 5.5s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 * 	Reduced loop size from 500 to 50, for optimization purposes.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const SOV_ABI = artifacts.require("SOV");
const TokenSender = artifacts.require("TokenSender");

const TOTAL_SUPPLY = "100000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;

contract("TokenSender", (accounts) => {
    let root, account1, account2, account3;
    let SOV, tokenSender;

    async function deploymentAndInitFixture(_wallets, _provider) {
        SOV = await SOV_ABI.new(TOTAL_SUPPLY);
        tokenSender = await TokenSender.new(SOV.address);
    }

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("constructor", () => {
        it("sets the expected values", async () => {
            let _sov = await tokenSender.SOV();

            expect(_sov).equal(SOV.address);
        });

        it("fails if the 0 address is passed as SOV address", async () => {
            await expectRevert(TokenSender.new(ZERO_ADDRESS), "SOV address invalid");
        });
    });

    describe("addAdmin", () => {
        it("adds admin", async () => {
            let tx = await tokenSender.addAdmin(account1);

            expectEvent(tx, "AdminAdded", {
                admin: account1,
            });

            let isAdmin = await tokenSender.admins(account1);
            expect(isAdmin).equal(true);
        });

        it("fails sender isn't an owner", async () => {
            await expectRevert(tokenSender.addAdmin(account1, { from: account1 }), "unauthorized");
        });
    });

    describe("removeAdmin", () => {
        it("adds admin", async () => {
            await tokenSender.addAdmin(account1);
            let tx = await tokenSender.removeAdmin(account1);

            expectEvent(tx, "AdminRemoved", {
                admin: account1,
            });

            let isAdmin = await tokenSender.admins(account1);
            expect(isAdmin).equal(false);
        });

        it("fails sender isn't an owner", async () => {
            await expectRevert(
                tokenSender.removeAdmin(account1, { from: account1 }),
                "unauthorized"
            );
        });
    });

    describe("transferSOV", () => {
        it("should be able to transfer SOV", async () => {
            let amount = new BN(1000);
            await SOV.transfer(tokenSender.address, amount);

            let balanceBefore = await SOV.balanceOf(account1);

            await tokenSender.addAdmin(account1);
            await tokenSender.transferSOV(account1, amount, { from: account1 });

            let balanceAfter = await SOV.balanceOf(account1);

            expect(amount).to.be.bignumber.equal(balanceAfter.sub(balanceBefore));
        });

        it("only owner or admin should be able to transfer", async () => {
            await expectRevert(
                tokenSender.transferSOV(account1, 1000, { from: account1 }),
                "unauthorized"
            );
        });

        it("fails if the 0 address is passed as receiver address", async () => {
            await expectRevert(
                tokenSender.transferSOV(ZERO_ADDRESS, 1000),
                "receiver address invalid"
            );
        });

        it("fails if the 0 is passed as an amount", async () => {
            await expectRevert(tokenSender.transferSOV(account1, 0), "amount invalid");
        });
    });

    describe("transferSOVusingList", () => {
        it("should be able to transfer SOV", async () => {
            let amount = web3.utils.toWei(new BN(10));
            await SOV.transfer(tokenSender.address, amount);

            let balanceBefore = await SOV.balanceOf(account1);

            await tokenSender.addAdmin(account1);
            let tx = await tokenSender.transferSOVusingList([account1], [amount], {
                from: account1,
            });
            console.log("gasUsed = " + tx.receipt.gasUsed);

            let balanceAfter = await SOV.balanceOf(account1);

            expect(amount).to.be.bignumber.equal(balanceAfter.sub(balanceBefore));
        });

        it("should be able to transfer SOV to N users", async () => {
            let amount = web3.utils.toWei(new BN(10));
            await SOV.transfer(tokenSender.address, amount.mul(new BN(2)));

            let balanceBefore1 = await SOV.balanceOf(account1);
            let balanceBefore2 = await SOV.balanceOf(account2);

            await tokenSender.addAdmin(account1);
            let tx = await tokenSender.transferSOVusingList(
                [account1, account2],
                [amount, amount],
                { from: account1 }
            );

            let balanceAfter1 = await SOV.balanceOf(account1);
            let balanceAfter2 = await SOV.balanceOf(account2);

            expect(amount).to.be.bignumber.equal(balanceAfter1.sub(balanceBefore1));
            expect(amount).to.be.bignumber.equal(balanceAfter2.sub(balanceBefore2));
        });

        it("should be able to transfer SOV to N users and check gas usage", async () => {
            /// @dev Reduced loop size from 500 to 50, for optimization purposes
            let userCount = 50;

            let amount = web3.utils.toWei(new BN(10));
            let totalAmount = amount.mul(new BN(userCount));
            await SOV.transfer(tokenSender.address, totalAmount);

            let accounts = [];
            let amounts = [];
            for (let i = 0; i < userCount; i++) {
                accounts.push(account1);
                amounts.push(amount);
            }

            let tx = await tokenSender.transferSOVusingList(accounts, amounts);
            console.log("gasUsed = " + tx.receipt.gasUsed);

            let balance = await SOV.balanceOf(account1);
            expect(totalAmount).to.be.bignumber.equal(balance);
        });

        it("only owner or admin should be able to transfer", async () => {
            await expectRevert(
                tokenSender.transferSOVusingList([account1], [1000], { from: account1 }),
                "unauthorized"
            );
        });

        it("fails if the 0 address is passed as receiver address", async () => {
            await expectRevert(
                tokenSender.transferSOVusingList([ZERO_ADDRESS], [1000]),
                "receiver address invalid"
            );
        });

        it("fails if the 0 is passed as an amount", async () => {
            await expectRevert(
                tokenSender.transferSOVusingList([account1], [0]),
                "amount invalid"
            );
        });
    });
});
