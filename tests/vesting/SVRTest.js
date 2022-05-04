/** Speed optimized on branch hardhatTestRefactor, 2021-10-05
 * Bottleneck found at beforeEach hook, redeploying tokens and staking on every test.
 *
 * Total time elapsed: 5.1s
 * After optimization: 4.6s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, expectEvent, constants, BN } = require("@openzeppelin/test-helpers");

const StakingLogic = artifacts.require("StakingMockup");
const StakingProxy = artifacts.require("StakingProxy");
const SOV = artifacts.require("SOV");
const SVR = artifacts.require("SVR");

const TOTAL_SUPPLY = "10000000000000000000000000";
const ZERO_ADDRESS = constants.ZERO_ADDRESS;
const ZERO = new BN(0);

const NAME = "Sovryn Vesting Reward Token";
const SYMBOL = "SVR";
const DECIMALS = 18;

const WEEK = new BN(7 * 24 * 60 * 60);

contract("SVR:", (accounts) => {
    let root, account1, account2, account3;
    let tokenSOV, tokenSVR, staking;

    async function deploymentAndInitFixture(_wallets, _provider) {
        tokenSOV = await SOV.new(TOTAL_SUPPLY);

        let stakingLogic = await StakingLogic.new(tokenSOV.address);
        staking = await StakingProxy.new(tokenSOV.address);
        await staking.setImplementation(stakingLogic.address);
        staking = await StakingLogic.at(staking.address);

        tokenSVR = await SVR.new(tokenSOV.address, staking.address);
    }

    before(async () => {
        [root, account1, account2, account3, ...accounts] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("constructor:", () => {
        it("sets the expected values", async () => {
            let tokenTemp = await SVR.new(tokenSOV.address, staking.address);

            expect(await tokenTemp.name.call()).to.be.equal(NAME);
            expect(await tokenTemp.symbol.call()).to.be.equal(SYMBOL);
            expect(await tokenTemp.decimals.call()).to.be.bignumber.equal(new BN(DECIMALS));

            expect(await tokenTemp.SOV.call()).to.be.equal(tokenSOV.address);
            expect(await tokenTemp.staking.call()).to.be.equal(staking.address);
        });

        it("fails if SOV address is zero", async () => {
            await expectRevert(SVR.new(ZERO_ADDRESS, staking.address), "SVR::SOV address invalid");
        });

        it("fails if staking address is zero", async () => {
            await expectRevert(
                SVR.new(tokenSOV.address, ZERO_ADDRESS),
                "SVR::staking address invalid"
            );
        });
    });

    describe("mint:", () => {
        it("should be able to mint SVR tokens", async () => {
            let amount = new BN(1000);

            await tokenSOV.transfer(account1, amount);
            await tokenSOV.approve(tokenSVR.address, amount, { from: account1 });
            let tx = await tokenSVR.mint(amount, { from: account1 });

            expect(await tokenSOV.balanceOf.call(account1)).to.be.bignumber.equal(ZERO);
            expect(await tokenSVR.balanceOf.call(account1)).to.be.bignumber.equal(amount);
            expect(await tokenSOV.balanceOf.call(tokenSVR.address)).to.be.bignumber.equal(amount);

            expectEvent(tx, "Mint", {
                sender: account1,
                amount: "1000",
            });
        });

        it("fails if amount is zero", async () => {
            await expectRevert(tokenSVR.mint(0), "SVR::mint: amount invalid");
        });

        it("fails if transfer is not approved", async () => {
            await expectRevert(tokenSVR.mint(100), "ERC20: transfer amount exceeds allowance");
        });
    });

    describe("mintWithApproval:", () => {
        let amount = new BN(5000);

        it("should be able to mint SVR tokens", async () => {
            await tokenSOV.transfer(account1, amount);

            let contract = new web3.eth.Contract(tokenSVR.abi, tokenSVR.address);
            let sender = account1;
            let data = contract.methods.mintWithApproval(sender, amount).encodeABI();
            await tokenSOV.approveAndCall(tokenSVR.address, amount, data, { from: sender });

            expect(await tokenSOV.balanceOf.call(account1)).to.be.bignumber.equal(ZERO);
            expect(await tokenSVR.balanceOf.call(account1)).to.be.bignumber.equal(amount);
            expect(await tokenSOV.balanceOf.call(tokenSVR.address)).to.be.bignumber.equal(amount);
        });

        it("fails if invoked directly", async () => {
            await expectRevert(tokenSVR.mintWithApproval(account1, new BN(5000)), "unauthorized");
        });

        it("fails if pass wrong method in data", async () => {
            let contract = new web3.eth.Contract(tokenSVR.abi, tokenSVR.address);
            let data = contract.methods.mint(amount).encodeABI();

            await expectRevert(
                tokenSOV.approveAndCall(tokenSVR.address, amount, data, { from: account1 }),
                "method is not allowed"
            );
        });

        it("fails if pass wrong method params in data", async () => {
            let contract = new web3.eth.Contract(tokenSVR.abi, tokenSVR.address);
            let data = contract.methods.mintWithApproval(account1, new BN(0)).encodeABI();

            await expectRevert(
                tokenSOV.approveAndCall(tokenSVR.address, amount, data, { from: account1 }),
                "amount mismatch"
            );
        });
    });

    describe("receiveApproval:", () => {
        it("fails if invoked directly", async () => {
            let amount = new BN(5000);
            let contract = new web3.eth.Contract(tokenSVR.abi, tokenSVR.address);
            let data = contract.methods.mintWithApproval(account1, amount).encodeABI();
            await expectRevert(
                tokenSVR.receiveApproval(account1, amount, tokenSOV.address, data),
                "unauthorized"
            );
        });
    });

    describe("burn:", () => {
        it("should be able to burn SVR tokens and stake for 13 positions", async () => {
            let initialAmount = 1000;
            let amount = initialAmount;

            await tokenSOV.transfer(account1, amount);
            await tokenSOV.approve(tokenSVR.address, amount, { from: account1 });
            await tokenSVR.mint(amount, { from: account1 });

            let tx = await tokenSVR.burn(amount, { from: account1 });

            let block = await web3.eth.getBlock("latest");
            let timestamp = block.timestamp;

            let start = timestamp + 4 * WEEK;
            let end = timestamp + 52 * WEEK;

            let transferAmount = Math.floor(amount / 14);
            amount -= transferAmount;

            let numIntervals = Math.floor((end - start) / (4 * WEEK)) + 1;
            let stakedPerInterval = Math.floor(amount / numIntervals);
            let stakeForFirstInterval = amount - stakedPerInterval * (numIntervals - 1);

            for (let i = start; i <= end; i += 4 * WEEK) {
                let lockedTS = await staking.timestampToLockDate(i);
                let userStakingCheckpoints = await staking.userStakingCheckpoints(
                    account1,
                    lockedTS,
                    0
                );

                expect(userStakingCheckpoints.fromBlock).to.be.bignumber.equal(
                    new BN(block.number)
                );
                if (i === start) {
                    expect(userStakingCheckpoints.stake).to.be.bignumber.equal(
                        new BN(stakeForFirstInterval)
                    );
                } else {
                    expect(userStakingCheckpoints.stake).to.be.bignumber.equal(
                        new BN(stakedPerInterval)
                    );
                }

                let numUserStakingCheckpoints = await staking.numUserStakingCheckpoints(
                    account1,
                    lockedTS
                );
                expect(numUserStakingCheckpoints).to.be.bignumber.equal(new BN(1));
            }

            expect(await tokenSVR.balanceOf.call(account1)).to.be.bignumber.equal(ZERO);
            expect(await tokenSOV.balanceOf.call(account1)).to.be.bignumber.equal(
                new BN(transferAmount)
            );
            expect(await tokenSOV.balanceOf.call(staking.address)).to.be.bignumber.equal(
                new BN(amount)
            );
            expect(transferAmount + amount).to.be.equal(initialAmount);

            expectEvent(tx, "Burn", {
                sender: account1,
                amount: new BN(amount),
            });
        });

        it("fails if amount is zero", async () => {
            await expectRevert(tokenSVR.burn(0), "SVR:: burn: amount invalid");
        });
    });
});
