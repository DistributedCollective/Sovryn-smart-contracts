/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 11.9s
 * After optimization: 5.6s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 *   Moved SOV mint to fixture.
 *   Unable to use the generic SOV from initializer.js because these tests
 *   require a particular simplified SOV token.
 */

const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const MultiSigWallet = artifacts.require("MultiSigWallet");

const ProtocolSettings = artifacts.require("ProtocolSettings");
const TestToken = artifacts.require("TestToken");

const sovrynProtocol = artifacts.require("sovrynProtocol");
const ISovryn = artifacts.require("ISovryn");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const SwapsExternal = artifacts.require("SwapsExternal");

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getPriceFeeds,
	decodeLogs,
	getSovryn,
	getLoanToken,
	getLoanTokenLogicWrbtc,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));

// Deploys the multisig wallet contract setting 3 owners and 2 required confirmations

const getMultisig = async (accounts) => {
	const requiredConf = 2;
	const owners = [accounts[0], accounts[1], accounts[2]];
	const multisig = await MultiSigWallet.new(owners, requiredConf);
	return multisig;
};

contract("ProtocolSettings", (accounts) => {
	let sovryn, SUSD, WRBTC, RBTC, BZRX, priceFeeds, multisig, sov;
	const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
	let lender, loanToken, loanTokenAddress;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);
		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		multisig = await getMultisig(accounts);
		await sovryn.transferOwnership(multisig.address);

		/// @dev A SOV mint useful for every test
		sov = await TestToken.new("Sovryn", "SOV", 18, new BN(10).pow(new BN(50)));
		await sov.transfer(multisig.address, new BN(10).pow(new BN(50)), { from: accounts[0] });

		/// @dev a loanToken required to test setting loan pools on the protocol
		loanToken = await getLoanToken(lender, sovryn, WRBTC, SUSD);
		loanTokenAddress = await loanToken.loanTokenAddress();
	}

	before(async () => {
		[lender] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("ProtocolSettings Tests", () => {
		it("Test setCoreParams", async () => {
			const dest = sovryn.address;
			const val = 0;

			let data = sovryn.contract.methods.setPriceFeedContract(ONE_ADDRESS).encodeABI();
			let tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = sovryn.contract.methods.setSwapsImplContract(ONE_ADDRESS).encodeABI();
			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			expect((await sovryn.priceFeeds()) == ONE_ADDRESS).to.be.true;
			expect((await sovryn.swapsImpl()) == ONE_ADDRESS).to.be.true;
		});

		it("Test setLoanPool", async () => {
			expect((await sovryn.loanPoolToUnderlying(accounts[6])) == ZERO_ADDRESS).to.be.true;
			expect((await sovryn.underlyingToLoanPool(accounts[7])) == ZERO_ADDRESS).to.be.true;

			expect(await sovryn.isLoanPool(accounts[6])).to.be.false;
			expect(await sovryn.isLoanPool(accounts[8])).to.be.false;
			const dest = sovryn.address;
			let val = 0;
			let data = sovryn.contract.methods.setLoanPool([accounts[6], accounts[8]], [accounts[7], accounts[9]]).encodeABI();
			let tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			expect((await sovryn.loanPoolToUnderlying(accounts[6])) == accounts[7]).to.be.true;
			expect((await sovryn.underlyingToLoanPool(accounts[7])) == accounts[6]).to.be.true;

			expect((await sovryn.loanPoolToUnderlying(accounts[8])) == accounts[9]).to.be.true;
			expect((await sovryn.underlyingToLoanPool(accounts[9])) == accounts[8]).to.be.true;

			expect(await sovryn.isLoanPool(accounts[6])).to.be.true;
			expect(await sovryn.isLoanPool(accounts[8])).to.be.true;

			data = sovryn.contract.methods.setLoanPool([accounts[6]], [ZERO_ADDRESS]).encodeABI();
			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			expect((await sovryn.loanPoolToUnderlying(accounts[6])) == ZERO_ADDRESS).to.be.true;
			expect((await sovryn.underlyingToLoanPool(accounts[7])) == ZERO_ADDRESS).to.be.true;

			expect(await sovryn.isLoanPool(accounts[6])).to.be.false;
		});

		it("Test set wrbtc token", async () => {
			expect((await sovryn.owner()) == multisig.address).to.be.true;

			const dest = sovryn.address;
			const val = 0;
			const data = sovryn.contract.methods.setWrbtcToken(WRBTC.address).encodeABI();
			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			const txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			expect((await sovryn.wrbtcToken()) == WRBTC.address).to.be.true;

			await expectRevert(sovryn.setWrbtcToken(WRBTC.address, { from: accounts[0] }), "unauthorized");
		});

		it("Should revert when setting wrbtc token w/ not a contract address", async () => {
			expect((await sovryn.owner()) == multisig.address).to.be.true;

			const dest = sovryn.address;
			const val = 0;
			const data = sovryn.contract.methods.setWrbtcToken(ZERO_ADDRESS).encodeABI();
			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			const txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });

			expectEvent(receipt, "ExecutionFailure");
		});

		it("Test set protocol token address", async () => {
			expect((await sovryn.protocolTokenAddress()) == ZERO_ADDRESS).to.be.true;

			const dest = sovryn.address;
			const val = 0;
			const data = sovryn.contract.methods.setProtocolTokenAddress(sov.address).encodeABI();
			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			const txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			expect((await sovryn.protocolTokenAddress()) == sov.address).to.be.true;

			await expectRevert(sovryn.setProtocolTokenAddress(sov.address, { from: accounts[1] }), "unauthorized");
		});

		it("Should revert when setting protocol token w/ not a contract address", async () => {
			expect((await sovryn.protocolTokenAddress()) == ZERO_ADDRESS).to.be.true;

			const dest = sovryn.address;
			const val = 0;
			const data = sovryn.contract.methods.setProtocolTokenAddress(ZERO_ADDRESS).encodeABI();
			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			const txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });

			expectEvent(receipt, "ExecutionFailure");
		});

		/*
			Should set and deposit the protocol token
			1. deploy erc20
			2. set address
			3. approve token transfer
			4. deposit tokens
			5. verify balance
		*/
		it("Test deposit protocol token", async () => {
			const dest = sovryn.address;
			const val = 0;

			let data = await sov.contract.methods.approve(sovryn.address, hunEth).encodeABI();

			let tx = await multisig.submitTransaction(sov.address, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = await sovryn.contract.methods.setProtocolTokenAddress(sov.address).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = sovryn.contract.methods.depositProtocolToken(hunEth).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			expect((await sovryn.protocolTokenHeld()).eq(hunEth)).to.be.true;
		});

		it("Test fail deposit protocol token", async () => {
			const dest = sovryn.address;
			const val = 0;

			let data = await sov.contract.methods.approve(sovryn.address, hunEth).encodeABI();

			let tx = await multisig.submitTransaction(sov.address, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = await sovryn.contract.methods.setProtocolTokenAddress(sov.address).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			await expectRevert(sovryn.depositProtocolToken(sov.address, { from: accounts[0] }), "unauthorized");
		});

		// Should withdraw no tokens
		it("Coverage Test: withdraw amount 0 from protocol", async () => {
			const dest = sovryn.address;
			const val = 0;

			let data = await sov.contract.methods.approve(sovryn.address, hunEth).encodeABI();

			let tx = await multisig.submitTransaction(sov.address, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = await sovryn.contract.methods.setProtocolTokenAddress(sov.address).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = sovryn.contract.methods.depositProtocolToken(hunEth).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			const balanceBefore = await sov.balanceOf(accounts[1]);

			data = sovryn.contract.methods.withdrawProtocolToken(accounts[1], 0).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			const balanceAfter = await sov.balanceOf(accounts[1]);
			expect((await sovryn.protocolTokenHeld()).eq(hunEth)).to.be.true;
			expect(balanceAfter.eq(balanceBefore)).to.be.true;
		});

		// Should successfully withdraw all deposited protocol tokens
		it("Test withdraw protocol token", async () => {
			const dest = sovryn.address;
			const val = 0;

			let data = await sov.contract.methods.approve(sovryn.address, hunEth).encodeABI();

			let tx = await multisig.submitTransaction(sov.address, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = await sovryn.contract.methods.setProtocolTokenAddress(sov.address).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = sovryn.contract.methods.depositProtocolToken(hunEth).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			const balanceBefore = await sov.balanceOf(accounts[1]);

			data = sovryn.contract.methods.withdrawProtocolToken(accounts[1], hunEth).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			const balanceAfter = await sov.balanceOf(accounts[1]);
			expect((await sovryn.protocolTokenHeld()).eq(new BN(0))).to.be.true;
			expect(balanceAfter.eq(balanceBefore.add(hunEth))).to.be.true;
		});

		// Should fail to withdraw 1e30 protocol tokens but withdraw 1e20
		it("Test fail withdraw protocol token", async () => {
			const dest = sovryn.address;
			const val = 0;

			let data = await sov.contract.methods.approve(sovryn.address, hunEth).encodeABI();

			let tx = await multisig.submitTransaction(sov.address, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = await sovryn.contract.methods.setProtocolTokenAddress(sov.address).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			data = sovryn.contract.methods.depositProtocolToken(hunEth).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			const balanceBefore = await sov.balanceOf(accounts[1]);

			data = sovryn.contract.methods.withdrawProtocolToken(accounts[1], new BN(10).pow(new BN(30))).encodeABI();

			tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			await multisig.confirmTransaction(txId, { from: accounts[1] });

			const balanceAfter = await sov.balanceOf(accounts[1]);
			expect((await sovryn.protocolTokenHeld()).eq(new BN(0))).to.be.true;
			expect(balanceAfter.eq(balanceBefore.add(hunEth))).to.be.true;
		});

		// Should successfully change rollover base reward
		it("Test set rollover base reward", async () => {
			const new_reward = new BN(10).pow(new BN(15));
			const old_reward = await sovryn.rolloverBaseReward();

			const dest = sovryn.address;
			const val = 0;
			const data = await sovryn.contract.methods.setRolloverBaseReward(new_reward).encodeABI();

			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });

			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetRolloverBaseReward");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			expect(event["oldValue"] == old_reward.toString()).to.be.true;
			expect(event["newValue"] == new_reward.toString()).to.be.true;
			expect((await sovryn.rolloverBaseReward()).eq(new_reward)).to.be.true;
		});

		// Should fail to change rollover base reward by unauthorized user
		it("Test set rollover base reward by unauthorized user", async () => {
			await expectRevert(sovryn.setRolloverBaseReward(new BN(10).pow(new BN(15)), { from: accounts[0] }), "unauthorized");
		});

		it("Should revert when setting rollover base reward w/ 0 amount", async () => {
			const dest = sovryn.address;
			const val = 0;
			const data = await sovryn.contract.methods.setRolloverBaseReward(new BN(0)).encodeABI();

			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });

			expectEvent(receipt, "ExecutionFailure");
		});

		// Should successfully change rebate percent
		it("Test set rebate percent", async () => {
			const new_percent = new BN(2).mul(oneEth);
			const old_percent = await sovryn.getFeeRebatePercent();

			const dest = sovryn.address;
			const val = 0;
			const data = await sovryn.contract.methods.setRebatePercent(new_percent).encodeABI();

			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });

			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetRebatePercent");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			expect(event["oldRebatePercent"] == old_percent.toString()).to.be.true;
			expect(event["newRebatePercent"] == new_percent.toString()).to.be.true;
			expect((await sovryn.getFeeRebatePercent()).eq(new_percent)).to.be.true;
		});

		// Should fail to change rebate percent by unauthorized user
		it("Test set rebate percent by unauthorized user", async () => {
			await expectRevert(sovryn.setRebatePercent(new BN(2).mul(oneEth), { from: accounts[0] }), "unauthorized");
		});

		it("Should revert when setting a too high fee rebate", async () => {
			const dest = sovryn.address;
			const val = 0;
			const data = await sovryn.contract.methods.setRebatePercent(new BN(10).pow(new BN(20)).add(new BN(1))).encodeABI();

			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });

			expectEvent(receipt, "ExecutionFailure");
		});

		// Should successfully change rebate percent
		it("Test set trading rebate rewards basis point", async () => {
			const new_basis_point = new BN(9999);
			const old_basis_point = await sovryn.getTradingRebateRewardsBasisPoint();

			const dest = sovryn.address;
			const val = 0;
			const data = await sovryn.contract.methods.setTradingRebateRewardsBasisPoint(new_basis_point).encodeABI();

			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });

			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetTradingRebateRewardsBasisPoint");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			expect(event["oldBasisPoint"] == old_basis_point.toString()).to.be.true;
			expect(event["newBasisPoint"] == new_basis_point.toString()).to.be.true;
			expect((await sovryn.getTradingRebateRewardsBasisPoint()).eq(new_basis_point)).to.be.true;
		});

		// Should fail to change rebate percent by unauthorized user
		it("Test set trading rebate rewards basis point by unauthorized user", async () => {
			await expectRevert(sovryn.setTradingRebateRewardsBasisPoint(new BN(10000), { from: accounts[0] }), "unauthorized");
		});

		// Should successfully change the swapExternalFeePercent
		it("Test set swapExternalFeePercent", async () => {
			const new_percent = new BN(2).mul(oneEth);
			const old_percent = await sovryn.getSwapExternalFeePercent();

			const dest = sovryn.address;
			const val = 0;
			const data = await sovryn.contract.methods.setSwapExternalFeePercent(new_percent).encodeABI();

			const tx = await multisig.submitTransaction(dest, val, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });

			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetSwapExternalFeePercent");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			expect(event["oldValue"] == old_percent.toString()).to.be.true;
			expect(event["newValue"] == new_percent.toString()).to.be.true;
			expect((await sovryn.getSwapExternalFeePercent()).eq(new_percent)).to.be.true;
		});

		// Should fail to change swap external fee percent by unauthorized user
		it("Test set swapExternalFeePercent with unauthorized sender", async () => {
			await expectRevert(sovryn.setSwapExternalFeePercent(new BN(2).mul(oneEth), { from: accounts[0] }), "unauthorized");
		});

		it("should work: setBorrowingFeePercent", async () => {
			/// @dev setBorrowingFeePercent must be called from multisig
			let newValue = new BN(10).pow(new BN(20));
			const data = await sovryn.contract.methods.setBorrowingFeePercent(newValue).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");

			// Check emitted event arguments
			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetBorrowingFeePercent");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			/// @dev Default value at State.sol:
			///   0.09% fee /// Origination fee paid for each loan.
			///   uint256 public borrowingFeePercent = 9 * 10**16;
			///     90000000000000000
			expect(event["oldValue"] == new BN(9).mul(new BN(10).pow(new BN(16)))).to.be.true;
			expect(event["newValue"] == newValue).to.be.true;
		});

		it("shouldn't work: setBorrowingFeePercent w/ value too high", async () => {
			/// @dev setBorrowingFeePercent must be called from multisig
			const data = await sovryn.contract.methods.setBorrowingFeePercent(new BN(10).pow(new BN(20)).add(new BN(1))).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("should work: setLiquidationIncentivePercent", async () => {
			/// @dev setLiquidationIncentivePercent must be called from multisig
			let newValue = new BN(10).pow(new BN(20));
			const data = await sovryn.contract.methods.setLiquidationIncentivePercent(newValue).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");

			// Check emitted event arguments
			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetLiquidationIncentivePercent");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			/// @dev Default value at State.sol:
			///   5% collateral discount /// Discount on collateral for liquidators.
			///   uint256 public liquidationIncentivePercent = 5 * 10**18;
			///     5000000000000000000
			expect(event["oldValue"] == new BN(5).mul(new BN(10).pow(new BN(18)))).to.be.true;
			expect(event["newValue"] == newValue).to.be.true;
		});

		it("shouldn't work: setLiquidationIncentivePercent w/ value too high", async () => {
			/// @dev setLiquidationIncentivePercent must be called from multisig
			const data = await sovryn.contract.methods
				.setLiquidationIncentivePercent(new BN(10).pow(new BN(20)).add(new BN(1)))
				.encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("should work: setMaxDisagreement", async () => {
			/// @dev setMaxDisagreement must be called from multisig
			const data = await sovryn.contract.methods.setMaxDisagreement(new BN(10).pow(new BN(20))).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");
		});

		it("should work: setSourceBuffer", async () => {
			/// @dev setSourceBuffer must be called from multisig
			const data = await sovryn.contract.methods.setSourceBuffer(new BN(10).pow(new BN(20))).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");
		});

		it("should work: setMaxSwapSize", async () => {
			/// @dev setMaxSwapSize must be called from multisig
			let newValue = new BN(10).pow(new BN(20));
			const data = await sovryn.contract.methods.setMaxSwapSize(newValue).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");

			// Check emitted event arguments
			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetMaxSwapSize");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			/// @dev Default value at State.sol:
			///   Maximum support swap size in rBTC
			///   uint256 public maxSwapSize = 50 ether;
			///     50000000000000000000
			expect(event["oldValue"] == new BN(50).mul(new BN(10).pow(new BN(18)))).to.be.true;
			expect(event["newValue"] == newValue).to.be.true;
		});

		it("should work on setLoanPool w/ 1 pool and 1 asset previously deployed", async () => {
			/// @dev setLoanPool must be called from multisig
			let pools = [loanToken.address];
			let assets = [loanTokenAddress];
			const data = await sovryn.contract.methods.setLoanPool(pools, assets).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");

			let list = await sovryn.getLoanPoolsList.call(0, 10);
			console.log("loanPools = ", list);
		});

		it("should revert for count mismatch on setLoanPool w/ 1 pool 2 assets", async () => {
			/// @dev setLoanPool must be called from multisig
			let pools = [loanToken.address];
			let assets = [loanTokenAddress, loanTokenAddress];
			const data = await sovryn.contract.methods.setLoanPool(pools, assets).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("should revert on setLoanPool w/ 1 pool and 1 asset that are equal", async () => {
			/// @dev setLoanPool must be called from multisig
			let pools = [loanToken.address];
			let assets = [loanToken.address];
			const data = await sovryn.contract.methods.setLoanPool(pools, assets).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("should revert on setLoanPool w/ 1 pool equal to address(0) and 1 asset", async () => {
			/// @dev setLoanPool must be called from multisig
			let pools = [ZERO_ADDRESS];
			let assets = [loanToken.address];
			const data = await sovryn.contract.methods.setLoanPool(pools, assets).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("should revert on setLoanPool w/ 1 pool and 1 asset equal to address(0)", async () => {
			/// @dev setLoanPool must be called from multisig
			let pools = [loanToken.address];
			let assets = [ZERO_ADDRESS];
			const data = await sovryn.contract.methods.setLoanPool(pools, assets).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("should work on setSupportedTokens w/ 1 address and 1 toogle", async () => {
			/// @dev setSupportedTokens must be called from multisig
			let addresses = [ZERO_ADDRESS];
			let toggles = [true];
			const data = await sovryn.contract.methods.setSupportedTokens(addresses, toggles).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");
		});

		it("should revert for count mismatch on setSupportedTokens w/ 1 address 2 toggles", async () => {
			/// @dev setSupportedTokens must be called from multisig
			let addresses = [ZERO_ADDRESS];
			let toggles = [true, false];
			const data = await sovryn.contract.methods.setSupportedTokens(addresses, toggles).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("should work: setLendingFeePercent", async () => {
			/// @dev setLendingFeePercent must be called from multisig
			let newValue = new BN(10).pow(new BN(20));
			const data = await sovryn.contract.methods.setLendingFeePercent(newValue).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");

			// Check emitted event arguments
			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetLendingFeePercent");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			/// @dev Default value at State.sol:
			///   	10% fee /// Fee taken from lender interest payments.
			///     uint256 public lendingFeePercent = 10**19;
			///     10000000000000000000
			expect(event["oldValue"] == new BN(1).mul(new BN(10).pow(new BN(19)))).to.be.true;
			expect(event["newValue"] == newValue).to.be.true;
		});

		it("shouldn't work: setLendingFeePercent w/ value too high", async () => {
			/// @dev setLendingFeePercent must be called from multisig
			const data = await sovryn.contract.methods.setLendingFeePercent(new BN(10).pow(new BN(20)).add(new BN(1))).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("should work: setTradingFeePercent", async () => {
			/// @dev setTradingFeePercent must be called from multisig
			let newValue = new BN(10).pow(new BN(20));
			const data = await sovryn.contract.methods.setTradingFeePercent(newValue).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "Execution");

			// Check emitted event arguments
			const decode = decodeLogs(receipt.rawLogs, ProtocolSettings, "SetTradingFeePercent");
			const event = decode[0].args;
			expect(event["sender"] == multisig.address).to.be.true;
			/// @dev Default value at State.sol:
			///   	0.15% fee /// Fee paid for each trade.
			///     uint256 public tradingFeePercent = 15 * 10**16;
			///     150000000000000000
			expect(event["oldValue"] == new BN(15).mul(new BN(10).pow(new BN(16)))).to.be.true;
			expect(event["newValue"] == newValue).to.be.true;
		});

		it("shouldn't work: setTradingFeePercent w/ value too high", async () => {
			/// @dev setTradingFeePercent must be called from multisig
			const data = await sovryn.contract.methods.setTradingFeePercent(new BN(10).pow(new BN(20)).add(new BN(1))).encodeABI();
			const tx = await multisig.submitTransaction(sovryn.address, 0, data, { from: accounts[0] });
			let txId = tx.logs.filter((item) => item.event == "Submission")[0].args["transactionId"];
			const { receipt } = await multisig.confirmTransaction(txId, { from: accounts[1] });
			expectEvent(receipt, "ExecutionFailure");
		});

		it("shouldn't revert: setSovrynSwapContractRegistryAddress w/ registryAddress not a contract", async () => {
			const sovrynproxy = await sovrynProtocol.new();
			const sovryn = await ISovryn.at(sovrynproxy.address);

			await sovryn.replaceContract((await ProtocolSettings.new()).address);
			await sovryn.replaceContract((await LoanSettings.new()).address);
			await sovryn.replaceContract((await LoanMaintenance.new()).address);
			await sovryn.replaceContract((await SwapsExternal.new()).address);

			await expectRevert(sovryn.setSovrynSwapContractRegistryAddress(ZERO_ADDRESS), "registryAddress not a contract");
		});
	});

	describe("LoanClosingsBase test coverage", () => {
		it("Doesn't allow fallback function call", async () => {
			/// @dev the revert "fallback not allowed" is never reached because
			///   fallback function (w/ no signature) is not registered in the protocol
			await expectRevert(sovryn.sendTransaction({}), "target not active");
		});
	});
});
