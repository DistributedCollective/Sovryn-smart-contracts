const hre = require("hardhat");
const { setDeploymentMetaData } = require("../helpers/helpers");

/**
 * Deploy USDT0PriceFeed wrapper contract
 *
 * This wrapper:
 * 1. Normalizes Redstone USDT price feed from 8 decimals to 18 decimals
 * 2. Validates price data to prevent stale/invalid prices (security-critical)
 *
 * Security features:
 * - Uses latestRoundData() for full validation
 * - Checks answer > 0 (prevents zero price exploits)
 * - Validates freshness (24-hour staleness check)
 * - Verifies round completion (prevents incomplete data usage)
 *
 * Redstone USDT Price Feed on RSK Mainnet: 0x09639692ce6Ff12a06cA3AE9a24B3aAE4cD80dc8
 */
module.exports = async (hre) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    // Get Redstone USDT oracle from deployment
    const redstoneOracle = await get("RedStoneUSDT0Oracle");

    console.log("\n--- Deploying USDT0PriceFeed Wrapper ---");
    console.log(`Deployer: ${deployer}`);
    console.log(`Redstone Oracle: ${redstoneOracle.address}`);

    const usdt0PriceFeed = await deploy("USDT0PriceFeeds", {
        contract: "USDT0PriceFeed",
        from: deployer,
        args: [redstoneOracle.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });

    if (usdt0PriceFeed.newlyDeployed) {
        console.log(`✅ USDT0PriceFeed deployed at: ${usdt0PriceFeed.address}`);

        // Verify the wrapper is working correctly
        const USDT0PriceFeed = await hre.ethers.getContractAt(
            "USDT0PriceFeed",
            usdt0PriceFeed.address
        );

        try {
            const price = await USDT0PriceFeed.latestAnswer();
            console.log(`   Price (18 decimals): ${hre.ethers.utils.formatEther(price)}`);
            console.log(`   Raw value: ${price.toString()}`);

            // Expected: ~999370000000000000 (0.99937 with 18 decimals)
            const expectedMin = hre.ethers.utils.parseEther("0.9"); // $0.90
            const expectedMax = hre.ethers.utils.parseEther("1.1"); // $1.10

            if (price.gte(expectedMin) && price.lte(expectedMax)) {
                console.log("   ✅ Price feed is working correctly (within expected range)");
            } else {
                console.log("   ⚠️  Warning: Price is outside expected range ($0.90 - $1.10)");
            }
        } catch (error) {
            console.log(`   ⚠️  Warning: Could not verify price feed: ${error.message}`);
        }

        await setDeploymentMetaData("USDT0PriceFeeds", {
            contractAddress: usdt0PriceFeed.address,
            description: "USDT0 Price Feed Wrapper (Redstone -> 18 decimals)",
            redstoneOracle: redstoneOracle.address,
        });
    } else {
        console.log(`USDT0PriceFeed already deployed at: ${usdt0PriceFeed.address}`);
    }
};

module.exports.tags = ["USDT0PriceFeed", "PriceFeeds"];
module.exports.dependencies = ["RedStoneUSDT0Oracle"];
