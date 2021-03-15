const { expect } = require("chai");
const { expectRevert, BN, expectEvent } = require("@openzeppelin/test-helpers");
const FeesEvents = artifacts.require("FeesEvents");
const TestToken = artifacts.require("TestToken");
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
	CONSTANTS,
} = require("../Utils/initializer.js");

const wei = web3.utils.toWei;

const oneEth = new BN(wei("1", "ether"));
const tenEth = new BN(wei("10", "ether"));
const hunEth = new BN(wei("100", "ether"));

// This decodes longs for a single event type, and returns a decoded object in
// the same form truffle-contract uses on its receipts
function decodeLogs(logs, emitter, eventName) {
	let abi;
	let address;
	abi = emitter.abi;
	try {
		address = emitter.address;
	} catch (e) {
		address = null;
	}

	let eventABI = abi.filter((x) => x.type === "event" && x.name === eventName);
	if (eventABI.length === 0) {
		throw new Error(`No ABI entry for event '${eventName}'`);
	} else if (eventABI.length > 1) {
		throw new Error(`Multiple ABI entries for event '${eventName}', only uniquely named events are supported`);
	}

	eventABI = eventABI[0];

	// The first topic will equal the hash of the event signature
	const eventSignature = `${eventName}(${eventABI.inputs.map((input) => input.type).join(",")})`;
	const eventTopic = web3.utils.sha3(eventSignature);

	// Only decode events of type 'EventName'
	return logs
		.filter((log) => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address))
		.map((log) => web3.eth.abi.decodeLog(eventABI.inputs, log.data, log.topics.slice(1)))
		.map((decoded) => ({ event: eventName, args: decoded }));
}

const verify_sov_reward_payment = async (logs, SOV, borrower, loan_id, sov_initial_balance, expected_events_number) => {
	const earn_reward_events = decodeLogs(logs, FeesEvents, "EarnReward");
	const len = earn_reward_events.length;
	expect(len).to.equal(expected_events_number);

	let reward = 0;
	for (let i = 0; i < len; i++) {
		const args = earn_reward_events[i].args;
		expect(args["receiver"]).to.equal(borrower);
		expect(args["token"]).to.equal(SOV.address);
		expect(args["loanId"]).to.equal(loan_id);
		reward += args["amount"];
	}

	expect(await SOV.balanceOf(borrower)).to.be.a.bignumber.equal(sov_initial_balance.add(new BN(reward)));
};

contract("LoanTokenBorrowing", (accounts) => {
	let owner, account1;
	let sovryn, SUSD, WRBTC, RBTC, BZRX, loanToken, loanTokenWRBTC, SOV;

	before(async () => {
		[owner, account1, ...accounts] = accounts;
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

	describe("Test borrow", () => {
		it("Test borrow", async () => {
			// prepare the test
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
			const borrowingFee = (await sovryn.borrowingFeePercent()).mul(collateralTokenSent).div(hunEth);
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
			await verify_sov_reward_payment(receipt.rawLogs, SOV, owner, args["loanId"], sov_initial_balance, 1);
		});

		it("test_borrow_0_collateral_should_fail", async () => {
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			expectRevert(
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
				"8"
			);
		});

		it("test_borrow_0_withdraw_should_fail", async () => {
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

		it("test_borrow_sending_value_with_tokens_should_fail", async () => {
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

		it("test_borrow_invalid_collateral_should_fail", async () => {
			await set_demand_curve(loanToken);
			await lend_to_pool(loanToken, SUSD, owner);
			expectRevert(
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
				"9"
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

		it("test_borrow_no_interest_should_fail", async () => {
			// no demand curve settings -> no interest set
			//  prepare the test
			await lend_to_pool(loanToken, SUSD, owner);

			// determine borrowing parameter
			const withdrawAmount = oneEth.mul(new BN(10)); // i want to borrow 10 USD
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			const collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(50).pow(new BN(18)),
				true
			);

			//approve the transfer of the collateral
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

		it("test_borrow_insufficient_collateral_should_fail", async () => {
			//  prepare the test

			await lend_to_pool(loanToken, SUSD, owner);
			await set_demand_curve(loanToken);

			// determine borrowing parameter
			const withdrawAmount = oneEth.mul(new BN(10)); // i want to borrow 10 USD
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			let collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount,
				new BN(10).pow(new BN(18)).mul(new BN(50)).toString(),
				true
			);
			collateralTokenSent = collateralTokenSent.div(new BN(2));

			//approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent.toString());
			expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					withdrawAmount, // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					collateralTokenSent.toString(), // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0" // bytes memory loanDataBytes
				),
				"collateral insufficient"
			);
		});

		it("test_borrow_without_early_access_token_should_fail_if_required", async () => {
			// no demand curve settings -> no interest set
			//  prepare the test

			await lend_to_pool(loanToken, SUSD, owner);
			await set_demand_curve(loanToken);

			// prepare early access token
			const early_access_token = await TestToken.new("Sovryn Early Access Token", "SEAT", 1, 10);
			await early_access_token.transfer(account1, (await early_access_token.balanceOf(owner)).toString());
			await loanToken.setEarlyAccessToken(early_access_token.address);

			// determine borrowing parameter
			const withdrawAmount = oneEth; // i want to borrow 10 USD
			// compute the required collateral. params: address loanToken, address collateralToken, uint256 newPrincipal,uint256 marginAmount, bool isTorqueLoan
			let collateralTokenSent = await sovryn.getRequiredCollateral(
				SUSD.address,
				RBTC.address,
				withdrawAmount.toString(),
				new BN(50).pow(new BN(18)),
				true
			);

			//approve the transfer of the collateral
			await RBTC.approve(loanToken.address, collateralTokenSent.toString());
			expectRevert(
				loanToken.borrow(
					"0x0", // bytes32 loanId
					withdrawAmount.toString(), // uint256 withdrawAmount
					24 * 60 * 60, // uint256 initialLoanDuration
					collateralTokenSent.toString(), // uint256 collateralTokenSent
					RBTC.address, // address collateralTokenAddress
					owner, // address borrower
					account1, // address receiver
					"0x0" // bytes memory loanDataBytes
				),
				"No early access tokens"
			);
		});
	});
});
