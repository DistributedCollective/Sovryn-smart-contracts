const { ethers, network, deployments } = require("hardhat");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
// import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk'
const { computePoolAddress, FeeAmount } = require("@uniswap/v3-sdk");
const { Token } = require("@uniswap/sdk-core");
const { default: BigNumber } = require("bignumber.js");
const axios = require("axios");
const moment = require("moment");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

require("dotenv").config();

/** START CONFIG */
const ETH_NATIVE_TOKEN_ADDRS = "0x0000000000000000000000000000000000000001";
const MAX_SLIPPAGE_TOLERANCE_IN_PERCENTAGE = 10; // 10%
const TOKEN_BALANCE_THRESHOLD_IN_USD = 100; // 100 USD
const ACTIVATE_BOB_SNAPSHOT_PRICING = true;
const CONFIG_CONTRACT_ADDRESSES = {
    mainnet: {
        uniswapV3PoolFactory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
    rskMainnet: {
        priceFeed: "0x437AC62769f386b2d238409B7f0a7596d36506e4",
        wbtc: "0x542fda317318ebf1d3deaf76e0b632741a7e677d",
        weth: "0x1D931Bf8656d795E50eF6D639562C5bD8Ac2B78f",
        xusd: "0xb5999795BE0EbB5bAb23144AA5FD6A02D080299F",
        sov: "0xEFc78fc7d48b64958315949279Ba181c2114ABBd",
    },
};
const CONFIG_WHITELISTED_TOKENS = require("./data/bobWhitelistedTokenListDepositor.json");
/** END CONFIG */

async function executeTimeLockDepositor() {
    let WHITELISTED_TOKENS = [];
    if (network.name == "ethMainnet" || network.name == "tenderlyForkedEthMainnet") {
        WHITELISTED_TOKENS = CONFIG_WHITELISTED_TOKENS.mainnet;
    } else if (network.name == "sepolia") {
        WHITELISTED_TOKENS = CONFIG_WHITELISTED_TOKENS.sepolia;
    } else {
        throw new Error("Network not supported");
    }

    const pk = network.tags["mainnet"]
        ? process.env.SAFE_DEPOSITS_SENDER
        : process.env.SAFE_DEPOSITS_SENDER;
    const wallet = new ethers.Wallet(pk);
    const signer = wallet.connect(ethers.provider);

    const { get } = deployments;
    const safeMultisigDeployment = await get("SafeBobDeposits");
    const safeMultisigModuleDeployment = await get("SafeDepositsSender");
    const safeMultisigModuleContract = await ethers.getContract("SafeDepositsSender");
    const safeMultisigContract = await ethers.getContract("SafeBobDeposits");
    const SovDeployment = await get("SOV");

    const yesterdayDate = moment().subtract("1", "day").format("YYYY-MM-DD");
    if (ACTIVATE_BOB_SNAPSHOT_PRICING)
        logger.info(`Yesterday date for bob snapshot pricing: ${yesterdayDate}`);

    const allBobPriceSnapshot = await getAllPricesFromBobSnapshotApi();
    if (!allBobPriceSnapshot.length) {
        logger.error("Bob snapshot price is empty");
        return;
    }

    /** Check Paused */
    if (await safeMultisigModuleContract.isPaused()) {
        logger.warning(`Safe multisig module is paused`);
        return;
    }

    const tokensNameToSend = [];
    const tokensAddressToSend = [];
    const amountsToSend = [];
    const sovAmountList = {};
    let totalSovAmount = new BigNumber(0);

    logger.info("Processing whitelisted tokens...");
    for (const whitelistedToken of WHITELISTED_TOKENS) {
        logger.info(
            `\n\n===== Processing whitelisted tokens ${whitelistedToken.tokenName} - ${whitelistedToken.tokenAddress} =====`
        );

        const tokenContract = await ethers.getContractAt(
            "TestToken",
            whitelistedToken.tokenAddress
        );
        const tokenDecimal =
            whitelistedToken.tokenAddress == ETH_NATIVE_TOKEN_ADDRS
                ? 18
                : await tokenContract.decimals();

        /** read balance of token */
        const tokenBalance = await getTokenBalance(
            whitelistedToken.tokenAddress,
            safeMultisigDeployment.address,
            ethers.provider
        );

        logger.info(`token ${whitelistedToken.tokenName} balance: ${tokenBalance}`);

        /** Process 50% of token balance */
        const processedTokenAmount = ethers.BigNumber.from(tokenBalance).div(
            ethers.BigNumber.from(2)
        );

        logger.info(
            `Proocessing 50% of ${whitelistedToken.tokenName} balance: ${processedTokenAmount.toString()}`
        );

        /** Get SOV Amount for the token */
        let sovPrice;
        if (ACTIVATE_BOB_SNAPSHOT_PRICING) {
            /** Use bob snapshot if config flag is true */
            sovPrice = await getPriceByDateFromBobSnapshot(
                whitelistedToken.tokenAddress,
                SovDeployment.address,
                yesterdayDate,
                allBobPriceSnapshot
            );
            if (!sovPrice || sovPrice.toString() == "0" || isNaN(sovPrice)) {
                throw new Error(
                    `getPriceByDateFromBobSnapshot: empty price data from bob snapshot for token ${whitelistedToken.tokenName} - ${whitelistedToken.tokenAddress}`
                );
            }
        } else {
            /** Use uniswap if bob snapshot config is false */
            // the function will return the price in floating format, e.g: 1 XDAI = 0.6123xx SOV
            sovPrice = await getSovPrice(whitelistedToken); // from uniswap v3
        }

        // SOV Amount will not consider decimal anymore (1 SOV = 1 SOV)
        const sovAmount = new BigNumber(sovPrice)
            .multipliedBy(new BigNumber(processedTokenAmount.toString()))
            .dividedBy(new BigNumber(`1e${tokenDecimal}`))
            .decimalPlaces(0);

        /** @todo uncomment this line 201 - 220 to check slippage tolerance */
        // get sov price from RSK PriceFeed for slippage comparison
        // the function will return price in floating format, e.g: 1 XDAI = 0.6123xx SOV
        // NOTE: Slippage check cannot be implemented when using bob snapshot pricing, because we will use the yesterday's price, and there might be a huge slippage between those time
        if (!ACTIVATE_BOB_SNAPSHOT_PRICING) {
            const sovPriceFromRskPriceFeed = await getPriceFromRskSovrynPriceFeed(
                getMappedRskTokenFromEther(whitelistedToken.tokenName),
                CONFIG_CONTRACT_ADDRESSES.rskMainnet.sov
            );

            if (
                !checkWithinSlippageTolerancePercentage(
                    sovPrice.toNumber(),
                    sovPriceFromRskPriceFeed.toNumber(),
                    MAX_SLIPPAGE_TOLERANCE_IN_PERCENTAGE
                )
            ) {
                const errMessage = `token ${whitelistedToken.tokenName} has exceed the max slippage tolerance, uniswapPrice: ${sovPrice}, rskSovrynPrice: ${sovPriceFromRskPriceFeed}`;
                logger.error(errMessage);
                throw new Error(errMessage);
            }

            logger.info(
                `Slippage check has passed, uniswapPrice: ${sovPrice}, rskSovrynPrice: ${sovPriceFromRskPriceFeed}`
            );
        }

        logger.info(`SOV Amount from 50% ${whitelistedToken.tokenName}: ${sovAmount.toString()}`);

        /** Get USD Price of the processed SOV */
        // GET SOV Price in USD
        const sovPriceInUsd = await getPriceFromRskSovrynPriceFeed(
            CONFIG_CONTRACT_ADDRESSES.rskMainnet.sov,
            CONFIG_CONTRACT_ADDRESSES.rskMainnet.xusd
        );
        logger.info(`SOV Price in USD: ${sovPriceInUsd}`);

        /** USD Price for 100% processed token */
        const fullProcessedUsdAmountInUsd = sovPriceInUsd
            .multipliedBy(sovAmount)
            .multipliedBy(new BigNumber(2));

        /** Compare the full USD Value to the threshold config */
        if (fullProcessedUsdAmountInUsd.lt(TOKEN_BALANCE_THRESHOLD_IN_USD)) {
            logger.warning(
                `token ${whitelistedToken.tokenName} still below the threshold of USD Threshold value to process the transfer to timelock: threshold: ${TOKEN_BALANCE_THRESHOLD_IN_USD}, balance: ${fullProcessedUsdAmountInUsd.toString()}`
            );
            continue;
        }

        logger.info(
            `token ${whitelistedToken.tokenName} will be processed, threshold: ${TOKEN_BALANCE_THRESHOLD_IN_USD}, value in USD: ${fullProcessedUsdAmountInUsd.toString()}`
        );

        tokensNameToSend.push(whitelistedToken.tokenName);
        tokensAddressToSend.push(whitelistedToken.tokenAddress);
        amountsToSend.push(processedTokenAmount.toString());
        totalSovAmount = totalSovAmount.plus(sovAmount);

        /** For logging purposes */
        sovAmountList[whitelistedToken.tokenName] = sovAmount.toString();
    }

    /** Consider the decimal of SOV */
    const totalSovAmountWithDecimal = totalSovAmount
        .multipliedBy(new BigNumber("1e18"))
        .decimalPlaces(0);

    /** Check SOV Amount */
    const safeSOVBalance = await getTokenBalance(
        SovDeployment.address,
        safeMultisigDeployment.address,
        ethers.provider
    );

    if (new BigNumber(safeSOVBalance).lt(totalSovAmountWithDecimal)) {
        logger.error(
            `insufficient SOV Amount, need: ${totalSovAmount.toString()} , got: ${safeSOVBalance.toString()}`
        );
        /** @TODO Trigger alert to discord maybe */
    }

    logger.info("Token list to send..");
    logger.info(JSON.stringify(tokensNameToSend));

    logger.info("Token Address to send..");
    logger.info(JSON.stringify(tokensAddressToSend));

    logger.info("Amounts list to send..");
    logger.info(JSON.stringify(amountsToSend));

    logger.info("SOV List Details");
    logger.info(JSON.stringify(sovAmountList));

    logger.info(`Total SOV Amount: ${totalSovAmount.toString()}`);
    logger.info(
        `Total SOV Amount (With decimal) to sent: ${totalSovAmountWithDecimal.toString()}`
    );

    if (amountsToSend.length != tokensAddressToSend.length) {
        throw new Error(
            `Tokens amount length: (${amountsToSend.length}) mismatch with token addresses length: (${tokensAddressToSend.length})`
        );
    }

    if (!amountsToSend.length) {
        logger.info("Empty token list to be processed, exiting...");
        return;
    }

    /** Process sending token */
    logger.info("===== Execute the sendToLockDropContract function from multisig safe =====");
    logger.info(`Safe Module address: ${safeMultisigModuleDeployment.address}`);
    const tx = await safeMultisigModuleContract
        .connect(signer)
        .sendToLockDropContract(
            tokensAddressToSend,
            amountsToSend,
            totalSovAmountWithDecimal.toFixed()
        );
    logger.info("===== Execute Done =====");
    logger.info(tx);
}

async function getPoolAddress(tokenInAddress, tokenOutAddress, fee = FeeAmount.HIGH) {
    const tokenInContract = await ethers.getContractAt("TestToken", tokenInAddress);
    const tokenOutContract = await ethers.getContractAt("TestToken", tokenOutAddress);
    const tokenInDecimal = await tokenInContract.decimals();
    const tokenOutDecimal = await tokenOutContract.decimals();
    const TOKEN_IN = new Token(
        1,
        tokenInAddress,
        tokenInDecimal,
        "IN", // dummy name
        "IN" // dummy symbol
    );

    const TOKEN_OUT = new Token(
        1,
        tokenOutAddress,
        tokenOutDecimal,
        "OUT", // dummy name
        "OUT" // dummy symbol
    );

    const currentPoolAddress = computePoolAddress({
        factoryAddress: CONFIG_CONTRACT_ADDRESSES.mainnet.uniswapV3PoolFactory,
        tokenA: TOKEN_IN,
        tokenB: TOKEN_OUT,
        fee: fee,
    });

    console.log(`pool address of ${tokenInAddress} <> ${tokenOutAddress}: ${currentPoolAddress}`);
}

async function getSovPrice(whitelistedTokenConfig, log = true) {
    const { get } = deployments;
    const SovDeployment = await get("SOV");

    const wethAddress = CONFIG_CONTRACT_ADDRESSES.mainnet.weth;
    if (!whitelistedTokenConfig.pricingRoutePath.length) throw new Error("Empty route path");
    if (whitelistedTokenConfig.pricingRoutePath.length > 2)
        throw new Error("Only support 2 route path for token pricing");

    let latestPrice = 0;
    let previousRoutePrice = 0;
    for (const [index, pricingRoute] of whitelistedTokenConfig.pricingRoutePath.entries()) {
        const poolContract = await ethers.getContractAt("UniswapV3Pool", pricingRoute);
        const poolToken0 = await poolContract.token0();
        const poolToken1 = await poolContract.token1();

        // if last index is not TOKEN <> SOV pool, it will revert
        if (
            index == whitelistedTokenConfig.pricingRoutePath.length - 1 &&
            poolToken0.toLowerCase() != SovDeployment.address.toLowerCase() &&
            poolToken1.toLowerCase() != SovDeployment.address.toLowerCase()
        ) {
            throw new Error("Last route must be SOV pool");
        }

        const token0Contract = await ethers.getContractAt("TestToken", poolToken0);
        const token1Contract = await ethers.getContractAt("TestToken", poolToken1);

        const token0Decimal = await token0Contract.decimals();
        const token1Decimal = await token1Contract.decimals();

        if (poolToken0 != wethAddress && poolToken1 != wethAddress) {
            throw new Error(
                `failed to get pricing for ${tokenInAddress} - ${tokenOutAddress}, non of token index are weth`
            );
        }

        const slot = await poolContract.slot0();
        const sqrtPriceX96 = slot["sqrtPriceX96"];
        let rawPrice = sqrtPriceX96 ** 2 / 2 ** 192;
        let decimalDiff = token0Decimal - token1Decimal;

        let price;
        if (index == whitelistedTokenConfig.pricingRoutePath.length - 1) {
            /** For last route, which is sov, we get the price in SOV unit instead */
            price =
                poolToken0.toLowerCase() == wethAddress.toLowerCase()
                    ? new BigNumber(rawPrice)
                    : new BigNumber(1).div(new BigNumber(rawPrice)); // always in SOV Unit
            decimalDiff =
                poolToken0.toLowerCase() == wethAddress.toLowerCase()
                    ? decimalDiff
                    : decimalDiff * -1;
        } else {
            /** For non last route, we get the price in WETH unit */
            price =
                poolToken0.toLowerCase() == wethAddress.toLowerCase()
                    ? new BigNumber(1).div(new BigNumber(rawPrice))
                    : new BigNumber(rawPrice); // always in WETH Unit

            /**  */
            decimalDiff =
                poolToken0.toLowerCase() == wethAddress.toLowerCase()
                    ? decimalDiff * -1
                    : decimalDiff;
        }

        if (decimalDiff != 0) {
            price = price.multipliedBy(new BigNumber(`1e${decimalDiff}`));
        }

        if (previousRoutePrice == 0) {
            latestPrice = price;
        } else {
            // previousRoutePrice always be in ETH unit, so to normalize we need to do the ^1e18
            latestPrice = new BigNumber(previousRoutePrice).multipliedBy(new BigNumber(price));
        }

        previousRoutePrice = price;
    }

    if (log) {
        console.log(
            `(Uniswap v3) SOV Price of ${whitelistedTokenConfig.tokenName} - ${whitelistedTokenConfig.tokenAddress}: ${latestPrice.toString()}`
        );
    }

    /** Price = price per unit */
    return latestPrice;
}

async function getPriceFromRskSovrynPriceFeed(sourceTokenAddress, destTokenAddress) {
    const rskProvider = new ethers.providers.JsonRpcProvider("https://mainnet-dev.sovryn.app/rpc");
    const priceFeedFactory = await ethers.getContractFactory("PriceFeeds");
    const priceFeedAbi = priceFeedFactory.interface.format(ethers.utils.FormatTypes.json);
    const priceFeedContract = new ethers.Contract(
        CONFIG_CONTRACT_ADDRESSES.rskMainnet.priceFeed,
        priceFeedAbi,
        rskProvider
    );

    const price = await priceFeedContract.queryRate(sourceTokenAddress, destTokenAddress);

    const finalPrice = new BigNumber(price[0].toString()).dividedBy(
        new BigNumber(price[1].toString())
    );

    console.log(`${sourceTokenAddress}: ${finalPrice}`);

    return finalPrice;
}

async function getAllPricesFromBobSnapshotApi() {
    const response = await axios.get("https://fusion-api.gobob.xyz/tokenprices");

    return response.data;
}

/**
 * Calculate Dest Token Price from the give source token address
 * @param sourceTokenAddress address of source token
 * @param destinationTokenAddress address of dest token
 * @param date date of snapshot price, format YYYY-MM-DD e.g: 2023-03-23
 * @param allBobPriceSnapshot array of object of all bob price snapshot
 *
 * @return sov price, e.g: 1 USD  (source token) = 0.6 SOV (dest token), this function will return "0.6" -> Type BigNumber
 * @NOTE returning zero price meaning there is an issue with the api data.
 */
async function getPriceByDateFromBobSnapshot(
    sourceTokenAddress,
    destinationTokenAddress,
    date,
    allBobPriceSnapshot
) {
    if (sourceTokenAddress == ETH_NATIVE_TOKEN_ADDRS) sourceTokenAddress = ZERO_ADDRESS;
    if (destinationTokenAddress == ETH_NATIVE_TOKEN_ADDRS) destinationTokenAddress = ZERO_ADDRESS;

    const price = allBobPriceSnapshot.filter((priceSnapshotObj) => {
        return (
            priceSnapshotObj.token_address.toLowerCase() == sourceTokenAddress.toLowerCase() &&
            priceSnapshotObj.ts == date
        );
    });

    if (price.length > 1) {
        throw new Error(
            `bobPriceSnapshot: There are two identical price for ${sourceTokenAddress} with date ${date}`
        );
    }

    if (!price.length) {
        return 0;
    }

    const sourceTokenInUsdPrice = price[0].price;

    const destTokenPrice = allBobPriceSnapshot.filter((priceSnapshotObj) => {
        return (
            priceSnapshotObj.token_address.toLowerCase() ==
                destinationTokenAddress.toLowerCase() && priceSnapshotObj.ts == date
        );
    });

    if (destTokenPrice.length > 1) {
        throw new Error(
            `bobPriceSnapshot: There are two identical price for ${destinationTokenAddress} Token with date ${date}`
        );
    }

    if (!destTokenPrice.length) {
        return 0; // just return 0 price to indicates there is an issue
    }

    const destTokenInUsdPrice = destTokenPrice[0].price;

    return new BigNumber(sourceTokenInUsdPrice).dividedBy(new BigNumber(destTokenInUsdPrice));
}

async function getSovAmountByQuoter(tokenInAddress, tokenOutAddress, amountIn) {
    /** The other solution to get price - but this one will consider the liquidity and swap amount in the pool */
    const quoterContract = await ethers.getContract("UniswapQuoter");
    const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
        tokenInAddress,
        tokenOutAddress,
        ethers.BigNumber.from(FeeAmount.HIGH),
        amountIn,
        0
    );

    console.log(quotedAmountOut.toString());

    return quotedAmountOut;
}

async function getTokenBalance(tokenAddress, holderAdress, provider) {
    if (tokenAddress == ETH_NATIVE_TOKEN_ADDRS) {
        return await provider.getBalance(holderAdress);
    } else {
        const tokenContract = await ethers.getContractAt("TestToken", tokenAddress);
        return await tokenContract.balanceOf(holderAdress);
    }
}

function checkWithinSlippageTolerancePercentage(
    price1,
    price2,
    slippageMaxPercentage,
    log = true
) {
    // Calculate the percentage difference
    const difference = Math.abs(price1 - price2);
    const average = (price1 + price2) / 2;

    const percentageDifference = (difference / average) * 100;

    if (log) console.log("slippage percentage diff: ", percentageDifference);
    // Check if the percentage difference is within 10%
    return percentageDifference <= slippageMaxPercentage;
}

function getMappedRskTokenFromEther(etherTokenName) {
    switch (etherTokenName) {
        case "WBTC":
            return CONFIG_CONTRACT_ADDRESSES.rskMainnet.wbtc;
        case "ETH":
        case "WETH":
            return CONFIG_CONTRACT_ADDRESSES.rskMainnet.weth;
        case "USDT":
        case "USDC":
        case "DAI":
            return CONFIG_CONTRACT_ADDRESSES.rskMainnet.xusd;
        default:
            throw new Error("Failed to map the eth <> rsk token");
    }
}
// executeTimeLockDepositor();

// Example usage:
// console.log(checkWithinSlippageTolerancePercentage(50, 59, 10)); // Output: false
// console.log(checkWithinSlippageTolerancePercentage(50, 54, 10)); // Output: true
// console.log(checkWithinSlippageTolerancePercentage(0.555250425310134847, 0.495250425310134847, 10)); // Output: false
// console.log(checkWithinSlippageTolerancePercentage(37897.01, 37283.26, 10)); // Output: false

// getPoolAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") // get USDT <> WETH
// getPoolAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") // get USDC <> WETH
// getPoolAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") // get DAI <> WETH

// getPoolAddress("0x18084fba666a33d37592fa2633fd49a74dd93a88", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", FeeAmount.MEDIUM) // get TBTC <> WETH
// getPoolAddress("0xae78736cd615f374d3085123a210448e74fc6393", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", FeeAmount.MEDIUM) // get rETH <> WETH
// getPoolAddress("0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", FeeAmount.MEDIUM) // get wstETH <> WETH

// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[0]); // get wbtc price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[1]) // get eth price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[2]) // get weth price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[3]) // get usdt price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[4]) // get usdc price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[5]) // get dai price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[6]) // get tbtc price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[7]) // get reth price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[8]) // get wsteth price

// getPriceFromRskSovrynPriceFeed(CONFIG_CONTRACT_ADDRESSES.rskMainnet.wbtc, CONFIG_CONTRACT_ADDRESSES.rskMainnet.sov)
// getPriceFromRskSovrynPriceFeed(CONFIG_CONTRACT_ADDRESSES.rskMainnet.xusd, CONFIG_CONTRACT_ADDRESSES.rskMainnet.sov)
// getPriceFromRskSovrynPriceFeed(CONFIG_CONTRACT_ADDRESSES.rskMainnet.weth, CONFIG_CONTRACT_ADDRESSES.rskMainnet.sov)

// (async () => {
//     const allPrices = await getAllPricesFromBobSnapshotApi()
//     const date = moment().format('YYYY-MM-DD');
//     console.log(date)
//     const tokenPrice = await getTokenPriceByDateFromBobSnapshot("0x0000000000000000000000000000000000000000", date, allPrices);
//     console.log(tokenPrice)
// })()

module.exports = {
    executeTimeLockDepositor,
    getSovPrice,
    ETH_NATIVE_TOKEN_ADDRS,
    getTokenBalance,
    getAllPricesFromBobSnapshotApi,
    getPriceByDateFromBobSnapshot,
    MAX_SLIPPAGE_TOLERANCE_IN_PERCENTAGE,
    checkWithinSlippageTolerancePercentage,
};
