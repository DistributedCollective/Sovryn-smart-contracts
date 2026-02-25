/* eslint-disable no-console */
const { task } = require("hardhat/config");
const Logs = require("node-logs");
const fs = require("fs");
const { createObjectCsvWriter } = require("csv-writer");

const logger = new Logs().showInConsole(true);

/**
 * Get borrowing data for a specific loan or user
 * Equivalent to: get_borrow_data.py
 */
task("data:getBorrowData", "Get borrowing data for loans")
    .addOptionalParam("user", "RSK address of the user")
    .addOptionalParam("loanId", "Loan ID to query")
    .addOptionalParam("tx", "Opening transaction hash")
    .addOptionalParam(
        "blocks",
        "Number of blocks to scan back (default: 86400 ~= 1 month)",
        "86400"
    )
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ user, loanId, tx, blocks, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        // Load contracts
        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ISovrynDeployment = await get("ISovryn");

        const Protocol = await ethers.getContractAt(
            ISovrynDeployment.abi,
            contracts.sovrynProtocol
        );

        // Token mapping for display
        const tokens = {
            [contracts.WRBTC.toLowerCase()]: "WRBTC",
            [contracts.DoC.toLowerCase()]: "DoC",
            [contracts.USDT.toLowerCase()]: "USDT",
            [contracts.BPro.toLowerCase()]: "BPro",
            [contracts.SOV.toLowerCase()]: "SOV",
            [contracts.XUSD.toLowerCase()]: "XUSD",
            [contracts.ETHs.toLowerCase()]: "ETHs",
            [contracts.BNBs.toLowerCase()]: "BNBs",
            [contracts.MOC.toLowerCase()]: "MOC",
            [contracts.FISH.toLowerCase()]: "FISH",
            [contracts.RIF.toLowerCase()]: "RIF",
            [contracts.MYNT.toLowerCase()]: "MYNT",
            [contracts.DLLR.toLowerCase()]: "DLLR",
        };

        const latestBlock = await provider.getBlockNumber();
        const fromBlock = latestBlock - parseInt(blocks);
        const toBlock = latestBlock;

        let filter = {};
        let scanFromBlock = fromBlock;
        let scanToBlock = toBlock;

        // Determine filter based on input
        if (user) {
            filter = { user: ethers.utils.getAddress(user) };
            logger.info(`Scanning borrows for user: ${user}`);
        } else if (loanId) {
            filter = { loanId };
            logger.info(`Scanning for loan: ${loanId}`);
        } else if (tx) {
            const receipt = await provider.getTransactionReceipt(tx);
            if (!receipt) {
                logger.error(`Transaction not found: ${tx}`);
                return;
            }
            scanFromBlock = receipt.blockNumber;
            scanToBlock = receipt.blockNumber;

            // Find loanId from transaction logs
            const borrowTopic = ethers.utils.id(
                "Borrow(address,bytes32,address,address,uint256,uint256,uint256,uint256,uint256,uint256)"
            );
            const borrowLog = receipt.logs.find((log) => log.topics[0] === borrowTopic);

            if (borrowLog) {
                loanId = borrowLog.topics[3];
                filter = { loanId };
                logger.info(`Found loanId: ${loanId} from tx: ${tx}`);
            } else {
                logger.error(`No Borrow event found in transaction: ${tx}`);
                return;
            }
        }

        logger.info(`Scanning blocks ${scanFromBlock} to ${scanToBlock}`);

        // Get Borrow events
        const borrowFilter = Protocol.filters.Borrow(
            filter.user || null,
            null,
            filter.loanId || null
        );
        const borrows = await Protocol.queryFilter(borrowFilter, scanFromBlock, scanToBlock);

        if (borrows.length === 0) {
            logger.warn("No borrow events found");
            return;
        }

        const results = [];

        for (let i = 0; i < borrows.length; i++) {
            const borrow = borrows[i];
            const args = borrow.args;

            const borrowLoanId = args.loanId;
            const borrowBlock = borrow.blockNumber;
            const borrowTx = borrow.transactionHash;

            logger.info(`\n========== Borrow #${i + 1} ==========`);
            logger.info(`Opening tx: ${borrowTx}`);
            logger.info(`Block: ${borrowBlock}`);
            logger.info(`LoanId: ${borrowLoanId}`);

            // Get current loan data
            const loan = await Protocol.getLoan(borrowLoanId);

            const loanToken = tokens[loan.loanToken.toLowerCase()] || loan.loanToken;
            const collateralToken =
                tokens[loan.collateralToken.toLowerCase()] || loan.collateralToken;

            logger.info(`User: ${args.user}`);
            logger.info(`Lender: ${tokens[args.lender.toLowerCase()] || args.lender}`);
            logger.info(`Loan Token: ${loanToken}`);
            logger.info(`Collateral Token: ${collateralToken}`);
            logger.info(`Principal: ${ethers.utils.formatEther(loan.principal)} ${loanToken}`);
            logger.info(
                `Collateral: ${ethers.utils.formatEther(loan.collateral)} ${collateralToken}`
            );
            logger.info(
                `Interest Per Day: ${ethers.utils.formatEther(loan.interestOwedPerDay)} ${loanToken}`
            );
            logger.info(`Current Margin: ${ethers.utils.formatEther(loan.currentMargin)}%`);
            logger.info(`Start Margin: ${ethers.utils.formatEther(loan.startMargin)}%`);
            logger.info(
                `Maintenance Margin: ${ethers.utils.formatEther(loan.maintenanceMargin)}%`
            );

            if (loan.endTimestamp.gt(0)) {
                const endDate = new Date(loan.endTimestamp.toNumber() * 1000);
                logger.info(`End Date: ${endDate.toISOString()}`);
            }

            // Get liquidations
            logger.info("\n=== Liquidations ===");
            const liqFilter = Protocol.filters.Liquidate(null, borrowLoanId);
            const liquidations = await Protocol.queryFilter(liqFilter, borrowBlock, latestBlock);

            if (liquidations.length === 0) {
                logger.info("No liquidations");
            } else {
                for (const liq of liquidations) {
                    const liqBlock = await provider.getBlock(liq.blockNumber);
                    logger.info(`Tx: ${liq.transactionHash}`);
                    logger.info(`Date: ${new Date(liqBlock.timestamp * 1000).toISOString()}`);
                    logger.info(`Liquidator: ${liq.args.liquidator}`);
                    logger.info(
                        `Repay Amount: ${ethers.utils.formatEther(liq.args.repayAmount)} ${loanToken}`
                    );
                    logger.info(
                        `Collateral Withdrawn: ${ethers.utils.formatEther(liq.args.collateralWithdrawAmount)} ${collateralToken}`
                    );
                    logger.info("---");
                }
            }

            // Get deposit collateral events
            logger.info("\n=== Deposit Collateral ===");
            const depFilter = Protocol.filters.DepositCollateral(null, borrowLoanId);
            const deposits = await Protocol.queryFilter(depFilter, borrowBlock, latestBlock);

            if (deposits.length === 0) {
                logger.info("No deposits");
            } else {
                for (const dep of deposits) {
                    const depBlock = await provider.getBlock(dep.blockNumber);
                    logger.info(`Tx: ${dep.transactionHash}`);
                    logger.info(`Date: ${new Date(depBlock.timestamp * 1000).toISOString()}`);
                    logger.info(
                        `Deposit Amount: ${ethers.utils.formatEther(dep.args.depositAmount)} ${collateralToken}`
                    );
                    logger.info("---");
                }
            }

            // Get rollovers
            logger.info("\n=== Rollovers ===");
            const rolloverFilter = Protocol.filters.Rollover(null, borrowLoanId);
            const rollovers = await Protocol.queryFilter(rolloverFilter, borrowBlock, latestBlock);

            if (rollovers.length === 0) {
                logger.info("No rollovers");
            } else {
                for (const roll of rollovers) {
                    const rollBlock = await provider.getBlock(roll.blockNumber);
                    logger.info(`Tx: ${roll.transactionHash}`);
                    logger.info(`Date: ${new Date(rollBlock.timestamp * 1000).toISOString()}`);
                    logger.info(
                        `Reward: ${ethers.utils.formatEther(roll.args.reward)} ${collateralToken}`
                    );
                    logger.info("---");
                }
            }

            results.push({
                loanId: borrowLoanId,
                tx: borrowTx,
                block: borrowBlock,
                user: args.user,
                loanToken,
                collateralToken,
                principal: ethers.utils.formatEther(loan.principal),
                collateral: ethers.utils.formatEther(loan.collateral),
                currentMargin: ethers.utils.formatEther(loan.currentMargin),
                liquidations: liquidations.length,
                deposits: deposits.length,
                rollovers: rollovers.length,
            });
        }

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "loanId", title: "Loan ID" },
                    { id: "tx", title: "Transaction" },
                    { id: "block", title: "Block" },
                    { id: "user", title: "User" },
                    { id: "loanToken", title: "Loan Token" },
                    { id: "collateralToken", title: "Collateral Token" },
                    { id: "principal", title: "Principal" },
                    { id: "collateral", title: "Collateral" },
                    { id: "currentMargin", title: "Current Margin %" },
                    { id: "liquidations", title: "Liquidations Count" },
                    { id: "deposits", title: "Deposits Count" },
                    { id: "rollovers", title: "Rollovers Count" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }

        logger.success(`\nProcessed ${results.length} borrows`);
    });

/**
 * Get LP token balances for liquidity mining
 * Equivalent to: lp_tokens.py
 */
task("data:getLPTokenBalances", "Get LP token balances and liquidity mining info")
    .addOptionalParam("pool", "Pool address (defaults to WRBTC/SOV)")
    .addOptionalParam("block", "Reference block number (defaults to latest)")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ pool, block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        // Load contracts
        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const LiquidityMiningDeployment = await get("LiquidityMining");
        const LiquidityPoolV1ConverterABI =
            require("../../artifacts/contracts/feeds/IV1PoolOracle.sol/ILiquidityPoolV1Converter.json").abi;
        const ERC20Deployment = await get("SOV"); // Using SOV as generic ERC20 ABI

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        const blockData = await provider.getBlock(refBlock);

        logger.info(
            `Reference block: ${refBlock} (${new Date(blockData.timestamp * 1000).toISOString()})`
        );

        // Addresses
        const poolAddress = pool || contracts["(WR)BTC/SOV"];
        const SOVConverterAddress = "0xe76Ea314b32fCf641C6c57f14110c5Baa1e45ff4"; // Latest SOV converter

        const LiquidityMining = await ethers.getContractAt(
            LiquidityMiningDeployment.abi,
            contracts.LiquidityMiningProxy
        );
        const PoolConverter = await ethers.getContractAt(
            LiquidityPoolV1ConverterABI,
            SOVConverterAddress
        );
        const PoolToken = await ethers.getContractAt(ERC20Deployment.abi, poolAddress);

        const WRBTC = contracts.WRBTC;
        const SOV = contracts.SOV;
        const poolId = 0; // WRBTC/SOV pool

        logger.info(`Pool: ${poolAddress}`);
        logger.info(`Pool ID: ${poolId}`);

        // Get pool reserves and total supply
        const totalSupply = await PoolToken.totalSupply({ blockTag: refBlock });
        const sovReserve = (await PoolConverter.reserves(SOV, { blockTag: refBlock }))[0];
        const wrbtcReserve = (await PoolConverter.reserves(WRBTC, { blockTag: refBlock }))[0];

        logger.info(`Total LP Token Supply: ${ethers.utils.formatEther(totalSupply)}`);
        logger.info(`SOV Reserve: ${ethers.utils.formatEther(sovReserve)}`);
        logger.info(`WRBTC Reserve: ${ethers.utils.formatEther(wrbtcReserve)}`);

        // Get all Transfer events to find token holders
        logger.info("\nScanning for LP token holders...");
        const transferFilter = PoolToken.filters.Transfer();
        const transfers = await PoolToken.queryFilter(transferFilter, 0, refBlock);

        // Build set of unique addresses
        const addresses = new Set();
        transfers.forEach((transfer) => {
            if (transfer.args.from !== ethers.constants.AddressZero) {
                addresses.add(transfer.args.from);
            }
            if (transfer.args.to !== ethers.constants.AddressZero) {
                addresses.add(transfer.args.to);
            }
        });

        logger.info(`Found ${addresses.size} unique addresses`);

        const results = [];
        let totalSOV = ethers.BigNumber.from(0);
        let totalWRBTC = ethers.BigNumber.from(0);

        for (const address of addresses) {
            // Skip liquidity mining contract itself
            if (address.toLowerCase() === contracts.LiquidityMiningProxy.toLowerCase()) {
                continue;
            }

            // Get tokens staked in liquidity mining
            const userInfo = await LiquidityMining.getUserInfo(poolId, address, {
                blockTag: refBlock,
            });
            let poolTokens = userInfo.amount;

            // Get tokens in wallet
            const walletBalance = await PoolToken.balanceOf(address, { blockTag: refBlock });
            poolTokens = poolTokens.add(walletBalance);

            if (poolTokens.isZero()) {
                continue;
            }

            // Calculate share
            const share = poolTokens.mul(ethers.utils.parseEther("1")).div(totalSupply);
            const accountSOV = sovReserve.mul(poolTokens).div(totalSupply);
            const accountWRBTC = wrbtcReserve.mul(poolTokens).div(totalSupply);

            totalSOV = totalSOV.add(accountSOV);
            totalWRBTC = totalWRBTC.add(accountWRBTC);

            results.push({
                address,
                poolTokens: ethers.utils.formatEther(poolTokens),
                share: ethers.utils.formatEther(share),
                sov: ethers.utils.formatEther(accountSOV),
                wrbtc: ethers.utils.formatEther(accountWRBTC),
                rewardDebt: ethers.utils.formatEther(userInfo.rewardDebt),
                accumulatedReward: ethers.utils.formatEther(userInfo.accumulatedReward),
            });

            logger.info(
                `${address}: ${ethers.utils.formatEther(poolTokens)} LP, ` +
                    `${ethers.utils.formatEther(accountSOV)} SOV, ` +
                    `${ethers.utils.formatEther(accountWRBTC)} WRBTC`
            );
        }

        logger.info("\n=========================================");
        logger.info(`Total accounts: ${results.length}`);
        logger.info(`Total SOV: ${ethers.utils.formatEther(totalSOV)}`);
        logger.info(`Total WRBTC: ${ethers.utils.formatEther(totalWRBTC)}`);
        logger.info("=========================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "address", title: "Address" },
                    { id: "poolTokens", title: "LP Tokens" },
                    { id: "share", title: "Share" },
                    { id: "sov", title: "SOV" },
                    { id: "wrbtc", title: "WRBTC" },
                    { id: "rewardDebt", title: "Reward Debt" },
                    { id: "accumulatedReward", title: "Accumulated Reward" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get staker statistics
 * Equivalent to: stakers_sip24_stats.py
 */
task("data:getStakerStats", "Get staker statistics for a given block range")
    .addOptionalParam("fromBlock", "Start block (defaults to staking genesis)")
    .addOptionalParam("toBlock", "End block (defaults to latest)")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ fromBlock, toBlock, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        // Load contracts
        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const StakingDeployment = await get("Staking");

        const stakingGenesisBlock = 3100263; // Staking deployment block
        const startBlock = fromBlock ? parseInt(fromBlock) : stakingGenesisBlock;
        const endBlock = toBlock ? parseInt(toBlock) : await provider.getBlockNumber();

        logger.info(`Scanning staking events from block ${startBlock} to ${endBlock}`);

        const Staking = await ethers.getContractAt(StakingDeployment.abi, contracts.Staking);

        // Get TokensStaked events
        const stakeFilter = Staking.filters.TokensStaked();
        const stakes = await Staking.queryFilter(stakeFilter, startBlock, endBlock);

        logger.info(`Found ${stakes.length} TokensStaked events`);

        const stakers = {};
        let contractEvents = 0;
        let eoaEvents = 0;

        for (const stake of stakes) {
            const staker = stake.args.staker;
            const amount = stake.args.amount;

            // Check if vesting contract
            const isVesting = await Staking.isVestingContract(staker);
            if (isVesting) {
                contractEvents++;
                continue;
            }

            // Check if contract
            const code = await provider.getCode(staker);
            const isContract = code !== "0x";

            if (isContract) {
                contractEvents++;
                continue;
            }

            // Track EOA stakers
            if (!stakers[staker]) {
                stakers[staker] = ethers.BigNumber.from(0);
            }
            stakers[staker] = stakers[staker].add(amount);
            eoaEvents++;
        }

        logger.info(`\nContract events (excluded): ${contractEvents}`);
        logger.info(`EOA events: ${eoaEvents}`);
        logger.info(`Unique stakers: ${Object.keys(stakers).length}`);

        // Get current balances
        logger.info("\nFetching current balances...");
        const results = [];
        let totalStaked = ethers.BigNumber.from(0);
        let activeStakers = 0;

        for (const [staker, stakedAmount] of Object.entries(stakers)) {
            const balance = await Staking.balanceOf(staker, { blockTag: endBlock });

            if (balance.gt(0)) {
                activeStakers++;
                totalStaked = totalStaked.add(balance);

                results.push({
                    address: staker,
                    totalStaked: ethers.utils.formatEther(stakedAmount),
                    currentBalance: ethers.utils.formatEther(balance),
                });

                logger.info(
                    `${staker}: Staked ${ethers.utils.formatEther(
                        stakedAmount
                    )} SOV, Balance ${ethers.utils.formatEther(balance)} SOV`
                );
            }
        }

        logger.info("\n=========================================");
        logger.info(`Active stakers: ${activeStakers}`);
        logger.info(`Total staked (current): ${ethers.utils.formatEther(totalStaked)} SOV`);
        logger.info("=========================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "address", title: "Address" },
                    { id: "totalStaked", title: "Total Staked" },
                    { id: "currentBalance", title: "Current Balance" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get margin trading data
 * Equivalent to: get_margin_data_new.py
 */
task("data:getMarginData", "Get margin trading position data")
    .addOptionalParam("user", "RSK address of the user")
    .addOptionalParam("loanId", "Loan ID to query")
    .addOptionalParam("blocks", "Number of blocks to scan back (default: 86400)", "86400")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ user, loanId, blocks, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        // Load contracts
        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ISovrynDeployment = await get("ISovryn");

        const Protocol = await ethers.getContractAt(
            ISovrynDeployment.abi,
            contracts.sovrynProtocol
        );

        const latestBlock = await provider.getBlockNumber();
        const fromBlock = latestBlock - parseInt(blocks);

        let filter = {};
        if (user) {
            filter = { user: ethers.utils.getAddress(user) };
            logger.info(`Scanning margin trades for user: ${user}`);
        } else if (loanId) {
            filter = { loanId };
            logger.info(`Scanning for loan: ${loanId}`);
        }

        logger.info(`Scanning blocks ${fromBlock} to ${latestBlock}`);

        // Get Trade events (margin trades)
        const tradeFilter = Protocol.filters.Trade(
            filter.user || null,
            null,
            filter.loanId || null
        );
        const trades = await Protocol.queryFilter(tradeFilter, fromBlock, latestBlock);

        if (trades.length === 0) {
            logger.warn("No margin trade events found");
            return;
        }

        logger.info(`Found ${trades.length} margin trades`);

        const results = [];

        for (const trade of trades) {
            const args = trade.args;
            const tradeLoanId = args.loanId;

            logger.info(`\n========== Trade ==========`);
            logger.info(`Tx: ${trade.transactionHash}`);
            logger.info(`Block: ${trade.blockNumber}`);
            logger.info(`User: ${args.user}`);
            logger.info(`Loan ID: ${tradeLoanId}`);

            // Get loan details
            const loan = await Protocol.getLoan(tradeLoanId);

            logger.info(`Principal: ${ethers.utils.formatEther(loan.principal)}`);
            logger.info(`Collateral: ${ethers.utils.formatEther(loan.collateral)}`);
            logger.info(`Current Margin: ${ethers.utils.formatEther(loan.currentMargin)}%`);

            results.push({
                tx: trade.transactionHash,
                block: trade.blockNumber,
                user: args.user,
                loanId: tradeLoanId,
                principal: ethers.utils.formatEther(loan.principal),
                collateral: ethers.utils.formatEther(loan.collateral),
                currentMargin: ethers.utils.formatEther(loan.currentMargin),
            });
        }

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "tx", title: "Transaction" },
                    { id: "block", title: "Block" },
                    { id: "user", title: "User" },
                    { id: "loanId", title: "Loan ID" },
                    { id: "principal", title: "Principal" },
                    { id: "collateral", title: "Collateral" },
                    { id: "currentMargin", title: "Current Margin %" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }

        logger.success(`\nProcessed ${results.length} margin trades`);
    });

/**
 * Get pending fees across protocol
 * Equivalent to: get_pending_fees.py
 */
task("data:getPendingFees", "Get pending fees from protocol, AMM, and fee sharing collector")
    .addOptionalParam("block", "Reference block number (defaults to latest)")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        // Load contracts
        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ISovrynDeployment = await get("ISovryn");
        const LiquidityPoolV1ConverterABI = require("../../scripts/contractInteraction/ABIs/LiquidityPoolV1Converter.json");
        const LiquidityPoolV2ConverterABI = require("../../scripts/contractInteraction/ABIs/LiquidityPoolV2Converter.json");
        const FeeSharingDeployment = await get("FeeSharingCollector");
        const ERC20Deployment = await get("SOV"); // Using SOV as generic ERC20 ABI

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        const blockData = await provider.getBlock(refBlock);

        logger.info(
            `Reference block: ${refBlock} (${new Date(blockData.timestamp * 1000).toISOString()})`
        );

        const Protocol = await ethers.getContractAt(
            ISovrynDeployment.abi,
            contracts.sovrynProtocol
        );
        const WRBTC = await ethers.getContractAt(ERC20Deployment.abi, contracts.WRBTC);
        const SOV = await ethers.getContractAt(ERC20Deployment.abi, contracts.SOV);
        const FeeCollector = await ethers.getContractAt(
            FeeSharingDeployment.abi,
            "0x115cAF168c51eD15ec535727F64684D33B7b08D1" // FeeSharingCollector address
        );

        // Token mapping (keys must match mainnet_contracts.json: DoC, ETHs, BNBs, etc.)
        const tokens = {
            [contracts.WRBTC.toLowerCase()]: "WRBTC",
            [contracts.DoC.toLowerCase()]: "DoC",
            [contracts.USDT.toLowerCase()]: "USDT",
            [contracts.BPro.toLowerCase()]: "BPro",
            [contracts.SOV.toLowerCase()]: "SOV",
            [contracts.XUSD.toLowerCase()]: "XUSD",
            [contracts.ETHs.toLowerCase()]: "ETHs",
            [contracts.BNBs.toLowerCase()]: "BNBs",
            [contracts.MOC.toLowerCase()]: "MOC",
            [contracts.FISH.toLowerCase()]: "FISH",
            [contracts.RIF.toLowerCase()]: "RIF",
            [contracts.MYNT.toLowerCase()]: "MYNT",
            [contracts.DLLR.toLowerCase()]: "DLLR",
        };

        // V1 Converter addresses only (from mainnet_contracts.json). Used for AMM fees and protocol fee conversion.
        const v1Converters = [
            contracts.ConverterBNBs,
            contracts.ConverterMOC,
            contracts.ConverterSOV,
            contracts.ConverterETHs,
            contracts.ConverterFISH,
            contracts.ConverterRIF,
            contracts.ConverterMYNT,
            contracts.ConverterDLLR,
        ];
        // V2 Converter addresses. Used only for protocol fee token->WRBTC conversion (see get_pending_fees.py).
        const v2Converters = [
            contracts.ConverterDOC,
            contracts.ConverterUSDT,
            contracts.ConverterBPRO,
            contracts.ConverterXUSD,
        ];

        let totalWRBTC = ethers.BigNumber.from(0);
        let totalSOV = ethers.BigNumber.from(0);

        // 1. AMM Fees from V1 Converters
        logger.info("\n========== AMM Fees ==========");
        for (const converterAddr of v1Converters) {
            try {
                const Converter = await ethers.getContractAt(
                    LiquidityPoolV1ConverterABI,
                    converterAddr
                );

                const reserve0 = await Converter.reserveTokens(0);
                const reserve1 = await Converter.reserveTokens(1);

                const name0 = tokens[reserve0.toLowerCase()] || reserve0;
                const name1 = tokens[reserve1.toLowerCase()] || reserve1;

                const fees0 = await Converter.getProtocolFeeTokensHeld(reserve0, {
                    blockTag: refBlock,
                });
                const fees1 = await Converter.getProtocolFeeTokensHeld(reserve1, {
                    blockTag: refBlock,
                });

                logger.info(`\nConverter: ${converterAddr}`);
                logger.info(`${name0}: ${ethers.utils.formatEther(fees0)}`);

                let ammTotal = fees0;

                // Convert non-WRBTC/SOV reserves to WRBTC
                if (
                    reserve1.toLowerCase() !== WRBTC.address.toLowerCase() &&
                    reserve1.toLowerCase() !== SOV.address.toLowerCase()
                ) {
                    const [wrbtcReturn] = await Converter.getReturn(
                        reserve1,
                        WRBTC.address,
                        fees1,
                        {
                            blockTag: refBlock,
                        }
                    );
                    ammTotal = ammTotal.add(wrbtcReturn);
                    logger.info(
                        `${name1}: ${ethers.utils.formatEther(fees1)} = ${ethers.utils.formatEther(
                            wrbtcReturn
                        )} WRBTC`
                    );
                } else {
                    if (reserve1.toLowerCase() === SOV.address.toLowerCase()) {
                        totalSOV = totalSOV.add(fees1);
                        logger.info(`${name1}: ${ethers.utils.formatEther(fees1)} SOV`);
                    } else {
                        logger.info(`${name1}: ${ethers.utils.formatEther(fees1)}`);
                        ammTotal = ammTotal.add(fees1);
                    }
                }

                logger.info(`AMM Total: ${ethers.utils.formatEther(ammTotal)} WRBTC`);
                totalWRBTC = totalWRBTC.add(ammTotal);
            } catch (error) {
                logger.warn(`Error processing converter ${converterAddr}: ${error.message}`);
            }
        }

        logger.info("\n--------------------------------------");
        logger.info(`AMM WRBTC fees: ${ethers.utils.formatEther(totalWRBTC)}`);
        logger.info(`AMM SOV fees: ${ethers.utils.formatEther(totalSOV)}`);
        logger.info("--------------------------------------");

        // 2. Protocol Fees (trading, borrowing, lending)
        logger.info("\n========== Protocol Fees ==========");
        let protocolWRBTC = ethers.BigNumber.from(0);
        let protocolSOV = ethers.BigNumber.from(0);

        for (const [tokenAddr, tokenName] of Object.entries(tokens)) {
            try {
                const checksumAddr = ethers.utils.getAddress(tokenAddr);

                const trading = await Protocol.tradingFeeTokensHeld(checksumAddr, {
                    blockTag: refBlock,
                });
                const borrowing = await Protocol.borrowingFeeTokensHeld(checksumAddr, {
                    blockTag: refBlock,
                });
                const lending = await Protocol.lendingFeeTokensHeld(checksumAddr, {
                    blockTag: refBlock,
                });

                const totalFees = trading.add(borrowing).add(lending);

                if (totalFees.isZero()) {
                    continue;
                }

                // SOV stays as SOV
                if (checksumAddr.toLowerCase() === SOV.address.toLowerCase()) {
                    protocolSOV = protocolSOV.add(totalFees);
                    logger.info(`${tokenName}: ${ethers.utils.formatEther(totalFees)}`);
                    continue;
                }

                // WRBTC stays as WRBTC
                if (checksumAddr.toLowerCase() === WRBTC.address.toLowerCase()) {
                    protocolWRBTC = protocolWRBTC.add(totalFees);
                    logger.info(`${tokenName}: ${ethers.utils.formatEther(totalFees)}`);
                    continue;
                }

                // Convert other tokens to WRBTC: try V1 converters first, then V2 (matches get_pending_fees.py all_converters).
                let converted = false;
                for (const converterAddr of v1Converters) {
                    try {
                        const Converter = await ethers.getContractAt(
                            LiquidityPoolV1ConverterABI,
                            converterAddr
                        );
                        const reserve1 = await Converter.reserveTokens(1);
                        if (checksumAddr.toLowerCase() === reserve1.toLowerCase()) {
                            const [wrbtcReturn] = await Converter.getReturn(
                                checksumAddr,
                                WRBTC.address,
                                totalFees,
                                { blockTag: refBlock }
                            );
                            protocolWRBTC = protocolWRBTC.add(wrbtcReturn);
                            logger.info(
                                `${tokenName}: ${ethers.utils.formatEther(
                                    totalFees
                                )} = ${ethers.utils.formatEther(wrbtcReturn)} WRBTC`
                            );
                            converted = true;
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
                if (!converted) {
                    for (const converterAddr of v2Converters) {
                        try {
                            const Converter = await ethers.getContractAt(
                                LiquidityPoolV2ConverterABI,
                                converterAddr
                            );
                            const reserve1 = await Converter.reserveTokens(1);
                            if (checksumAddr.toLowerCase() === reserve1.toLowerCase()) {
                                const [wrbtcReturn] = await Converter.getReturn(
                                    checksumAddr,
                                    WRBTC.address,
                                    totalFees,
                                    { blockTag: refBlock }
                                );
                                protocolWRBTC = protocolWRBTC.add(wrbtcReturn);
                                logger.info(
                                    `${tokenName}: ${ethers.utils.formatEther(
                                        totalFees
                                    )} = ${ethers.utils.formatEther(wrbtcReturn)} WRBTC (V2)`
                                );
                                converted = true;
                                break;
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                }
                if (!converted) {
                    logger.warn(
                        `No converter (V1 or V2) found for ${tokenName}; protocol fees not converted to WRBTC`
                    );
                }
            } catch (error) {
                logger.warn(`Error processing token ${tokenName}: ${error.message}`);
            }
        }

        logger.info("\n--------------------------------------");
        logger.info(`Protocol WRBTC fees: ${ethers.utils.formatEther(protocolWRBTC)}`);
        logger.info(`Protocol SOV fees: ${ethers.utils.formatEther(protocolSOV)}`);
        logger.info("--------------------------------------");

        // 3. Unprocessed amounts in FeeCollector
        logger.info("\n========== Unprocessed Amounts ==========");
        const RBTC_DUMMY = "0xEaBD29bE3C3187500DF86a2613C6470E12F2D77d";
        const ZUSD = "0xdB107FA69E33f05180a4C2cE9c2E7CB481645C2d";

        const unprocessedRBTC = await FeeCollector.unprocessedAmount(RBTC_DUMMY, {
            blockTag: refBlock,
        });
        const unprocessedSOV = await FeeCollector.unprocessedAmount(SOV.address, {
            blockTag: refBlock,
        });
        const unprocessedZUSD = await FeeCollector.unprocessedAmount(ZUSD, {
            blockTag: refBlock,
        });

        logger.info(`RBTC unprocessed: ${ethers.utils.formatEther(unprocessedRBTC)}`);
        logger.info(`SOV unprocessed: ${ethers.utils.formatEther(unprocessedSOV)}`);
        logger.info(`ZUSD unprocessed: ${ethers.utils.formatEther(unprocessedZUSD)}`);

        // Calculate totals
        const grandTotalWRBTC = totalWRBTC.add(protocolWRBTC).add(unprocessedRBTC);
        const grandTotalSOV = totalSOV.add(protocolSOV).add(unprocessedSOV);

        logger.info("\n======================================");
        logger.info("======= FeeSharing Pending ===========");
        logger.info("======================================");
        logger.info(`Total WRBTC fees: ${ethers.utils.formatEther(grandTotalWRBTC)}`);
        logger.info(`Total SOV fees: ${ethers.utils.formatEther(grandTotalSOV)}`);
        logger.info(`Total ZUSD fees: ${ethers.utils.formatEther(unprocessedZUSD)}`);
        logger.info(`Reference block: ${refBlock}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output) {
            const results = [
                {
                    type: "AMM",
                    wrbtc: ethers.utils.formatEther(totalWRBTC),
                    sov: ethers.utils.formatEther(totalSOV),
                    zusd: "0",
                },
                {
                    type: "Protocol",
                    wrbtc: ethers.utils.formatEther(protocolWRBTC),
                    sov: ethers.utils.formatEther(protocolSOV),
                    zusd: "0",
                },
                {
                    type: "Unprocessed",
                    wrbtc: ethers.utils.formatEther(unprocessedRBTC),
                    sov: ethers.utils.formatEther(unprocessedSOV),
                    zusd: ethers.utils.formatEther(unprocessedZUSD),
                },
                {
                    type: "TOTAL",
                    wrbtc: ethers.utils.formatEther(grandTotalWRBTC),
                    sov: ethers.utils.formatEther(grandTotalSOV),
                    zusd: ethers.utils.formatEther(unprocessedZUSD),
                },
            ];

            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "type", title: "Type" },
                    { id: "wrbtc", title: "WRBTC" },
                    { id: "sov", title: "SOV" },
                    { id: "zusd", title: "ZUSD" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get staking rewards (osSOV) data
 * Equivalent to: stakingRewardsOS.py
 */
task("data:getStakingRewards", "Get staking rewards (osSOV) for voluntary stakers")
    .addOptionalParam("block", "Reference block number (defaults to latest)")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        // Load contracts
        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ERC20Deployment = await get("SOV"); // Using SOV as generic ERC20 ABI
        const StakingRewardsOSDeployment = await get("StakingRewardsOS");
        const StakingDeployment = await get("Staking");

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        const blockData = await provider.getBlock(refBlock);

        logger.info(
            `Reference block: ${refBlock} (${new Date(blockData.timestamp * 1000).toISOString()})`
        );

        const OSSOV = await ethers.getContractAt(ERC20Deployment.abi, contracts.osSOV);
        const StakingRewards = await ethers.getContractAt(
            StakingRewardsOSDeployment.abi,
            contracts.StakingRewardsOs
        );
        const Staking = await ethers.getContractAt(StakingDeployment.abi, contracts.Staking);

        logger.info("\nFetching voluntary stakers...");

        // Get all TokensStaked events from genesis to get unique stakers
        const stakingGenesisBlock = 3100263;
        const stakeFilter = Staking.filters.TokensStaked();
        const stakes = await Staking.queryFilter(stakeFilter, stakingGenesisBlock, refBlock);

        logger.info(`Found ${stakes.length} staking events`);

        const stakers = new Set();
        for (const stake of stakes) {
            const staker = stake.args.staker;
            const isVesting = await Staking.isVestingContract(staker);
            if (!isVesting) {
                const code = await provider.getCode(staker);
                const isContract = code !== "0x";
                if (!isContract) {
                    stakers.add(staker);
                }
            }
        }

        logger.info(`Found ${stakers.size} voluntary stakers`);
        logger.info("\nCalculating rewards...\n");

        const results = [];
        let totalClaimed = ethers.BigNumber.from(0);
        let totalUnclaimed = ethers.BigNumber.from(0);
        let eligibleStakers = 0;

        for (const staker of stakers) {
            try {
                // Claimed (minted) osSOV
                const claimed = await OSSOV.balanceOf(staker, { blockTag: refBlock });

                // Unclaimed osSOV (accrued but not minted)
                const rewardData = await StakingRewards.callStatic.getStakerCurrentReward(
                    false,
                    0,
                    {
                        from: staker,
                        blockTag: refBlock,
                    }
                );
                const lastWithdrawal = rewardData[0];
                const unclaimed = rewardData[1];

                const total = claimed.add(unclaimed);

                if (total.gt(0)) {
                    eligibleStakers++;
                    totalClaimed = totalClaimed.add(claimed);
                    totalUnclaimed = totalUnclaimed.add(unclaimed);

                    results.push({
                        address: staker,
                        lastWithdrawalInterval: lastWithdrawal.toString(),
                        claimed: ethers.utils.formatEther(claimed),
                        unclaimed: ethers.utils.formatEther(unclaimed),
                        total: ethers.utils.formatEther(total),
                    });

                    logger.info(
                        `${staker}: Claimed ${ethers.utils.formatEther(
                            claimed
                        )}, Unclaimed ${ethers.utils.formatEther(unclaimed)}, Total ${ethers.utils.formatEther(
                            total
                        )}`
                    );
                }
            } catch (error) {
                logger.warn(`Error processing staker ${staker}: ${error.message}`);
            }
        }

        const grandTotal = totalClaimed.add(totalUnclaimed);

        logger.info("\n======================================");
        logger.info("====== Staking Rewards Summary =======");
        logger.info("======================================");
        logger.info(`Total OSSOV minted/withdrawn: ${ethers.utils.formatEther(totalClaimed)}`);
        logger.info(`Total pending to be withdrawn: ${ethers.utils.formatEther(totalUnclaimed)}`);
        logger.info("--------------------------------------");
        logger.info(`Total claimed+unclaimed: ${ethers.utils.formatEther(grandTotal)}`);
        logger.info(`Eligible voluntary stakers: ${eligibleStakers}`);
        logger.info(`Total voluntary stakers: ${stakers.size}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "address", title: "Address" },
                    { id: "lastWithdrawalInterval", title: "Last Withdrawal Interval" },
                    { id: "claimed", title: "Claimed (osSOV)" },
                    { id: "unclaimed", title: "Unclaimed (osSOV)" },
                    { id: "total", title: "Total (osSOV)" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get DLLR token holders
 * Equivalent to: DLLR_holders.py
 */
task("data:getDLLRHolders", "Get DLLR token holder balances")
    .addOptionalParam("block", "Reference block number (defaults to latest)")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ERC20Deployment = await get("SOV"); // Using SOV as generic ERC20 ABI

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        const blockData = await provider.getBlock(refBlock);

        logger.info(
            `Reference block: ${refBlock} (${new Date(blockData.timestamp * 1000).toISOString()})`
        );

        const DLLR = await ethers.getContractAt(ERC20Deployment.abi, contracts.DLLR);

        // Get all Transfer events to find holders
        logger.info("Scanning Transfer events...");
        const fromBlock = 5072468; // DLLR creation block
        const transferFilter = DLLR.filters.Transfer();
        const transfers = await DLLR.queryFilter(transferFilter, fromBlock, refBlock);

        // Build set of receiving addresses
        const receivers = new Set();
        transfers.forEach((transfer) => {
            if (transfer.args.to !== ethers.constants.AddressZero) {
                receivers.add(transfer.args.to);
            }
        });

        logger.info(`Found ${receivers.size} receiving addresses`);
        logger.info("\nFetching balances...\n");

        const results = [];
        let totalBalance = ethers.BigNumber.from(0);
        let holdersEOA = 0;
        let holdersSC = 0;

        for (const address of receivers) {
            const balance = await DLLR.balanceOf(address, { blockTag: refBlock });

            if (balance.gt(0)) {
                const code = await provider.getCode(address);
                const isContract = code !== "0x";

                if (isContract) {
                    holdersSC++;
                } else {
                    holdersEOA++;
                }

                // Exclude converter from total
                if (address.toLowerCase() !== contracts.ConverterDLLR.toLowerCase()) {
                    totalBalance = totalBalance.add(balance);
                }

                results.push({
                    address,
                    balance: ethers.utils.formatEther(balance),
                    isContract: isContract ? "Yes" : "No",
                });

                logger.info(
                    `${address}: ${ethers.utils.formatEther(balance)} DLLR (${isContract ? "SC" : "EOA"})`
                );
            }
        }

        logger.info("\n======================================");
        logger.info("========== DLLR Holders =============");
        logger.info("======================================");
        logger.info(`Receivers: ${receivers.size}`);
        logger.info(`EOA holders: ${holdersEOA}`);
        logger.info(`SC holders: ${holdersSC}`);
        logger.info(`Total balance: ${ethers.utils.formatEther(totalBalance)} DLLR`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "address", title: "Address" },
                    { id: "balance", title: "Balance (DLLR)" },
                    { id: "isContract", title: "Is Contract" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get bridge events
 * Equivalent to: bridge_events.py
 */
task("data:getBridgeEvents", "Get bridge Cross events")
    .addOptionalParam("fromBlock", "Start block")
    .addOptionalParam("toBlock", "End block")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ fromBlock, toBlock, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const BridgeABI = require("../../external/artifacts/Bridge.sol/Bridge.json").abi;

        const latestBlock = await provider.getBlockNumber();
        const startBlock = fromBlock ? parseInt(fromBlock) : 3257444; // Bridge deployment
        const endBlock = toBlock ? parseInt(toBlock) : latestBlock;

        logger.info(`Scanning bridge events from block ${startBlock} to ${endBlock}`);

        const Bridge = await ethers.getContractAt(BridgeABI, contracts.BridgeRSK);

        // Get Cross events
        const crossFilter = Bridge.filters.Cross();
        const crosses = await Bridge.queryFilter(crossFilter, startBlock, endBlock);

        logger.info(`Found ${crosses.length} bridge Cross events\n`);

        const results = [];
        const bridgedTotals = {};

        for (const cross of crosses) {
            const args = cross.args;
            const block = await provider.getBlock(cross.blockNumber);
            const tx = await provider.getTransaction(cross.transactionHash);

            const symbol = args._symbol;
            const amount = args._amount;

            if (!bridgedTotals[symbol]) {
                bridgedTotals[symbol] = ethers.BigNumber.from(0);
            }
            bridgedTotals[symbol] = bridgedTotals[symbol].add(amount);

            results.push({
                tx: cross.transactionHash,
                block: cross.blockNumber,
                date: new Date(block.timestamp * 1000).toISOString(),
                from: tx.from,
                to: args._to,
                amount: ethers.utils.formatEther(amount),
                symbol,
                tokenAddress: args._tokenAddress,
            });

            logger.info(
                `${cross.transactionHash} from: ${tx.from} to: ${args._to} ` +
                    `amount: ${ethers.utils.formatEther(amount)} ${symbol}`
            );
        }

        logger.info("\n======================================");
        logger.info("========= Total Bridged ==============");
        logger.info("======================================");
        for (const [symbol, total] of Object.entries(bridgedTotals)) {
            logger.info(`${symbol}: ${ethers.utils.formatEther(total)}`);
        }
        logger.info(`\nBridging transactions: ${crosses.length}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "tx", title: "Transaction" },
                    { id: "block", title: "Block" },
                    { id: "date", title: "Date" },
                    { id: "from", title: "From" },
                    { id: "to", title: "To" },
                    { id: "amount", title: "Amount" },
                    { id: "symbol", title: "Symbol" },
                    { id: "tokenAddress", title: "Token Address" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get staking checkpoints
 * Equivalent to: checkpoints.py
 */
task("data:getCheckpoints", "Get staking checkpoints and voting power")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const StakingDeployment = await get("Staking");

        const Staking = await ethers.getContractAt(StakingDeployment.abi, contracts.Staking);

        const TWO_WEEKS = 2 * 7 * 24 * 60 * 60;
        const MAX_STAKING_PERIODS = 78;

        const kickOffTS = await Staking.kickoffTS();
        let lockedTS = await Staking.timestampToLockDate(kickOffTS);

        const currentTS = Math.floor(Date.now() / 1000);
        const prevLockedTS = await Staking.timestampToLockDate(currentTS);
        const maxLockedTS = prevLockedTS.add(MAX_STAKING_PERIODS * TWO_WEEKS);

        logger.info("======================================");
        logger.info("======= Staking Checkpoints ==========");
        logger.info("======================================");
        logger.info(`Start locked TS: ${lockedTS} (${new Date(lockedTS * 1000).toISOString()})`);
        logger.info(
            `Max locked TS: ${maxLockedTS} (${new Date(maxLockedTS * 1000).toISOString()})`
        );
        logger.info("\nFetching checkpoints...\n");

        const results = [];
        let totalAmount = ethers.BigNumber.from(0);

        while (lockedTS.lt(maxLockedTS)) {
            lockedTS = lockedTS.add(TWO_WEEKS);

            const stakedAmount = await Staking.getCurrentStakedUntil(lockedTS);
            totalAmount = totalAmount.add(stakedAmount);

            const date = new Date(lockedTS * 1000).toISOString();

            results.push({
                timestamp: lockedTS.toString(),
                date,
                unlockedSOV: ethers.utils.formatEther(stakedAmount),
            });

            logger.info(
                `Locked until: ${lockedTS} (${date}) - ` +
                    `Released SOV: ${ethers.utils.formatEther(stakedAmount)}`
            );
        }

        logger.info("\n======================================");
        logger.info(`Total staked amount: ${ethers.utils.formatEther(totalAmount)} SOV`);
        logger.info(`Total checkpoints: ${results.length}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "timestamp", title: "Timestamp" },
                    { id: "date", title: "Date (UTC)" },
                    { id: "unlockedSOV", title: "Unlocked SOV" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get fee collector staker revenue
 * Equivalent to: feeCollector_stakers_all.py
 */
task("data:getFeeCollectorRevenue", "Get fee collector revenue for all stakers")
    .addOptionalParam("block", "Reference block number")
    .addOptionalParam("weeks", "Number of past weeks to scan (default: 1)", "1")
    .addOptionalParam("staker", "Specific staker address")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ block, weeks, staker, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const FeeSharingDeployment = await get("FeeSharingCollector");
        const StakingDeployment = await get("Staking");

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        const blockData = await provider.getBlock(refBlock);
        const refBlockDate = new Date(blockData.timestamp * 1000);

        const weeksAgo = parseInt(weeks);
        const startDate = new Date(refBlockDate.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000);

        logger.info(`Reference block: ${refBlock} (${refBlockDate.toISOString()})`);
        logger.info(`Scanning from ${startDate.toISOString()} to ${refBlockDate.toISOString()}`);

        const FeeCollector = await ethers.getContractAt(
            FeeSharingDeployment.abi,
            "0x115cAF168c51eD15ec535727F64684D33B7b08D1"
        );
        const Staking = await ethers.getContractAt(StakingDeployment.abi, contracts.Staking);

        // Fee tokens to track
        const feeTokens = [
            { address: "0xa9DcDC63eaBb8a2b6f39D7fF9429d88340044a7A", name: "iWRBTC" },
            { address: contracts.SOV, name: "SOV" },
            { address: "0xdB107FA69E33f05180a4C2cE9c2E7CB481645C2d", name: "ZUSD" },
            { address: contracts.WRBTC, name: "WRBTC" },
            { address: "0xEaBD29bE3C3187500DF86a2613C6470E12F2D77d", name: "RBTC_DUMMY" },
            { address: "0x2e6B1d146064613E8f521Eb3c6e65070af964EbB", name: "MYNT" },
        ];

        const results = [];
        const totalRevenue = { RBTC: 0, USD: 0 };

        for (const token of feeTokens) {
            const numCheckpoints = await FeeCollector.numTokenCheckpoints(token.address, {
                blockTag: refBlock,
            });

            logger.info(`\nScanning ${token.name} checkpoints... (${numCheckpoints} total)`);

            for (let i = 0; i < numCheckpoints; i++) {
                const checkpoint = await FeeCollector.tokenCheckpoints(token.address, i);
                const [checkpointBlock, ts, totalWeightedStake, numTokens] = checkpoint;

                const checkpointDate = new Date(ts * 1000);

                if (checkpointDate < startDate || checkpointDate > refBlockDate) {
                    continue;
                }

                logger.info(
                    `Block ${checkpointBlock}: ${checkpointDate.toISOString()} - ` +
                        `${ethers.utils.formatEther(numTokens)} ${token.name}`
                );

                results.push({
                    block: checkpointBlock.toString(),
                    date: checkpointDate.toISOString(),
                    token: token.name,
                    amount: ethers.utils.formatEther(numTokens),
                    totalWeightedStake: ethers.utils.formatEther(totalWeightedStake),
                });
            }
        }

        logger.info("\n======================================");
        logger.info("====== Fee Collector Revenue =========");
        logger.info("======================================");
        logger.info(`Checkpoints found: ${results.length}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "block", title: "Block" },
                    { id: "date", title: "Date" },
                    { id: "token", title: "Token" },
                    { id: "amount", title: "Amount" },
                    { id: "totalWeightedStake", title: "Total Weighted Stake" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get borrows with SOV collateral
 * Equivalent to: SOV_borrow.py
 */
task("data:getSOVBorrows", "Get all borrows using SOV as collateral")
    .addOptionalParam("fromBlock", "Start block")
    .addOptionalParam("toBlock", "End block")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ fromBlock, toBlock, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ISovrynDeployment = await get("ISovryn");

        const latestBlock = await provider.getBlockNumber();
        const startBlock = fromBlock ? parseInt(fromBlock) : 3690000;
        const endBlock = toBlock ? parseInt(toBlock) : latestBlock;

        logger.info(`Scanning SOV collateral borrows from block ${startBlock} to ${endBlock}`);

        const Protocol = await ethers.getContractAt(
            ISovrynDeployment.abi,
            contracts.sovrynProtocol
        );
        const SOV = contracts.SOV;

        // Get Borrow events filtered by SOV collateral
        const borrowFilter = Protocol.filters.Borrow(null, null, null, null, SOV);
        const borrows = await Protocol.queryFilter(borrowFilter, startBlock, endBlock);

        logger.info(`Found ${borrows.length} borrows with SOV collateral\n`);

        const results = [];
        let totalSOVCollateral = ethers.BigNumber.from(0);

        for (const borrow of borrows) {
            const args = borrow.args;
            const block = await provider.getBlock(borrow.blockNumber);

            const loan = await Protocol.loans(args.loanId);
            const liquidationPrice =
                loan.active && !loan.collateral.isZero()
                    ? loan.principal.mul(115).div(loan.collateral).div(100)
                    : ethers.BigNumber.from(0);

            totalSOVCollateral = totalSOVCollateral.add(args.newCollateral);

            results.push({
                tx: borrow.transactionHash,
                block: borrow.blockNumber,
                date: new Date(block.timestamp * 1000).toISOString(),
                loanId: args.loanId,
                user: args.user,
                principal: ethers.utils.formatEther(args.newPrincipal),
                collateral: ethers.utils.formatEther(args.newCollateral),
                interestRate: ethers.utils.formatEther(args.interestRate),
                currentMargin: ethers.utils.formatEther(args.currentMargin),
                liquidationPrice: ethers.utils.formatEther(liquidationPrice),
                active: loan.active,
            });

            logger.info(
                `${borrow.transactionHash}: User ${args.user} ` +
                    `Principal ${ethers.utils.formatEther(args.newPrincipal)} ` +
                    `Collateral ${ethers.utils.formatEther(args.newCollateral)} SOV`
            );
        }

        logger.info("\n======================================");
        logger.info(`Total SOV collateral: ${ethers.utils.formatEther(totalSOVCollateral)}`);
        logger.info(`Total borrows: ${borrows.length}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "tx", title: "Transaction" },
                    { id: "block", title: "Block" },
                    { id: "date", title: "Date" },
                    { id: "loanId", title: "Loan ID" },
                    { id: "user", title: "User" },
                    { id: "principal", title: "Principal" },
                    { id: "collateral", title: "Collateral (SOV)" },
                    { id: "interestRate", title: "Interest Rate %" },
                    { id: "currentMargin", title: "Current Margin %" },
                    { id: "liquidationPrice", title: "Liquidation Price" },
                    { id: "active", title: "Active" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get margin trades with SOV collateral
 * Equivalent to: SOV_margin.py
 */
task("data:getSOVMargins", "Get all margin trades using SOV as collateral")
    .addOptionalParam("fromBlock", "Start block")
    .addOptionalParam("toBlock", "End block")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ fromBlock, toBlock, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ISovrynDeployment = await get("ISovryn");

        const latestBlock = await provider.getBlockNumber();
        const startBlock = fromBlock ? parseInt(fromBlock) : 3690000;
        const endBlock = toBlock ? parseInt(toBlock) : latestBlock;

        logger.info(
            `Scanning SOV collateral margin trades from block ${startBlock} to ${endBlock}`
        );

        const Protocol = await ethers.getContractAt(
            ISovrynDeployment.abi,
            contracts.sovrynProtocol
        );
        const SOV = contracts.SOV;

        // Get Trade events filtered by SOV collateral
        const tradeFilter = Protocol.filters.Trade(null, null, null, SOV);
        const trades = await Protocol.queryFilter(tradeFilter, startBlock, endBlock);

        logger.info(`Found ${trades.length} margin trades with SOV collateral\n`);

        const results = [];
        let totalSOVCollateral = ethers.BigNumber.from(0);

        for (const trade of trades) {
            const args = trade.args;
            const block = await provider.getBlock(trade.blockNumber);

            const loan = await Protocol.loans(args.loanId);
            const liquidationPrice =
                loan.active && !loan.collateral.isZero()
                    ? loan.principal.mul(115).div(loan.collateral).div(100)
                    : ethers.BigNumber.from(0);

            totalSOVCollateral = totalSOVCollateral.add(args.positionSize);

            results.push({
                tx: trade.transactionHash,
                block: trade.blockNumber,
                date: new Date(block.timestamp * 1000).toISOString(),
                loanId: args.loanId,
                user: args.user,
                positionSize: ethers.utils.formatEther(args.positionSize),
                borrowedAmount: ethers.utils.formatEther(args.borrowedAmount),
                entryLeverage: ethers.utils.formatEther(args.entryLeverage),
                currentLeverage: ethers.utils.formatEther(args.currentLeverage),
                entryPrice: ethers.utils.formatEther(args.entryPrice),
                liquidationPrice: ethers.utils.formatEther(liquidationPrice),
                active: loan.active,
            });

            logger.info(
                `${trade.transactionHash}: User ${args.user} ` +
                    `Position ${ethers.utils.formatEther(args.positionSize)} ` +
                    `Leverage ${ethers.utils.formatEther(args.entryLeverage)}x`
            );
        }

        logger.info("\n======================================");
        logger.info(`Total position size: ${ethers.utils.formatEther(totalSOVCollateral)}`);
        logger.info(`Total margin trades: ${trades.length}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "tx", title: "Transaction" },
                    { id: "block", title: "Block" },
                    { id: "date", title: "Date" },
                    { id: "loanId", title: "Loan ID" },
                    { id: "user", title: "User" },
                    { id: "positionSize", title: "Position Size" },
                    { id: "borrowedAmount", title: "Borrowed Amount" },
                    { id: "entryLeverage", title: "Entry Leverage" },
                    { id: "currentLeverage", title: "Current Leverage" },
                    { id: "entryPrice", title: "Entry Price" },
                    { id: "liquidationPrice", title: "Liquidation Price" },
                    { id: "active", title: "Active" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Watch DLLR arbitrage events
 * Equivalent to: watcher_arb_DLLR.py
 */
task("data:getDLLRArbitrage", "Get DLLR arbitrage events from watcher")
    .addOptionalParam("fromBlock", "Start block (defaults to watcher deployment)")
    .addOptionalParam("toBlock", "End block")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ fromBlock, toBlock, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        // Watcher ABI not available in deployments, using inline ABI
        const WatcherABI = [
            "event Arbitrage(address indexed token0, address indexed token1, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)",
        ];

        const latestBlock = await provider.getBlockNumber();
        const startBlock = fromBlock ? parseInt(fromBlock) : 5168617; // Watcher deployment
        const endBlock = toBlock ? parseInt(toBlock) : latestBlock;

        logger.info(`Scanning DLLR arbitrage events from block ${startBlock} to ${endBlock}`);

        const Watcher = await ethers.getContractAt(WatcherABI, contracts.Watcher);
        const DLLR = contracts.DLLR;
        const WRBTC = contracts.WRBTC;

        // Get arbitrage events DLLR -> WRBTC
        const arbDLLRFilter = Watcher.filters.Arbitrage(DLLR, WRBTC);
        const arbsDLLR = await Watcher.queryFilter(arbDLLRFilter, startBlock, endBlock);

        // Get arbitrage events WRBTC -> DLLR
        const arbWRBTCFilter = Watcher.filters.Arbitrage(WRBTC, DLLR);
        const arbsWRBTC = await Watcher.queryFilter(arbWRBTCFilter, startBlock, endBlock);

        logger.info(`Found ${arbsDLLR.length} DLLR->WRBTC arbitrages`);
        logger.info(`Found ${arbsWRBTC.length} WRBTC->DLLR arbitrages\n`);

        const results = [];
        let totalDLLRSpent = ethers.BigNumber.from(0);
        let totalDLLREarned = ethers.BigNumber.from(0);
        let totalWRBTCBought = ethers.BigNumber.from(0);
        let totalWRBTCSold = ethers.BigNumber.from(0);

        // Process DLLR -> WRBTC
        for (const arb of arbsDLLR) {
            const args = arb.args;
            const block = await provider.getBlock(arb.blockNumber);

            totalDLLRSpent = totalDLLRSpent.add(args._sourceTokenAmount);
            totalWRBTCBought = totalWRBTCBought.add(args._targetTokenAmount);

            results.push({
                tx: arb.transactionHash,
                block: arb.blockNumber,
                date: new Date(block.timestamp * 1000).toISOString(),
                direction: "DLLR→WRBTC",
                sourceAmount: ethers.utils.formatEther(args._sourceTokenAmount),
                targetAmount: ethers.utils.formatEther(args._targetTokenAmount),
                profit: ethers.utils.formatEther(args._profit),
                sender: args._sender,
            });

            logger.info(
                `${arb.transactionHash}: DLLR→WRBTC ` +
                    `${ethers.utils.formatEther(args._sourceTokenAmount)} DLLR → ` +
                    `${ethers.utils.formatEther(args._targetTokenAmount)} WRBTC ` +
                    `(profit: ${ethers.utils.formatEther(args._profit)})`
            );
        }

        // Process WRBTC -> DLLR
        for (const arb of arbsWRBTC) {
            const args = arb.args;
            const block = await provider.getBlock(arb.blockNumber);

            totalWRBTCSold = totalWRBTCSold.add(args._sourceTokenAmount);
            totalDLLREarned = totalDLLREarned.add(args._targetTokenAmount);

            results.push({
                tx: arb.transactionHash,
                block: arb.blockNumber,
                date: new Date(block.timestamp * 1000).toISOString(),
                direction: "WRBTC→DLLR",
                sourceAmount: ethers.utils.formatEther(args._sourceTokenAmount),
                targetAmount: ethers.utils.formatEther(args._targetTokenAmount),
                profit: ethers.utils.formatEther(args._profit),
                sender: args._sender,
            });

            logger.info(
                `${arb.transactionHash}: WRBTC→DLLR ` +
                    `${ethers.utils.formatEther(args._sourceTokenAmount)} WRBTC → ` +
                    `${ethers.utils.formatEther(args._targetTokenAmount)} DLLR ` +
                    `(profit: ${ethers.utils.formatEther(args._profit)})`
            );
        }

        logger.info("\n======================================");
        logger.info("======== Arbitrage Summary ===========");
        logger.info("======================================");
        logger.info(`Total DLLR spent: ${ethers.utils.formatEther(totalDLLRSpent)}`);
        logger.info(`Total DLLR earned: ${ethers.utils.formatEther(totalDLLREarned)}`);
        logger.info(`Total WRBTC bought: ${ethers.utils.formatEther(totalWRBTCBought)}`);
        logger.info(`Total WRBTC sold: ${ethers.utils.formatEther(totalWRBTCSold)}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "tx", title: "Transaction" },
                    { id: "block", title: "Block" },
                    { id: "date", title: "Date" },
                    { id: "direction", title: "Direction" },
                    { id: "sourceAmount", title: "Source Amount" },
                    { id: "targetAmount", title: "Target Amount" },
                    { id: "profit", title: "Profit" },
                    { id: "sender", title: "Sender" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get all vestings data
 * Equivalent to: all_vestings_all.py
 */
task("data:getAllVestings", "Get all vesting contracts and their details")
    .addOptionalParam("block", "Reference block number")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const VestingRegistryDeployment = await get("VestingRegistry");
        const FourYearVestingFactoryDeployment = await get("FourYearVestingFactory");

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        logger.info(`Reference block: ${refBlock}`);

        const VestingRegistry = await ethers.getContractAt(
            VestingRegistryDeployment.abi,
            "0xe24ABdB7DcaB57F3cbe4cBDDd850D52F143eE920"
        );

        const FourYearFactory = await ethers.getContractAt(
            FourYearVestingFactoryDeployment.abi,
            "0xD5564a16f356dD45e445beC725F54496700b5C5A"
        );

        logger.info("\nGetting 4-year vesting contracts...");

        // Get FourYearVestingCreated events
        const factoryFilter = FourYearFactory.filters.FourYearVestingCreated();
        const factoryEvents = await FourYearFactory.queryFilter(factoryFilter, 4378315, refBlock);

        const fourYearOwners = factoryEvents.map((event) => event.args.tokenOwner);
        logger.info(`Found ${fourYearOwners.length} 4-year vesting contracts`);

        // Get TokensStaked events to find all stakers
        logger.info("\nGetting all token owners from staking events...");
        const StakingDeployment = await get("Staking");
        const Staking = await ethers.getContractAt(StakingDeployment.abi, contracts.Staking);

        const stakeFilter = Staking.filters.TokensStaked();
        const stakes = await Staking.queryFilter(stakeFilter, 3100263, refBlock);

        const tokenOwners = new Set();
        for (const stake of stakes) {
            tokenOwners.add(stake.args.staker);
        }

        // Add four year owners
        fourYearOwners.forEach((owner) => tokenOwners.add(owner));

        logger.info(`Found ${tokenOwners.size} unique token owners`);
        logger.info("\nFetching vesting details...\n");

        const results = [];
        const TWO_WEEKS = 2 * 7 * 24 * 60 * 60;

        for (const tokenOwner of tokenOwners) {
            try {
                const vestings = await VestingRegistry.getVestingsOf(tokenOwner, {
                    blockTag: refBlock,
                });

                for (const vesting of vestings) {
                    const vestingType = vesting[0];
                    const vestingCreationType = vesting[1];
                    const vestingAddress = vesting[2];

                    const details = await VestingRegistry.getVestingDetails(vestingAddress, {
                        blockTag: refBlock,
                    });
                    const cliff = details[0];
                    const duration = details[1];

                    const cliffMonths = Math.floor(cliff / (60 * 60 * 24 * 28));
                    const durationMonths = Math.floor(duration / (60 * 60 * 24 * 28));

                    const isTeamVesting = await VestingRegistry.isTeamVesting(vestingAddress, {
                        blockTag: refBlock,
                    });

                    results.push({
                        tokenOwner,
                        vestingAddress,
                        vestingType: vestingType.toString(),
                        vestingCreationType: vestingCreationType.toString(),
                        cliff: cliff.toString(),
                        duration: duration.toString(),
                        cliffMonths: cliffMonths.toString(),
                        durationMonths: durationMonths.toString(),
                        isTeamVesting: isTeamVesting ? "Yes" : "No",
                    });

                    logger.info(
                        `Owner: ${tokenOwner} Vesting: ${vestingAddress} ` +
                            `Type: ${vestingType} Cliff: ${cliffMonths}m Duration: ${durationMonths}m ` +
                            `Team: ${isTeamVesting}`
                    );
                }
            } catch (error) {
                // Skip if no vestings found for this owner
                continue;
            }
        }

        logger.info("\n======================================");
        logger.info(`Total vestings found: ${results.length}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "tokenOwner", title: "Token Owner" },
                    { id: "vestingAddress", title: "Vesting Address" },
                    { id: "vestingType", title: "Vesting Type" },
                    { id: "vestingCreationType", title: "Creation Type" },
                    { id: "cliff", title: "Cliff (seconds)" },
                    { id: "duration", title: "Duration (seconds)" },
                    { id: "cliffMonths", title: "Cliff (months)" },
                    { id: "durationMonths", title: "Duration (months)" },
                    { id: "isTeamVesting", title: "Is Team Vesting" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get token holders for any ERC20 token
 */
task("data:getTokenHolders", "Get holders of any ERC20 token")
    .addParam("token", "Token address or name (SOV, DLLR, etc)")
    .addOptionalParam("block", "Reference block number")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ token, block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ERC20Deployment = await get("SOV"); // Using SOV as generic ERC20 ABI

        // Resolve token address
        const tokenAddress = ethers.utils.isAddress(token)
            ? token
            : contracts[token] || contracts[token.toUpperCase()];

        if (!tokenAddress) {
            logger.error(`Token not found: ${token}`);
            return;
        }

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        const blockData = await provider.getBlock(refBlock);

        logger.info(`Token: ${tokenAddress}`);
        logger.info(
            `Reference block: ${refBlock} (${new Date(blockData.timestamp * 1000).toISOString()})`
        );

        const Token = await ethers.getContractAt(ERC20Deployment.abi, tokenAddress);
        const tokenName = await Token.name();
        const tokenSymbol = await Token.symbol();

        logger.info(`Token name: ${tokenName} (${tokenSymbol})`);
        logger.info("\nScanning Transfer events...");

        // Get all Transfer events
        const transferFilter = Token.filters.Transfer();
        const transfers = await Token.queryFilter(transferFilter, 0, refBlock);

        // Build set of addresses that ever received tokens
        const addresses = new Set();
        transfers.forEach((transfer) => {
            if (transfer.args.to !== ethers.constants.AddressZero) {
                addresses.add(transfer.args.to);
            }
        });

        logger.info(`Found ${addresses.size} addresses\n`);
        logger.info("Fetching balances...\n");

        const results = [];
        let totalBalance = ethers.BigNumber.from(0);
        let holdersCount = 0;

        for (const address of addresses) {
            const balance = await Token.balanceOf(address, { blockTag: refBlock });

            if (balance.gt(0)) {
                holdersCount++;
                totalBalance = totalBalance.add(balance);

                const code = await provider.getCode(address);
                const isContract = code !== "0x";

                results.push({
                    address,
                    balance: ethers.utils.formatEther(balance),
                    isContract: isContract ? "Yes" : "No",
                });

                logger.info(`${address}: ${ethers.utils.formatEther(balance)} ${tokenSymbol}`);
            }
        }

        logger.info("\n======================================");
        logger.info(`Total holders: ${holdersCount}`);
        logger.info(`Total balance: ${ethers.utils.formatEther(totalBalance)} ${tokenSymbol}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "address", title: "Address" },
                    { id: "balance", title: `Balance (${tokenSymbol})` },
                    { id: "isContract", title: "Is Contract" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get loan token statistics
 */
task("data:getLoanTokenStats", "Get statistics for loan tokens (iTokens)")
    .addOptionalParam("block", "Reference block number")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const LoanTokenABI =
            require("../../artifacts/contracts/connectors/loantoken/LoanToken.sol/LoanToken.json").abi;

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        const blockData = await provider.getBlock(refBlock);

        logger.info(
            `Reference block: ${refBlock} (${new Date(blockData.timestamp * 1000).toISOString()})\n`
        );

        // List of loan tokens
        const loanTokens = [
            { name: "iDOC", address: contracts.iDOC },
            { name: "iUSDT", address: contracts.iUSDT },
            { name: "iWRBTC", address: contracts.iWRBTC },
            { name: "iXUSD", address: contracts.iXUSD },
            { name: "iBPRO", address: contracts.iBPRO },
            { name: "iDLLR", address: contracts.iDLLR },
        ];

        const results = [];

        for (const token of loanTokens) {
            try {
                const LoanToken = await ethers.getContractAt(LoanTokenABI, token.address);

                const totalSupply = await LoanToken.totalSupply({ blockTag: refBlock });
                const totalAssetBorrow = await LoanToken.totalAssetBorrow({ blockTag: refBlock });
                const totalAssetSupply = await LoanToken.totalAssetSupply({ blockTag: refBlock });
                const supplyInterestRate = await LoanToken.supplyInterestRate({
                    blockTag: refBlock,
                });
                const borrowInterestRate = await LoanToken.borrowInterestRate({
                    blockTag: refBlock,
                });
                const tokenPrice = await LoanToken.tokenPrice({ blockTag: refBlock });

                const utilizationRate = totalAssetSupply.gt(0)
                    ? totalAssetBorrow.mul(ethers.utils.parseEther("100")).div(totalAssetSupply)
                    : ethers.BigNumber.from(0);

                results.push({
                    name: token.name,
                    address: token.address,
                    totalSupply: ethers.utils.formatEther(totalSupply),
                    totalAssetBorrow: ethers.utils.formatEther(totalAssetBorrow),
                    totalAssetSupply: ethers.utils.formatEther(totalAssetSupply),
                    supplyInterestRate: ethers.utils.formatEther(supplyInterestRate),
                    borrowInterestRate: ethers.utils.formatEther(borrowInterestRate),
                    tokenPrice: ethers.utils.formatEther(tokenPrice),
                    utilizationRate: ethers.utils.formatEther(utilizationRate),
                });

                logger.info(`\n${token.name} (${token.address})`);
                logger.info(`Total supply: ${ethers.utils.formatEther(totalSupply)}`);
                logger.info(`Total asset borrow: ${ethers.utils.formatEther(totalAssetBorrow)}`);
                logger.info(`Total asset supply: ${ethers.utils.formatEther(totalAssetSupply)}`);
                logger.info(
                    `Supply interest rate: ${ethers.utils.formatEther(supplyInterestRate)}%`
                );
                logger.info(
                    `Borrow interest rate: ${ethers.utils.formatEther(borrowInterestRate)}%`
                );
                logger.info(`Token price: ${ethers.utils.formatEther(tokenPrice)}`);
                logger.info(`Utilization rate: ${ethers.utils.formatEther(utilizationRate)}%`);
            } catch (error) {
                logger.warn(`Error fetching data for ${token.name}: ${error.message}`);
            }
        }

        logger.info("\n======================================");
        logger.info(`Loan tokens analyzed: ${results.length}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "name", title: "Name" },
                    { id: "address", title: "Address" },
                    { id: "totalSupply", title: "Total Supply" },
                    { id: "totalAssetBorrow", title: "Total Asset Borrow" },
                    { id: "totalAssetSupply", title: "Total Asset Supply" },
                    { id: "supplyInterestRate", title: "Supply Interest Rate %" },
                    { id: "borrowInterestRate", title: "Borrow Interest Rate %" },
                    { id: "tokenPrice", title: "Token Price" },
                    { id: "utilizationRate", title: "Utilization Rate %" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get active loans summary
 */
task("data:getActiveLoans", "Get summary of all active loans")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const ISovrynDeployment = await get("ISovryn");

        const latestBlock = await provider.getBlockNumber();
        logger.info(`Scanning for active loans at block ${latestBlock}\n`);

        const Protocol = await ethers.getContractAt(
            ISovrynDeployment.abi,
            contracts.sovrynProtocol
        );

        // Get all Borrow events from genesis
        const borrowFilter = Protocol.filters.Borrow();
        const borrows = await Protocol.queryFilter(borrowFilter, 0, latestBlock);

        logger.info(`Found ${borrows.length} total borrow events`);
        logger.info("Checking active status...\n");

        const results = [];
        let totalActivePrincipal = ethers.BigNumber.from(0);
        let totalActiveCollateral = ethers.BigNumber.from(0);
        let activeCount = 0;

        for (const borrow of borrows) {
            const loanId = borrow.args.loanId;

            try {
                const loan = await Protocol.getLoan(loanId);

                if (loan.active) {
                    activeCount++;
                    totalActivePrincipal = totalActivePrincipal.add(loan.principal);
                    totalActiveCollateral = totalActiveCollateral.add(loan.collateral);

                    results.push({
                        loanId,
                        user: borrow.args.user,
                        loanToken: borrow.args.loanToken,
                        collateralToken: borrow.args.collateralToken,
                        principal: ethers.utils.formatEther(loan.principal),
                        collateral: ethers.utils.formatEther(loan.collateral),
                        currentMargin: ethers.utils.formatEther(loan.currentMargin),
                        interestOwedPerDay: ethers.utils.formatEther(loan.interestOwedPerDay),
                    });

                    if (activeCount % 10 === 0) {
                        logger.info(`Processed ${activeCount} active loans...`);
                    }
                }
            } catch (error) {
                // Loan might not exist or be accessible
                continue;
            }
        }

        logger.info("\n======================================");
        logger.info("======= Active Loans Summary =========");
        logger.info("======================================");
        logger.info(`Total active loans: ${activeCount}`);
        logger.info(`Total active principal: ${ethers.utils.formatEther(totalActivePrincipal)}`);
        logger.info(`Total active collateral: ${ethers.utils.formatEther(totalActiveCollateral)}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "loanId", title: "Loan ID" },
                    { id: "user", title: "User" },
                    { id: "loanToken", title: "Loan Token" },
                    { id: "collateralToken", title: "Collateral Token" },
                    { id: "principal", title: "Principal" },
                    { id: "collateral", title: "Collateral" },
                    { id: "currentMargin", title: "Current Margin %" },
                    { id: "interestOwedPerDay", title: "Interest Owed Per Day" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get AMM pool statistics
 */
task("data:getAMMPoolStats", "Get statistics for all AMM pools")
    .addOptionalParam("block", "Reference block number")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const LiquidityPoolV1ConverterABI =
            require("../../artifacts/contracts/feeds/IV1PoolOracle.sol/ILiquidityPoolV1Converter.json").abi;
        const ERC20Deployment = await get("SOV"); // Using SOV as generic ERC20 ABI

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        const blockData = await provider.getBlock(refBlock);

        logger.info(
            `Reference block: ${refBlock} (${new Date(blockData.timestamp * 1000).toISOString()})\n`
        );

        // List of AMM converters (from mainnet_contracts.json)
        const converters = [
            { name: "DOC/WRBTC", address: contracts.ConverterDOC },
            { name: "USDT/WRBTC", address: contracts.ConverterUSDT },
            { name: "BPRO/WRBTC", address: contracts.ConverterBPRO },
            { name: "SOV/WRBTC", address: contracts.ConverterSOV },
            { name: "ETH/WRBTC", address: contracts.ConverterETHs },
            { name: "MOC/WRBTC", address: contracts.ConverterMOC },
            { name: "BNB/WRBTC", address: contracts.ConverterBNBs },
            { name: "XUSD/WRBTC", address: contracts.ConverterXUSD },
            { name: "FISH/WRBTC", address: contracts.ConverterFISH },
            { name: "RIF/WRBTC", address: contracts.ConverterRIF },
            { name: "MYNT/WRBTC", address: contracts.ConverterMYNT },
            { name: "DLLR/WRBTC", address: contracts.ConverterDLLR },
        ];

        const results = [];

        for (const conv of converters) {
            try {
                const Converter = await ethers.getContractAt(
                    LiquidityPoolV1ConverterABI,
                    conv.address
                );

                const reserve0Addr = await Converter.reserveTokens(0);
                const reserve1Addr = await Converter.reserveTokens(1);

                const reserve0 = await Converter.reserves(reserve0Addr, { blockTag: refBlock });
                const reserve1 = await Converter.reserves(reserve1Addr, { blockTag: refBlock });

                const Token0 = await ethers.getContractAt(ERC20Deployment.abi, reserve0Addr);
                const Token1 = await ethers.getContractAt(ERC20Deployment.abi, reserve1Addr);

                const symbol0 = await Token0.symbol();
                const symbol1 = await Token1.symbol();

                results.push({
                    pool: conv.name,
                    address: conv.address,
                    token0: symbol0,
                    token1: symbol1,
                    reserve0: ethers.utils.formatEther(reserve0[0]),
                    reserve1: ethers.utils.formatEther(reserve1[0]),
                });

                logger.info(`\n${conv.name} (${conv.address})`);
                logger.info(`${symbol0} reserve: ${ethers.utils.formatEther(reserve0[0])}`);
                logger.info(`${symbol1} reserve: ${ethers.utils.formatEther(reserve1[0])}`);
            } catch (error) {
                logger.warn(`Error fetching data for ${conv.name}: ${error.message}`);
            }
        }

        logger.info("\n======================================");
        logger.info(`AMM pools analyzed: ${results.length}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "pool", title: "Pool" },
                    { id: "address", title: "Address" },
                    { id: "token0", title: "Token 0" },
                    { id: "token1", title: "Token 1" },
                    { id: "reserve0", title: "Reserve 0" },
                    { id: "reserve1", title: "Reserve 1" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Get XUSD aggregator mints and redemptions
 * Equivalent to: tyrone/SOV-AD-147.py
 */
task("data:getXUSDActivity", "Get XUSD aggregator mints and redemptions")
    .addOptionalParam("fromBlock", "Start block (defaults to aggregator deployment)")
    .addOptionalParam("toBlock", "End block")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ fromBlock, toBlock, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        // MassetManager ABI not available in deployments, using inline ABI
        const XUSDAggregatorABI = [
            "event Minted(address indexed minter, address indexed recipient, uint256 mAssetQuantity, address bAsset, uint256 bAssetQuantity)",
            "event Redeemed(address indexed redeemer, address indexed recipient, uint256 mAssetQuantity, address[] bAssets, uint256[] bAssetQuantities)",
        ];
        const ERC20Deployment = await get("SOV"); // Using SOV as generic ERC20 ABI

        const deploymentBlock = 3416026;
        const startBlock = fromBlock ? parseInt(fromBlock) : deploymentBlock;
        const latestBlock = await provider.getBlockNumber();
        const endBlock = toBlock ? parseInt(toBlock) : latestBlock;

        logger.info(`Scanning XUSD aggregator activity from block ${startBlock} to ${endBlock}`);

        const XUSDAggregator = await ethers.getContractAt(
            XUSDAggregatorABI,
            "0x1440d19436bEeaF8517896bffB957a88EC95a00F"
        );
        const XUSD = await ethers.getContractAt(ERC20Deployment.abi, contracts.XUSD);

        // Get Minted events
        const mintedFilter = XUSDAggregator.filters.Minted();
        const mints = await XUSDAggregator.queryFilter(mintedFilter, startBlock, endBlock);

        // Get Redeemed events
        const redeemedFilter = XUSDAggregator.filters.Redeemed();
        const redemptions = await XUSDAggregator.queryFilter(redeemedFilter, startBlock, endBlock);

        logger.info(`Found ${mints.length} mint events`);
        logger.info(`Found ${redemptions.length} redemption events\n`);

        const results = [];
        let totalMinted = ethers.BigNumber.from(0);
        let totalRedeemed = ethers.BigNumber.from(0);

        // Process mints
        for (const mint of mints) {
            const args = mint.args;
            totalMinted = totalMinted.add(args.massetQuantity);

            results.push({
                tx: mint.transactionHash,
                block: mint.blockNumber,
                event: "Minted",
                minter: args.minter,
                recipient: args.recipient,
                massetQuantity: ethers.utils.formatEther(args.massetQuantity),
                bAsset: args.bAsset,
                bassetQuantity: ethers.utils.formatEther(args.bassetQuantity),
            });

            logger.info(
                `Minted: ${ethers.utils.formatEther(args.massetQuantity)} XUSD ` +
                    `from ${ethers.utils.formatEther(args.bassetQuantity)} bAsset`
            );
        }

        // Process redemptions
        for (const redemption of redemptions) {
            const args = redemption.args;
            totalRedeemed = totalRedeemed.add(args.massetQuantity);

            results.push({
                tx: redemption.transactionHash,
                block: redemption.blockNumber,
                event: "Redeemed",
                redeemer: args.redeemer,
                recipient: args.recipient,
                massetQuantity: ethers.utils.formatEther(args.massetQuantity),
                bAsset: args.bAsset,
                bassetQuantity: ethers.utils.formatEther(args.bassetQuantity),
            });

            logger.info(
                `Redeemed: ${ethers.utils.formatEther(args.massetQuantity)} XUSD ` +
                    `to ${ethers.utils.formatEther(args.bassetQuantity)} bAsset`
            );
        }

        const difference = totalMinted.sub(totalRedeemed);
        const xusdSupply = await XUSD.totalSupply({ blockTag: endBlock });

        logger.info("\n======================================");
        logger.info("====== XUSD Aggregator Summary =======");
        logger.info("======================================");
        logger.info(`Total minted: ${ethers.utils.formatEther(totalMinted)} XUSD`);
        logger.info(`Total redeemed: ${ethers.utils.formatEther(totalRedeemed)} XUSD`);
        logger.info("-----------------------------------------");
        logger.info(`Difference: ${ethers.utils.formatEther(difference)} XUSD`);
        logger.info(
            `XUSD supply at block ${endBlock}: ${ethers.utils.formatEther(xusdSupply)} XUSD`
        );
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "tx", title: "Transaction" },
                    { id: "block", title: "Block" },
                    { id: "event", title: "Event" },
                    { id: "massetQuantity", title: "XUSD Amount" },
                    { id: "bAsset", title: "bAsset Address" },
                    { id: "bassetQuantity", title: "bAsset Amount" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

/**
 * Analyze vesting contracts for block limit issues
 * Equivalent to: tyrone/SOV-2932_general_full.py
 */
task("data:getVestingBlockLimits", "Analyze vesting contracts for potential block limit issues")
    .addOptionalParam("block", "Reference block number")
    .addOptionalParam("output", "Output file path for CSV export")
    .setAction(async ({ block, output }, hre) => {
        const {
            ethers,
            deployments: { get },
        } = hre;
        const provider = ethers.provider;

        const contracts = require("../../scripts/contractInteraction/mainnet_contracts.json");
        const StakingDeployment = await get("Staking");
        const LockedSOVDeployment = await get("LockedSOV");
        const VestingRegistryDeployment = await get("VestingRegistry");

        const refBlock = block ? parseInt(block) : await provider.getBlockNumber();
        logger.info(`Analyzing vesting contracts at block ${refBlock}\n`);

        const Staking = await ethers.getContractAt(StakingDeployment.abi, contracts.Staking);
        const LockedSOV = await ethers.getContractAt(LockedSOVDeployment.abi, contracts.LockedSOV);
        const VestingRegistry = await ethers.getContractAt(
            VestingRegistryDeployment.abi,
            "0xe24ABdB7DcaB57F3cbe4cBDDd850D52F143eE920"
        );

        const TWO_WEEKS = 2 * 7 * 24 * 60 * 60;
        const currentTS = Math.floor(Date.now() / 1000);
        const lastCheckpoint = await Staking.timestampToLockDate(currentTS);

        // Get all TokensStaked events to find stakers
        const stakeFilter = Staking.filters.TokensStaked();
        const stakes = await Staking.queryFilter(stakeFilter, 3100263, refBlock);

        const tokenOwners = new Set();
        stakes.forEach((stake) => tokenOwners.add(stake.args.staker));

        logger.info(`Found ${tokenOwners.size} unique token owners`);
        logger.info("Analyzing vesting contracts...\n");

        const results = [];
        let potentialIssues = 0;

        for (const tokenOwner of tokenOwners) {
            try {
                const vestings = await VestingRegistry.getVestingsOf(tokenOwner, {
                    blockTag: refBlock,
                });

                for (const vesting of vestings) {
                    const vestingAddress = vesting[2];

                    const [lockDates, amounts] = await Staking.getStakes(vestingAddress, {
                        blockTag: refBlock,
                    });

                    const totalLockDates = lockDates.length;

                    // Check if vesting has more than 32 lock dates (potential issue)
                    if (totalLockDates > 32) {
                        potentialIssues++;

                        let unlockedPeriods = 0;
                        let totalUnlockedAmount = ethers.BigNumber.from(0);

                        lockDates.forEach((lockDate, index) => {
                            if (lockDate.lte(lastCheckpoint)) {
                                unlockedPeriods++;
                                totalUnlockedAmount = totalUnlockedAmount.add(amounts[index]);
                            }
                        });

                        const totalAmounts = amounts.reduce(
                            (acc, val) => acc.add(val),
                            ethers.BigNumber.from(0)
                        );

                        const lockedBalance = await LockedSOV.getLockedBalance(tokenOwner, {
                            blockTag: refBlock,
                        });
                        const unlockedBalance = await LockedSOV.getUnlockedBalance(tokenOwner, {
                            blockTag: refBlock,
                        });

                        results.push({
                            tokenOwner,
                            vestingAddress,
                            vestingType: vesting[0].toString(),
                            vestingCreationType: vesting[1].toString(),
                            unlockedPeriods,
                            totalUnlockedAmount: ethers.utils.formatEther(totalUnlockedAmount),
                            totalLockDates,
                            totalAmounts: ethers.utils.formatEther(totalAmounts),
                            lockedSOVLocked: ethers.utils.formatEther(lockedBalance),
                            lockedSOVUnlocked: ethers.utils.formatEther(unlockedBalance),
                        });

                        logger.info(
                            `${tokenOwner}: ${vestingAddress} - ` +
                                `${unlockedPeriods}/${totalLockDates} periods unlocked, ` +
                                `${ethers.utils.formatEther(totalUnlockedAmount)}/${ethers.utils.formatEther(
                                    totalAmounts
                                )} SOV vested`
                        );
                    }
                }
            } catch (error) {
                // Skip if no vestings found
                continue;
            }
        }

        logger.info("\n======================================");
        logger.info("=== Vesting Block Limit Analysis =====");
        logger.info("======================================");
        logger.info(`Vestings with >32 lock dates: ${potentialIssues}`);
        logger.info("======================================");

        // Export to CSV if requested
        if (output && results.length > 0) {
            const csvWriter = createObjectCsvWriter({
                path: output,
                header: [
                    { id: "tokenOwner", title: "Token Owner" },
                    { id: "vestingAddress", title: "Vesting Address" },
                    { id: "vestingType", title: "Vesting Type" },
                    { id: "vestingCreationType", title: "Creation Type" },
                    { id: "unlockedPeriods", title: "Unlocked Periods" },
                    { id: "totalUnlockedAmount", title: "Total Unlocked (SOV)" },
                    { id: "totalLockDates", title: "Total Lock Dates" },
                    { id: "totalAmounts", title: "Total Amounts (SOV)" },
                    { id: "lockedSOVLocked", title: "LockedSOV Locked" },
                    { id: "lockedSOVUnlocked", title: "LockedSOV Unlocked" },
                ],
            });
            await csvWriter.writeRecords(results);
            logger.success(`Results exported to: ${output}`);
        }
    });

module.exports = {};
