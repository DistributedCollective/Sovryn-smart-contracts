const { expect } = require("chai");
const { expectRevert, BN, expectEvent } = require("@openzeppelin/test-helpers");
const FeesEvents = artifacts.require("FeesEvents");
const TestToken = artifacts.require("TestToken");
const LoanOpenings = artifacts.require("LoanOpenings");
const MintLoanAndBorrowTest = artifacts.require("MintLoanAndBorrowTest");

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
		const priceFeeds = await getPriceFeeds(WRBTC, SUSD, RBTC, sovryn, BZRX);

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
			console.log("\nsov_initial_balance: " + (await SOV.balanceOf(owner)));
			/// SOV_initial_balance: 99999999999999999999999999999900000000000000000000

			console.log("\nRBTC_initial_balance: " + (await RBTC.balanceOf(owner)));
			/// RBTC_initial_balance: 100000000000000000000000000000000000000000000000000

			console.log("\nSUSD_initial_balance: " + (await SUSD.balanceOf(owner)));
			/// SUSD_initial_balance: 100000000000000000000000000000000000000000000000000

            console.log("\nTest contract address: " + mintLoanAndBorrowTest.address);

			// Send underlying tokens SUSD to the test contract. Later it will spend those
            // on hacking the lending pool.
			await SUSD.transfer(mintLoanAndBorrowTest.address, hackAmount);

			// Send collateral tokens RBTC to the test contract. Later it will spend those
            // on borrowing.
			await RBTC.transfer(mintLoanAndBorrowTest.address, collateralTokenSent);

			// Check underlying token balance of test contract.
			console.log("\nSUSD balance on test contract: " + (await SUSD.balanceOf(mintLoanAndBorrowTest.address)));
			/// SUSD balance on test contract: 100000000000000000000

            // Check underlying token balance of test contract w/ contract function.
			console.log("\nSUSD balance on test contract: " + (await mintLoanAndBorrowTest.getBalance(SUSD.address)));

            // Check collateral token balance of test contract.
			console.log("\nRBTC balance on test contract: " + (await RBTC.balanceOf(mintLoanAndBorrowTest.address)));
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
	});
});
