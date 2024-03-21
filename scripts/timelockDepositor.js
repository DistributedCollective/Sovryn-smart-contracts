const { ethers, network, deployments } = require("hardhat");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
// import { computePoolAddress, FeeAmount } from '@uniswap/v3-sdk'
const { computePoolAddress, FeeAmount } = require("@uniswap/v3-sdk");
const { Token } = require("@uniswap/sdk-core");
const { default: BigNumber } = require("bignumber.js");

require("dotenv").config();

const ETH_NATIVE_TOKEN_ADDRS = "0x0000000000000000000000000000000000000001";
const MAX_SLIPPAGE_TOLERANCE_IN_PERCENTAGE = 15; // 15%

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

const CONFIG_WHITELISTED_TOKENS = {
    mainnet: [
        {
            tokenName: "WBTC",
            tokenAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
            tokenBalanceThreshold: "1600000", // 8 Decimals - 0.016 BTC
            pricingRoutePath: [
                "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD", // WBTC <> WETH
                "0x3C4323f83D91b500b0f52cB19f7086813595F4C9", // SOV <> WETH
            ],
        },
        {
            tokenName: "ETH",
            tokenAddress: ETH_NATIVE_TOKEN_ADDRS,
            tokenBalanceThreshold: "300000000000000000", // 18 Decimals - 0.3 ETH
            pricingRoutePath: [
                "0x3C4323f83D91b500b0f52cB19f7086813595F4C9", // SOV <> WETH
            ],
        },
        {
            tokenName: "WETH",
            tokenAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            tokenBalanceThreshold: "300000000000000000", // 18 Decimals - 0.3 ETH
            pricingRoutePath: [
                "0x3C4323f83D91b500b0f52cB19f7086813595F4C9", // SOV <> WETH
            ],
        },
        {
            tokenName: "USDT",
            tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            tokenBalanceThreshold: "1000000000", // 6 Decimals - 1000 USDT
            pricingRoutePath: [
                "0xC5aF84701f98Fa483eCe78aF83F11b6C38ACA71D", // USDT <> WETH
                "0x3C4323f83D91b500b0f52cB19f7086813595F4C9", // SOV <> WETH
            ],
        },
        {
            tokenName: "USDC",
            tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            tokenBalanceThreshold: "1000000000", // 6 Decimals - 1000 USDC
            pricingRoutePath: [
                "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8", // USDC <> WETH
                "0x3C4323f83D91b500b0f52cB19f7086813595F4C9", // SOV <> WETH
            ],
        },
        {
            tokenName: "DAI",
            tokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
            tokenBalanceThreshold: "1000000000000000000000", // 18 Decimals - 1000 DAI
            pricingRoutePath: [
                "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8", // DAI <> WETH
                "0x3C4323f83D91b500b0f52cB19f7086813595F4C9", // SOV <> WETH
            ],
        },
    ],

    sepolia: [
        {
            tokenName: "WBTC",
            tokenAddress: "",
            tokenBalanceThreshold: 1000,
        },
        {
            tokenName: "ETH",
            tokenAddress: ETH_NATIVE_TOKEN_ADDRS,
            tokenBalanceThreshold: 1000,
        },
        {
            tokenName: "WETH",
            tokenAddress: "",
            tokenBalanceThreshold: 1000,
        },
        {
            tokenName: "USDT",
            tokenAddress: "",
            tokenBalanceThreshold: 1000,
        },
        {
            tokenName: "USDC",
            tokenAddress: "",
            tokenBalanceThreshold: 1000,
        },
        {
            tokenName: "DAI",
            tokenAddress: "",
            tokenBalanceThreshold: 1000,
        },
    ],
};

async function main() {
    let WHITELISTED_TOKENS = [];
    if (network.name == "ethMainnet" || network.name == "tenderlyForkedEthMainnet") {
        WHITELISTED_TOKENS = CONFIG_WHITELISTED_TOKENS.mainnet;
    } else if (network.name == "sepolia") {
        WHITELISTED_TOKENS = CONFIG_WHITELISTED_TOKENS.sepolia;
    } else {
        throw new Error("Network not supported");
    }

    const pk = network.tags["mainnet"]
        ? process.env.MAINNET_SIGNER_PRIVATE_KEY
        : process.env.TESTNET_SIGNER_PRIVATE_KEY;
    const wallet = new ethers.Wallet(pk);
    const { get } = deployments;
    const safeMultisigDeployment = await get("SafeBobDeposits");
    const safeMultisigModuleDeployment = await get("SafeDepositsSender");
    const safeMultisigModuleContract = await ethers.getContract("SafeDepositsSender");
    const safeMultisigContract = await ethers.getContract("SafeBobDeposits");

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
            `Processing whitelisted tokens ${whitelistedToken.tokenName} - ${whitelistedToken.tokenAddress}`
        );
        // const tokenDeployment = await get(whitelistedToken);
        const tokenContract = await ethers.getContractAt(
            "TestToken",
            whitelistedToken.tokenAddress
        );

        /** read balance of token */
        const tokenBalance = await getTokenBalance(
            whitelistedToken.tokenAddress,
            safeMultisigDeployment.address,
            ethers.provider
        );

        logger.info(`token ${whitelistedToken.tokenName} balance: ${tokenBalance}`);

        if (
            ethers.BigNumber.from(tokenBalance).lt(
                ethers.BigNumber.from(whitelistedToken.tokenBalanceThreshold)
            )
        ) {
            logger.warning(
                `token ${whitelistedToken.tokenName} lack of balance to process the transfer to timelock: threshold: ${whitelistedToken.tokenBalanceThreshold}, balance: ${tokenBalance.toString()}`
            );
            continue;
        }

        logger.info(
            `token ${whitelistedToken.tokenName} will be processed, threshold: ${whitelistedToken.tokenBalanceThreshold}, balance: ${tokenBalance.toString()}`
        );

        /** Process 50% of token balance */
        const processedTokenAmount = ethers.BigNumber.from(tokenBalance).div(
            ethers.BigNumber.from(2)
        );

        logger.info(
            `Sufficient ${whitelistedToken.tokenName} balance, processing ${processedTokenAmount.toString()}`
        );

        tokensNameToSend.push(whitelistedToken.tokenName);
        tokensAddressToSend.push(whitelistedToken.tokenAddress);
        amountsToSend.push(processedTokenAmount.toString());

        /** Get SOV Amount for the token */
        // the function will return the price in floating format, e.g: 1 XDAI = 0.6123xx
        const sovPrice = await getSovPrice(whitelistedToken); // from uniswap v3
        const sovAmount = new BigNumber(sovPrice)
            .multipliedBy(new BigNumber(processedTokenAmount.toString()))
            .decimalPlaces(0);

        // get sov price from RSK PriceFeed for slippage comparison
        // the function will return price in floating format, e.g: 1 XDAI =
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
        logger.info(`SOV Amount from 50% ${whitelistedToken.tokenName}: ${sovPrice.toString()}`);

        /** For logging purposes */
        sovAmountList[whitelistedToken.tokenName] = sovAmount.toString();

        totalSovAmount = totalSovAmount.plus(sovAmount);
    }

    /** Check SOV Amount */
    const SovDeployment = await get("SOV");
    const safeSOVBalance = await getTokenBalance(
        SovDeployment.address,
        safeMultisigDeployment.address,
        ethers.provider
    );

    if (new BigNumber(safeSOVBalance).lt(totalSovAmount)) {
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

    logger.info(`Total SOV Amount to sent: ${totalSovAmount.toString()}`);

    /** Process sending token */
    const data = await safeMultisigModuleContract.populateTransaction.sendToLockDropContract(
        tokensAddressToSend,
        amountsToSend,
        totalSovAmount.toFixed()
    );

    logger.info("===== Execute the sendToLockDropContract function from multisig safe =====");
    logger.info(`Safe Module address: ${safeMultisigModuleDeployment.address}`);
    logger.info(`Data: ${data.data}`);
    // await safeMultisigContract.execTransactionFromModule(
    //     safeMultisigModuleDeployment.address,
    //     0,
    //     data.data,
    //     1
    // );
    logger.info("===== Execute Done =====");
}

async function getPoolAddress(tokenInAddress, tokenOutAddress) {
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
        fee: FeeAmount.HIGH,
    });

    console.log(`pool address of ${tokenInAddress} <> ${tokenOutAddress}: ${currentPoolAddress}`);
}

async function getSovPrice(whitelistedTokenConfig) {
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

    console.log(
        `SOV Price of ${whitelistedTokenConfig.tokenName} - ${whitelistedTokenConfig.tokenAddress}: ${latestPrice.toString()}`
    );

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

function checkWithinSlippageTolerancePercentage(price1, price2, slippageMaxPercentage) {
    // Calculate the percentage difference
    const difference = Math.abs(price1 - price2);
    const average = (price1 + price2) / 2;

    const percentageDifference = (difference / average) * 100;

    console.log("slippage percentage diff: ", percentageDifference);
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
main();

// Example usage:
// console.log(checkWithinSlippageTolerancePercentage(50, 59, 10)); // Output: false
// console.log(checkWithinSlippageTolerancePercentage(50, 54, 10)); // Output: true
// console.log(checkWithinSlippageTolerancePercentage(0.555250425310134847, 0.495250425310134847, 10)); // Output: false
// console.log(checkWithinSlippageTolerancePercentage(37897.01, 37283.26, 10)); // Output: false

// getPoolAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") // get USDT <> WETH
// getPoolAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") // get USDC <> WETH
// getPoolAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") // get DAI <> WETH

// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[0]); // get wbtc price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[1]) // get eth price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[2]) // get weth price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[3]) // get usdt price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[4]) // get usdc price
// getSovPrice(CONFIG_WHITELISTED_TOKENS.mainnet[5]) // get dai price

// getPriceFromRskSovrynPriceFeed(CONFIG_CONTRACT_ADDRESSES.rskMainnet.wbtc, CONFIG_CONTRACT_ADDRESSES.rskMainnet.sov)
// getPriceFromRskSovrynPriceFeed(CONFIG_CONTRACT_ADDRESSES.rskMainnet.xusd, CONFIG_CONTRACT_ADDRESSES.rskMainnet.sov)
// getPriceFromRskSovrynPriceFeed(CONFIG_CONTRACT_ADDRESSES.rskMainnet.weth, CONFIG_CONTRACT_ADDRESSES.rskMainnet.sov)
