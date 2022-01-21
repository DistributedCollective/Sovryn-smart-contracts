/** Speed optimized on branch hardhatTestRefactor, 2021-10-01
 * Bottleneck found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 7.4s
 * After optimization: 6.2s
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect } = require("chai");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;

const FeesEvents = artifacts.require("FeesEvents");
const LoanOpeningsEvents = artifacts.require("LoanOpeningsEvents");
const SwapsEvents = artifacts.require("SwapsEvents");
const VaultController = artifacts.require("VaultController");
const { increaseTime, blockNumber } = require("../Utils/Ethereum");
const LoanClosingsEvents = artifacts.require("LoanClosingsEvents");
const SwapEvents = artifacts.require("SwapsEvents");
const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getLoanToken,
	getLoanTokenWRBTC,
	loan_pool_setup,
	set_demand_curve,
	getPriceFeeds,
	getSovryn,
	decodeLogs,
	getSOV,
	verify_sov_reward_payment,
} = require("../Utils/initializer.js");

const LockedSOVMockup = artifacts.require("LockedSOVMockup");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));
const TINY_AMOUNT = new BN(25).mul(new BN(10).pow(new BN(13))); // 25 * 10**13

/*
Tests the close with deposit. 
Note: close with swap is tested in loanToken/trading

1. Test a full closure with deposit
2. Test a partial closure with deposit
3. Should fail to close with 0 deposit 
*/

contract("ProtocolCloseDeposit", (accounts) => {
	let owner;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, priceFeeds, SOV;

	async function deploymentAndInitFixture(_wallets, _provider) {
		// Deploying sovrynProtocol w/ generic function from initializer.js
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

		/// @dev SOV test token deployment w/ initializer.js
		SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
	}

	before(async () => {
		[owner] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	const setup_rollover_test = async (RBTC, SUSD, accounts, loanToken, loan_token_sent, set_demand_curve, sovryn) => {
		await set_demand_curve(loanToken);
		await SUSD.approve(loanToken.address, new BN(10).pow(new BN(40)));
		const lender = accounts[0];
		const borrower = accounts[1];
		await loanToken.mint(lender, new BN(10).pow(new BN(30)));
		await SUSD.mint(borrower, loan_token_sent);
		await SUSD.approve(loanToken.address, loan_token_sent, { from: borrower });
		const { receipt } = await loanToken.marginTrade(
			"0x0", // loanId  (0 for new loans)
			new BN(2).mul(oneEth), // leverageAmount
			loan_token_sent, // loanTokenSent
			0, // no collateral token sent
			RBTC.address, // collateralTokenAddress
			borrower, // trader,
			0,
			"0x", // loanDataBytes (only required with ether)
			{ from: borrower }
		);

		const decode = decodeLogs(receipt.rawLogs, LoanOpeningsEvents, "Trade");
		const loan_id = decode[0].args["loanId"];
		const loan = await sovryn.getLoan(loan_id);
		const num = await blockNumber();
		let currentBlock = await web3.eth.getBlock(num);
		const block_timestamp = currentBlock.timestamp;
		const time_until_loan_end = loan["endTimestamp"] - block_timestamp;
		await increaseTime(time_until_loan_end);
		return [borrower, loan, loan_id, parseInt(loan["endTimestamp"])];
	};

	describe("Tests the close with deposit. ", () => {
		/*
			Tests paid interests to lender
			Test that loan attributes are updated
			Test loan swap event
		*/
		it("Test rollover", async () => {
			// prepare the test

			const [borrower, loan, loan_id, endTimestamp] = await setup_rollover_test(
				RBTC,
				SUSD,
				accounts,
				loanToken,
				hunEth, // loan_token_sent
				set_demand_curve,
				sovryn
			);

			const lender_interest_data = await sovryn.getLenderInterestData(loanToken.address, SUSD.address);

			const lender_pool_initial_balance = await SUSD.balanceOf(loanToken.address);

			lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
			const sov_borrower_initial_balance = (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower));

			const { receipt } = await sovryn.rollover(loan_id, "0x");
			const susd_bal_after_rollover = (await SUSD.balanceOf(loanToken.address)).toString();

			const lender_interest_after = await sovryn.getLenderInterestData(loanToken.address, SUSD.address);

			const lending_fee_percent = await sovryn.lendingFeePercent();
			const interest_unpaid = new BN(lender_interest_data["interestUnPaid"]);
			const lending_fee = interest_unpaid.mul(lending_fee_percent).div(hunEth);
			let interest_owed_now = interest_unpaid.sub(lending_fee);

			num = await blockNumber();
			currentBlock = await web3.eth.getBlock(num);
			block_timestamp = currentBlock.timestamp;
			if (block_timestamp > endTimestamp) {
				backInterestTime = new BN(block_timestamp - endTimestamp);
				backInterestOwed = backInterestTime.mul(lender_interest_data["interestOwedPerDay"]).div(new BN(24 * 60 * 60));
				const lending_fee = backInterestOwed.mul(lending_fee_percent).div(hunEth);
				backInterestOwed = backInterestOwed.sub(lending_fee);
				interest_owed_now = interest_owed_now.add(backInterestOwed);
			}

			expect(await SUSD.balanceOf(loanToken.address)).to.be.bignumber.equal(lender_pool_initial_balance.add(interest_owed_now));
			expect(lender_interest_after["interestPaid"] == interest_unpaid.toString()).to.be.true;
			expect(lender_interest_after["interestUnPaid"] == "0").to.be.true;

			// Settles and pays borrowers based on fees generated by their interest payments
			if ((await sovryn.protocolTokenHeld()) != 0)
				await verify_sov_reward_payment(
					receipt.rawLogs,
					FeesEvents,
					SOV,
					borrower,
					loan_id,
					sov_borrower_initial_balance,
					2,
					SUSD.address,
					RBTC.address,
					sovryn
				);

			const loan_after = await sovryn.getLoan(loan_id);
			expect(loan_after["endTimestamp"] >= parseInt(loan["endTimestamp"]) + 28 * 24 * 60 * 60).to.be.true;
			const { rate: trade_rate, precision } = await priceFeeds.queryRate(RBTC.address, SUSD.address);
			const trading_fee_percent = await sovryn.tradingFeePercent();
			const trading_fee = interest_unpaid.mul(trading_fee_percent).div(hunEth);

			const decode = decodeLogs(receipt.rawLogs, SwapsEvents, "LoanSwap");
			const loan_swap_event = decode[0].args;
			expect(loan_swap_event["loanId"] == loan_id).to.be.true;
			expect(loan_swap_event["sourceToken"] == RBTC.address).to.be.true;
			expect(loan_swap_event["destToken"] == SUSD.address).to.be.true;
			expect(loan_swap_event["borrower"] == borrower).to.be.true;
			// source buffer = 10000 in sovryn swap connector
			expect(
				new BN(loan_swap_event["sourceAmount"])
					.sub(interest_unpaid)
					.add(trading_fee)
					.mul(precision)
					.div(trade_rate)
					.lte(new BN(10000))
			).to.be.true;
			expect(new BN(loan_swap_event["destAmount"]).gte(interest_unpaid)).to.be.true;

			const decoded_rollover = decodeLogs(receipt.rawLogs, LoanClosingsEvents, "Rollover");
			const rollover_event = decoded_rollover[0].args;
			expect(rollover_event["user"]).to.equal(borrower);
			expect(rollover_event["lender"]).to.equal(loanToken.address);
			expect(rollover_event["loanId"]).to.equal(loan_id);
			expect(rollover_event["principal"]).to.equal(loan_after["principal"]);
			expect(rollover_event["collateral"]).to.equal(loan_after["collateral"]);
			expect(rollover_event["endTimestamp"]).to.equal(loan_after["endTimestamp"]);
			expect(rollover_event["rewardReceiver"]).to.equal(accounts[0]);
			expect(new BN(rollover_event["reward"]) > new BN(0)).to.be.true;
		});

		it("Test rollover tiny amount", async () => {
			// prepare the test
			let rollover_wallet = accounts[5];
			loan_token_sent = TINY_AMOUNT.add(new BN(1)).mul(new BN(10).pow(new BN(4)));
			const [borrower, loan, loan_id, endTimestamp] = await setup_rollover_test(
				RBTC,
				SUSD,
				accounts,
				loanToken,
				loan_token_sent,
				set_demand_curve,
				sovryn
			);

			const num = await blockNumber();
			let currentBlock = await web3.eth.getBlock(num);
			const block_timestamp = currentBlock.timestamp;
			const time_until_loan_end = loan["endTimestamp"] - block_timestamp;
			await increaseTime(time_until_loan_end);

			loan_before_rolled_over = await sovryn.getLoan.call(loan_id);

			// // Set the wrbtc price become more expensive, so that it can create the dust
			await priceFeeds.setRates(WRBTC.address, SUSD.address, new BN(10).pow(new BN(23)).toString());

			const previousBorrowerBalanceSUSD = await SUSD.balanceOf(borrower);
			const previousBorrowerBalanceRBTC = await RBTC.balanceOf(borrower);
			const previousRolloverWalletBalanceSUSD = await SUSD.balanceOf(rollover_wallet);
			const previousRolloverWalletBalanceRBTC = await RBTC.balanceOf(rollover_wallet);
			const { receipt } = await sovryn.rollover(loan_id, "0x", { from: rollover_wallet });
			const latestBorrowerBalanceSUSD = await SUSD.balanceOf(borrower);
			const latestBorrowerBalanceRBTC = await RBTC.balanceOf(borrower);
			const latestRolloverWalletBalanceSUSD = await SUSD.balanceOf(rollover_wallet);
			const latestRolloverWalletBalanceRBTC = await RBTC.balanceOf(rollover_wallet);

			const vaultWithdrawEvents = decodeLogs(receipt.rawLogs, VaultController, "VaultWithdraw");

			// Make sure the borrower got the remaining collateral
			const remainingCollateralAmount = vaultWithdrawEvents[vaultWithdrawEvents.length - 1].args["amount"];
			expect(latestBorrowerBalanceSUSD.toString()).to.equal(
				previousBorrowerBalanceSUSD.add(new BN(remainingCollateralAmount)).toString()
			);

			expect(previousBorrowerBalanceRBTC.toString()).to.equal(new BN(0).toString());
			expect(latestBorrowerBalanceRBTC.toString()).to.equal(new BN(0).toString());

			// Rollover wallet should get the reward
			const rollover_reward = vaultWithdrawEvents[2].args["amount"];
			expect(previousRolloverWalletBalanceSUSD.toString()).to.equal(new BN(0).toString());
			expect(previousRolloverWalletBalanceRBTC.toString()).to.equal(new BN(0).toString());
			expect(latestRolloverWalletBalanceSUSD.toString()).to.equal(new BN(0).toString());
			expect(latestRolloverWalletBalanceRBTC.toString()).to.equal(
				previousRolloverWalletBalanceRBTC.add(new BN(rollover_reward)).toString()
			);

			// Test loan update
			end_loan = await sovryn.getLoan.call(loan_id);
			// CHECK THE POSITION / LOAN IS COMPLETELY CLOSED
			expect(end_loan["principal"]).to.be.bignumber.equal(new BN(0).toString(), "principal should be 0");
			expect(end_loan["collateral"]).to.be.bignumber.equal(new BN(0).toString(), "collateral should be 0");
			expect(end_loan["currentMargin"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["maxLiquidatable"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["maxSeizable"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["interestOwedPerDay"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["interestDepositRemaining"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");

			// CHECK THE CLOSE SWAP IS WORKING PROPERLY
			const decode = decodeLogs(receipt.rawLogs, LoanClosingsEvents, "CloseWithSwap");
			const swapEvent = decode[0].args;
			expect(swapEvent["user"]).to.equal(borrower);
			expect(swapEvent["lender"]).to.equal(loanToken.address); // lender is the pool in this case
			expect(swapEvent["loanId"]).to.equal(loan_id);
			expect(swapEvent["closer"]).to.equal(rollover_wallet); // the one who called the rollover function
			expect(swapEvent["loanToken"]).to.equal(SUSD.address); /// Don't get confused, the loanToken is not the pool token, it's the underlying token
			expect(swapEvent["collateralToken"]).to.equal(RBTC.address);
			expect(swapEvent["loanCloseAmount"]).to.equal(loan_before_rolled_over["principal"]); // the principal before rolled over

			const decoded_rollover = decodeLogs(receipt.rawLogs, LoanClosingsEvents, "Rollover");
			const rollover_event = decoded_rollover;
			expect(rollover_event.length == 0).to.be.true;
		});

		it("Test rollover where the rollover reward greater than collateral itself", async () => {
			// prepare the test
			let rollover_wallet = accounts[5];
			loan_token_sent = TINY_AMOUNT.add(new BN(1)).mul(new BN(10).pow(new BN(4)));
			const [borrower, loan, loan_id, endTimestamp] = await setup_rollover_test(
				RBTC,
				SUSD,
				accounts,
				loanToken,
				loan_token_sent,
				set_demand_curve,
				sovryn
			);

			const num = await blockNumber();
			let currentBlock = await web3.eth.getBlock(num);
			const block_timestamp = currentBlock.timestamp;
			const time_until_loan_end = loan["endTimestamp"] - block_timestamp;
			await increaseTime(time_until_loan_end);

			loan_before_rolled_over = await sovryn.getLoan.call(loan_id);

			// // Set the rbtc (collateral) price become more expensive, so that the reward will be greater than the collateral itself
			await priceFeeds.setRates(WRBTC.address, RBTC.address, new BN(10).pow(new BN(19)).mul(new BN(3)).toString());

			const previousRolloverWalletBalanceSUSD = await SUSD.balanceOf(rollover_wallet);
			const previousRolloverWalletBalanceWRBTC = await WRBTC.balanceOf(rollover_wallet);
			const { receipt } = await sovryn.rollover(loan_id, "0x", { from: rollover_wallet });
			const latestRolloverWalletBalanceSUSD = await SUSD.balanceOf(rollover_wallet);
			const latestRolloverWalletBalanceWRBTC = await WRBTC.balanceOf(rollover_wallet);

			const vaultWithdrawEvents = decodeLogs(receipt.rawLogs, VaultController, "VaultWithdraw");

			// Make sure the rollover wallet get the remaining collateral in form of underlying loan token
			const remainingCollateralAmount = vaultWithdrawEvents[vaultWithdrawEvents.length - 1].args["amount"];
			expect(latestRolloverWalletBalanceSUSD.toString()).to.equal(
				previousRolloverWalletBalanceSUSD.add(new BN(remainingCollateralAmount)).toString()
			);

			expect(previousRolloverWalletBalanceWRBTC.toString()).to.equal(new BN(0).toString());
			expect(latestRolloverWalletBalanceWRBTC.toString()).to.equal(new BN(0).toString());

			// Test loan update
			end_loan = await sovryn.getLoan.call(loan_id);

			// CHECK THE POSITION / LOAN IS COMPLETELY CLOSED
			expect(end_loan["principal"]).to.be.bignumber.equal(new BN(0).toString(), "principal should be 0");
			expect(end_loan["collateral"]).to.be.bignumber.equal(new BN(0).toString(), "collateral should be 0");
			expect(end_loan["currentMargin"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["maxLiquidatable"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["maxSeizable"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["interestOwedPerDay"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["interestDepositRemaining"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");

			// CHECK THE CLOSE SWAP IS WORKING PROPERLY
			const decode = decodeLogs(receipt.rawLogs, LoanClosingsEvents, "CloseWithSwap");
			const swapEvent = decode[0].args;

			const loanSwapEvent = decodeLogs(receipt.rawLogs, SwapEvents, "LoanSwap");
			const sourceTokenAmountUsed = new BN(loanSwapEvent[0].args["sourceAmount"]);

			expect(swapEvent["user"]).to.equal(borrower);
			expect(swapEvent["lender"]).to.equal(loanToken.address); // lender is the pool in this case
			expect(swapEvent["loanId"]).to.equal(loan_id);
			expect(swapEvent["closer"]).to.equal(rollover_wallet); // the one who called the rollover function
			expect(swapEvent["loanToken"]).to.equal(SUSD.address); /// Don't get confused, the loanToken is not the pool token, it's the underlying token
			expect(swapEvent["collateralToken"]).to.equal(RBTC.address);
			expect(swapEvent["loanCloseAmount"]).to.equal(loan_before_rolled_over["principal"]); // the principal before rolled over
			expect(swapEvent["positionCloseSize"]).to.equal(
				new BN(loan_before_rolled_over["collateral"]).sub(sourceTokenAmountUsed).toString()
			); // the principal before rolled over
		});

		it("Test rollover tiny amount", async () => {
			// prepare the test
			let rollover_wallet = accounts[5];
			loan_token_sent = TINY_AMOUNT.add(new BN(1)).mul(new BN(10).pow(new BN(4)));
			const [borrower, loan, loan_id, endTimestamp] = await setup_rollover_test(
				RBTC,
				SUSD,
				accounts,
				loanToken,
				loan_token_sent,
				set_demand_curve,
				sovryn
			);

			const num = await blockNumber();
			let currentBlock = await web3.eth.getBlock(num);
			const block_timestamp = currentBlock.timestamp;
			const time_until_loan_end = loan["endTimestamp"] - block_timestamp;
			await increaseTime(time_until_loan_end);

			loan_before_rolled_over = await sovryn.getLoan.call(loan_id);

			// // Set the wrbtc price become more expensive, so that it can create the dust
			await priceFeeds.setRates(WRBTC.address, SUSD.address, new BN(10).pow(new BN(23)).toString());

			const previousBorrowerBalanceSUSD = await SUSD.balanceOf(borrower);
			const previousBorrowerBalanceRBTC = await RBTC.balanceOf(borrower);
			const previousRolloverWalletBalanceSUSD = await SUSD.balanceOf(rollover_wallet);
			const previousRolloverWalletBalanceRBTC = await RBTC.balanceOf(rollover_wallet);
			const { receipt } = await sovryn.rollover(loan_id, "0x", { from: rollover_wallet });
			const latestBorrowerBalanceSUSD = await SUSD.balanceOf(borrower);
			const latestBorrowerBalanceRBTC = await RBTC.balanceOf(borrower);
			const latestRolloverWalletBalanceSUSD = await SUSD.balanceOf(rollover_wallet);
			const latestRolloverWalletBalanceRBTC = await RBTC.balanceOf(rollover_wallet);

			const vaultWithdrawEvents = decodeLogs(receipt.rawLogs, VaultController, "VaultWithdraw");

			// Make sure the borrower got the remaining collateral
			const remainingCollateralAmount = vaultWithdrawEvents[vaultWithdrawEvents.length - 1].args["amount"];
			expect(latestBorrowerBalanceSUSD.toString()).to.equal(
				previousBorrowerBalanceSUSD.add(new BN(remainingCollateralAmount)).toString()
			);

			expect(previousBorrowerBalanceRBTC.toString()).to.equal(new BN(0).toString());
			expect(latestBorrowerBalanceRBTC.toString()).to.equal(new BN(0).toString());

			// Rollover wallet should get the reward
			const rollover_reward = vaultWithdrawEvents[2].args["amount"];
			expect(previousRolloverWalletBalanceSUSD.toString()).to.equal(new BN(0).toString());
			expect(previousRolloverWalletBalanceRBTC.toString()).to.equal(new BN(0).toString());
			expect(latestRolloverWalletBalanceSUSD.toString()).to.equal(new BN(0).toString());
			expect(latestRolloverWalletBalanceRBTC.toString()).to.equal(
				previousRolloverWalletBalanceRBTC.add(new BN(rollover_reward)).toString()
			);

			// Test loan update
			end_loan = await sovryn.getLoan.call(loan_id);
			// CHECK THE POSITION / LOAN IS COMPLETELY CLOSED
			expect(end_loan["principal"]).to.be.bignumber.equal(new BN(0).toString(), "principal should be 0");
			expect(end_loan["collateral"]).to.be.bignumber.equal(new BN(0).toString(), "collateral should be 0");
			expect(end_loan["currentMargin"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["maxLiquidatable"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["maxSeizable"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["interestOwedPerDay"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["interestDepositRemaining"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");

			// CHECK THE CLOSE SWAP IS WORKING PROPERLY
			const decode = decodeLogs(receipt.rawLogs, LoanClosingsEvents, "CloseWithSwap");
			const swapEvent = decode[0].args;
			expect(swapEvent["user"]).to.equal(borrower);
			expect(swapEvent["lender"]).to.equal(loanToken.address); // lender is the pool in this case
			expect(swapEvent["loanId"]).to.equal(loan_id);
			expect(swapEvent["closer"]).to.equal(rollover_wallet); // the one who called the rollover function
			expect(swapEvent["loanToken"]).to.equal(SUSD.address); /// Don't get confused, the loanToken is not the pool token, it's the underlying token
			expect(swapEvent["collateralToken"]).to.equal(RBTC.address);
			expect(swapEvent["loanCloseAmount"]).to.equal(loan_before_rolled_over["principal"]); // the principal before rolled over
		});

		it("Test rollover where the rollover reward greater than collateral itself", async () => {
			// prepare the test
			let rollover_wallet = accounts[5];
			loan_token_sent = TINY_AMOUNT.add(new BN(1)).mul(new BN(10).pow(new BN(4)));
			const [borrower, loan, loan_id, endTimestamp] = await setup_rollover_test(
				RBTC,
				SUSD,
				accounts,
				loanToken,
				loan_token_sent,
				set_demand_curve,
				sovryn
			);

			const num = await blockNumber();
			let currentBlock = await web3.eth.getBlock(num);
			const block_timestamp = currentBlock.timestamp;
			const time_until_loan_end = loan["endTimestamp"] - block_timestamp;
			await increaseTime(time_until_loan_end);

			loan_before_rolled_over = await sovryn.getLoan.call(loan_id);

			// // Set the rbtc (collateral) price become more expensive, so that the reward will be greater than the collateral itself
			await priceFeeds.setRates(WRBTC.address, RBTC.address, new BN(10).pow(new BN(19)).mul(new BN(3)).toString());

			const previousRolloverWalletBalanceSUSD = await SUSD.balanceOf(rollover_wallet);
			const previousRolloverWalletBalanceWRBTC = await WRBTC.balanceOf(rollover_wallet);
			const { receipt } = await sovryn.rollover(loan_id, "0x", { from: rollover_wallet });
			const latestRolloverWalletBalanceSUSD = await SUSD.balanceOf(rollover_wallet);
			const latestRolloverWalletBalanceWRBTC = await WRBTC.balanceOf(rollover_wallet);

			const vaultWithdrawEvents = decodeLogs(receipt.rawLogs, VaultController, "VaultWithdraw");

			// Make sure the rollover wallet get the remaining collateral in form of underlying loan token
			const remainingCollateralAmount = vaultWithdrawEvents[vaultWithdrawEvents.length - 1].args["amount"];
			expect(latestRolloverWalletBalanceSUSD.toString()).to.equal(
				previousRolloverWalletBalanceSUSD.add(new BN(remainingCollateralAmount)).toString()
			);

			expect(previousRolloverWalletBalanceWRBTC.toString()).to.equal(new BN(0).toString());
			expect(latestRolloverWalletBalanceWRBTC.toString()).to.equal(new BN(0).toString());

			// Test loan update
			end_loan = await sovryn.getLoan.call(loan_id);

			// CHECK THE POSITION / LOAN IS COMPLETELY CLOSED
			expect(end_loan["principal"]).to.be.bignumber.equal(new BN(0).toString(), "principal should be 0");
			expect(end_loan["collateral"]).to.be.bignumber.equal(new BN(0).toString(), "collateral should be 0");
			expect(end_loan["currentMargin"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["maxLiquidatable"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["maxSeizable"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["interestOwedPerDay"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");
			expect(end_loan["interestDepositRemaining"]).to.be.bignumber.equal(new BN(0).toString(), "current margin should be 0");

			// CHECK THE CLOSE SWAP IS WORKING PROPERLY
			const decode = decodeLogs(receipt.rawLogs, LoanClosingsEvents, "CloseWithSwap");
			const swapEvent = decode[0].args;

			const loanSwapEvent = decodeLogs(receipt.rawLogs, SwapEvents, "LoanSwap");
			const sourceTokenAmountUsed = new BN(loanSwapEvent[0].args["sourceAmount"]);

			expect(swapEvent["user"]).to.equal(borrower);
			expect(swapEvent["lender"]).to.equal(loanToken.address); // lender is the pool in this case
			expect(swapEvent["loanId"]).to.equal(loan_id);
			expect(swapEvent["closer"]).to.equal(rollover_wallet); // the one who called the rollover function
			expect(swapEvent["loanToken"]).to.equal(SUSD.address); /// Don't get confused, the loanToken is not the pool token, it's the underlying token
			expect(swapEvent["collateralToken"]).to.equal(RBTC.address);
			expect(swapEvent["loanCloseAmount"]).to.equal(loan_before_rolled_over["principal"]); // the principal before rolled over
			expect(swapEvent["positionCloseSize"]).to.equal(
				new BN(loan_before_rolled_over["collateral"]).sub(sourceTokenAmountUsed).toString()
			); // the principal before rolled over
		});

		it("Test rollover with special rebates", async () => {
			// prepare the test
			await sovryn.setSpecialRebates(SUSD.address, RBTC.address, wei("300", "ether"));
			const [borrower, loan, loan_id, endTimestamp] = await setup_rollover_test(
				RBTC,
				SUSD,
				accounts,
				loanToken,
				hunEth, // loan_token_sent
				set_demand_curve,
				sovryn
			);

			const lender_interest_data = await sovryn.getLenderInterestData(loanToken.address, SUSD.address);

			const lender_pool_initial_balance = await SUSD.balanceOf(loanToken.address);

			lockedSOV = await LockedSOVMockup.at(await sovryn.lockedSOVAddress());
			const sov_borrower_initial_balance = (await SOV.balanceOf(borrower)).add(await lockedSOV.getLockedBalance(borrower));

			const { receipt } = await sovryn.rollover(loan_id, "0x");
			const susd_bal_after_rollover = (await SUSD.balanceOf(loanToken.address)).toString();

			const lender_interest_after = await sovryn.getLenderInterestData(loanToken.address, SUSD.address);

			const lending_fee_percent = await sovryn.lendingFeePercent();
			const interest_unpaid = new BN(lender_interest_data["interestUnPaid"]);
			const lending_fee = interest_unpaid.mul(lending_fee_percent).div(hunEth);
			let interest_owed_now = interest_unpaid.sub(lending_fee);

			num = await blockNumber();
			currentBlock = await web3.eth.getBlock(num);
			block_timestamp = currentBlock.timestamp;
			if (block_timestamp > endTimestamp) {
				backInterestTime = new BN(block_timestamp - endTimestamp);
				backInterestOwed = backInterestTime.mul(lender_interest_data["interestOwedPerDay"]).div(new BN(24 * 60 * 60));
				const lending_fee = backInterestOwed.mul(lending_fee_percent).div(hunEth);
				backInterestOwed = backInterestOwed.sub(lending_fee);
				interest_owed_now = interest_owed_now.add(backInterestOwed);
			}

			expect(await SUSD.balanceOf(loanToken.address)).to.be.bignumber.equal(lender_pool_initial_balance.add(interest_owed_now));
			expect(lender_interest_after["interestPaid"] == interest_unpaid.toString()).to.be.true;
			expect(lender_interest_after["interestUnPaid"] == "0").to.be.true;

			// Settles and pays borrowers based on fees generated by their interest payments
			if ((await sovryn.protocolTokenHeld()) != 0)
				await verify_sov_reward_payment(
					receipt.rawLogs,
					FeesEvents,
					SOV,
					borrower,
					loan_id,
					sov_borrower_initial_balance,
					2,
					SUSD.address,
					RBTC.address,
					sovryn
				);

			const loan_after = await sovryn.getLoan(loan_id);
			expect(loan_after["endTimestamp"] >= parseInt(loan["endTimestamp"]) + 28 * 24 * 60 * 60).to.be.true;
			const { rate: trade_rate, precision } = await priceFeeds.queryRate(RBTC.address, SUSD.address);
			const trading_fee_percent = await sovryn.tradingFeePercent();
			const trading_fee = interest_unpaid.mul(trading_fee_percent).div(hunEth);

			const decode = decodeLogs(receipt.rawLogs, SwapsEvents, "LoanSwap");
			const loan_swap_event = decode[0].args;
			expect(loan_swap_event["loanId"] == loan_id).to.be.true;
			expect(loan_swap_event["sourceToken"] == RBTC.address).to.be.true;
			expect(loan_swap_event["destToken"] == SUSD.address).to.be.true;
			expect(loan_swap_event["borrower"] == borrower).to.be.true;
			// source buffer = 10000 in sovryn swap connector
			expect(
				new BN(loan_swap_event["sourceAmount"])
					.sub(interest_unpaid)
					.add(trading_fee)
					.mul(precision)
					.div(trade_rate)
					.lte(new BN(10000))
			).to.be.true;
			expect(new BN(loan_swap_event["destAmount"]).gte(interest_unpaid)).to.be.true;
		});

		/*
			Collateral should decrease
			Sender collateral balance should increase
		*/
		it("Test rollover reward payment", async () => {
			// prepare the test
			const [, initial_loan, loan_id] = await setup_rollover_test(RBTC, SUSD, accounts, loanToken, hunEth, set_demand_curve, sovryn);

			const num = await blockNumber();
			let currentBlock = await web3.eth.getBlock(num);
			const block_timestamp = currentBlock.timestamp;
			const time_until_loan_end = initial_loan["endTimestamp"] - block_timestamp;
			await increaseTime(time_until_loan_end);

			const receiver = accounts[3];
			expect((await RBTC.balanceOf(receiver)).toNumber() == 0).to.be.true;

			const previousRolloverWalletBalanceSUSD = await SUSD.balanceOf(receiver);
			const previousRolloverWalletBalanceRBTC = await RBTC.balanceOf(receiver);
			const { receipt } = await sovryn.rollover(loan_id, "0x", { from: receiver });
			const latestRolloverWalletBalanceSUSD = await SUSD.balanceOf(receiver);
			const latestRolloverWalletBalanceRBTC = await RBTC.balanceOf(receiver);

			const vaultWithdrawEvents = decodeLogs(receipt.rawLogs, VaultController, "VaultWithdraw");

			const end_loan = await sovryn.getLoan(loan_id);
			const decode = decodeLogs(receipt.rawLogs, SwapsEvents, "LoanSwap");
			const loan_swap_event = decode[0].args;
			const source_token_amount_used = new BN(loan_swap_event["sourceAmount"]);

			// Make sure the rollover wallet get the rollover reward
			const rollover_reward = vaultWithdrawEvents[vaultWithdrawEvents.length - 1].args["amount"];
			expect(latestRolloverWalletBalanceRBTC.toString()).to.equal(
				previousRolloverWalletBalanceRBTC.add(new BN(rollover_reward)).toString()
			);

			expect(previousRolloverWalletBalanceSUSD.toString()).to.equal(new BN(0).toString());
			expect(latestRolloverWalletBalanceSUSD.toString()).to.equal(new BN(0).toString());
		});

		it("Test rollover reward payment with unhealthy position (margin <= 3%) should revert", async () => {
			// prepare the test
			const [, initial_loan, loan_id] = await setup_rollover_test(RBTC, SUSD, accounts, loanToken, hunEth, set_demand_curve, sovryn);

			const num = await blockNumber();
			let currentBlock = await web3.eth.getBlock(num);
			const block_timestamp = currentBlock.timestamp;
			const time_until_loan_end = initial_loan["endTimestamp"] - block_timestamp;
			await increaseTime(time_until_loan_end);

			const receiver = accounts[3];
			expect((await RBTC.balanceOf(receiver)).toNumber() == 0).to.be.true;

			// Set the rbtc price become cheaper, so that it can create the unhealth position (0% margin) because the collateral value less than the loan amount
			await priceFeeds.setRates(RBTC.address, SUSD.address, new BN(10).pow(new BN(21)).toString());
			await expectRevert(sovryn.rollover(loan_id, "0x", { from: receiver }), "unhealthy position");
		});
	});
});
