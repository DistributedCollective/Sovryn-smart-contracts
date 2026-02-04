// scripts/lockedSOV/snapshot_lockedSOV.ts
import { ethers } from "ethers";
import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";
dotenv.config();

interface LockedSOVSnapshot {
  userAddress: string;
  lockedBalance: string;
  unlockedBalance: string;
  totalBalance: string;
  hasVesting: boolean;
  vestingAddress: string;
  blockNumber: number;
  snapshotTimestamp: number;
}

const LOCKED_SOV_ABI = [
  "function getLockedBalance(address _addr) external view returns (uint256)",
  "function getUnlockedBalance(address _addr) external view returns (uint256)",
  "function cliff() external view returns (uint256)",
  "function duration() external view returns (uint256)",
];

const VESTING_REGISTRY_ABI = [
  "function getVesting(address _tokenOwner) external view returns (address)",
];

/**
 * Snapshot LockedSOV balances for all users
 */
async function getLockedSOVSnapshot(params: {
  rpcUrl: string;
  lockedSOVAddress: string;
  vestingRegistryAddress: string;
  userAddresses: string[];
  blockNumber: number;
  network: string;
}) {
  const {
    rpcUrl,
    lockedSOVAddress,
    vestingRegistryAddress,
    userAddresses,
    blockNumber,
    network,
  } = params;

  console.log("\nStarting LockedSOV snapshot process...");
  console.log(`Total users to process: ${userAddresses.length}`);

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const lockedSOVContract = new ethers.Contract(
    lockedSOVAddress,
    LOCKED_SOV_ABI,
    provider,
  );
  const vestingRegistryContract = new ethers.Contract(
    vestingRegistryAddress,
    VESTING_REGISTRY_ABI,
    provider,
  );

  const targetBlock = blockNumber;

  // Get timestamp from the block
  const block = await provider.getBlock(targetBlock);
  const targetTimestamp = block.timestamp;

  console.log(`Target block: ${targetBlock}`);
  console.log(
    `Block timestamp: ${targetTimestamp} (${new Date(targetTimestamp * 1000).toISOString()})`,
  );

  // Get cliff and duration for reference
  const [cliff, duration] = await Promise.all([
    lockedSOVContract.cliff({ blockTag: targetBlock }),
    lockedSOVContract.duration({ blockTag: targetBlock }),
  ]);

  console.log(`LockedSOV Configuration:`);
  console.log(
    `  Cliff: ${cliff.toString()} seconds (${cliff.toNumber() / (4 * 7 * 24 * 60 * 60)} 4-week periods)`,
  );
  console.log(
    `  Duration: ${duration.toString()} seconds (${duration.toNumber() / (4 * 7 * 24 * 60 * 60)} 4-week periods)`,
  );

  const results: LockedSOVSnapshot[] = [];
  const errors: { address: string; error: string }[] = [];
  let processedCount = 0;
  let usersWithBalance = 0;

  for (const userAddress of userAddresses) {
    try {
      // Fetch locked and unlocked balances
      const [lockedBalance, unlockedBalance, vestingAddress] =
        await Promise.all([
          lockedSOVContract.getLockedBalance(userAddress, {
            blockTag: targetBlock,
          }),
          lockedSOVContract.getUnlockedBalance(userAddress, {
            blockTag: targetBlock,
          }),
          vestingRegistryContract.getVesting(userAddress, {
            blockTag: targetBlock,
          }),
        ]);

      const totalBalance = lockedBalance.add(unlockedBalance);

      // Skip users with zero balance
      if (totalBalance.isZero()) {
        processedCount++;
        continue;
      }

      const hasVesting = vestingAddress !== ethers.constants.AddressZero;

      results.push({
        userAddress,
        lockedBalance: ethers.utils.formatUnits(lockedBalance, 18),
        unlockedBalance: ethers.utils.formatUnits(unlockedBalance, 18),
        totalBalance: ethers.utils.formatUnits(totalBalance, 18),
        hasVesting,
        vestingAddress: hasVesting
          ? vestingAddress
          : "0x0000000000000000000000000000000000000000",
        blockNumber: targetBlock,
        snapshotTimestamp: targetTimestamp,
      });

      usersWithBalance++;
      processedCount++;

      if (processedCount % 50 === 0) {
        console.log(
          `Processed ${processedCount}/${userAddresses.length} users (${usersWithBalance} with balance)`,
        );
      }

      // Add small delay between requests
      await sleep(50);
    } catch (error: any) {
      console.error(
        `ERROR: Failed to process user ${userAddress}:`,
        error.message,
      );
      errors.push({
        address: userAddress,
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

  // Calculate summary statistics
  const totalLockedSOV = results.reduce(
    (sum, r) => sum + parseFloat(r.lockedBalance),
    0,
  );
  const totalUnlockedSOV = results.reduce(
    (sum, r) => sum + parseFloat(r.unlockedBalance),
    0,
  );
  const totalSOV = totalLockedSOV + totalUnlockedSOV;
  const usersWithVesting = results.filter((r) => r.hasVesting).length;
  const usersWithoutVesting = results.length - usersWithVesting;

  // Save as JSON
  const jsonPath = path.join(
    resultsDir,
    `lockedSOV_snapshot_${network}_block_${targetBlock}_${timestamp}.json`,
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
          lockedSOVAddress,
          vestingRegistryAddress,
          cliff: cliff.toString(),
          duration: duration.toString(),
          cliffWeeks: cliff.toNumber() / (4 * 7 * 24 * 60 * 60),
          durationWeeks: duration.toNumber() / (4 * 7 * 24 * 60 * 60),
          totalUsersProcessed: userAddresses.length,
          usersWithBalance: results.length,
          usersWithVesting,
          usersWithoutVesting,
          totalLockedSOV: totalLockedSOV.toFixed(18),
          totalUnlockedSOV: totalUnlockedSOV.toFixed(18),
          totalSOV: totalSOV.toFixed(18),
          errors: errors.length,
        },
        balances: results,
        errors,
      },
      null,
      2,
    ),
  );

  // Save as CSV
  const csvPath = path.join(
    resultsDir,
    `lockedSOV_snapshot_${network}_block_${targetBlock}_${timestamp}.csv`,
  );
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: "userAddress", title: "User Address" },
      { id: "lockedBalance", title: "Locked Balance (SOV)" },
      { id: "unlockedBalance", title: "Unlocked Balance (SOV)" },
      { id: "totalBalance", title: "Total Balance (SOV)" },
      { id: "hasVesting", title: "Has Vesting" },
      { id: "vestingAddress", title: "Vesting Address" },
      { id: "blockNumber", title: "Block Number" },
      { id: "snapshotTimestamp", title: "Snapshot Timestamp" },
    ],
  });
  await csvWriter.writeRecords(results);

  console.log("\n" + "=".repeat(60));
  console.log("LockedSOV Snapshot Summary");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Block: ${targetBlock}`);
  console.log(`Timestamp: ${new Date(targetTimestamp * 1000).toISOString()}`);
  console.log(`\nConfiguration:`);
  console.log(
    `  Cliff: ${cliff.toNumber() / (4 * 7 * 24 * 60 * 60)} 4-week periods`,
  );
  console.log(
    `  Duration: ${duration.toNumber() / (4 * 7 * 24 * 60 * 60)} 4-week periods`,
  );
  console.log(`\nUsers:`);
  console.log(`  Total Processed: ${userAddresses.length}`);
  console.log(`  With Balance: ${results.length}`);
  console.log(`  With Vesting: ${usersWithVesting}`);
  console.log(`  Without Vesting: ${usersWithoutVesting}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`\nSOV Totals:`);
  console.log(`  Locked: ${totalLockedSOV.toFixed(2)} SOV`);
  console.log(`  Unlocked: ${totalUnlockedSOV.toFixed(2)} SOV`);
  console.log(`  Total: ${totalSOV.toFixed(2)} SOV`);
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
      choices: ["rsk-mainnet", "rsk-testnet"],
      demandOption: true,
    })
    .option("locked-sov-address", {
      type: "string",
      description: "LockedSOV contract address",
      default: "0xC4E3c5D0c7CAa5E0f417784c720A7860B97a4753", // RSK mainnet
    })
    .option("vesting-registry-address", {
      type: "string",
      description: "VestingRegistry contract address",
      default: "0xe24ABdB7DcaB57F3cbe4cBDDd850D52F143eE920", // RSK mainnet
    })
    .option("rpc-url", {
      type: "string",
      description: "RPC URL",
      default: "https://mainnet-dev.sovryn.app/rpc",
    })
    .option("users-file", {
      type: "string",
      description: "Path to JSON file with user addresses",
      default: "./config/lockedSOVUsers.json",
    })
    .parseSync();

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

  let targetBlockNumber: number;

  if (argv.currentBlockNumber) {
    const provider = new ethers.providers.JsonRpcProvider(argv.rpcUrl);
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

  // Load user addresses from config
  const userAddresses = loadUserAddresses(argv.usersFile);

  await getLockedSOVSnapshot({
    rpcUrl: argv.rpcUrl,
    lockedSOVAddress: argv.lockedSovAddress,
    vestingRegistryAddress: argv.vestingRegistryAddress,
    userAddresses,
    blockNumber: targetBlockNumber,
    network: argv.network,
  });
}

function loadUserAddresses(configPath: string): string[] {
  const fullPath = path.resolve(__dirname, configPath);
  if (fs.existsSync(fullPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      const addresses = config.addresses || config.users;

      if (!addresses || addresses.length === 0) {
        console.error("Error: No addresses found in config file");
        process.exit(1);
      }

      console.log(
        `Loaded ${addresses.length} user addresses from ${configPath}`,
      );
      return addresses;
    } catch (error) {
      console.error("Error reading user addresses config file:", error);
      throw new Error(`Error reading user addresses config file: ${error}`);
    }
  } else {
    console.error(`Error: Config file not found at ${fullPath}`);
    console.error("Please create config file with user addresses to snapshot");
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
