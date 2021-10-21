const { assert, expect } = require("chai");
const { BN, constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const TestCoverage = artifacts.require("TestCoverage");

contract("SafeMath96", (accounts) => {
	before(async () => {
		testCoverage = await TestCoverage.new();
	});

	describe("SafeMath96 edge cases", () => {
		it("shouldn't overflow: safe32 w/ 10**32-1", async () => {
			await expectRevert(testCoverage.testSafeMath96_safe32_Ok(new BN(10).pow(new BN(32).sub(new BN(1)))), "overflow");
		});
		it("should overflow: safe32 w/ 10**32", async () => {
			await expectRevert(testCoverage.testSafeMath96_safe32_Overflow(), "overflow");
		});
	});
});
