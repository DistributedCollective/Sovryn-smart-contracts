/** Speed optimized on branch hardhatTestRefactor, 2021-09-24
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, and calling initialize_test_transfer() on every test.
 *
 * Total time elapsed: 7.4s
 * After optimization: 5.1s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expectRevert, BN, expectEvent } = require("@openzeppelin/test-helpers");
const StakingProxy = artifacts.require("StakingProxy");
const FeeSharingCollector = artifacts.require("FeeSharingCollector");
const FeeSharingCollectorProxy = artifacts.require("FeeSharingCollectorProxy");
const Vesting = artifacts.require("TeamVesting");
const VestingLogic = artifacts.require("VestingLogicMockup");
const TestToken = artifacts.require("TestToken");
const mutexUtils = require("../reentrancy/utils");

const {
    getSUSD,
    getRBTC,
    getWRBTC,
    getBZRX,
    getLoanTokenLogic,
    getLoanToken,
    getLoanTokenWRBTC,
    loan_pool_setup,
    getPriceFeeds,
    getSovryn,
    CONSTANTS,
    getStakingModulesObject,
    deployAndGetIStaking,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const hunEth = new BN(wei("100", "ether"));

const initialize_test_transfer = async (SUSD, accounts, _loan_token) => {
    const sender = accounts[0];
    const receiver = accounts[1];
    const amount_to_buy = hunEth;
    await SUSD.approve(_loan_token.address, amount_to_buy);
    await _loan_token.mint(sender, amount_to_buy);
    const sender_initial_balance = await _loan_token.balanceOf(sender);
    const amount_sent = sender_initial_balance.div(new BN(2));

    return { amount_sent, receiver, sender };
};

contract("LoanTokenFunctionality", (accounts) => {
    let owner;
    let sovryn, SUSD, WRBTC, RBTC, BZRX, SOVToken, loanToken, loanTokenWRBTC;
    let amount_sent, receiver, sender;

    async function deploymentAndInitFixture(_wallets, _provider) {
        // Need to deploy the mutex in the initialization. Otherwise, the global reentrancy prevention will not be working & throw an error.
        await mutexUtils.getOrDeployMutex();

        SUSD = await getSUSD();
        RBTC = await getRBTC();
        WRBTC = await getWRBTC();
        BZRX = await getBZRX();

        SOVToken = await TestToken.new("SOV", "SOV", 18, hunEth);

        const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

        sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

        loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
        loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
        await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

        let r = await initialize_test_transfer(SUSD, accounts, loanToken);
        amount_sent = r.amount_sent;
        receiver = r.receiver;
        sender = r.sender;
    }

    before(async () => {
        [owner] = accounts;
    });

    beforeEach(async () => {
        await loadFixture(deploymentAndInitFixture);
    });

    describe("Test token transfer functionality of the loan token contract", () => {
        it("Test transfer", async () => {
            const tx = await loanToken.transfer(receiver, amount_sent.toString());
            expect((await loanToken.balanceOf(sender)).eq(amount_sent)).to.be.true;
            expect((await loanToken.balanceOf(receiver)).eq(amount_sent)).to.be.true;
            expect((await loanToken.checkpointPrice(sender)).eq(await loanToken.initialPrice())).to
                .be.true;
            expect((await loanToken.checkpointPrice(receiver)).eq(await loanToken.initialPrice()))
                .to.be.true;

            expectEvent(tx, "Transfer", {
                from: sender,
                to: receiver,
                value: amount_sent.toString(),
            });
        });

        it("Test transfer with insufficient balance", async () => {
            expectRevert(
                loanToken.transfer(sender, amount_sent.toString(), { from: receiver }),
                "16"
            );
        });

        it("Test transfer to zero account should fail", async () => {
            expectRevert(loanToken.transfer(CONSTANTS.ZERO_ADDRESS, amount_sent.toString()), "15");
        });

        it("Test transfer to self", async () => {
            const initial_balance = await loanToken.balanceOf(sender);
            // transfer the tokens to the sender
            await loanToken.transfer(sender, amount_sent);
            expect((await loanToken.balanceOf(sender)).eq(initial_balance)).to.be.true;
        });

        it("should transfer to tokenOwner if passed recipient is vesting contract that has tokenOwner() selector", async () => {
            const vestingLogic = await VestingLogic.new();
            // Creating the Staking Instance (Staking Modules Interface).
            const stakingProxy = await StakingProxy.new(SOVToken.address);
            const modulesObject = await getStakingModulesObject();
            const staking = await deployAndGetIStaking(stakingProxy.address, modulesObject);
            const tokenOwner = accounts[3];
            const cliff = new BN(24 * 60 * 60).mul(new BN(1092));

            const feeSharingCollectorLogic = await FeeSharingCollector.new();
            const feeSharingCollectorProxyObj = await FeeSharingCollectorProxy.new(
                sovryn.address,
                staking.address
            );
            await feeSharingCollectorProxyObj.setImplementation(feeSharingCollectorLogic.address);
            const feeSharingCollector = await FeeSharingCollector.at(
                feeSharingCollectorProxyObj.address
            );

            await loanToken.setStakingContractAddress(staking.address);
            expect(await loanToken.getStakingContractAddress()).to.equal(staking.address);

            let vestingInstance = await Vesting.new(
                vestingLogic.address,
                SOVToken.address,
                staking.address,
                tokenOwner,
                cliff,
                cliff,
                feeSharingCollector.address
            );

            vestingInstance = await VestingLogic.at(vestingInstance.address);
            // important, so it's recognized as vesting contract
            await staking.addContractCodeHash(vestingInstance.address);

            const previousTokenOwnerBalance = await loanToken.balanceOf(tokenOwner);
            const previousVestingContractBalance = await loanToken.balanceOf(
                vestingInstance.address
            );

            // transfer the tokens to the vesting contract address
            await loanToken.transfer(vestingInstance.address, amount_sent);

            const latestTokenOwnerBalance = await loanToken.balanceOf(tokenOwner);
            const latestVestingContractBalance = await loanToken.balanceOf(
                vestingInstance.address
            );

            /** Token owner of the contract should receive the amount */
            expect(previousTokenOwnerBalance.add(amount_sent).toString()).to.equal(
                latestTokenOwnerBalance.toString()
            );

            /** Vesting contract should not receive the amount */
            expect(
                previousVestingContractBalance.add(latestVestingContractBalance).toString()
            ).to.equal("0");
        });

        it("should transfer to the passed recipient if passed recipient is EOA / Contract that has no tokenOwner() function", async () => {
            // Creating the Staking Instance (Staking Modules Interface).
            const stakingProxy = await StakingProxy.new(SOVToken.address);
            const modulesObject = await getStakingModulesObject();
            const staking = await deployAndGetIStaking(stakingProxy.address, modulesObject);

            await loanToken.setStakingContractAddress(staking.address);
            expect(await loanToken.getStakingContractAddress()).to.equal(staking.address);

            // we register the contract that has no tokenOwner function
            const dummyContractAddress = stakingProxy.address;
            await staking.addContractCodeHash(dummyContractAddress);

            const previousDummyContractBalance = await loanToken.balanceOf(dummyContractAddress);

            // transfer the tokens to the contract that has no tokenOwner function
            await loanToken.transfer(dummyContractAddress, amount_sent);
            const latestDummyContractBalance = await loanToken.balanceOf(dummyContractAddress);

            /** The dummy contract should receive the token */
            expect(previousDummyContractBalance.add(amount_sent).toString()).to.equal(
                latestDummyContractBalance.toString()
            );
        });

        it("should transfer to the passed recipient if the passed recipient is not vesting contract", async () => {
            const vestingLogic = await VestingLogic.new();
            // Creating the Staking Instance (Staking Modules Interface).
            const stakingProxy = await StakingProxy.new(SOVToken.address);
            const modulesObject = await getStakingModulesObject();
            const staking = await deployAndGetIStaking(stakingProxy.address, modulesObject);
            const tokenOwner = accounts[3];
            const passedRecipient = accounts[2];
            const cliff = new BN(24 * 60 * 60).mul(new BN(1092));

            const feeSharingCollectorLogic = await FeeSharingCollector.new();
            const feeSharingCollectorProxyObj = await FeeSharingCollectorProxy.new(
                sovryn.address,
                staking.address
            );
            await feeSharingCollectorProxyObj.setImplementation(feeSharingCollectorLogic.address);
            const feeSharingCollector = await FeeSharingCollector.at(
                feeSharingCollectorProxyObj.address
            );

            await loanToken.setStakingContractAddress(staking.address);
            expect(await loanToken.getStakingContractAddress()).to.equal(staking.address);

            let vestingInstance = await Vesting.new(
                vestingLogic.address,
                SOVToken.address,
                staking.address,
                tokenOwner,
                cliff,
                cliff,
                feeSharingCollector.address
            );

            vestingInstance = await VestingLogic.at(vestingInstance.address);
            // important, so it's recognized as vesting contract
            await staking.addContractCodeHash(vestingInstance.address);

            const previousTokenOwnerBalance = await loanToken.balanceOf(tokenOwner);
            const previousPassedRecipientBalance = await loanToken.balanceOf(passedRecipient);
            // transfer the tokens to the non-vesting contract address
            await loanToken.transfer(passedRecipient, amount_sent);

            const latestTokenOwnerBalance = await loanToken.balanceOf(tokenOwner);
            const latestPassedRecipientBalance = await loanToken.balanceOf(passedRecipient);

            expect(previousTokenOwnerBalance.add(latestTokenOwnerBalance).toString()).to.equal(
                "0"
            );

            /** The passed recipient should receive the amount */
            expect(previousPassedRecipientBalance.add(amount_sent).toString()).to.equal(
                latestPassedRecipientBalance.toString()
            );
        });

        it("Test transfer to from", async () => {
            await loanToken.approve(receiver, amount_sent);

            expect((await loanToken.allowance(sender, receiver)).eq(amount_sent)).to.be.true;

            let tx = await loanToken.transferFrom(sender, receiver, amount_sent, {
                from: receiver,
            });
            expect((await loanToken.balanceOf(sender)).eq(amount_sent)).to.be.true;
            expect((await loanToken.balanceOf(receiver)).eq(amount_sent)).to.be.true;

            // Expect the AllowanceUpdate event triggered at  TestToken::transferFrom
            expectEvent(tx, "AllowanceUpdate", {
                owner: sender,
                spender: receiver,
                valueBefore: amount_sent,
                valueAfter: new BN(0),
            });
        });
    });
});
