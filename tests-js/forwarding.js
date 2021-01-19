const { assert } = require("chai");

const LoanTokenLogicStandard = artifacts.require("LoanTokenLogicStandard");
const sovrynProtocol = artifacts.require("sovrynProtocol");
const LoanToken = artifacts.require("LoanToken");
const TestWrbtc = artifacts.require("TestWrbtc");
const TestToken = artifacts.require("TestToken");
const ISovryn = artifacts.require("ISovryn");
const ProtocolSettings = artifacts.require("ProtocolSettings");
const LoanSettings = artifacts.require("LoanSettings");
const LoanMaintenance = artifacts.require("LoanMaintenance");
const LoanOpenings = artifacts.require("LoanOpenings");
const SwapsExternal = artifacts.require("SwapsExternal");
const LoanClosings = artifacts.require("LoanClosings");
const Forwarding = artifacts.require("Forwarding");
const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplLocal = artifacts.require("SwapsImplLocal");

contract("Forwarding ", async (accounts) => {
	let loanTokenLogic;
	let testWrbtc;
	let doc;
	let sovryn;
	let loanTokenV2;
	let forwarding;
	let wei = web3.utils.toWei;
	beforeEach(async () => {
		loanTokenLogic = await LoanTokenLogicStandard.new();
		testWrbtc = await TestWrbtc.new();
		doc = await TestToken.new("dollar on chain", "DOC", 18, web3.utils.toWei("20000", "ether"));
		// Deploying sovrynProtocol
		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);
		await sovryn.replaceContract((await LoanClosings.new()).address);
		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.replaceContract((await LoanSettings.new()).address);
		await sovryn.replaceContract((await LoanMaintenance.new()).address);
		await sovryn.replaceContract((await SwapsExternal.new()).address);
		await sovryn.replaceContract((await LoanOpenings.new()).address);
		//
		loanToken = await LoanToken.new(accounts[0], loanTokenLogic.address, sovryn.address, testWrbtc.address);
		await loanToken.initialize(doc.address, "SUSD", "SUSD");
		// console.log((await loanToken.initialPrice()).toString());
		loanTokenV2 = await LoanTokenLogicStandard.at(loanToken.address);
		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (accounts[0] == (await sovryn.owner())) {
			await sovryn.setLoanPool([loanTokenV2.address], [loanTokenAddress]);
		}
		//Deploying Forwarding Contract
		forwarding = await Forwarding.new();
	});
	beforeEach(async () => {
		const feeds = await PriceFeedsLocal.new(testWrbtc.address, sovryn.address);
		await feeds.setRates(doc.address, testWrbtc.address, wei("0.01", "ether"));
		// await feeds.setProtocolTokenEthPrice(wei("0.01", "ether"));
		const swaps = await SwapsImplLocal.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);

		await sovryn.setSupportedTokens([doc.address, testWrbtc.address], [true, true]);
		// await feeds.setProtocolTokenEthPrice(wei("1", "ether"));
		await sovryn.setPriceFeedContract(
			feeds.address //priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swaps.address // swapsImpl
		);
		await sovryn.setFeesController(accounts[0]);
		await sovryn.setWrbtcToken(testWrbtc.address);
		// await sovryn.setProtocolTokenAddress(doc.address);

		// const priceFeeds = await PriceFeeds.new(
		//   doc.address,
		//   sovryn.address,
		//   wRBTC.address
		// );
		// await feeds.setRates(testWrbtc.address, doc.address, wei("0.01", "ether"));

		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000",
			false,
			accounts[0],
			doc.address,
			testWrbtc.address,
			wei("20", "ether"),
			wei("15", "ether"),
			2419200,
		];

		await loanTokenV2.setupLoanParams([params], true);
		await loanTokenV2.setupLoanParams([params], false);

		//        setting up interest rates

		const baseRate = wei("1", "ether");
		const rateMultiplier = wei("20.25", "ether");
		const targetLevel = wei("80", "ether");
		const kinkLevel = wei("90", "ether");
		const maxScaleRate = wei("100", "ether");
		await loanTokenV2.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);
		// const borrowInterestRate = await loanTokenV2.borrowInterestRate();
		// console.log("borrowInterestRate: ", borrowInterestRate.toString());
		// GIVING SOME DOC tokens to loanToken so that we can borrow from loanToken
		await doc.transfer(loanTokenV2.address, wei("500", "ether"));
		await doc.approve(forwarding.address, web3.utils.toWei("20", "ether"));
	});
	it("Deposit DOC token", async function () {
		const loanTokenAddress = await loanToken.loanTokenAddress();
		assert.equal(loanTokenAddress, doc.address, "Doc address not set yet");

		const depositAmount = web3.utils.toWei("12", "ether");
		await doc.approve(forwarding.address, depositAmount);
		await forwarding.depositLendToken(loanTokenV2.address, doc.address, accounts[0], depositAmount);
		//await loanTokenV2.mint(accounts[0], depositAmount);
		assert.equal(
			(await loanTokenV2.totalSupply()).toString(),
			(await loanTokenV2.balanceOf(accounts[0])).toString(),
			"TotalSupply!=user balance"
		);
	});
	it("Margin trading  with 3X leverage with DOC token and topUp position by 12rwBTC", async () => {
		//        setting up interest rates

		// const borrowInterestRate = await loanTokenV2.borrowInterestRate();
		// console.log("borrowInterestRate: ", borrowInterestRate.toString());
		await doc.approve(forwarding.address, web3.utils.toWei("20", "ether"));
		//Giving some testRbtc to sovrynAddress (by minting some testRbtc),so  that it can open position in wRBTC.
		await testWrbtc.mint(sovryn.address, wei("500", "ether"));
		await forwarding.marginTrading(
			loanTokenV2.address,
			"0x0000000000000000000000000000000000000000000000000000000000000000", //loanId  (0 for new loans)
			web3.utils.toWei("3", "ether"), // leverageAmount
			web3.utils.toWei("20", "ether"), //loanTokenSent
			0, // no collateral token sent
			testWrbtc.address, //collateralTokenAddress
			accounts[0], //trader,
			"0x" //loanDataBytes (only required with rBTC)
		);

		//Top up position by givng 12 wrbtc

		const beforeDepositLoan = await sovryn.getUserLoans(accounts[0], 0, 1, 1, false, false);
		const beforeDepositCollateral = beforeDepositLoan[0].collateral;
		const depositAmount = web3.utils.toWei("12", "ether");

		//Giving 12testWrbtc to myself so that i can deposit 12testWrbtc to protocol,to top-up my position
		await testWrbtc.mint(accounts[0], depositAmount);

		await testWrbtc.approve(forwarding.address, depositAmount);
		await forwarding.depositCollateral(sovryn.address, testWrbtc.address, beforeDepositLoan[0].loanId, depositAmount);
		const afterDepositLoan = await sovryn.getUserLoans(accounts[0], 0, 1, 1, false, false);
		const afterDepositCollateral = afterDepositLoan[0].collateral;
		assert.ok(parseInt(afterDepositCollateral) > parseInt(beforeDepositCollateral), "not Deposited ");
	});
	it("Borrowing loan ammount of  12 DOC  and closing this loan by  closeWithDepositWithSig", async () => {
		// GIVING SOME DOC tokens to loanToken so that we can borrow from loanToken
		await doc.transfer(loanTokenV2.address, wei("500", "ether"));

		const collateralTokenAddress = testWrbtc.address;
		const depositAmount = web3.utils.toWei("12", "ether");
		const collateralTokenSent = await sovryn.getRequiredCollateral(
			doc.address,
			collateralTokenAddress,
			depositAmount,
			web3.utils.toWei("50", "ether"),
			true
		);
		// console.log(collateralTokenSent.toString());
		//GIVNG SOME wrBTC to myself so that i will borrow some doc by giving some collateral as Wrbtc
		await testWrbtc.mint(accounts[0], wei("50", "ether"));

		await testWrbtc.approve(forwarding.address, collateralTokenSent);
		const withdrawAmount = web3.utils.toWei("12", "ether");
		await forwarding.borrow(
			loanTokenV2.address,
			"0x0000000000000000000000000000000000000000000000000000000000000000", //loanId  (0 for new loans)
			withdrawAmount,
			2419200,
			collateralTokenSent,
			collateralTokenAddress, //collateralTokenAddress
			accounts[0],
			accounts[0],
			"0x" //loanDataBytes (only required with rBTC)
		);
		// CloseWithDeposit(),THE BORROW loan which user take from loanToken
		await doc.approve(forwarding.address, withdrawAmount);
		await testWrbtc.deposit({ value: web3.utils.toWei("12", "ether") });
		// await sovryn.closeWithDeposit(loan[0].loanId, accounts[0], withdrawAmount);

		//Now closeWithDepositWithSig (closing user loan by their signatures)
		//Creating user signature by loanid,receiver,depositAmmount,methodSignature
		const methodSig = "0x50b38565";
		const loan = await sovryn.getUserLoans(accounts[0], 0, 1, 2, false, false); //Here 2 is  non-margin trade loans
		const loanId = loan[0].loanId;
		const receiver = accounts[0];
		const hash = await sovryn.getHash(loanId, receiver, withdrawAmount, methodSig);

		//repaying loan then it give us collateral as real RBTC (here not wrBTC but Rtbc)

		const beforeRepayWBtcAmmount = (await web3.eth.getBalance(accounts[0])) / 1e18;
		const userSig = await web3.eth.sign(hash, accounts[0]);
		await forwarding.closeWithDepositWithUserSig(sovryn.address, doc.address, loanId, receiver, withdrawAmount, userSig);
		const AfterRepaywRBTCAmmount = (await web3.eth.getBalance(accounts[0])) / 1e18;
		assert.ok(AfterRepaywRBTCAmmount > beforeRepayWBtcAmmount, "Loan is not close by user");
	});
	it("Borrowing loan ammount of  12 DOC  and closing this loan by   closeWithDepositWithSig by thirdParty and save us from getting error by using try catch Block", async () => {
		// GIVING SOME DOC tokens to loanToken so that we can borrow from loanToken
		await doc.transfer(loanTokenV2.address, wei("500", "ether"));
		const collateralTokenAddress = testWrbtc.address;
		const depositAmount = web3.utils.toWei("12", "ether");
		const collateralTokenSent = await sovryn.getRequiredCollateral(
			doc.address,
			collateralTokenAddress,
			depositAmount,
			web3.utils.toWei("50", "ether"),
			true
		);
		// console.log(collateralTokenSent.toString());
		//GIVNG SOME wrBTC to myself so that i will borrow some doc by giving some collateral as Wrbtc
		await testWrbtc.mint(accounts[0], wei("50", "ether"));

		await testWrbtc.approve(forwarding.address, collateralTokenSent);
		const withdrawAmount = web3.utils.toWei("12", "ether");
		await forwarding.borrow(
			loanTokenV2.address,
			"0x0000000000000000000000000000000000000000000000000000000000000000", //loanId  (0 for new loans)
			withdrawAmount,
			2419200,
			collateralTokenSent,
			collateralTokenAddress, //collateralTokenAddress
			accounts[0],
			accounts[0],
			"0x" //loanDataBytes (only required with rBTC)
		);
		// CloseWithDeposit(),THE BORROW loan which user take from loanToken
		await doc.approve(forwarding.address, withdrawAmount);
		await testWrbtc.deposit({ value: web3.utils.toWei("12", "ether") });
		// await sovryn.closeWithDeposit(loan[0].loanId, accounts[0], withdrawAmount);

		//Now closeWithDepositWithSig (closing user loan by their signatures)
		//Creating user signature by loanid,receiver,depositAmmount,methodSignature
		const methodSig = "0x50b38565";
		const loan = await sovryn.getUserLoans(accounts[0], 0, 1, 2, false, false); //Here 2 is  non-margin trade loans
		const loanId = loan[0].loanId;
		const receiver = accounts[0];
		const hash = await sovryn.getHash(loanId, receiver, withdrawAmount, methodSig);
		const beforeRepayWBtcAmmount = (await web3.eth.getBalance(accounts[0])) / 1e18;
		//Closing loan by another person ,must fail

		const userSig = await web3.eth.sign(hash, accounts[1]);

		//Catching error and save by try/catch Block
		try {
			await forwarding.closeWithDepositWithUserSig(sovryn.address, doc.address, loanId, receiver, withdrawAmount, userSig);
			const AfterRepaywRBTCAmmount = (await web3.eth.getBalance(accounts[0])) / 1e18;
			assert.ok(AfterRepaywRBTCAmmount > beforeRepayWBtcAmmount, "Loan is not close by user");
		} catch (error) {
			// Loan Don't close by third party so it give UnAuthorize User
			assert.ok(error["reason"] == "UnAuthorize User");
		}
	});
	it("Swap 10 Doc to wrBTC tokens using swapExternal", async function () {
		const sourceTokenAmount = wei("10", "ether");
		// beforeSwappingWrbtcAmmount=0
		const beforeSwappingToWrbtcAmmount = parseInt((await testWrbtc.balanceOf(accounts[0])).toString());
		assert.equal(0, beforeSwappingToWrbtcAmmount, "Before swapping Wrbtc must be zero");
		await doc.approve(forwarding.address, sourceTokenAmount);
		await forwarding.swapExternal(sovryn.address, doc.address, testWrbtc.address, accounts[0], accounts[0], sourceTokenAmount, 0, "0x");
		const afterSwappingToWrbtcAmmount = parseInt((await testWrbtc.balanceOf(accounts[0])).toString());
		assert.ok(afterSwappingToWrbtcAmmount > beforeSwappingToWrbtcAmmount, "After swapping Wrbtc greater than zero");
	});
});
