const { constants, BN, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { decodeLogs, verify_sov_reward_payment } = require("../Utils/initializer");
const { blockNumber, increaseTime } = require("../Utils/Ethereum");
const LoanOpenings = artifacts.require("LoanOpenings");
const SwapsEvents = artifacts.require("SwapsEvents");
const LoanClosingsEvents = artifacts.require("LoanClosingsEvents");

const wei = web3.utils.toWei;
const oneEth = new BN(wei("1", "ether"));
const hunEth = new BN(wei("100", "ether"));
const BN2 = new BN(2);

/*
makes a margin trade sending loan tokens as collateral. therefore, not just the loan, but the complete position needs to be swapped.
process:
1. approve the transfer
2. send the margin trade tx
3. verify the trade event and balances are correct
4. retrieve the loan from the smart contract and make sure all values are set as expected
*/
const margin_trading_sending_loan_tokens = async (accounts, sovryn, loanToken, underlyingToken, collateralToken, priceFeeds, sendValue) => {
	// preparation
	const loan_token_sent = oneEth;
	await underlyingToken.mint(loanToken.address, loan_token_sent.mul(new BN(3)));
	await underlyingToken.mint(accounts[0], loan_token_sent);
	await underlyingToken.approve(loanToken.address, loan_token_sent);
	const value = sendValue ? loan_token_sent : 0;

	// send the transaction
	const leverage_amount = oneEth.mul(new BN(2));
	const collateral_sent = new BN(0);
	const { receipt } = await loanToken.marginTrade(
		constants.ZERO_BYTES32, //loanId  (0 for new loans)
		leverage_amount.toString(), // leverageAmount
		loan_token_sent.toString(), // loanTokenSent
		collateral_sent.toString(), // no collateral token sent
		collateralToken.address, // collateralTokenAddress
		accounts[0], // trader,
		"0x", // loanDataBytes (only required with ether)
		{ value: value }
	);

	// check the balances and the trade event
	const sovryn_after_collateral_token_balance = await collateralToken.balanceOf(sovryn.address);
	const loantoken_after_underlying_token_balance = await underlyingToken.balanceOf(loanToken.address);
	const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
	const args = decode[0].args;
	expect(args["borrowedAmount"]).to.equal(loan_token_sent.mul(new BN(2)).toString());
	expect(args["positionSize"]).to.equal(sovryn_after_collateral_token_balance.toString());
	expect(loan_token_sent.mul(new BN(3)).sub(new BN(args["borrowedAmount"]))).to.be.a.bignumber.eq(
		loantoken_after_underlying_token_balance
	);

	// compute the expected values of the loan object
	const start_margin = new BN(10).pow(new BN(38)).div(leverage_amount);
	const total_deposit = loan_token_sent.add(collateral_sent);
	const { rate: trade_rate, precision: trade_rate_precision } = await priceFeeds.queryRate(
		underlyingToken.address,
		collateralToken.address
	);
	const { rate: collateral_to_loan_rate, precision: collateral_to_loan_precision } = await priceFeeds.queryRate(
		collateralToken.address,
		underlyingToken.address
	);

	const collateral_to_loan_swap_rate = collateral_to_loan_precision.mul(trade_rate_precision).div(new BN(args["entryPrice"]));
	const interest_rate = await loanToken.nextBorrowInterestRate(total_deposit.mul(hunEth).div(start_margin));
	const principal = loan_token_sent.mul(BN2);
	const seconds_per_day = new BN(24 * 60 * 60);
	const max_loan_duration = seconds_per_day.mul(new BN(28));
	const seconds_per_year = seconds_per_day.mul(new BN(365));
	const borrow_amount = total_deposit
		.mul(new BN(10).pow(new BN(40)))
		.div(interest_rate.div(seconds_per_year).mul(max_loan_duration).div(start_margin).mul(hunEth).add(hunEth))
		.div(start_margin);
	const owed_per_day = borrow_amount.mul(interest_rate).div(new BN(365).mul(hunEth));
	const interest_amount_required = new BN(28).mul(owed_per_day).div(seconds_per_day);
	const trading_fee = loan_token_sent
		.add(borrow_amount)
		.mul(new BN(15).mul(new BN(10).pow(new BN(16))))
		.div(hunEth); // 0.15% fee
	const collateral = collateral_sent
		.add(loan_token_sent)
		.add(borrow_amount)
		.sub(interest_amount_required)
		.sub(trading_fee)
		.mul(trade_rate)
		.div(trade_rate_precision);
	//current_margin = (collateral * collateral_to_loan_rate / 1e18 - principal) / principal * 1e20
	const current_margin = collateral.mul(collateral_to_loan_rate).div(oneEth).sub(principal).mul(hunEth).div(principal);
	//TODO: problem: rounding error somewhere

	const loan_id = args["loanId"];
	const loan = await sovryn.getLoan(loan_id);
	const end_timestamp = loan["endTimestamp"];
	const num = await blockNumber();
	let currentBlock = await web3.eth.getBlock(num);
	const block_timestamp = currentBlock.timestamp;

	const interest_deposit_remaining =
		end_timestamp >= block_timestamp ? new BN(end_timestamp).sub(new BN(block_timestamp)).mul(owed_per_day).div(seconds_per_day) : 0;
	// assert the loan object is set as expected
	expect(loan["loanToken"]).to.equal(underlyingToken.address);
	expect(loan["collateralToken"]).to.equal(collateralToken.address);
	expect(loan["principal"]).to.equal(principal.toString());
	expect(loan["collateral"]).to.equal(collateral.toString());

	expect(loan["interestOwedPerDay"]).to.equal(owed_per_day.toString());
	expect(loan["interestDepositRemaining"]).to.eq(interest_deposit_remaining.toString());
	expect(loan["startRate"]).to.eq(collateral_to_loan_swap_rate.toString());
	expect(loan["startMargin"]).to.eq(start_margin.toString());
	expect(loan["maintenanceMargin"]).to.eq(new BN(15).mul(oneEth).toString());
	expect(loan["currentMargin"]).to.eq(current_margin.toString());
	expect(loan["maxLoanTerm"]).to.eq(max_loan_duration.toString()); // In the SC is hardcoded to 28 days
	expect(new BN(block_timestamp).add(max_loan_duration).sub(new BN(end_timestamp)).lt(new BN(1))).to.be.true;
	expect(loan["maxLiquidatable"]).to.eq("0");
	expect(loan["maxSeizable"]).to.eq("0");
};

const fl_attack_margin_trading_sending_loan_tokens = async (
	accounts,
	sovryn,
	loanToken,
	underlyingToken,
	collateralToken,
	priceFeeds,
	sendValue
) => {
	const LoanTokenLogicStandard = artifacts.require("LoanTokenLogicStandard");
	const set_demand_curve_local = async () => {
		const baseRate = wei("1", "ether");
		const rateMultiplier = wei("20.25", "ether");
		const targetLevel = wei("60", "ether");
		const kinkLevel = wei("80", "ether");
		const maxScaleRate = wei("100", "ether");

		const localLoanToken = await LoanTokenLogicStandard.at(loanToken.address);
		await localLoanToken.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);
		// borrow_interest_rate = loanToken.borrowInterestRate();
		// print("borrowInterestRate: ", borrow_interest_rate);
		// assert(borrow_interest_rate > baseRate);
	};
	// preparation
	const loan_token_sent = oneEth;

	// legitimate users add liquidity to the loan token
	const baseLiquidity = loan_token_sent.mul(new BN(1.1));
	await underlyingToken.mint(accounts[1], baseLiquidity);
	await underlyingToken.approve(loanToken.address, baseLiquidity, { from: accounts[1] });
	await loanToken.mint(accounts[1], baseLiquidity, { from: accounts[1] });

	// amount attacker will get in flash loan
	// changing this obtains different interest rates
	// e.g. 0.001*loan_token_sent => 1.78e15
	// 10 * loan_token_sent => 0.36e15
	// that means attacker can borrow at the base rate,
	// regardless of actual utilization rate
	// by temporarily lowering utilization rate with a flash loan
	// from a third-party
	const flashLoanAmount = new BN(10).mul(loan_token_sent);

	// we simulate the flash loan by minting tokens to the attacker account
	// the attacker already owns loan_token_sent before the loan
	// begin flash loan attack:
	underlyingToken.mint(accounts[0], loan_token_sent.add(flashLoanAmount));
	underlyingToken.approve(loanToken.address, loan_token_sent.add(flashLoanAmount));

	/*await set_demand_curve_local();
	const borrowInterestRate = await loanToken.borrowInterestRate();
	console.log(`borrowInterestRate (mul by 10 ** 18): ${borrowInterestRate.div(new BN(10).pow(new BN(18))).toString()}`);*/

	// deposits to the loan token
	await loanToken.mint(accounts[0], flashLoanAmount);

	console.log("trading...");

	const value = sendValue ? loan_token_sent : 0;

	// sets up interest rates
	/* 
	// from the bug report code:
    baseRate = 1e18
    rateMultiplier = 20.25e18
    targetLevel=60*10**18
    kinkLevel=80*10**18
    maxScaleRate=100*10**18
    loanToken.setDemandCurve(baseRate,rateMultiplier,baseRate,rateMultiplier, targetLevel, kinkLevel, maxScaleRate)
    borrowInterestRate = loanToken.borrowInterestRate()
    print("borrowInterestRate: ",borrowInterestRate/1e18)

	// NOTE: but we initialize tests with the different rates
	const targetLevel = wei("80", "ether");
	const kinkLevel = wei("90", "ether");
	*/

	await set_demand_curve_local();
	const borrowInterestRate = await loanToken.borrowInterestRate();
	console.log(`borrowInterestRate (mul by 10 ** 18): ${borrowInterestRate.div(new BN(10).pow(new BN(18))).toString()}`);

	// send the transaction
	/*leverage_amount = 1e18
    collateral_sent = 0
    tx = loanToken.marginTrade(
        "0", #loanId  (0 for new loans)
        leverage_amount, # leverageAmount
        loan_token_sent, #loanTokenSent
        collateral_sent, # no collateral token sent
        collateralToken.address, #collateralTokenAddress
        accounts[0], #trader,
        b'', #loanDataBytes (only required with ether)
        {'value': value}
    )*/

	const leverage_amount = oneEth;
	const collateral_sent = new BN(0);

	const { receipt } = await loanToken.marginTrade(
		constants.ZERO_BYTES32, //loanId  (0 for new loans)
		leverage_amount.toString(), // leverageAmount
		loan_token_sent.toString(), // loanTokenSent
		collateral_sent.toString(), // no collateral token sent
		collateralToken.address, // collateralTokenAddress
		accounts[0], // trader,
		"0x", // loanDataBytes (only required with ether)
		{ value: value }
	);

	// check the balances and the trade event
	const sovryn_after_collateral_token_balance = await collateralToken.balanceOf(sovryn.address);
	const loantoken_after_underlying_token_balance = await underlyingToken.balanceOf(loanToken.address);

	const decode = decodeLogs(receipt.rawLogs, LoanOpenings, "Trade");
	const args = decode[0].args;

	/*
	loan_id = tx.events['Trade']['loanId']
    loan = sovryn.getLoan(loan_id).dict()

    # interest paid per day is lower than without flash loan
    print("interest per day", loan['interestOwedPerDay']/1e15,"*1e15")

    # withdraws from the loan token
    loanToken.burn(accounts[0], flashLoanAmount)

    # simulates repaying flash loan
    underlyingToken.mint(accounts[0], flashLoanAmount)

    # stop execution and display stdout
    assert(1==0)
	*/

	const loan_id = args["loanId"];
	const loan = await sovryn.getLoan(loan_id);

	// interest paid per day is lower than without flash loan
	console.log("interest per day", Number(loan["interestOwedPerDay"]) / 10 ** 15, " * 10**15");

	// withdraws from the loan token
	const ub = await underlyingToken.balanceOf(accounts[0]);
	console.log(`underlyingToken.balanceOf(accounts[0]): ${ub}`);
	const ubl = await loanToken.balanceOf(accounts[0]);
	console.log(`loanToken.balanceOf(accounts[0]): ${ub}`);

	await loanToken.burn(accounts[0], flashLoanAmount);

	// simulates repaying flash loan
	await underlyingToken.mint(accounts[0], flashLoanAmount);
};

module.exports = {
	fl_attack_margin_trading_sending_loan_tokens,
	margin_trading_sending_loan_tokens,
};
