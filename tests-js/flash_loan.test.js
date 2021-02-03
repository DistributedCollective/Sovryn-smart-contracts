const { assert, expect } = require("chai");
// const hre = require("hardhat"); access to the hardhat engine if needed
// const { encodeParameters, etherMantissa, mineBlock, increaseTime, blockNumber, sendFallback } = require("./utilities/ethereum"); useful utilities

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
const LoanClosingsBase = artifacts.require("LoanClosingsBase");
const LoanClosingsWith = artifacts.require("LoanClosingsWith");

const PriceFeedsLocal = artifacts.require("PriceFeedsLocal");
const TestSovrynSwap = artifacts.require("TestSovrynSwap");
const SwapsImplLocal = artifacts.require("SwapsImplLocal");
const Affiliates = artifacts.require("Affiliates");

const { BN, constants, balance, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("Margin Trading with Affiliates boilerplate", (accounts) => {
	let loanTokenLogic;
	let testWrbtc;
	let doc;
	let sovryn;
	let loanTokenV2;
	let wei = web3.utils.toWei;
	before(async () => {
		[owner, trader, referrer, account1, account2, ...accounts] = accounts;
	});
	beforeEach(async () => {
		loanTokenLogic = await LoanTokenLogicStandard.new();
		testWrbtc = await TestWrbtc.new();
		doc = await TestToken.new("dollar on chain", "DOC", 18, web3.utils.toWei("20000", "ether"));

		// Deploying sovrynProtocol
		const sovrynproxy = await sovrynProtocol.new();
		sovryn = await ISovryn.at(sovrynproxy.address);
		await sovryn.replaceContract((await LoanClosingsBase.new()).address);
		await sovryn.replaceContract((await LoanClosingsWith.new()).address);
		await sovryn.replaceContract((await ProtocolSettings.new()).address);
		await sovryn.replaceContract((await LoanSettings.new()).address);
		await sovryn.replaceContract((await LoanMaintenance.new()).address);
		await sovryn.replaceContract((await SwapsExternal.new()).address);
		await sovryn.replaceContract((await LoanOpenings.new()).address);
		await sovryn.replaceContract((await Affiliates.new()).address);

		await sovryn.setSovrynProtocolAddress(sovrynproxy.address);

		loanToken = await LoanToken.new(owner, loanTokenLogic.address, sovryn.address, testWrbtc.address);
		await loanToken.initialize(doc.address, "SUSD", "SUSD");

		loanTokenV2 = await LoanTokenLogicStandard.at(loanToken.address);
		const loanTokenAddress = await loanToken.loanTokenAddress();
		if (owner == (await sovryn.owner())) {
			await sovryn.setLoanPool([loanTokenV2.address], [loanTokenAddress]);
		}
	});
	beforeEach(async () => {
		// initializing
		const feeds = await PriceFeedsLocal.new(testWrbtc.address, sovryn.address);
		await feeds.setRates(doc.address, testWrbtc.address, wei("0.01", "ether"));

		const swaps = await SwapsImplLocal.new();
		const sovrynSwapSimulator = await TestSovrynSwap.new(feeds.address);
		await sovryn.setSovrynSwapContractRegistryAddress(sovrynSwapSimulator.address);

		await sovryn.setSupportedTokens([doc.address, testWrbtc.address], [true, true]);

		await sovryn.setPriceFeedContract(
			feeds.address //priceFeeds
		);
		await sovryn.setSwapsImplContract(
			swaps.address // swapsImpl
		);
		await sovryn.setFeesController(owner);
		await sovryn.setWrbtcToken(testWrbtc.address);
		{
			/**
			struct LoanParams {
				bytes32 id; // id of loan params object
				bool active; // if false, this object has been disabled by the owner and can't be used for future loans
				address owner; // owner of this object
				address loanToken; // the token being loaned
				address collateralToken; // the required collateral token
				uint256 minInitialMargin; // the minimum allowed initial margin
				uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
				uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
			}
		*/
		}
		params = [
			"0x0000000000000000000000000000000000000000000000000000000000000000", // bytes32 id; // id of loan params object
			false, // bool active; // if false, this object has been disabled by the owner and can't be used for future loans
			owner, // address owner; // owner of this object
			doc.address, // address loanToken; // the token being loaned
			testWrbtc.address, // address collateralToken; // the required collateral token
			wei("20", "ether"), // uint256 minInitialMargin; // the minimum allowed initial margin
			wei("15", "ether"), // uint256 maintenanceMargin; // an unhealthy loan when current margin is at or below this value
			2419200, // uint256 maxLoanTerm; // the maximum term for new loans (0 means there's no max term)
		];

		await loanTokenV2.setupLoanParams([params], true);
		await loanTokenV2.setupLoanParams([params], false);

		// setting up interest rates
		const baseRate = wei("1", "ether");
		const rateMultiplier = wei("20.25", "ether");
		const targetLevel = wei("80", "ether");
		const kinkLevel = wei("90", "ether");
		const maxScaleRate = wei("100", "ether");
		await loanTokenV2.setDemandCurve(baseRate, rateMultiplier, baseRate, rateMultiplier, targetLevel, kinkLevel, maxScaleRate);

		// GIVING SOME DOC tokens to loanToken so that we can borrow from loanToken
		await doc.transfer(loanTokenV2.address, wei("500", "ether"));
		await doc.approve(loanToken.address, web3.utils.toWei("20", "ether"));
	});
	it("Flash borrowing loan ammount of 12 DOC", async () => {
		// minting withdrawAmmount (12DOC) tokens to loanToken + some interest as 0.5 so total is 12.5 so that we can borrow from loanToken
		await doc.mint(loanTokenV2.address, wei("12.5", "ether"));

		const collateralTokenAddress = testWrbtc.address;
		const depositAmount = wei("12", "ether");
		const collateralTokenSent = await sovryn.getRequiredCollateral(
			doc.address,
			collateralTokenAddress,
			depositAmount,
			wei("50", "ether"),
			true
		);
		// console.log(collateralTokenSent.toString());

		const withdrawAmount = depositAmount;
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

		//Now closeWithDepositWithSig (closing user loan by their signatures)
		//Creating user signature by loanid,receiver,depositAmmount,methodSignature
		const methodSig = "0x50b38565";
		const loan = await sovryn.getUserLoans(accounts[0], 0, 3, 2, false, false); //Here 2 is  non-margin trade loans
		const loanId = loan[0].loanId;
		const receiver = accounts[0];
		const hash = await sovryn.getHash(loanId, receiver, withdrawAmount, methodSig);

		//repaying loan then it give us collateral as real RBTC (here not wrBTC but Rtbc)

		const beforeRepayWBtcAmmount = parseInt(await web3.eth.getBalance(accounts[0])) / 1e18;
		const userSig = await web3.eth.sign(hash, accounts[0]);
		await forwarding.closeWithDepositWithUserSig(sovryn.address, doc.address, loanId, receiver, withdrawAmount, userSig);
		const AfterRepaywRBTCAmmount = parseInt(await web3.eth.getBalance(accounts[0])) / 1e18;
		assert.ok(AfterRepaywRBTCAmmount > beforeRepayWBtcAmmount, "Loan is not close by user");
	});
	it("Borrowing loan ammount of  12 DOC  and closing this loan by closeWithDepositWithSig by thirdParty ", async () => {
		// minting withdrawAmmount (12DOC) tokens to loanToken + some interest as 0.5 so total is 12.5 so that we can borrow from loanToken
		await doc.mint(loanTokenV2.address, wei("12.5", "ether"));
		const collateralTokenAddress = testWrbtc.address;
		const depositAmount = wei("12", "ether");
		const collateralTokenSent = await sovryn.getRequiredCollateral(
			doc.address,
			collateralTokenAddress,
			depositAmount,
			wei("50", "ether"),
			true
		);
		// console.log(collateralTokenSent.toString());

		const withdrawAmount = depositAmount;
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

		//Now closeWithDepositWithSig (closing user loan by their signatures)
		//Creating user signature by loanid,receiver,depositAmmount,methodSignature
		const methodSig = "0x50b38565";
		const loan = await sovryn.getUserLoans(accounts[0], 0, 3, 2, false, false); //Here 2 is  non-margin trade loans
		const loanId = loan[0].loanId;
		const receiver = accounts[0];
		const hash = await sovryn.getHash(loanId, receiver, withdrawAmount, methodSig);

		const userSig = await web3.eth.sign(hash, accounts[2]);

		//Catching error and save by try/catch Block
		try {
			await doc.mint(accounts[2], withdrawAmount);
			await doc.approve(forwarding.address, withdrawAmount, { from: accounts[2] });
			await testWrbtc.deposit({ value: wei("1", "ether") });

			await forwarding.closeWithDepositWithUserSig(sovryn.address, doc.address, loanId, receiver, withdrawAmount, userSig, {
				from: accounts[2],
			});
		} catch (error) {
			// Loan Don't close by third party so it give UnAuthorize User
			assert.ok(error["reason"] == "UnAuthorize User");
		}
	});
	it("Borrowing loan ammount of  12 DOC  from loanToken and loanToken don't have enough ammount of DOC ", async () => {
		const collateralTokenAddress = testWrbtc.address;
		const depositAmount = wei("12", "ether");
		const collateralTokenSent = await sovryn.getRequiredCollateral(
			doc.address,
			collateralTokenAddress,
			depositAmount,
			wei("50", "ether"),
			true
		);
		// console.log(collateralTokenSent.toString());

		const withdrawAmount = depositAmount;
		try {
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
		} catch (error) {
			assert.ok(error["reason"] == "24");
		}
	});
});
