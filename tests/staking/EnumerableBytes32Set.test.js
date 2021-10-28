const { assert, expect } = require("chai");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const TestCoverage = artifacts.require("TestCoverage");

contract("EnumerableBytes32Set", (accounts) => {
	before(async () => {
		testCoverage = await TestCoverage.new();
	});

	describe("EnumerableBytes32Set edge cases", () => {
		it("Add and remove bytes32 w/ same value", async () => {
			let result = await testCoverage.testEnum_AddRemove.call(
				"0x7465737400000000000000000000000000000000000000000000000000000000",
				"0x7465737400000000000000000000000000000000000000000000000000000000"
			);
			// console.log("result", result);
			assert(result == true);
		});

		it("Add and remove bytes32 w/ different value", async () => {
			let result = await testCoverage.testEnum_AddRemove.call(
				"0x7465737400000000000000000000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000000000000000000000000000000"
			);
			// console.log("result", result);
			assert(result == false);
		});

		it("Add and check address", async () => {
			let result = await testCoverage.testEnum_AddAddress.call(testCoverage.address, testCoverage.address);
			// console.log("result", result);
			assert(result == true);
		});

		it("Add and check different address", async () => {
			let result = await testCoverage.testEnum_AddAddress.call(testCoverage.address, ZERO_ADDRESS);
			// console.log("result", result);
			assert(result == false);
		});

		it("Add several addresses and enumerate them", async () => {
			let result = await testCoverage.testEnum_AddAddressesAndEnumerate.call(testCoverage.address, ZERO_ADDRESS);
			// console.log("result", result);
			/// @dev the output from contract has to be sliced to be compared as a String. Besides, it comes lowercased.
			assert.equal(
				"0x" + result[0].toString().match(/.{40}$/)[0],
				testCoverage.address.toLowerCase(),
				"The 1st Address does not match."
			);
			assert.equal("0x" + result[1].toString().match(/.{40}$/)[0], ZERO_ADDRESS.toLowerCase(), "The 2nd Address does not match.");
		});
	});
});
