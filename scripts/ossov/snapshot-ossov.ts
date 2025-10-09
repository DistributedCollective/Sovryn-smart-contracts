import { ethers } from "ethers";
import { createObjectCsvWriter } from "csv-writer";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

interface StakingData {
  address: string;
  osSOV_balance: string;
  osSOV_unclaimed: string;
}

interface TokensStakedEvent {
  args: [string, bigint, bigint, bigint] & {
    staker: string;
    amount: bigint;
    lockedUntil: bigint;
    totalStaked: bigint;
  };
}

const STAKING_ABI = [
  "event TokensStaked(address indexed staker, uint256 amount, uint256 lockedUntil, uint256 totalStaked)",
];

const REWARDS_ABI = [
  "function getArbitraryStakerCurrentReward(bool considerMaxDuration, uint256 startTime, address staker) view returns (uint256 nextWithdrawTimestamp, uint256 amount)",
  "function getOsSOV() view returns (address)",
  "function getStaking() view returns (address)",
];

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

const ADDRESSES = {
  REWARDS: "0xFdC57Cb52264209afd1559E7E3Db0F28351E9422",
} as const;

const CHUNK_SIZE = 10000000;

async function getStakingData(params: {
  startFromBlock?: number;
  endBlock?: number;
  specificAddresses?: string[];
}) {
  console.log("Starting snapshot process...");

  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  if (!provider) throw new Error("Failed to initialize provider");

  // define target block
  let { startFromBlock, endBlock, specificAddresses } = params;
  if (!startFromBlock) startFromBlock = 0;
  const targetBlock = endBlock || (await provider.getBlockNumber());
  console.log(`Using block number: ${targetBlock}`);
  console.log(`Starting from block: ${startFromBlock}`);

  const rewardsContract = new ethers.Contract(
    ADDRESSES.REWARDS,
    REWARDS_ABI,
    provider,
  );
  const stakingContractAddress = await rewardsContract.getStaking();
  const stakingContract = new ethers.Contract(
    stakingContractAddress,
    STAKING_ABI,
    provider,
  );

  // Get osSOV token address and contract
  const osSOVAddress = await rewardsContract.getOsSOV();
  const osSOVContract = new ethers.Contract(osSOVAddress, ERC20_ABI, provider);
  console.log(`osSOV token address: ${osSOVAddress}`);

  let stakers: string[] = [];

  // If specific addresses are provided, use them directly
  if (specificAddresses && specificAddresses.length > 0) {
    console.log(
      `Using ${specificAddresses.length} provided addresses instead of querying events`,
    );
    stakers = specificAddresses;
  } else {
    // Otherwise fetch all staking events in chunks
    console.log("Fetching staking events...");
    const filter = stakingContract.filters.TokensStaked();

    // Process in chunks of 10,000 blocks
    let allEvents: TokensStakedEvent[] = [];

    for (
      let fromBlock = startFromBlock;
      fromBlock <= targetBlock;
      fromBlock += CHUNK_SIZE
    ) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, targetBlock);
      console.log(`Querying blocks ${fromBlock} to ${toBlock}...`);

      try {
        const chunkEvents = (
          await stakingContract.queryFilter(filter, fromBlock, toBlock)
        ).map((event) => {
          return {
            args: event.args as unknown as [string, bigint, bigint, bigint] & {
              staker: string;
              amount: bigint;
              lockedUntil: bigint;
              totalStaked: bigint;
            },
          } as TokensStakedEvent;
        });

        allEvents = [...allEvents, ...chunkEvents];
        console.log(
          `Found ${chunkEvents.length} events in this chunk. Total: ${allEvents.length}`,
        );

        // Add delay between chunks to avoid rate limiting
        if (fromBlock + CHUNK_SIZE <= targetBlock) {
          console.log("Waiting before next chunk...");
          await sleep(1000);
        }
      } catch (error) {
        console.error(`Error querying blocks ${fromBlock}-${toBlock}:`, error);
        // Continue to next chunk
      }
    }

    // Get unique stakers
    stakers = [...new Set(allEvents.map((event) => event.args.staker))];
    console.log(`Found ${stakers.length} unique stakers`);
  }

  // Create results directory if it doesn't exist
  const resultsDir = path.resolve(__dirname, "./results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Define CSV file path
  const csvFilePath = path.join(
    resultsDir,
    `staking_rewards_snapshot_block.csv`,
  );

  // Check if file exists and load existing data
  let existingData: Record<string, StakingData> = {};
  if (fs.existsSync(csvFilePath)) {
    console.log(`Found existing CSV file. Loading data...`);
    const csvContent = fs.readFileSync(csvFilePath, "utf8");
    const rows = csvContent.split("\n").slice(1); // Skip header

    for (const row of rows) {
      if (!row.trim()) continue;
      const [address, osSOV_balance, osSOV_unclaimed] = row.split(",");
      if (address) {
        existingData[address.toLowerCase()] = {
          address,
          osSOV_balance,
          osSOV_unclaimed,
        };
      }
    }
    console.log(`Loaded ${Object.keys(existingData).length} existing records`);

    // Filter out already processed addresses
    stakers = stakers.filter(
      (staker) =>
        !existingData[staker.toLowerCase()] ||
        specificAddresses?.includes(staker),
    );
    console.log(`Remaining addresses to process: ${stakers.length}`);
  }

  // Process all of the unique stakers
  const results: StakingData[] = [];
  let successCount = 0;
  let errorCount = 0;
  const failedAddresses: string[] = [];

  // Create progress log file
  const progressLogPath = path.join(resultsDir, `progress_log.json`);
  let progressData = {
    targetBlock,
    totalStakers: stakers.length,
    processedCount: 0,
    lastProcessedIndex: -1,
    lastUpdateTime: new Date().toISOString(),
  };

  // Load existing progress if available
  if (fs.existsSync(progressLogPath)) {
    try {
      progressData = JSON.parse(fs.readFileSync(progressLogPath, "utf8"));
      console.log(`Resuming from index ${progressData.lastProcessedIndex + 1}`);
    } catch (error) {
      console.error(`Error reading progress log:`, error);
    }
  }

  // Process in smaller chunks and save progress regularly
  const PROCESS_CHUNK_SIZE = 20; // Process 20 addresses at a time

  for (let i = progressData.lastProcessedIndex + 1; i < stakers.length; i++) {
    const staker = stakers[i];
    if (!staker) continue;

    try {
      // Add delay to avoid rate limiting
      await sleep(100);

      const [balance, [, unclaimed]] = await Promise.all([
        osSOVContract.balanceOf(staker, { blockTag: targetBlock }),
        rewardsContract.getArbitraryStakerCurrentReward(false, 0, staker, {
          blockTag: targetBlock,
        }),
      ]);

      results.push({
        address: staker,
        osSOV_balance: balance.toString(),
        osSOV_unclaimed: unclaimed.toString(),
      });

      successCount++;
      progressData.processedCount++;
      progressData.lastProcessedIndex = i;

      if (successCount % 10 === 0) {
        console.log(
          `Processed ${successCount}/${stakers.length} stakers successfully`,
        );
      }
    } catch (error) {
      console.error(`Error processing staker ${staker}:`, error);
      errorCount++;
      failedAddresses.push(staker);
    }

    // Save progress and results every PROCESS_CHUNK_SIZE addresses
    if ((i + 1) % PROCESS_CHUNK_SIZE === 0 || i === stakers.length - 1) {
      // Update progress log
      progressData.lastUpdateTime = new Date().toISOString();
      fs.writeFileSync(progressLogPath, JSON.stringify(progressData, null, 2));

      // Append to CSV if we have new results
      if (results.length > 0) {
        // Combine new results with existing data
        const allResults: StakingData[] = [
          ...Object.values(existingData),
          ...results,
        ];

        // Write to CSV
        const csvWriter = createObjectCsvWriter({
          path: csvFilePath,
          header: [
            { id: "address", title: "address" },
            { id: "osSOV_balance", title: "osSOV_balance" },
            { id: "osSOV_unclaimed", title: "osSOV_unclaimed" },
          ],
        });

        await csvWriter.writeRecords(allResults);
        console.log(
          `Saved progress: ${progressData.processedCount}/${stakers.length} addresses processed`,
        );

        // Update existing data with new results to avoid duplicates in next chunk
        for (const result of results) {
          existingData[result.address.toLowerCase()] = result;
        }

        // Clear results array for next chunk
        results.length = 0;
      }
    }
  }

  console.log("\nSnapshot completed!");
  console.log(
    `Successfully processed: ${successCount}/${stakers.length} stakers`,
  );
  console.log(`Errors encountered: ${errorCount} stakers`);
  console.log(`Total records in CSV: ${Object.keys(existingData).length}`);
  console.log(`Results saved to: ${csvFilePath}`);

  // If there are failed addresses, try to process them again
  if (failedAddresses.length > 0) {
    console.log(
      `\nAttempting to process ${failedAddresses.length} failed addresses again...`,
    );

    // Save failed addresses to a file for future reference
    const failedAddressesPath = path.join(
      resultsDir,
      `failed_addresses_${targetBlock}.json`,
    );
    fs.writeFileSync(
      failedAddressesPath,
      JSON.stringify(failedAddresses, null, 2),
    );
    console.log(`Failed addresses saved to: ${failedAddressesPath}`);

    // Wait a bit longer before retrying
    await sleep(5000);

    // Retry with increased delay
    const retryResults: StakingData[] = [];
    let retrySuccessCount = 0;
    const stillFailedAddresses: string[] = [];

    for (const staker of failedAddresses) {
      try {
        // Longer delay for retries
        await sleep(500);

        const [balance, [, unclaimed]] = await Promise.all([
          osSOVContract.balanceOf(staker, { blockTag: targetBlock }),
          rewardsContract.getArbitraryStakerCurrentReward(false, 0, staker, {
            blockTag: targetBlock,
          }),
        ]);

        retryResults.push({
          address: staker,
          osSOV_balance: balance.toString(),
          osSOV_unclaimed: unclaimed.toString(),
        });

        retrySuccessCount++;
        console.log(`Retry successful for ${staker}`);
      } catch (error) {
        console.error(`Retry failed for staker ${staker}:`, error);
        stillFailedAddresses.push(staker);
      }
    }

    // If we recovered some addresses, update the CSV
    if (retrySuccessCount > 0) {
      const finalResults = [...Object.values(existingData), ...retryResults];

      const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
          { id: "address", title: "address" },
          { id: "osSOV_balance", title: "osSOV_balance" },
          { id: "osSOV_unclaimed", title: "osSOV_unclaimed" },
        ],
      });

      await csvWriter.writeRecords(finalResults);

      console.log(`\nRetry completed!`);
      console.log(
        `Successfully recovered: ${retrySuccessCount}/${failedAddresses.length} stakers`,
      );
      console.log(`Total records in CSV: ${finalResults.length}`);
    }

    // If there are still failed addresses, save them and notify
    if (stillFailedAddresses.length > 0) {
      const stillFailedPath = path.join(
        resultsDir,
        `still_failed_addresses_${targetBlock}.json`,
      );
      fs.writeFileSync(
        stillFailedPath,
        JSON.stringify(stillFailedAddresses, null, 2),
      );
      console.log(
        `\n⚠️ WARNING: ${stillFailedAddresses.length} addresses still failed processing`,
      );
      console.log(`These addresses saved to: ${stillFailedPath}`);
      console.log(`You can process them manually by running:`);
      console.log(
        `node scripts/ossov/snapshot-ossov.js --block ${targetBlock} --addresses ${stillFailedPath}`,
      );

      // Return the list of still failed addresses
      return stillFailedAddresses;
    }
  }

  return [];
}

let specificAddresses: string[] | undefined;
const configPath = path.resolve(__dirname, "./config.json");
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    specificAddresses = config.addresses;
    console.log(
      `Loaded ${specificAddresses?.length} addresses from config.json`,
    );
  } catch (error) {
    console.error("Error reading config file:", error);
  }
}

getStakingData({
  startFromBlock: 900618, // block where the staking contract have stake txs
  specificAddresses:
    specificAddresses && specificAddresses.length > 0
      ? specificAddresses
      : undefined,
})
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
