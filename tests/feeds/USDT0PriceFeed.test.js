const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("USDT0PriceFeed", () => {
    let usdt0PriceFeed;
    let mockOracle;

    beforeEach(async () => {
        // Deploy mock oracle that returns 8 decimals
        const MockOracle = await ethers.getContractFactory("MockRedstoneOracle");
        mockOracle = await MockOracle.deploy();
        await mockOracle.deployed();

        // Deploy USDT0PriceFeed wrapper
        const USDT0PriceFeed = await ethers.getContractFactory("USDT0PriceFeed");
        usdt0PriceFeed = await USDT0PriceFeed.deploy(mockOracle.address);
        await usdt0PriceFeed.deployed();
    });

    it("Should scale 8 decimals to 18 decimals correctly", async () => {
        // Redstone returns 99937000 (8 decimals) = $0.99937
        const oraclePrice = 99937000;
        await mockOracle.setPrice(oraclePrice);

        const wrapperPrice = await usdt0PriceFeed.latestAnswer();

        // Expected: 999370000000000000 (18 decimals) = $0.99937
        // Scaling: 99937000 * 10^10 = 999370000000000000
        const expectedPrice = ethers.BigNumber.from(oraclePrice).mul(
            ethers.BigNumber.from(10).pow(10)
        );

        expect(wrapperPrice).to.equal(expectedPrice);
        expect(wrapperPrice.toString()).to.equal("999370000000000000");
    });

    it("Should work with realistic USDT price range", async () => {
        // USDT typically trades between $0.99 and $1.01 (with 8 decimals)
        const testCases = [
            { oraclePrice: 99000000, usdValue: "0.99" }, // $0.99
            { oraclePrice: 99500000, usdValue: "0.995" }, // $0.995
            { oraclePrice: 100000000, usdValue: "1.0" }, // $1.00
            { oraclePrice: 100500000, usdValue: "1.005" }, // $1.005
            { oraclePrice: 101000000, usdValue: "1.01" }, // $1.01
        ];

        for (const test of testCases) {
            await mockOracle.setPrice(test.oraclePrice);
            const wrapperPrice = await usdt0PriceFeed.latestAnswer();

            // Verify it scales correctly
            const expected = ethers.utils.parseEther(test.usdValue);
            expect(wrapperPrice).to.equal(expected);

            // Verify it's within reasonable range for USDT
            expect(wrapperPrice).to.be.gte(ethers.utils.parseEther("0.98"));
            expect(wrapperPrice).to.be.lte(ethers.utils.parseEther("1.02"));
        }
    });

    describe("Price validation", () => {
        it("Should revert if price is zero or negative", async () => {
            await mockOracle.setPrice(0);
            await expect(usdt0PriceFeed.latestAnswer()).to.be.revertedWith(
                "Invalid price: answer <= 0"
            );

            await mockOracle.setPrice(-100);
            await expect(usdt0PriceFeed.latestAnswer()).to.be.revertedWith(
                "Invalid price: answer <= 0"
            );
        });

        it("Should revert if price data is stale (>24 hours old)", async () => {
            // Set a valid price
            await mockOracle.setPrice(100000000);

            // Fast forward 25 hours
            await time.increase(25 * 60 * 60);

            // Should revert because price is now stale
            await expect(usdt0PriceFeed.latestAnswer()).to.be.revertedWith("Stale price: too old");
        });

        it("Should accept price data within 24 hours", async () => {
            await mockOracle.setPrice(100000000);

            // Fast forward 23 hours (still valid)
            await time.increase(23 * 60 * 60);

            // Should succeed
            const price = await usdt0PriceFeed.latestAnswer();
            expect(price).to.equal(ethers.utils.parseEther("1.0"));
        });

        it("Should work immediately after price update", async () => {
            await mockOracle.setPrice(99937000);

            // Should succeed immediately
            const price = await usdt0PriceFeed.latestAnswer();
            expect(price).to.equal("999370000000000000");
        });
    });

    it("Should revert on zero address constructor", async () => {
        const USDT0PriceFeed = await ethers.getContractFactory("USDT0PriceFeed");
        await expect(USDT0PriceFeed.deploy(ethers.constants.AddressZero)).to.be.revertedWith(
            "Invalid oracle address"
        );
    });
});
