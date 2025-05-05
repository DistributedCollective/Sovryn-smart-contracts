// scripts/staking/snapshot-staking.ts
import { ethers } from "ethers";
import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";
import path from "path";
import { TBOS_SNAPSHOT_STAKING_CONFIG } from "./config/tbos_snapshot_staking.config";

interface StakingSnapshot {
  address: string;
  amountStaked: string;
  votingPower: string;
  isVesting: boolean;
}

const STAKING_ABI = [
  "function getCurrentVotes(address account) external view returns (uint96)",
  "function getPriorVotes(address account, uint256 blockNumber, uint256 date) public view returns (uint96)",
  "function isVestingContract(address stakerAddress) external view returns (bool)",
  "function _currentBalance(address account, uint256 lockDate) internal view returns (uint96)",
  "function getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber) external view returns (uint96)",
  "function balanceOf(address account) external view returns (uint96)",
  "event TokensStaked(address indexed staker, uint256 amount, uint256 lockedUntil, uint256 totalStaked)",
];

async function getStakingSnapshot(params: {
  rpcUrl: string;
  stakingAddress: string;
  stakerAddresses: string[];
  snapshotTimestamp?: number;
  voluntaryOnly?: boolean;
}) {
  const {
    rpcUrl,
    stakingAddress,
    stakerAddresses,
    snapshotTimestamp,
    voluntaryOnly = false,
  } = params;
  console.log("Starting staking snapshot process...");

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const stakingContract = new ethers.Contract(
    stakingAddress,
    STAKING_ABI,
    provider,
  );

  // Get current block if no timestamp provided
  const currentBlock = await provider.getBlock("latest");
  const targetTimestamp = snapshotTimestamp || currentBlock.timestamp;

  // Calculate target block number based on timestamp
  const targetBlock = await calculateBlockNumber(
    provider,
    TBOS_SNAPSHOT_STAKING_CONFIG.averageBlockTime,
    targetTimestamp,
  );
  console.log(
    `Target timestamp: ${targetTimestamp} (${new Date(targetTimestamp * 1000).toISOString()})`,
  );
  console.log(`Target block: ${targetBlock}`);

  const results: StakingSnapshot[] = [];
  let processedCount = 0;

  for (const staker of stakerAddresses) {
    try {
      // Check if it's a vesting contract
      const isVesting = await stakingContract.isVestingContract(staker);

      // Skip if voluntaryOnly is true and this is a vesting contract
      if (voluntaryOnly && isVesting) {
        continue;
      }

      // Get voting power at target block
      const votingPower = await stakingContract.getPriorVotes(
        staker,
        targetBlock,
        targetTimestamp,
      );

      // Get staked amount
      const stakedAmount = await stakingContract.balanceOf(staker, {
        blockTag: targetBlock,
      });

      results.push({
        address: staker,
        amountStaked: ethers.utils.formatUnits(stakedAmount.toString(), 18),
        votingPower: ethers.utils.formatUnits(votingPower, 18),
        isVesting,
      });

      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(
          `Processed ${processedCount}/${stakerAddresses.length} stakers`,
        );
      }

      // Add small delay between requests
      await sleep(100);
    } catch (error) {
      console.error(`Error processing staker ${staker}:`, error);
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
  const jsonPath = path.join(resultsDir, `staking_snapshot_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  // Save as CSV
  const csvPath = path.join(resultsDir, `staking_snapshot_${timestamp}.csv`);
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: "address", title: "Address" },
      { id: "amountStaked", title: "Amount Staked" },
      { id: "votingPower", title: "Voting Power" },
      { id: "isVesting", title: "Is Vesting" },
    ],
  });
  await csvWriter.writeRecords(results);

  console.log("\nSnapshot completed!");
  console.log(`Total stakers processed: ${results.length}`);
  console.log(`Results saved to:`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);

  return results;
}

async function calculateBlockNumber(
  provider: ethers.providers.JsonRpcProvider,
  averageBlockTime: number,
  targetTimestamp: number,
): Promise<number> {
  // Get current block
  const currentBlock = await provider.getBlock("latest");
  const currentTs = currentBlock.timestamp;

  // Calculate blocks between current time and sales end
  const timeDifference = currentTs - targetTimestamp;
  const blockDifference = Math.floor(timeDifference / averageBlockTime);

  // Calculate target block number
  const targetBlockNumber = currentBlock.number - blockDifference;

  return targetBlockNumber;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Script entry point
async function main() {
  const snapshotTimestamp = process.argv[2]
    ? parseInt(process.argv[2])
    : undefined;
  const voluntaryOnly = process.argv[3] === "--voluntary-only";

  await getStakingSnapshot({
    rpcUrl: process.env.RPC_URL!,
    stakingAddress: TBOS_SNAPSHOT_STAKING_CONFIG.stakingAddress,
    stakerAddresses: stakerAddresses,
    snapshotTimestamp,
    voluntaryOnly,
  });
}

let stakerAddresses: string[];
const configPath = path.resolve(__dirname, "./config/stakerAddresses.json");
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    stakerAddresses = config.addresses;
    console.log(
      `Loaded ${stakerAddresses?.length} staker addresses from config.json`,
    );
  } catch (error) {
    console.error("Error reading addresses config file:", error);
    throw Error("Error reading addresses config file: ", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
