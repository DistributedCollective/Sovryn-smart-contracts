const { expect } = require("chai");
const { constants, expectRevert, BN, expectEvent } = require("@openzeppelin/test-helpers");
const { blockNumber, increaseTime } = require("../Utils/Ethereum");
const FeesEvents = artifacts.require("FeesEvents");
const TestToken = artifacts.require("TestToken");
const LoanOpenings = artifacts.require("LoanOpenings");
const MintLoanAndBorrowTest = artifacts.require("MintLoanAndBorrowTest");
const FlashLoanMockup = artifacts.require("FlashLoanMockup");
const FlashLoanAttack = artifacts.require("FlashLoanAttack");

const {
	getSUSD,
	getRBTC,
	getWRBTC,
	getBZRX,
	getSOV,
	getLoanTokenLogic,
	getLoanToken,
	getLoanTokenWRBTC,
	loan_pool_setup,
	set_demand_curve,
	lend_to_pool,
	getPriceFeeds,
	getSovryn,
	decodeLogs,
	verify_sov_reward_payment,
	CONSTANTS,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const tenEth = new BN(wei("10", "ether"));
const hunEth = new BN(wei("100", "ether"));

// This decodes longs for a single event type, and returns a decoded object in
// the same form truffle-contract uses on its receipts

contract("LoanTokenBorrowing & MintLoanAndBorrowTest", (accounts) => {
	let owner, account1;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, SOV;

	before(async () => {
		[owner, account1] = accounts;
	});

	beforeEach(async () => {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		const loanTokenLogicStandard = await getLoanTokenLogic();
		loanToken = await getLoanToken(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(loanTokenLogicStandard, owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

		SOV = await getSOV(sovryn, priceFeeds, SUSD);
	});

	describe("Flash loan attack", () => {
		it("Test borrow", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const withdrawAmount = tenEth;
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			const collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address, // loan token == underlying token
				RBTC.address, // collateral token
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(50)),
				true
			);
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			// compute expected values for asserts
			const interestRate = await loanToken.nextBorrowInterestRate(withdrawAmount);
			// principal = withdrawAmount/(1 - interestRate/1e20 * durationInSeconds /  31536000)
			const principal = withdrawAmount
				.mul(oneEth)
				.div(oneEth.sub(interestRate.mul(new BN(durationInSeconds)).mul(oneEth).div(new BN(31536000)).div(hunEth)));
			//TODO: refactor formula to remove rounding error subn(1)
			const borrowingFee = (await sovryn.borrowingFeePercent()).mul(collateralTokenSent).div(hunEth); /*.addn(1)*/
			const expectedBalance = (await SUSD.balanceOf(account1)).add(withdrawAmount);
			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent);
			const sov_initial_balance = await SOV.balanceOf(owner);

			// borrow some funds
			const { tx, receipt } = await loanToken.borrow(
				"0x0", // bytes32 loanId
				withdrawAmount, // uint256 withdrawAmount
				durationInSeconds, // uint256 initialLoanDuration
				collateralTokenSent, // uint256 collateralTokenSent
				RBTC.address, // address collateralTokenAddress
				owner, // address borrower
				account1, // address receiver
				web3.utils.fromAscii("") // bytes memory loanDataBytes
			);
			// assert the trade was processed as expected
			await expectEvent.inTransaction(tx, LoanOpenings, "Borrow", {
				user: owner,
				lender: loanToken.address,
				loanToken: SUSD.address,
				collateralToken: RBTC.address,
				newPrincipal: principal,
				newCollateral: collateralTokenSent.sub(borrowingFee),
				interestRate: interestRate,
			});
			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Borrow");
			const args = decode[0].args;

			expect(args["interestDuration"] >= durationInSeconds - 1 && args["interestDuration"] <= durationInSeconds).to.be.true;
			expect(new BN(args["currentMargin"])).to.be.a.bignumber.gt(new BN(49).mul(oneEth));

			// assert the user received the borrowed amount
			expect(await SUSD.balanceOf(account1)).to.be.a.bignumber.equal(expectedBalance);
			await verify_sov_reward_payment(receipt.rawLogs, FeesEvents, SOV, owner, args["loanId"], sov_initial_balance, 1);
		});

		it("Mint, Borrow and Burn in 1 tx should fail", async () => {
			// underlying token is SUSD
			// loan pool token is iSUSD (loanToken)
			// collateral token is RBTC

			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);

			// determine borrowing parameter
			const withdrawAmount = tenEth;
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			const collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(50)),
				true
			);
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			// compute expected values for asserts
			const interestRate = await loanToken.nextBorrowInterestRate(withdrawAmount);
			// principal = withdrawAmount/(1 - interestRate/1e20 * durationInSeconds /  31536000)
			const principal = withdrawAmount
				.mul(oneEth)
				.div(oneEth.sub(interestRate.mul(new BN(durationInSeconds)).mul(oneEth).div(new BN(31536000)).div(hunEth)));
			//TODO: refactor formula to remove rounding error subn(1)
			const borrowingFee = (await sovryn.borrowingFeePercent()).mul(collateralTokenSent).div(hunEth); /*.addn(1)*/
			const expectedBalance = (await SUSD.balanceOf(account1)).add(withdrawAmount);
			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent);
			const sov_initial_balance = await SOV.balanceOf(owner);

			const hackAmount = hunEth;

			// Deploy test contract
			const mintLoanAndBorrowTest = await MintLoanAndBorrowTest.new();

			// Check balances
			console.log("SOV_initial_balance: " + (await SOV.balanceOf(owner)));
			/// SOV_initial_balance: 99999999999999999999999999999900000000000000000000

			console.log("RBTC_initial_balance: " + (await RBTC.balanceOf(owner)));
			/// RBTC_initial_balance: 100000000000000000000000000000000000000000000000000

			console.log("SUSD_initial_balance: " + (await SUSD.balanceOf(owner)));
			/// SUSD_initial_balance: 100000000000000000000000000000000000000000000000000

			console.log("Test contract address: " + mintLoanAndBorrowTest.address);

			// Send underlying tokens SUSD to the test contract. Later it will spend those
			// on hacking the lending pool.
			await SUSD.transfer(mintLoanAndBorrowTest.address, hackAmount);

			// Send collateral tokens RBTC to the test contract. Later it will spend those
			// on borrowing.
			await RBTC.transfer(mintLoanAndBorrowTest.address, collateralTokenSent);

			// Check underlying token balance of test contract.
			console.log("SUSD balance on test contract: " + (await SUSD.balanceOf(mintLoanAndBorrowTest.address)));
			/// SUSD balance on test contract: 100000000000000000000

			// Check underlying token balance of test contract w/ contract function.
			console.log("SUSD balance on test contract: " + (await mintLoanAndBorrowTest.getBalance(SUSD.address)));

			// Check collateral token balance of test contract.
			console.log("RBTC balance on test contract: " + (await RBTC.balanceOf(mintLoanAndBorrowTest.address)));
			/// RBTC balance on test contract: 1501350000000000

			// Approve the transfer of the collateral.
			// This should be done by the very test contract, not by the owner.
			// await RBTC.approve(loanToken.address, collateralTokenSent);

			// Call the test contract hack.
			await expectRevert(
				mintLoanAndBorrowTest.callMintAndBorrowAndBurn(
					SUSD.address, // address of the underlying token
					loanToken.address, // address of the lending pool token
					RBTC.address, // address of the collateral token
					hackAmount, // rBTC amount to hack the lending pool
					withdrawAmount,
					collateralTokenSent
				),
				"Avoiding flash loan attack: several txs in same block from same account."
			);
		});

		it("Flash loan attack should fail", async () => {
			// **** SETUP LOAN POOL TO BE HACKED, iSUSD **** //

			// underlying token is SUSD
			// loan pool token to hack is iSUSD (loanToken)
			// collateral token is RBTC

			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);

			// determine borrowing parameter
			const withdrawAmount = tenEth;
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			const collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(50)),
				true
			);
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			// compute expected values for asserts
			const interestRate = await loanToken.nextBorrowInterestRate(withdrawAmount);
			// principal = withdrawAmount/(1 - interestRate/1e20 * durationInSeconds /  31536000)
			const principal = withdrawAmount
				.mul(oneEth)
				.div(oneEth.sub(interestRate.mul(new BN(durationInSeconds)).mul(oneEth).div(new BN(31536000)).div(hunEth)));
			//TODO: refactor formula to remove rounding error subn(1)
			const borrowingFee = (await sovryn.borrowingFeePercent()).mul(collateralTokenSent).div(hunEth); /*.addn(1)*/
			const expectedBalance = (await SUSD.balanceOf(account1)).add(withdrawAmount);
			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent);
			const sov_initial_balance = await SOV.balanceOf(owner);

			const hackAmount1 = tenEth;
			const hackAmount2 = hunEth;

			// **** DEPLOY ATTACK AND 3RD PARTY FL CONTRACTS **** //

			// Deploy third party flash loan provider contract.
			const flashLoanMockup = await FlashLoanMockup.new();

			// Fill it up with underlying tokens to provide funds when FL-ing hackAmount.
			await SUSD.transfer(flashLoanMockup.address, hackAmount2);

			// Setup underlying token on FL mockup contract.
			await flashLoanMockup.settings(SUSD.address);

			// Deploy hack contract.
			const flashLoanAttack = await FlashLoanAttack.new();

			// Configure hack contract.
			await flashLoanAttack.hackSettings(
				loanToken.address, // iTokenToHack
				RBTC.address, // collateralToken
				withdrawAmount,
				collateralTokenSent
			);

			// Fill it up with collateral tokens RBTC. Later it will spend those
			// on unfair borrowing.
			await RBTC.transfer(flashLoanAttack.address, collateralTokenSent);

			// **** BALANCES **** //

			// Check owner balances
			console.log("RBTC owner balance: " + (await RBTC.balanceOf(owner)));
			/// RBTC owner balance: 99999999999999999999999999999999998498650000000000

			console.log("SUSD owner balance: " + (await SUSD.balanceOf(owner)));
			/// SUSD owner balance: 99999999999999999999999999999900000000000000000000

			// Check flashLoanMockup & flashLoanAttack contract addresses.
			console.log("flashLoanMockup contract address: " + flashLoanMockup.address);
			console.log("flashLoanAttack contract address: " + flashLoanAttack.address);

			// Check underlying token balance of flashLoanMockup contract.
			console.log("SUSD balance on flashLoanMockup contract: " + (await SUSD.balanceOf(flashLoanMockup.address)));
			/// SUSD balance on flashLoanMockup contract: 100000000000000000000 (hunEth)

			// Check underlying token balance of flashLoanAttack contract.
			console.log("SUSD balance on flashLoanAttack contract: " + (await SUSD.balanceOf(flashLoanAttack.address)));
			/// SUSD balance on flashLoanAttack contract: 0

			// Check collateral token balance of flashLoanMockup contract.
			console.log("RBTC balance on flashLoanMockup contract: " + (await RBTC.balanceOf(flashLoanMockup.address)));
			/// RBTC balance on flashLoanMockup contract: 0

			// Check collateral token balance of flashLoanAttack contract.
			console.log("RBTC balance on flashLoanAttack contract: " + (await RBTC.balanceOf(flashLoanAttack.address)));
			/// RBTC balance on flashLoanAttack contract: 1501350000000000

			// **** RUN ATTACK directly (no FL) **** //

			// Fill it up with underlying tokens to attack directly w/o FL.
			await SUSD.transfer(flashLoanAttack.address, hackAmount1);

			await expectRevert(
				flashLoanAttack.hackTheLoanPool(
					SUSD.address, // address of the underlying token
					hackAmount1 // rBTC amount to hack the lending pool
				),
				"Avoiding flash loan attack: several txs in same block from same account."
			);

			// **** RUN ATTACK through FL contract **** //

			// Call the flashLoanAttack to run the attack.
			await expectRevert(
				flashLoanAttack.doStuffWithFlashLoan(
					SUSD.address, // address of the underlying token
					flashLoanMockup.address, // address of the lending pool to request the FL.
					hackAmount2 // rBTC amount to hack the lending pool
				),
				"Avoiding flash loan attack: several txs in same block from same account."
			);
		});

		it("Loan attack w/o FL should success", async () => {
			// Equivalent to Pyhton test_margin_trading_sending_loan_tokens

			// **** SETUP LOAN POOL TO BE ALTERED, iSUSD **** //

			const underlyingToken = SUSD;
			// loan pool token to alter is iSUSD (loanToken)
			const collateralToken = WRBTC;

			console.log("PREPARATION");

			// Amount to be sent for margin trade
			loan_token_sent = oneEth; // new BN(10).pow(new BN(18));
			console.log("Amount to be sent for margin trade, loan_token_sent: " + loan_token_sent);
			// Amount to be sent for margin trade, loan_token_sent: 1000000000000000000 (1 Eth)

			console.log("Legitimate users add liquidity to the loan token");

			const baseLiquidity = loan_token_sent.mul(new BN(105)).div(new BN(100)); // loan_token_sent * 1.1
			console.log("baseLiquidity: ", baseLiquidity.toString());
			// baseLiquidity: 1100000000000000000 (1.1 SUSD)

			// Give liquidity to the provider 1.
			await underlyingToken.mint(accounts[1], baseLiquidity);

			// Transfer liquidity (1.1 SUSD) to the loan pool.
			await underlyingToken.approve(loanToken.address, baseLiquidity, { from: accounts[1] });
			await loanToken.mint(accounts[1], baseLiquidity, { from: accounts[1] });

			// Set up interest rates.
			var baseRate = oneEth;
			var rateMultiplier = oneEth.mul(new BN(2025)).div(new BN(100)); // 20.25e18
			var targetLevel = oneEth.mul(new BN(80)); // 80*10**18
			var kinkLevel = oneEth.mul(new BN(90)); // 90*10**18
			var maxScaleRate = oneEth.mul(new BN(100)); // 100*10**18
			await loanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);
			var borrowInterestRate = await loanToken.borrowInterestRate();
			console.log("Base borrow interest rate (not adjusted by utilization): ", borrowInterestRate.div(oneEth).toString());
			// Base borrow interest rate (not adjusted by utilization): 17

			console.log("First trade, without the attack strategy");

			// Give liquidity to the trader 0.
			await underlyingToken.mint(accounts[0], loan_token_sent);

			// Ready to transfer it to the loan pool.
			await underlyingToken.approve(loanToken.address, loan_token_sent);

			// Send the margin trade transaction.
			var leverage_amount = oneEth;
			var collateral_sent = new BN(0);
			var { receipt } = await loanToken.marginTrade(
				constants.ZERO_BYTES32, // loanId  (0 for new loans)
				leverage_amount.toString(),
				loan_token_sent.toString(),
				collateral_sent.toString(), // no collateral token sent
				collateralToken.address,
				accounts[0], // trader
				"0x" // loanDataBytes (only required with ether)
			);

			// Get loan info from logs.
			var decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
			var args = decode[0].args;
			var loan_id = args["loanId"];
			var positionSize = args["positionSize"];
			var loan = await sovryn.getLoan(loan_id);

			// Interest paid per day is high because of high utilization rate.
			console.log("Interest per day (without attack): ", loan["interestOwedPerDay"] / 10 ** 15);
			expect(loan["interestOwedPerDay"] / 10 ** 15).to.equal(1.768000054768636);

			// Repays the loan (so that the tokens are there to be loaned again).
			await sovryn.closeWithSwap(loan_id, accounts[0], positionSize, false, "0x");

			// Now do the same loan again, but use a flash loan to lower interest.

			// Amount attacker will get in flash loan
			// that means attacker can borrow at the base rate,
			// regardless of actual utilization rate
			// by temporarily lowering utilization rate with a flash loan
			// from a third-party.
			const flashLoanAmount = loan_token_sent.mul(new BN(100));

			// We simulate the flash loan by minting tokens to the attacker account
			// the attacker already owns loan_token_sent before the loan
			// begin flash loan attack:
			await underlyingToken.mint(accounts[0], loan_token_sent + flashLoanAmount);

			// Deposit liquidity 100 SUSD to the loan token.
			await underlyingToken.approve(loanToken.address, loan_token_sent + flashLoanAmount);
			await loanToken.mint(accounts[0], flashLoanAmount);

			console.log("Repeating the trade but with the attack flash loan.");
			/* Second time, NOT NECESSARY
			// Set up interest rates.
			baseRate = oneEth;
			rateMultiplier = oneEth.mul(new BN(2025)).div(new BN(100)); // 20.25e18
			targetLevel = oneEth.mul(new BN(80)); // 80*10**18
			kinkLevel = oneEth.mul(new BN(90)); // 90*10**18
			maxScaleRate = oneEth.mul(new BN(100)); // 100*10**18
			await loanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);
			*/

			borrowInterestRate = await loanToken.borrowInterestRate();
			console.log("Base borrow interest rate (not adjusted by utilization): ", borrowInterestRate.div(oneEth).toString());
			// Base borrow interest rate (not adjusted by utilization): 17

			// Send the margin trade transaction.
			leverage_amount = oneEth;
			collateral_sent = new BN(0);
			var { receipt } = await loanToken.marginTrade(
				constants.ZERO_BYTES32, // loanId  (0 for new loans)
				leverage_amount.toString(),
				loan_token_sent.toString(),
				collateral_sent.toString(), // no collateral token sent
				collateralToken.address,
				accounts[0], // trader
				"0x" // loanDataBytes (only required with ether)
			);

			// Get loan info from logs.
			decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
			args = decode[0].args;
			loan_id = args["loanId"];
			positionSize = args["positionSize"];
			loan = await sovryn.getLoan(loan_id);

			// Interest paid per day is lower than without flash loan.
			console.log("Interest per day (with attack): ", loan["interestOwedPerDay"] / 10 ** 15);
			expect(loan["interestOwedPerDay"] / 10 ** 15).to.equal(0.477533704995224);

			// Conclusion:
			// Providing low liquidity of 1.1 SUSD, trading 1 SUSD (high utilization: ~91%)
			//   costs a daily interest of 0.74%
			// Providing high liquidity of 100 SUSD, trading 1 SUSD (low utilization: 1%)
			//   costs a daily interest of 0.47%

			/*
				Profiling interest and deposit values:

				104/100 (1.040 SUSD):
					sentAmounts[1] = 1055799386991083000 (1.055 SUSD)
					_underlyingBalance() = 1040000000000000000 (1.040 SUSD)

				_borrowOrTrade::sentAmounts
				borrow::
					sentAmounts[1] = withdrawAmount;
					borrow::withdrawAmount
				marginTrade::
					sentAmounts[1] = totalDeposit; /// Total amount of deposit.
					uint256 totalDeposit = _totalDeposit(collateralTokenAddress, collateralTokenSent, loanTokenSent);
					marginTrade::loanTokenSent
						loan_token_sent = oneEth;

				uint256 totalDeposit = _totalDeposit(collateralTokenAddress, collateralTokenSent, loanTokenSent);
					collateralTokenSent = 0
					loanTokenSent = 1000000000000000000 (1 SUSD)
					totalDeposit = 1000000000000000000 (1 SUSD)

				(sentAmounts[1], sentAmounts[0]) = _getMarginBorrowAmountAndRate( /// borrowAmount, interestRate
					leverageAmount,
					sentAmounts[1] /// depositAmount
				);
					depositAmount => borrowAmount
						1.000 => 1.055799

				So, edge case near liquidity = 1.055800

				Limit point: 105/100 (1.050 SUSD):
					borrowAmount = 1.049504001533521828
					interest: 1.768000054768636

				Conclusion:

				Interest curve is not very extreme. It's value swifts around 1.76%
				(higher bound) and 0.47% (lower bound) w/ liquidities ranging
				from 1.050 SUSD to 100 SUSD and margin trading depositAmount of 1 SUSD.

				So an attack (flash loan or not, although FL are not allowed anymore
				due to check implemented on NotInTheSameBlock branch) would give
				the LP an advantage of getting loans with a lower interest of
				around 1.3% on most extreme case (maximum utilization of the loan pool).
			*/
		});
	});
});
