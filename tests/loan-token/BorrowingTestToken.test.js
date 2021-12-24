/** Speed optimized on branch hardhatTestRefactor, 2021-09-23
 * Bottlenecks found at beforeEach hook, redeploying tokens,
 *  protocol, ... on every test.
 *
 * Total time elapsed: 16.0s
 * After optimization: 7.3s
 *
 * Other minor optimizations:
 * - removed unneeded variables
 *
 * Notes: Applied fixture to use snapshot beforeEach test.
 */

const { expect, assert } = require("chai");
const { waffle } = require("hardhat");
const { loadFixture } = waffle;
const { expectRevert, BN, expectEvent } = require("@openzeppelin/test-helpers");
const FeesEvents = artifacts.require("FeesEvents");
const LoanOpenings = artifacts.require("LoanOpenings");

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
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const tenEth = new BN(wei("10", "ether"));
const hunEth = new BN(wei("100", "ether"));

// This decodes longs for a single event type, and returns a decoded object in
// the same form truffle-contract uses on its receipts

contract("LoanTokenBorrowing", (accounts) => {
	let owner, account1;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, SOV, priceFeeds;

	async function deploymentAndInitFixture(_wallets, _provider) {
		SUSD = await getSUSD();
		RBTC = await getRBTC();
		WRBTC = await getWRBTC();
		BZRX = await getBZRX();
		priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, BZRX);

		sovryn = await getSovryn(WRBTC, SUSD, RBTC, priceFeeds);

		loanToken = await getLoanToken(owner, sovryn, WRBTC, SUSD);
		loanTokenWRBTC = await getLoanTokenWRBTC(owner, sovryn, WRBTC, SUSD);
		await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC);

		SOV = await getSOV(sovryn, priceFeeds, SUSD, accounts);
	}

	before(async () => {
		[owner, account1] = accounts;
	});

	beforeEach(async () => {
		await loadFixture(deploymentAndInitFixture);
	});

	describe("Test borrow", () => {
		it("Test getRequiredCollateral w/ marginAmount = 0", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const withdrawAmount = tenEth;

			const collateralTokenSent = await sovryn.getRequiredCollateral(SUSD.address, RBTC.address, withdrawAmount, new BN(0), true);
			// console.log("collateralTokenSent = ", collateralTokenSent.toString());
			expect(collateralTokenSent).to.be.a.bignumber.equal(new BN(0));
		});

		it("Test getBorrowAmount w/ marginAmount = 0", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const withdrawAmount = tenEth;

			const borrowAmount = await sovryn.getBorrowAmount(SUSD.address, RBTC.address, withdrawAmount, new BN(0), true);
			// console.log("borrowAmount = ", borrowAmount.toString());
			expect(borrowAmount).to.be.a.bignumber.equal(new BN(0));
		});

		it("Test getBorrowAmount w/ and w/o Torque Loan", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const withdrawAmount = tenEth;
			let marginAmount = new BN(10).pow(new BN(20)).mul(new BN(1));

			// Without TorqueLoan
			const borrowAmountNoTorque = await sovryn.getBorrowAmount(
				SUSD.address, // loanToken
				RBTC.address, // collateralToken
				withdrawAmount, // collateralTokenAmount
				marginAmount,
				false // isTorqueLoan
			);
			// console.log("borrowAmountNoTorque = ", borrowAmountNoTorque.toString());

			// Compute expected values
			const { rate: trade_rate, precision } = await priceFeeds.queryRate(RBTC.address, SUSD.address);
			// console.log("trade_rate = ", trade_rate.toString());
			// console.log("precision = ", precision.toString());

			const tradingFee = (await sovryn.tradingFeePercent()).mul(withdrawAmount).div(hunEth);
			let expectedBorrowAmountNoTorque = withdrawAmount.sub(tradingFee);
			expectedBorrowAmountNoTorque = expectedBorrowAmountNoTorque.mul(new BN(10).pow(new BN(20))).mul(trade_rate);
			expectedBorrowAmountNoTorque = expectedBorrowAmountNoTorque.div(marginAmount).div(precision);

			// Check expected = real
			expect(borrowAmountNoTorque).to.be.a.bignumber.equal(expectedBorrowAmountNoTorque);

			// With TorqueLoan
			const borrowAmountTorque = await sovryn.getBorrowAmount(
				SUSD.address, // loanToken
				RBTC.address, // collateralToken
				withdrawAmount, // collateralTokenAmount
				marginAmount,
				true // isTorqueLoan
			);
			// console.log("borrowAmountTorque = ", borrowAmountTorque.toString());

			// Compute expected values
			marginAmount = marginAmount.add(new BN(10).pow(new BN(20))); // Torque increases the margin
			const borrowingFee = (await sovryn.borrowingFeePercent()).mul(withdrawAmount).div(hunEth);
			let expectedBorrowAmountTorque = withdrawAmount.sub(borrowingFee);
			expectedBorrowAmountTorque = expectedBorrowAmountTorque
				.mul(new BN(10).pow(new BN(20)))
				.mul(trade_rate)
				.div(marginAmount)
				.div(precision);

			// Check expected = real
			expect(borrowAmountTorque).to.be.a.bignumber.equal(expectedBorrowAmountTorque);
		});

		it("Test borrow", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const withdrawAmount = tenEth;
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			// NOTE: this is not the best method for computing the required collateral for borrowing, because it is not considering the interest payment
			// better use getDepositAmountForBorrow -> need to adjust the rest of the test as well, then
			const collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(50)),
				true
			);

			// compute expected values for asserts
			const interestRate = await loanToken.nextBorrowInterestRate(withdrawAmount);
			// principal = withdrawAmount/(1 - interestRate/1e20 * durationInSeconds /  31536000)
			const principal = withdrawAmount
				.mul(oneEth)
				.div(oneEth.sub(interestRate.mul(new BN(durationInSeconds)).mul(oneEth).div(new BN(31536000)).div(hunEth)));
			// TODO: refactor formula to remove rounding error subn(1)
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
			await verify_sov_reward_payment(
				receipt.rawLogs,
				FeesEvents,
				SOV,
				owner,
				args["loanId"],
				sov_initial_balance,
				1,
				RBTC.address,
				SUSD.address,
				sovryn
			);
		});

		it("Test borrow with special rebates percentage", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			// For borrowing, the token fee is the collateral token
			await sovryn.setSpecialRebates(RBTC.address, SUSD.address, wei("300", "ether"));

			/// @dev fast checking previously added rebates
			let rebates = await sovryn.getSpecialRebates.call(RBTC.address, SUSD.address);

			expect(rebates).to.be.a.bignumber.equal(wei("300", "ether"));

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
			// TODO: refactor formula to remove rounding error subn(1)
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
			await verify_sov_reward_payment(
				receipt.rawLogs,
				FeesEvents,
				SOV,
				owner,
				args["loanId"],
				sov_initial_balance,
				1,
				RBTC.address,
				SUSD.address,
				sovryn
			);
		});

		it("Test borrow 0 collateral should fail", async () => {
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			await expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					10, // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					0, // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0" // bytes memory loanDataBytes
				),
				"7"
			);
		});

		it("Test borrow 0 withdraw should fail", async () => {
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					0, // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					10, // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0" // bytes memory loanDataBytes
				),
				"6"
			);
		});

		it("Test borrow sending value with tokens should fail", async () => {
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					10, // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					10, // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0", // bytes memory loanDataBytes
					{ value: 100 }
				),
				"7"
			);
		});

		it("Test borrow invalid collateral should fail", async () => {
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			await expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					10, // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					10, // uint256 collateralTokenSent
					CONSTANTS.ZERO_ADDRESS, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0" // bytes memory loanDataBytes
				),
				"7"
			);

			expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					10, // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					10, // uint256 collateralTokenSent
					SUSD.address, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0" // bytes memory loanDataBytes
				),
				"10"
			);
		});

		it("Test borrow no interest should fail", async () => {
			// no demand curve settings -> no interest set
			// prepare the test
			await lend_to_pool(loanToken, SUSD, owner);

			// determine borrowing parameter
			const withdrawAmount = oneEth.mul(new BN(10)); // I want to borrow 10 USD
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			const collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(50).pow(new BN(18)),
				true
			);

			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent);
			expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					withdrawAmount, // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					collateralTokenSent, // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0" // bytes memory loanDataBytes
				),
				"invalid interest"
			);
		});

		it("Test borrow insufficient collateral should fail", async () => {
			// prepare the test

			await lend_to_pool(loanToken, SUSD, owner);
			await set_demand_curve(loanToken);

			// determine borrowing parameter
			const withdrawAmount = oneEth.mul(new BN(10)); // I want to borrow 10 USD
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			let collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(50)),
				true
			);
			collateralTokenSent = collateralTokenSent.div(new BN(2));

			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent);
			expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					withdrawAmount, // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					collateralTokenSent, // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0" // bytes memory loanDataBytes
				),
				"collateral insufficient"
			);
		});

		// borrows some funds from account 0 and then takes out some more from account 2 with 'borrow' without paying should fail.
		it("Test borrow from foreign loan should fail", async () => {
			// prepare the test

			await lend_to_pool(loanToken, SUSD, owner);
			await set_demand_curve(loanToken);

			// determine borrowing parameter
			const withdrawAmount = oneEth.mul(new BN(10)); // I want to borrow 10 USD
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			let collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(50)),
				true
			);
			collateralTokenSent = collateralTokenSent.mul(new BN(2));
			const durationInSeconds = 60 * 60 * 24 * 10;

			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent);
			const borrower = accounts[0];

			const { receipt } = await loanToken.borrow(
				"0x0", // bytes32 loanId
				withdrawAmount, // uint256 withdrawAmount
				durationInSeconds, // uint256 initialLoanDuration
				collateralTokenSent, // uint256 collateralTokenSent
				RBTC.address, // address collateralTokenAddress
				borrower, // address borrower
				account1, // address receiver
				"0x0" // bytes memory loanDataBytes
			);

			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Borrow");
			const loanId = decode[0].args["loanId"];

			await RBTC.transfer(accounts[2], collateralTokenSent);
			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent, { from: accounts[2] });

			await expectRevert(
				loanToken.borrow(
					loanId, // bytes32 loanId
					withdrawAmount.div(new BN(2)), // uint256 withdrawAmount
					durationInSeconds, // uint256 initialLoanDuration
					1, // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					borrower, // address borrower
					accounts[2], // address receiver
					"0x0", // bytes memory loanDataBytes
					{ from: accounts[2] }
				),
				"7"
			);
		});

		// borrows some funds from account 0 and then takes out some more from account 2 with a marginTrade without paying should fail.
		it("Test margin trade from foreign loan should fail", async () => {
			// prepare the test

			await lend_to_pool(loanToken, SUSD, owner);
			await set_demand_curve(loanToken);

			// determine borrowing parameter
			const withdrawAmount = oneEth.mul(new BN(10)); // I want to borrow 10 USD
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			let collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(50)),
				true
			);
			collateralTokenSent = collateralTokenSent.mul(new BN(2));
			const durationInSeconds = 60 * 60 * 24 * 10;

			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent);
			const borrower = accounts[0];

			const { receipt } = await loanToken.borrow(
				"0x0", // bytes32 loanId
				withdrawAmount, // uint256 withdrawAmount
				durationInSeconds, // uint256 initialLoanDuration
				collateralTokenSent, // uint256 collateralTokenSent
				RBTC.address, // address collateralTokenAddress
				borrower, // address borrower
				account1, // address receiver
				web3.utils.fromAscii("") // bytes memory loanDataBytes
			);

			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Borrow");
			const loanId = decode[0].args["loanId"];

			await SUSD.transfer(accounts[2], collateralTokenSent);
			// approve the transfer of the collateral
			await SUSD.approve(loanToken.address, collateralTokenSent, { from: accounts[2] });

			await expectRevert(
				loanToken.marginTrade(
					loanId, // bytes32 loanId
					oneEth, // uint256 withdrawAmount
					10000000, // uint256 collateralTokenSent
					0,
					RBTC.address, // address collateralTokenAddress
					accounts[2], // address receiver
					0,
					"0x0", // bytes memory loanDataBytes
					{ from: accounts[2] }
				),
				"borrower mismatch"
			);
		});

		// margin trades from account 0 and then borrows from same loan should fail.
		it("Test borrow from trade position should fail", async () => {
			// prepare the test

			await lend_to_pool(loanToken, SUSD, owner);
			await set_demand_curve(loanToken);

			// determine borrowing parameter
			const withdrawAmount = oneEth.mul(new BN(10)); // I want to borrow 10 USD

			await SUSD.approve(loanToken.address, withdrawAmount);

			const { receipt } = await loanToken.marginTrade(
				"0x0", // bytes32 loanId
				oneEth, // uint256 withdrawAmount
				withdrawAmount, // uint256 collateralTokenSent
				0,
				RBTC.address, // address collateralTokenAddress
				accounts[0], // address receiver
				0,
				"0x" // bytes memory loanDataBytes
			);

			const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
			const loanId = decode[0].args["loanId"];

			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, withdrawAmount);

			await expectRevert(
				loanToken.borrow(
					loanId, // bytes32 loanId
					withdrawAmount.div(new BN(10)), // uint256 withdrawAmount
					60 * 60 * 24 * 10, // uint256 initialLoanDuration
					1, // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					accounts[0], // address borrower
					accounts[0], // address receiver
					"0x" // bytes memory loanDataBytes
				),
				"loanParams mismatch"
			);
		});

		// 50% was hardcoded on the old contracts -> would have failed, but should work now
		it("Borrowing with more than 50% initial margin", async () => {
			await set_demand_curve(loanToken);
			await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC, wei("100", "ether"));
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const withdrawAmount = tenEth;
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			// compute the required collateral
			const collateralTokenSent = await loanToken.getDepositAmountForBorrow(withdrawAmount, durationInSeconds, RBTC.address);

			// TODO: refactor formula to remove rounding error subn(1)
			const borrowingFee = (await sovryn.borrowingFeePercent()).mul(collateralTokenSent).div(hunEth).addn(1);

			// compute expected values for asserts
			const interestRate = await loanToken.nextBorrowInterestRate(withdrawAmount);
			// principal = withdrawAmount/(1 - interestRate/1e20 * durationInSeconds /  31536000)
			const principal = withdrawAmount
				.mul(oneEth)
				.div(oneEth.sub(interestRate.mul(new BN(durationInSeconds)).mul(oneEth).div(new BN(31536000)).div(hunEth)));

			// approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent);

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
			expect(new BN(args["currentMargin"])).to.be.a.bignumber.gt(new BN(99).mul(oneEth));
		});

		/// @dev For test coverage
		it("getDepositAmountForBorrow should return 0 when borrowAmount is 0", async () => {
			await set_demand_curve(loanToken);
			await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC, wei("100", "ether"));
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const borrowAmount = new BN(0);
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			const collateralTokenSent = await loanToken.getDepositAmountForBorrow(borrowAmount, durationInSeconds, RBTC.address);

			expect(collateralTokenSent).to.be.bignumber.equal(new BN(0));
		});

		it("getDepositAmountForBorrow should consider the initial margin on the loan params", async () => {
			await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC, wei("100", "ether"));
			await lend_to_pool(loanToken, SUSD, owner);

			// determine borrowing parameter
			const withdrawAmount = tenEth;
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days

			const requiredCollateralOnProtocol = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(100)),
				true
			);

			const requiredCollateralOnLoanToken = await loanToken.getDepositAmountForBorrow(
				withdrawAmount,
				durationInSeconds,
				RBTC.address
			);
			expect(requiredCollateralOnProtocol).to.be.bignumber.equal(requiredCollateralOnLoanToken.subn(10));
		});

		it("getBorrowAmountForDeposit should consider the initial margin on the loan params", async () => {
			await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC, wei("100", "ether"));
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const depositAmount = tenEth;
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			const borrowAmount = await loanToken.getBorrowAmountForDeposit(depositAmount, durationInSeconds, RBTC.address);
			const { rate: trade_rate, precision } = await priceFeeds.queryRate(RBTC.address, SUSD.address);
			const borrowingFeePercent = await sovryn.borrowingFeePercent();
			const fee = depositAmount.divn(2).mul(borrowingFeePercent).div(hunEth);
			const expectedBorrowAmount = depositAmount.divn(2).sub(fee).mul(trade_rate).div(precision);

			expect(borrowAmount).to.be.bignumber.equal(expectedBorrowAmount);
		});

		/// @dev For test coverage
		it("getBorrowAmountForDeposit should return 0 when depositAmount is 0", async () => {
			await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC, wei("100", "ether"));
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const depositAmount = new BN(0);
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			const borrowAmount = await loanToken.getBorrowAmountForDeposit(depositAmount, durationInSeconds, RBTC.address);

			expect(borrowAmount).to.be.bignumber.equal(new BN(0));
		});

		/// @dev For test coverage
		it("getBorrowAmountForDeposit should set collateralTokenAddress = wrbtcTokenAddress when collateralTokenAddress is 0", async () => {
			await loan_pool_setup(sovryn, owner, RBTC, WRBTC, SUSD, loanToken, loanTokenWRBTC, wei("100", "ether"));
			await lend_to_pool(loanToken, SUSD, owner);
			// determine borrowing parameter
			const depositAmount = tenEth;
			const durationInSeconds = 60 * 60 * 24 * 10; // 10 days
			const borrowAmount1 = await loanToken.getBorrowAmountForDeposit(depositAmount, durationInSeconds, ZERO_ADDRESS);
			const borrowAmount2 = await loanToken.getBorrowAmountForDeposit(depositAmount, durationInSeconds, RBTC.address);

			expect(borrowAmount1).to.be.bignumber.equal(borrowAmount2);
		});

		/// @dev Testing the interest rate calculations for the range [0,k]
		it("Checking that the interest rate is calculated correctly when utilization rate is [0,k]", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);

			// determine borrowing parameter
			const withdrawAmount = tenEth;

			// compute expected values for asserts
			const interestRate = await loanToken.nextBorrowInterestRate(withdrawAmount);

			// Replicate the values of demand curve
			const baseRate = wei("1", "ether");
			const rateMultiplier = wei("20.25", "ether");
			const targetLevel = wei("80", "ether");

			// Utilization Rate
			const totalAssetBorrow = await loanToken.totalAssetBorrow();
			const totalAssetSupply = await loanToken.totalAssetSupply();
			const assetBorrow = totalAssetBorrow.add(withdrawAmount);
			let utilizationRate = assetBorrow.mul(new BN(10).pow(new BN(20))).div(totalAssetSupply);
			if (utilizationRate < targetLevel) utilizationRate = targetLevel;

			// Interest rate calculation
			// in the interval [0,k] : f(x) = b + m*x, where b is the base rate, m is the rate multiplier and x is the utilization rate
			const calculatedRate = new BN(baseRate).add(
				new BN(rateMultiplier).mul(new BN(utilizationRate)).div(new BN(10).pow(new BN(20)))
			);
			expect(interestRate).to.be.a.bignumber.equal(calculatedRate);
		});

		/// @dev Testing the math changes for interest rate calculations for the range (k,100]
		it("Checking that the interest rate is calculated correctly when utilization rate is (k,100]", async () => {
			// prepare the test
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);

			// determine borrowing parameter
			const withdrawAmount = new BN(wei("990000000000", "ether")); //Borrow amount above Kink Level

			// compute expected values for asserts
			const interestRate = await loanToken.nextBorrowInterestRate(withdrawAmount);

			// Replicate the values of demand curve
			const baseRate = wei("1", "ether");
			const rateMultiplier = wei("20.25", "ether");
			const targetLevel = wei("80", "ether");
			const kinkLevel = wei("90", "ether");
			const maxScaleRate = wei("100", "ether");

			// Utilization Rate
			const totalAssetBorrow = await loanToken.totalAssetBorrow();
			const totalAssetSupply = await loanToken.totalAssetSupply();
			const assetBorrow = totalAssetBorrow.add(withdrawAmount);
			let utilizationRate = assetBorrow.mul(new BN(10).pow(new BN(20))).div(totalAssetSupply);
			if (utilizationRate < targetLevel) utilizationRate = targetLevel;

			// Interest rate calculation
			// In the interval (k, 100] : let z = (b + m * k)
			const calculatedRate = new BN(baseRate).add(new BN(rateMultiplier).mul(new BN(kinkLevel)).div(new BN(10).pow(new BN(20))));

			// Then f(x) = z + (s - z)*(x - k)/(100-k), where s is the maximum scale rate (could be 100% or 150%)
			const interest = new BN(calculatedRate).add(
				new BN(new BN(maxScaleRate))
					.sub(new BN(calculatedRate))
					.mul(new BN(utilizationRate).sub(new BN(kinkLevel)))
					.div(new BN(new BN(10).pow(new BN(20))).sub(new BN(kinkLevel)))
			);
			expect(interestRate).to.be.a.bignumber.equal(interest);
		});
	});
});
