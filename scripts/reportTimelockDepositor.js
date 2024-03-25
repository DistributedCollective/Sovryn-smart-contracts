const { ethers, network, deployments } = require("hardhat");
const Logs = require("node-logs");
const logger = new Logs().showInConsole(true);
const CONFIG_WHITELISTED_TOKENS = require("./data/bobWhitelistedTokenListDepositor.json");
const { default: BigNumber } = require("bignumber.js");
const {
    getSovPrice,
    ETH_NATIVE_TOKEN_ADDRS,
    getTokenBalance,
    getAllPricesFromBobSnapshotApi,
    getPriceByDateFromBobSnapshot,
    checkWithinSlippageTolerancePercentage,
    MAX_SLIPPAGE_TOLERANCE_IN_PERCENTAGE,
} = require("./timelockDepositor");
const moment = require("moment");
const col = require("cli-color");

async function main() {
    const { get } = deployments;
    const lockDropDeployment = await get("BobLockDrop");
    const safeDeployment = await get("SafeBobDeposits");
    const sovDeployment = await get("SOV");

    const lockDropContract = await ethers.getContract("BobLockDrop");
    const lockDropWithdrawalStartTime = await lockDropContract.withdrawalStartTime();

    const leftWithdrawalTime = moment.unix(lockDropWithdrawalStartTime).diff(moment().unix());
    const durationObj = moment.duration(leftWithdrawalTime, "seconds");
    const daysLeft = durationObj.days();
    const hoursLeft = durationObj.hours();
    const minutesLeft = durationObj.minutes();
    const secondsLeft = durationObj.seconds();

    const allBobPriceSnapshot = await getAllPricesFromBobSnapshotApi();
    if (!allBobPriceSnapshot.length) {
        logger.error("Bob snapshot price is empty");
        return;
    }

    const yesterdayDate = moment().subtract("1", "day").format("YYYY-MM-DD");
    const timeLeft = `${daysLeft} days, ${hoursLeft} hours ${minutesLeft} minutes ${secondsLeft} seconds`;
    logger.info(`LockDrop time to left to withdrawalStartTime: ${timeLeft}`);

    let emptyBobSnapshotPrice = [];
    let exceedSlippageTolerance = [];

    let tokenBalancesDetail = {
        lockDrop: [],
        safe: [],
    };

    let totalSovRequiredLockDrop = 0;
    let totalSovRequiredSafe = 0;
    for (const whitelistedToken of CONFIG_WHITELISTED_TOKENS.mainnet) {
        logger.info(`Processing ${whitelistedToken.tokenName}`);
        const tokenContract = await ethers.getContractAt(
            "TestToken",
            whitelistedToken.tokenAddress
        );

        /** Get token decimals */
        const tokenDecimal =
            whitelistedToken.tokenAddress == ETH_NATIVE_TOKEN_ADDRS
                ? 18
                : await tokenContract.decimals();

        /** Get token balance for LockDrop */
        let lockDropBalance = await getTokenBalance(
            whitelistedToken.tokenAddress,
            lockDropDeployment.address,
            ethers.provider
        );
        lockDropBalance = normalizeTokenNumber(lockDropBalance, tokenDecimal);
        tokenBalancesDetail.lockDrop.push({
            tokenAddress: whitelistedToken.tokenAddress,
            tokenName: whitelistedToken.tokenName,
            tokenBalance: !lockDropBalance.isNaN()
                ? lockDropBalance.decimalPlaces(2).toString()
                : "0",
        });

        /** Get token balance for Safe contract */
        let safeBalance = await getTokenBalance(
            whitelistedToken.tokenAddress,
            safeDeployment.address,
            ethers.provider
        );
        safeBalance = normalizeTokenNumber(safeBalance, tokenDecimal);
        tokenBalancesDetail.safe.push({
            tokenAddress: whitelistedToken.tokenAddress,
            tokenName: whitelistedToken.tokenName,
            tokenBalance: !safeBalance.isNaN() ? safeBalance.decimalPlaces(2).toString() : "0",
        });

        /** Get SOV equivalent for this token - using uniswap v3 */
        const sovPrice = await getSovPrice(whitelistedToken, false);
        // SOV Amount will not consider decimal anymore (1 SOV = 1 SOV)

        /** No need to normalize the price using decimal, because the lockDrop balance already been normalized */
        const sovAmountLockDrop = new BigNumber(sovPrice)
            .multipliedBy(new BigNumber(lockDropBalance.toString()))
            .decimalPlaces(0);

        /** No need to normalize the price using decimal, because the safe balance already been normalized */
        const sovAmountSafe = new BigNumber(sovPrice)
            .multipliedBy(new BigNumber(safeBalance.toString()))
            .decimalPlaces(0);

        totalSovRequiredLockDrop = new BigNumber(sovAmountLockDrop).plus(
            new BigNumber(totalSovRequiredLockDrop)
        );
        totalSovRequiredSafe = new BigNumber(sovAmountSafe).plus(
            new BigNumber(totalSovRequiredSafe)
        );

        /** Get price from bob api snapshot */
        /** Use bob snapshot if config flag is true */
        const sovPriceFromBobSnapshot = await getPriceByDateFromBobSnapshot(
            whitelistedToken.tokenAddress,
            sovDeployment.address,
            yesterdayDate,
            allBobPriceSnapshot
        );
        if (
            !sovPriceFromBobSnapshot ||
            sovPriceFromBobSnapshot.toString() == "0" ||
            isNaN(sovPriceFromBobSnapshot)
        ) {
            emptyBobSnapshotPrice.push(whitelistedToken);
        } else {
            if (
                !checkWithinSlippageTolerancePercentage(
                    new BigNumber(sovPrice).toNumber(),
                    new BigNumber(sovPriceFromBobSnapshot).toNumber(),
                    MAX_SLIPPAGE_TOLERANCE_IN_PERCENTAGE,
                    false
                )
            ) {
                exceedSlippageTolerance.push({
                    tokenName: whitelistedToken.tokenName,
                    tokenAddress: whitelistedToken.tokenAddress,
                    uniswapPrice: sovPrice.toString(),
                    bobSnapshotPrice: sovPriceFromBobSnapshot.toString(),
                });
            }
        }
    }

    const sovContract = await ethers.getContract("SOV");
    const sovDecimal = await sovContract.decimals();
    let lockDropSovBalance = await getTokenBalance(
        sovDeployment.address,
        lockDropDeployment.address,
        ethers.provider
    );
    let safeSovBalance = await getTokenBalance(
        sovDeployment.address,
        safeDeployment.address,
        ethers.provider
    );
    lockDropSovBalance = normalizeTokenNumber(lockDropSovBalance, sovDecimal);
    safeSovBalance = normalizeTokenNumber(safeSovBalance, sovDecimal);

    tokenBalancesDetail.lockDrop.push({
        tokenAddress: sovDeployment.address,
        tokenName: "SOV",
        tokenBalance: !lockDropSovBalance.isNaN()
            ? lockDropSovBalance.decimalPlaces(2).toString()
            : "0",
    });

    tokenBalancesDetail.safe.push({
        tokenAddress: sovDeployment.address,
        tokenName: "SOV",
        tokenBalance: !safeSovBalance.isNaN() ? safeSovBalance.decimalPlaces(2).toString() : "0",
    });

    /** Process the token list lockdrop details */
    console.log("\n");
    logger.info("=== Bob LockDrop Contract ===");
    for (const tokenBalanceDetailLockDrop of tokenBalancesDetail.lockDrop) {
        logger.info(
            `${tokenBalanceDetailLockDrop.tokenName}: ${tokenBalanceDetailLockDrop.tokenBalance}`
        );
    }

    if (totalSovRequiredLockDrop.isNaN()) totalSovRequiredLockDrop = "0";
    logger.info(`SOV (Required): ${totalSovRequiredLockDrop}`);

    const sovMinusSovRequiredLockDrop = new BigNumber(
        tokenBalancesDetail.lockDrop[tokenBalancesDetail.lockDrop.length - 1].tokenBalance
    ).minus(new BigNumber(totalSovRequiredLockDrop));
    logger.info(`SOV - SOV Required: ${sovMinusSovRequiredLockDrop}`);

    console.log("\n");
    logger.info("=== Bob Safe Contract ===");
    for (const tokenBalanceDetailSafe of tokenBalancesDetail.safe) {
        logger.info(`${tokenBalanceDetailSafe.tokenName}: ${tokenBalanceDetailSafe.tokenBalance}`);
    }

    if (totalSovRequiredSafe.isNaN()) totalSovRequiredSafe = "0";
    logger.info(`SOV (Required): ${totalSovRequiredSafe}`);

    const sovMinusSovRequiredSafe = new BigNumber(
        tokenBalancesDetail.safe[tokenBalancesDetail.safe.length - 1].tokenBalance
    ).minus(new BigNumber(totalSovRequiredSafe));
    if (sovMinusSovRequiredSafe != "0")
        logger.info(`SOV - SOV Required: ${sovMinusSovRequiredSafe}`);

    /** SECTION 2 (SLIPPAGE REPORT) */
    console.log("\n\n");
    logger.info("===== Report Section 2 =====");
    for (const emptyPrice of emptyBobSnapshotPrice) {
        logger.info(
            col.bgRed(`Empty price of ${emptyPrice.tokenName} - ${emptyPrice.tokenAddress}`)
        );
    }

    for (const exceedSlippage of exceedSlippageTolerance) {
        logger.info(
            col.bgYellow(
                `Exceed slippage (${MAX_SLIPPAGE_TOLERANCE_IN_PERCENTAGE}%): ${exceedSlippage.tokenName} - ${exceedSlippage.tokenAddress}`
            )
        );
        logger.info(
            col.bgYellow(
                `Uniswap price: ${exceedSlippage.uniswapPrice.toString()}, bob snapshot price: ${exceedSlippage.bobSnapshotPrice.toString()}`
            )
        );
        console.log("\n");
    }
}

function normalizeTokenNumber(tokenAmount, decimal) {
    const normalizedTokeNumber = new BigNumber(tokenAmount.toString())
        .dividedBy(new BigNumber(`1e${decimal}`))
        .decimalPlaces(2);
    return normalizedTokeNumber;
}

main();
