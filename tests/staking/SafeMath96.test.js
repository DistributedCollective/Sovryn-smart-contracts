const { assert, expect } = require("chai");
const { BN, constants, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const TestCoverage = artifacts.require("TestCoverage");

contract("SafeMath96", (accounts) => {
	before(async () => {
		testCoverage = await TestCoverage.new();
	});

	describe("SafeMath96 edge cases", () => {
		it("shouldn't overflow: safe32 w/ 2**32-1", async () => {
			let upperLimitValue = new BN(2).pow(new BN(32).sub(new BN(1)));
            let result = await testCoverage.testSafeMath96_safe32(upperLimitValue);
            expect(result).to.be.bignumber.equal(upperLimitValue);
		});

		it("should overflow: safe32 w/ 2**32", async () => {
			await expectRevert(testCoverage.testSafeMath96_safe32(new BN(2).pow(new BN(32))), "overflow");
		});

		it("shouldn't overflow: safe64 w/ 2**64-1", async () => {
			let upperLimitValue = new BN(2).pow(new BN(64).sub(new BN(1)));
            let result = await testCoverage.testSafeMath96_safe64(upperLimitValue);
            expect(result).to.be.bignumber.equal(upperLimitValue);
		});

		it("should overflow: safe64 w/ 2**64", async () => {
			await expectRevert(testCoverage.testSafeMath96_safe64(new BN(2).pow(new BN(64))), "overflow");
		});

		it("shouldn't overflow: safe96 w/ 2**96-1", async () => {
			let upperLimitValue = new BN(2).pow(new BN(96).sub(new BN(1)));
            let result = await testCoverage.testSafeMath96_safe96(upperLimitValue);
            expect(result).to.be.bignumber.equal(upperLimitValue);
		});

		it("should overflow: safe96 w/ 2**96", async () => {
			await expectRevert(testCoverage.testSafeMath96_safe96(new BN(2).pow(new BN(96))), "overflow");
		});

    });
});
