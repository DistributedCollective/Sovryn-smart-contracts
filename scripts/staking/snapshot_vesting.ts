// scripts/staking/snapshot_vesting.ts
import { ethers } from "ethers";
import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { TBOS_SNAPSHOT_STAKING_CONFIG } from "./config/tbos_snapshot_staking.config";
import dotenv from "dotenv";
dotenv.config();

interface VestingSnapshot {
  vestingAddress: string;
  tokenOwner: string;
  cliff: string; // in seconds
  duration: string; // in seconds
  startDate: string; // timestamp
  endDate: string; // timestamp
  totalBalance: string; // Total SOV staked in this vesting
  lockedAmount: string; // Currently locked SOV
  unlockedAmount: string; // Currently unlocked SOV
  percentageVested: string; // Percentage of vesting completed
  isFullyVested: boolean;
  blockNumber: number;
  snapshotTimestamp: number;
}

const VESTING_ABI = [
  "function tokenOwner() external view returns (address)",
  "function cliff() external view returns (uint256)",
  "function duration() external view returns (uint256)",
  "function startDate() external view returns (uint256)",
  "function endDate() external view returns (uint256)",
];

const STAKING_ABI = [
  "function balanceOf(address account) external view returns (uint96)",
  "function isVestingContract(address stakerAddress) external view returns (bool)",
];

const SOV_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
];

/**
 * Calculate locked and unlocked amounts based on vesting schedule
 */
function calculateVestingAmounts(
  totalBalance: bigint,
  startDate: bigint,
  cliff: bigint,
  duration: bigint,
  currentTimestamp: bigint,
): { lockedAmount: bigint; unlockedAmount: bigint; percentageVested: number } {
  // If vesting hasn't started yet
  if (currentTimestamp < startDate) {
    return {
      lockedAmount: totalBalance,
      unlockedAmount: BigInt(0),
      percentageVested: 0,
    };
  }

  const cliffDate = startDate + cliff;

  // If we're before cliff, everything is locked
  if (currentTimestamp < cliffDate) {
    return {
      lockedAmount: totalBalance,
      unlockedAmount: BigInt(0),
      percentageVested: 0,
    };
  }

  const endDate = startDate + duration;

  // If fully vested
  if (currentTimestamp >= endDate) {
    return {
      lockedAmount: BigInt(0),
      unlockedAmount: totalBalance,
      percentageVested: 100,
    };
  }

  // Calculate linear vesting
  const timeFromStart = currentTimestamp - startDate;
  const percentageVested =
    Number((timeFromStart * BigInt(10000)) / duration) / 100;

  const unlockedAmount = (totalBalance * timeFromStart) / duration;
  const lockedAmount = totalBalance - unlockedAmount;

  return {
    lockedAmount,
    unlockedAmount,
    percentageVested,
  };
}

async function getVestingSnapshot(params: {
  rpcUrl: string;
  stakingAddress: string;
  sovAddress: string;
  vestingAddresses: string[];
  blockNumber: number;
  network: string;
}) {
  const {
    rpcUrl,
    stakingAddress,
    sovAddress,
    vestingAddresses,
    blockNumber,
    network,
  } = params;

  console.log(`Starting vesting snapshot process...`);
  console.log(`Total vesting contracts to process: ${vestingAddresses.length}`);

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const stakingContract = new ethers.Contract(
    stakingAddress,
    STAKING_ABI,
    provider,
  );
  const sovContract = new ethers.Contract(sovAddress, SOV_ABI, provider);

  const targetBlock = blockNumber;

  // Get timestamp from the block
  const block = await provider.getBlock(targetBlock);
  const targetTimestamp = block.timestamp;

  console.log(`Target block: ${targetBlock}`);
  console.log(
    `Block timestamp: ${targetTimestamp} (${new Date(targetTimestamp * 1000).toISOString()})`,
  );

  const results: VestingSnapshot[] = [];
  const errors: { address: string; error: string }[] = [];
  let processedCount = 0;

  for (const vestingAddress of vestingAddresses) {
    try {
      // Verify it's a vesting contract
      const isVesting = await stakingContract.isVestingContract(
        vestingAddress,
        {
          blockTag: targetBlock,
        },
      );

      if (!isVesting) {
        console.warn(
          `WARNING: ${vestingAddress} is not a vesting contract, skipping`,
        );
        errors.push({
          address: vestingAddress,
          error: "Not a vesting contract",
        });
        continue;
      }

      const vestingContract = new ethers.Contract(
        vestingAddress,
        VESTING_ABI,
        provider,
      );

      // Fetch all vesting details in parallel
      const [tokenOwner, cliff, duration, startDate, endDate, totalBalance] =
        await Promise.all([
          vestingContract.tokenOwner({ blockTag: targetBlock }),
          vestingContract.cliff({ blockTag: targetBlock }),
          vestingContract.duration({ blockTag: targetBlock }),
          vestingContract.startDate({ blockTag: targetBlock }),
          vestingContract.endDate({ blockTag: targetBlock }),
          stakingContract.balanceOf(vestingAddress, { blockTag: targetBlock }),
        ]);

      // Calculate locked/unlocked amounts
      const { lockedAmount, unlockedAmount, percentageVested } =
        calculateVestingAmounts(
          BigInt(totalBalance.toString()),
          BigInt(startDate.toString()),
          BigInt(cliff.toString()),
          BigInt(duration.toString()),
          BigInt(targetTimestamp),
        );

      const isFullyVested = percentageVested >= 100;

      results.push({
        vestingAddress,
        tokenOwner,
        cliff: cliff.toString(),
        duration: duration.toString(),
        startDate: startDate.toString(),
        endDate: endDate.toString(),
        totalBalance: ethers.utils.formatUnits(totalBalance.toString(), 18),
        lockedAmount: ethers.utils.formatUnits(lockedAmount.toString(), 18),
        unlockedAmount: ethers.utils.formatUnits(unlockedAmount.toString(), 18),
        percentageVested: percentageVested.toFixed(2),
        isFullyVested,
        blockNumber: targetBlock,
        snapshotTimestamp: targetTimestamp,
      });

      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(
          `Processed ${processedCount}/${vestingAddresses.length} vesting contracts`,
        );
      }

      // Add small delay between requests
      await sleep(100);
    } catch (error: any) {
      console.error(
        `ERROR: Failed to process vesting ${vestingAddress}:`,
        error.message,
      );
      errors.push({
        address: vestingAddress,
        error: error.message,
      });
    }
  }

  // Save results
  const timestamp = new Date(targetTimestamp * 1000)
    .toISOString()
    .replace(/[:.]/g, "-");
  const resultsDir = path.resolve(__dirname, "./output");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Save as JSON
  const jsonPath = path.join(
    resultsDir,
    `vesting_snapshot_${network}_block_${targetBlock}_${timestamp}.json`,
  );
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        metadata: {
          network,
          blockNumber: targetBlock,
          blockTimestamp: targetTimestamp,
          snapshotDate: new Date(targetTimestamp * 1000).toISOString(),
          totalVestingContracts: vestingAddresses.length,
          successfullyProcessed: results.length,
          errors: errors.length,
        },
        vestings: results,
        errors,
      },
      null,
      2,
    ),
  );

  // Save as CSV
  const csvPath = path.join(
    resultsDir,
    `vesting_snapshot_${network}_block_${targetBlock}_${timestamp}.csv`,
  );
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: "vestingAddress", title: "Vesting Address" },
      { id: "tokenOwner", title: "Token Owner" },
      { id: "cliff", title: "Cliff (seconds)" },
      { id: "duration", title: "Duration (seconds)" },
      { id: "startDate", title: "Start Date (timestamp)" },
      { id: "endDate", title: "End Date (timestamp)" },
      { id: "totalBalance", title: "Total Balance (SOV)" },
      { id: "lockedAmount", title: "Locked Amount (SOV)" },
      { id: "unlockedAmount", title: "Unlocked Amount (SOV)" },
      { id: "percentageVested", title: "Percentage Vested (%)" },
      { id: "isFullyVested", title: "Is Fully Vested" },
      { id: "blockNumber", title: "Block Number" },
      { id: "snapshotTimestamp", title: "Snapshot Timestamp" },
    ],
  });
  await csvWriter.writeRecords(results);

  // Calculate summary statistics
  const totalSOVStaked = results.reduce(
    (sum, v) => sum + parseFloat(v.totalBalance),
    0,
  );
  const totalLocked = results.reduce(
    (sum, v) => sum + parseFloat(v.lockedAmount),
    0,
  );
  const totalUnlocked = results.reduce(
    (sum, v) => sum + parseFloat(v.unlockedAmount),
    0,
  );
  const fullyVestedCount = results.filter((v) => v.isFullyVested).length;

  console.log("\n" + "=".repeat(60));
  console.log("Vesting Snapshot Summary");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Block: ${targetBlock}`);
  console.log(`Timestamp: ${new Date(targetTimestamp * 1000).toISOString()}`);
  console.log(`\nVesting Contracts:`);
  console.log(`  Total Processed: ${results.length}`);
  console.log(`  Fully Vested: ${fullyVestedCount}`);
  console.log(`  Still Vesting: ${results.length - fullyVestedCount}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`\nSOV Totals:`);
  console.log(`  Total Staked: ${totalSOVStaked.toFixed(2)} SOV`);
  console.log(
    `  Locked: ${totalLocked.toFixed(2)} SOV (${((totalLocked / totalSOVStaked) * 100).toFixed(2)}%)`,
  );
  console.log(
    `  Unlocked: ${totalUnlocked.toFixed(2)} SOV (${((totalUnlocked / totalSOVStaked) * 100).toFixed(2)}%)`,
  );
  console.log(`\nOutput Files:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  CSV: ${csvPath}`);
  console.log("=".repeat(60));

  if (errors.length > 0) {
    console.log("\nErrors encountered:");
    errors.forEach((e) => {
      console.log(`  ${e.address}: ${e.error}`);
    });
  }

  return { results, errors };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Script entry point
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("block-number", {
      type: "number",
      description: "Specific block number for the snapshot",
    })
    .option("current-block-number", {
      type: "boolean",
      description: "Use the current block number for the snapshot",
    })
    .option("network", {
      type: "string",
      description: "Network to use",
      choices: ["BOB", "RSK"],
      demandOption: true,
    })
    .option("sov-address", {
      type: "string",
      description: "SOV token address (required for RSK mainnet)",
      default: "0xEFc78fc7d48b64958315949279Ba181c2114ABBd", // RSK mainnet SOV
    })
    .parseSync() as {
    network: "BOB" | "RSK";
    blockNumber?: number;
    currentBlockNumber?: boolean;
    sovAddress: string;
  };

  // Validate that exactly one block option is provided
  if (!argv.blockNumber && !argv.currentBlockNumber) {
    console.error(
      "Error: Must provide either --block-number <NUMBER> or --current-block-number",
    );
    process.exit(1);
  }
  if (argv.blockNumber && argv.currentBlockNumber) {
    console.error(
      "Error: Cannot use both --block-number and --current-block-number",
    );
    process.exit(1);
  }

  // Get network-specific config
  const networkConfig = TBOS_SNAPSHOT_STAKING_CONFIG[argv.network];
  console.log(`Using network: ${argv.network}`);

  let targetBlockNumber: number;

  if (argv.currentBlockNumber) {
    const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpcUrl);
    const currentBlock = await provider.getBlock("latest");
    const blockSafeThreshold = 2;
    targetBlockNumber = currentBlock.number - blockSafeThreshold;
    console.log(
      `Using current block number (with safety threshold): ${targetBlockNumber}`,
    );
  } else {
    targetBlockNumber = argv.blockNumber!;
    console.log(`Using specified block number: ${targetBlockNumber}`);
  }

  // Load vesting addresses from config
  const vestingAddresses = loadVestingAddresses();

  await getVestingSnapshot({
    rpcUrl: networkConfig.rpcUrl,
    stakingAddress: networkConfig.stakingAddress,
    sovAddress: argv.sovAddress,
    vestingAddresses,
    blockNumber: targetBlockNumber,
    network: argv.network,
  });
}

function loadVestingAddresses(): string[] {
  const configPath = path.resolve(__dirname, "./config/vestingAddresses.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const addresses = config.addresses;

      if (!addresses || addresses.length === 0) {
        console.error("Error: No addresses found in config file");
        process.exit(1);
      }

      console.log(
        `Loaded ${addresses.length} vesting addresses from config.json`,
      );
      return addresses;
    } catch (error) {
      console.error("Error reading vesting addresses config file:", error);
      throw new Error(`Error reading vesting addresses config file: ${error}`);
    }
  } else {
    console.error(`Error: Config file not found at ${configPath}`);
    console.error(
      "Please create config/vestingAddresses.json with the vesting addresses to snapshot",
    );
    console.error("\nExample format:");
    console.error(
      JSON.stringify(
        {
          addresses: [
            "0x1234567890123456789012345678901234567890",
            "0x0987654321098765432109876543210987654321",
          ],
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
