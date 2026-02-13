import { ethers } from "ethers";
import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";
import path from "path";

interface NetworkConfig {
  name: string;
  rpcUrl: string;
  rewardsAddress: string;
  startBlock: number;
  chunkSize?: number;
}

interface Config {
  networks: {
    rsk?: NetworkConfig;
    bob?: NetworkConfig;
  };
  addresses?: string[];
}

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

interface TokenTransferEvent {
  args: [string, string, bigint] & {
    from: string;
    to: string;
    value: bigint;
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
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// Default network configurations
const DEFAULT_NETWORKS: Config["networks"] = {
  bob: {
    name: "BOB",
    rpcUrl: "https://rpc.gobob.xyz",
    rewardsAddress: "0xFdC57Cb52264209afd1559E7E3Db0F28351E9422",
    startBlock: 26296185,
    chunkSize: 5000,
  },
};

async function getAllAddressesFromEvents(params: {
  startBlock: number;
  endBlock: number;
  provider: ethers.providers.JsonRpcProvider;
  stakingContract: ethers.Contract;
  osSOVContract: ethers.Contract;
  chunkSize: number;
}) {
  const {
    startBlock,
    endBlock,
    provider,
    stakingContract,
    osSOVContract,
    chunkSize,
  } = params;

  console.log("\n=== AUTO-DISCOVERY MODE ===");
  console.log(`Scanning blocks ${startBlock} to ${endBlock}`);

  const allAddresses = new Set<string>();

  // 1. Get stakers from TokensStaked events
  console.log("\n1. Fetching stakers from TokensStaked events...");
  const stakingFilter = stakingContract.filters.TokensStaked();

  for (
    let fromBlock = startBlock;
    fromBlock <= endBlock;
    fromBlock += chunkSize
  ) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, endBlock);
    console.log(`   Querying blocks ${fromBlock} to ${toBlock}...`);

    try {
      const events = await stakingContract.queryFilter(
        stakingFilter,
        fromBlock,
        toBlock,
      );
      for (const event of events) {
        const staker = (event as any).args?.staker;
        if (staker) {
          allAddresses.add(staker.toLowerCase());
        }
      }
      console.log(
        `   Found ${events.length} staking events. Total unique addresses: ${allAddresses.size}`,
      );

      await sleep(500);
    } catch (error) {
      console.error(`   Error querying blocks ${fromBlock}-${toBlock}:`, error);
    }
  }

  // 2. Get osSOV token holders from Transfer events
  console.log("\n2. Fetching osSOV holders from Transfer events...");
  const transferFilter = osSOVContract.filters.Transfer();

  for (
    let fromBlock = startBlock;
    fromBlock <= endBlock;
    fromBlock += chunkSize
  ) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, endBlock);
    console.log(`   Querying blocks ${fromBlock} to ${toBlock}...`);

    try {
      const events = await osSOVContract.queryFilter(
        transferFilter,
        fromBlock,
        toBlock,
      );
      for (const event of events) {
        const from = (event as any).args?.from;
        const to = (event as any).args?.to;

        if (from && from !== ethers.constants.AddressZero) {
          allAddresses.add(from.toLowerCase());
        }
        if (to && to !== ethers.constants.AddressZero) {
          allAddresses.add(to.toLowerCase());
        }
      }
      console.log(
        `   Found ${events.length} transfer events. Total unique addresses: ${allAddresses.size}`,
      );

      await sleep(500);
    } catch (error) {
      console.error(`   Error querying blocks ${fromBlock}-${toBlock}:`, error);
    }
  }

  console.log(`\n✅ Total unique addresses discovered: ${allAddresses.size}`);
  return Array.from(allAddresses);
}

async function getStakingData(params: {
  network: NetworkConfig;
  startFromBlock?: number;
  endBlock?: number;
  specificAddresses?: string[];
  autoDiscover?: boolean;
}) {
  const { network, autoDiscover } = params;

  console.log("\n" + "=".repeat(60));
  console.log("OSSOV SNAPSHOT TOOL");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name}`);
  console.log(`RPC: ${network.rpcUrl}`);
  console.log("=".repeat(60) + "\n");

  console.log("Starting snapshot process...");

  const provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
  if (!provider) throw new Error("Failed to initialize provider");

  // Verify network connection
  const networkInfo = await provider.getNetwork();
  console.log(`Connected to chainId: ${networkInfo.chainId}`);

  // Define target block
  let { startFromBlock, endBlock, specificAddresses } = params;
  if (!startFromBlock) startFromBlock = network.startBlock;
  const targetBlock = endBlock || (await provider.getBlockNumber());
  console.log(`Target block: ${targetBlock}`);
  console.log(`Scanning from block: ${startFromBlock}`);

  // Validate rewards address
  if (!network.rewardsAddress) {
    throw new Error(
      `Rewards address not configured for ${network.name}. Please update config.json.`,
    );
  }

  const rewardsContract = new ethers.Contract(
    network.rewardsAddress,
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
  console.log(`Staking contract: ${stakingContractAddress}`);

  let addressesToProcess: string[] = [];

  // Determine which addresses to process
  if (autoDiscover) {
    console.log("\n🔍 AUTO-DISCOVERY MODE ENABLED");
    addressesToProcess = await getAllAddressesFromEvents({
      startBlock: startFromBlock,
      endBlock: targetBlock,
      provider,
      stakingContract,
      osSOVContract,
      chunkSize: network.chunkSize || 10000,
    });
  } else if (specificAddresses && specificAddresses.length > 0) {
    console.log(`\n📋 Using ${specificAddresses.length} provided addresses`);
    addressesToProcess = specificAddresses;
  } else {
    // Fallback: fetch from TokensStaked events only (legacy behavior)
    console.log("\n📋 Fetching addresses from TokensStaked events...");
    const filter = stakingContract.filters.TokensStaked();
    let allEvents: TokensStakedEvent[] = [];
    const chunkSize = network.chunkSize || 10000;

    for (
      let fromBlock = startFromBlock;
      fromBlock <= targetBlock;
      fromBlock += chunkSize
    ) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, targetBlock);
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

        await sleep(1000);
      } catch (error) {
        console.error(`Error querying blocks ${fromBlock}-${toBlock}:`, error);
      }
    }

    addressesToProcess = [
      ...new Set(allEvents.map((event) => event.args.staker)),
    ];
    console.log(`Found ${addressesToProcess.length} unique stakers`);
  }

  // Create results directory if it doesn't exist
  const resultsDir = path.resolve(__dirname, "./results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Define CSV file path with network name
  const networkSlug = network.name.toLowerCase().replace(/\s+/g, "_");
  const csvFilePath = path.join(
    resultsDir,
    `${networkSlug}_snapshot_block_${targetBlock}.csv`,
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
    addressesToProcess = addressesToProcess.filter(
      (addr) =>
        !existingData[addr.toLowerCase()] || specificAddresses?.includes(addr),
    );
    console.log(`Remaining addresses to process: ${addressesToProcess.length}`);
  }

  // Process all addresses
  console.log("\n=== PROCESSING ADDRESSES ===");
  const results: StakingData[] = [];
  let successCount = 0;
  let errorCount = 0;
  const failedAddresses: string[] = [];

  // Create progress log file
  const progressLogPath = path.join(
    resultsDir,
    `${networkSlug}_progress_block_${targetBlock}.json`,
  );
  let progressData = {
    network: network.name,
    targetBlock,
    startFromBlock,
    totalAddresses: addressesToProcess.length,
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

  for (
    let i = progressData.lastProcessedIndex + 1;
    i < addressesToProcess.length;
    i++
  ) {
    const address = addressesToProcess[i];
    if (!address) continue;

    try {
      // Add delay to avoid rate limiting
      await sleep(100);

      const [balance, [, unclaimed]] = await Promise.all([
        osSOVContract.balanceOf(address, { blockTag: targetBlock }),
        rewardsContract.getArbitraryStakerCurrentReward(false, 0, address, {
          blockTag: targetBlock,
        }),
      ]);

      results.push({
        address,
        osSOV_balance: balance.toString(),
        osSOV_unclaimed: unclaimed.toString(),
      });

      successCount++;
      progressData.processedCount++;
      progressData.lastProcessedIndex = i;

      if (successCount % 10 === 0) {
        console.log(
          `Processed ${successCount}/${addressesToProcess.length} addresses successfully`,
        );
      }
    } catch (error) {
      console.error(`Error processing address ${address}:`, error);
      errorCount++;
      failedAddresses.push(address);
    }

    // Save progress and results every PROCESS_CHUNK_SIZE addresses
    if (
      (i + 1) % PROCESS_CHUNK_SIZE === 0 ||
      i === addressesToProcess.length - 1
    ) {
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
          `Saved progress: ${progressData.processedCount}/${addressesToProcess.length} addresses processed`,
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

  console.log("\n=== SNAPSHOT COMPLETED ===");
  console.log(`Network: ${network.name}`);
  console.log(`Block: ${targetBlock}`);
  console.log(
    `Successfully processed: ${successCount}/${addressesToProcess.length}`,
  );
  console.log(`Errors: ${errorCount}`);
  console.log(`Total records in CSV: ${Object.keys(existingData).length}`);
  console.log(`Results saved to: ${csvFilePath}`);

  // Handle failed addresses
  if (failedAddresses.length > 0) {
    const failedPath = path.join(
      resultsDir,
      `${networkSlug}_failed_addresses_${targetBlock}.json`,
    );
    fs.writeFileSync(failedPath, JSON.stringify(failedAddresses, null, 2));
    console.log(
      `\n⚠️  ${failedAddresses.length} failed addresses saved to: ${failedPath}`,
    );
  }

  return {
    totalAddresses: addressesToProcess.length,
    successCount,
    errorCount,
    csvPath: csvFilePath,
  };
}

// Helper function
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Parse command line arguments
const args = process.argv.slice(2);
const cliArgs: {
  network?: string;
  block?: number;
  startBlock?: number;
  autoDiscover?: boolean;
  addresses?: string[];
} = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--network" && args[i + 1]) {
    cliArgs.network = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === "--block" && args[i + 1]) {
    cliArgs.block = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === "--start-block" && args[i + 1]) {
    cliArgs.startBlock = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === "--auto-discover") {
    cliArgs.autoDiscover = true;
  } else if (args[i] === "--addresses" && args[i + 1]) {
    try {
      const addressData = JSON.parse(fs.readFileSync(args[i + 1], "utf8"));
      cliArgs.addresses = Array.isArray(addressData)
        ? addressData
        : addressData.addresses;
    } catch (error) {
      console.error(`Error loading addresses from file:`, error);
    }
    i++;
  }
}

// Load config.json
let config: Config = { networks: {} };
const configPath = path.resolve(__dirname, "./config.json");
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log(`✅ Loaded configuration from config.json`);
  } catch (error) {
    console.error("❌ Error reading config file:", error);
  }
} else {
  console.log("⚠️  config.json not found. Using default configurations.");
  console.log(
    "   Create config.json from config.json.example for custom settings.\n",
  );
}

// Merge config with defaults
const networks = {
  rsk: {
    ...DEFAULT_NETWORKS.rsk!,
    ...(config.networks?.rsk || {}),
  } as NetworkConfig,
  bob: {
    ...DEFAULT_NETWORKS.bob!,
    ...(config.networks?.bob || {}),
  } as NetworkConfig,
};

// Determine which network to use
const selectedNetwork = cliArgs.network || "rsk";
const networkConfig = networks[selectedNetwork as keyof typeof networks];

if (!networkConfig) {
  console.error(`❌ Unknown network: ${selectedNetwork}`);
  console.error(`   Available networks: rsk, bob`);
  process.exit(1);
}

// Determine addresses
const specificAddresses =
  cliArgs.addresses ||
  (config.addresses && config.addresses.length > 0
    ? config.addresses
    : undefined);

// Execute snapshot
console.log("\n" + "=".repeat(70));
console.log("OSSOV SNAPSHOT TOOL");
console.log("=".repeat(70));
console.log(`Network: ${networkConfig.name}`);
console.log(`Target Block: ${cliArgs.block || "latest"}`);
console.log(`Start Block: ${cliArgs.startBlock || networkConfig.startBlock}`);
console.log(`Auto-discover: ${cliArgs.autoDiscover || false}`);
if (specificAddresses) {
  console.log(`Specific addresses: ${specificAddresses.length}`);
}
console.log("=".repeat(70) + "\n");

getStakingData({
  network: networkConfig,
  startFromBlock: cliArgs.startBlock,
  endBlock: cliArgs.block,
  specificAddresses: specificAddresses,
  autoDiscover: cliArgs.autoDiscover || false,
})
  .then((result) => {
    console.log("\n✅ Snapshot completed successfully!");
    console.log(`📄 CSV file: ${result.csvPath}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
