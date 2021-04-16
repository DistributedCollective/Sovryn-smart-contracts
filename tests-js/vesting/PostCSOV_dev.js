//const { expectRevert, increaseTime } = require('@openzeppelin/test-helpers');
const { expectEvent, expectRevert, time, BN } = require("@openzeppelin/test-helpers");
const PostCSOV = artifacts.require("VestingRegistry.sol");
const TestToken = artifacts.require("TestToken.sol");

const TOTAL_SUPPLY = "100000000000000000000000000";

contract("PostCSOV", (accounts) => {
	let postcsov;
	let token1;
	let token2;
	let tokenAddr;
	let postcsovAddr;

	const dummyAddress = accounts[9];
	const owner = accounts[5];
	const csovAdmin = accounts[0];
	const amountUser = web3.utils.toWei("3");
	//console.log("Owner: " + owner);

	const totalSupply = web3.utils.toWei("2000000");
	const pricsSats = "2500";

	beforeEach(async () => {
		//deploy CSOVToken1
		token1 = await TestToken.new("cSOV1", "cSOV1", 18, TOTAL_SUPPLY);
		tokenAddr1 = await token1.address;

		await token1.transfer(accounts[2], amountUser, { from: csovAdmin });

		let CSOVAmountWei = await token1.balanceOf(accounts[2]);
		console.log("CSOVAmountWei: " + CSOVAmountWei);

		//deploy CSOVToken2
		token2 = await TestToken.new("cSOV2", "cSOV2", 18, TOTAL_SUPPLY);
		tokenAddr2 = await token2.address;

		await token2.transfer(accounts[2], amountUser, { from: csovAdmin });

		CSOVAmountWei = await token2.balanceOf(accounts[2]);
		console.log("CSOVAmountWei: " + CSOVAmountWei);

		//deploy PostCSOV
		postcsov = await PostCSOV.new(
			dummyAddress,
			dummyAddress,
			[tokenAddr1, tokenAddr2],
			pricsSats,
			dummyAddress,
			dummyAddress,
			dummyAddress,
			{ from: owner }
		);
		console.log(tokenAddr1 + "  " + tokenAddr2 + "  " + pricsSats);
		postcsovAddr = await postcsov.address;
	});

	describe("deposit funds", () => {
		it("should deposit", async () => {
			const amount = web3.utils.toWei("3");
			let postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			await postcsov.deposit({ from: accounts[1], value: amount });

			postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);
		});
	});

	describe("reImburse", () => {
		it("should reImburse", async () => {
			const amount = web3.utils.toWei("3");
			let postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			await postcsov.deposit({ from: accounts[1], value: amount });

			postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			let CSOVAmountWei1 = await token1.balanceOf(accounts[2]);
			console.log("CSOVAmountWei1: " + CSOVAmountWei1);

			let CSOVAmountWei2 = await token2.balanceOf(accounts[2]);
			console.log("CSOVAmountWei2: " + CSOVAmountWei2);

			let tx = await postcsov.reImburse({ from: accounts[2] });

			// Found and fixed the SIP-0007 bug on VestingRegistry::reImburse formula.
			// More details at Documenting Code issues at point 11 in
			// https://docs.google.com/document/d/10idTD1K6JvoBmtPKGuJ2Ub_mMh6qTLLlTP693GQKMyU/
			// Bug: let rbtcAmount = ((CSOVAmountWei1 + CSOVAmountWei2) * pricsSats) / 10 ** 10;
			let rbtcAmount = ((CSOVAmountWei1 + CSOVAmountWei2) * pricsSats) / 10 ** 8;
			console.log("rbtcAmount: " + rbtcAmount);

			expectEvent(tx, "CSOVReImburse", {
				from: accounts[2],
				CSOVamount: "6000000000000000000",
				reImburseAmount: "150000000000000",
			});
		});

		it("should reImburse partially", async () => {
			const amount = web3.utils.toWei("3");
			let postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			await postcsov.deposit({ from: accounts[1], value: amount });

			postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			let CSOVAmountWei1 = await token1.balanceOf(accounts[2]);
			console.log("CSOVAmountWei1: " + CSOVAmountWei1);

			let CSOVAmountWei2 = await token2.balanceOf(accounts[2]);
			console.log("CSOVAmountWei2: " + CSOVAmountWei2);

			await postcsov.setLockedAmount(accounts[2], "2000000000000000000", { from: owner });
			let tx = await postcsov.reImburse({ from: accounts[2] });

			// Found and fixed the SIP-0007 bug on VestingRegistry::reImburse formula.
			// More details at Documenting Code issues at point 11 in
			// https://docs.google.com/document/d/10idTD1K6JvoBmtPKGuJ2Ub_mMh6qTLLlTP693GQKMyU/
			let rbtcAmount = ((CSOVAmountWei1 + CSOVAmountWei2) * pricsSats) / 10 ** 8;
			console.log("rbtcAmount: " + rbtcAmount);

			expectEvent(tx, "CSOVReImburse", {
				from: accounts[2],
				CSOVamount: "4000000000000000000",
				reImburseAmount: "100000000000000",
			});
		});

		it("should NOT reImburse twice", async () => {
			const amount = web3.utils.toWei("3");
			let postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			await postcsov.deposit({ from: accounts[1], value: amount });

			postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			let CSOVAmountWei1 = await token1.balanceOf(accounts[2]);
			console.log("CSOVAmountWei1: " + CSOVAmountWei1);

			let CSOVAmountWei2 = await token2.balanceOf(accounts[2]);
			console.log("CSOVAmountWei2: " + CSOVAmountWei2);

			let tx = await postcsov.reImburse({ from: accounts[2] });

			// Found and fixed the SIP-0007 bug on VestingRegistry::reImburse formula.
			// More details at Documenting Code issues at point 11 in
			// https://docs.google.com/document/d/10idTD1K6JvoBmtPKGuJ2Ub_mMh6qTLLlTP693GQKMyU/
			let rbtcAmount = ((CSOVAmountWei1 + CSOVAmountWei2) * pricsSats) / 10 ** 8;
			console.log("rbtcAmount: " + rbtcAmount);

			await expectRevert(postcsov.reImburse({ from: accounts[3] }), "holder has no CSOV");

			expectEvent(tx, "CSOVReImburse", {
				from: accounts[2],
				CSOVamount: "6000000000000000000",
				reImburseAmount: "150000000000000",
			});

			await expectRevert(postcsov.reImburse({ from: accounts[2] }), "Address cannot be processed twice");
		});

		it("should not reImburse if user has no CSOV", async () => {
			let postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			let CSOVAmountWei1 = await token1.balanceOf(accounts[3]);
			console.log("CSOVAmountWei1: " + CSOVAmountWei1);

			let CSOVAmountWei2 = await token2.balanceOf(accounts[3]);
			console.log("CSOVAmountWei2: " + CSOVAmountWei2);

			postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);
			console.log("CSOVAmountWei1: " + CSOVAmountWei1);
			console.log("CSOVAmountWei2: " + CSOVAmountWei2);

			await expectRevert(postcsov.reImburse({ from: accounts[3] }), "holder has no CSOV");
		});

		it("should not reImburse if user blacklisted", async () => {
			await postcsov.setBlacklistFlag(accounts[3], true, { from: owner });

			await expectRevert(postcsov.reImburse({ from: accounts[3] }), "Address blacklisted");
		});
	});

	describe("withdraw funds", () => {
		it("should withdraw", async () => {
			await expectRevert(postcsov.withdrawAll(accounts[4], { from: accounts[4] }), "unauthorized");

			let postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);

			await postcsov.withdrawAll(accounts[4], { from: owner });

			postBudget = await postcsov.budget();
			console.log("postBudget: " + postBudget);
		});
	});
});
