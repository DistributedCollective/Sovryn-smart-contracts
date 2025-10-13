// scripts/staking/snapshot-staking.ts
import { ethers } from "ethers";
import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { TBOS_SNAPSHOT_STAKING_CONFIG } from "./config/tbos_snapshot_staking.config";
import dotenv from "dotenv";
dotenv.config();

interface StakingSnapshot {
  address: string;
  amountStaked: string;
  votingPower: string;
  votingPowerMode: "voluntary" | "total";
  isVesting: boolean;
}

const STAKING_ABI = [
  "function getCurrentVotes(address account) external view returns (uint96)",
  "function getPriorVotes(address account, uint256 blockNumber, uint256 date) public view returns (uint96)",
  "function getPriorTotalVotingPower(uint32 blockNumber, uint256 date) external view returns (uint96)",
  "function getPriorWeightedStake(address account, uint256 blockNumber, uint256 date) external view returns (uint96)",
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
  snapshotTimestamp: number;
  voluntaryOnly: boolean;
  averageBlockTime: number;
}) {
  const {
    rpcUrl,
    stakingAddress,
    stakerAddresses,
    snapshotTimestamp,
    voluntaryOnly,
    averageBlockTime,
  } = params;
  console.log(
    `Starting staking snapshot process... (voluntaryOnly: ${voluntaryOnly})`,
  );

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const stakingContract = new ethers.Contract(
    stakingAddress,
    STAKING_ABI,
    provider,
  );

  const targetTimestamp = snapshotTimestamp;

  // Calculate target block number based on timestamp
  const targetBlock = await calculateBlockNumber(
    provider,
    averageBlockTime,
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

      if (isVesting) {
        continue;
      }

      // Get total voting power (used for SIP voting)
      // Includes voluntary staking VP + delegated VP from vesting contracts and other stakers
      const totalVotingPower = await stakingContract.getPriorVotes(
        staker,
        targetBlock,
        targetTimestamp,
      );

      // Get voluntary voting power
      // Only includes VP from own stake - no delegated VP from vesting or other stakers
      const ownWeightedStake = await stakingContract.getPriorWeightedStake(
        staker,
        targetBlock,
        targetTimestamp,
      );

      // Calculate delegated voting power (from vesting contracts and other stakers)
      const delegatedVotingPower = totalVotingPower.sub(ownWeightedStake);

      // Voluntary voting power = own weighted stake only
      const voluntaryVotingPower = ownWeightedStake;

      // Get staked amount
      const stakedAmount = await stakingContract.balanceOf(staker, {
        blockTag: targetBlock,
      });

      // Select which VP to use based on flag:
      // voluntaryOnly == true (default): use getPriorWeightedStake
      // voluntaryOnly == false: use getPriorVotes
      const votingPowerToUse = voluntaryOnly
        ? voluntaryVotingPower
        : totalVotingPower;

      results.push({
        address: staker,
        amountStaked: ethers.utils.formatUnits(stakedAmount.toString(), 18),
        votingPower: ethers.utils.formatUnits(votingPowerToUse, 18),
        votingPowerMode: voluntaryOnly ? "voluntary" : "total",
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
      { id: "votingPowerMode", title: "VP Mode" },
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
  const argv = yargs(hideBin(process.argv))
    .option("timestamp", {
      type: "number",
      description: "Unix timestamp for the snapshot",
    })
    .option("current-timestamp", {
      type: "boolean",
      description: "Use the current block timestamp for the snapshot",
    })
    .option("voluntary-only", {
      type: "boolean",
      description:
        "Use voluntary VP. Default: true. Use --no-voluntary-only for total VP",
      default: true,
    })
    .option("network", {
      type: "string",
      description: "Network to use",
      choices: ["BOB", "RSK"],
      demandOption: true,
    })
    .parseSync() as {
    network: "BOB" | "RSK";
    timestamp?: number;
    currentTimestamp?: boolean;
    voluntaryOnly?: boolean;
  };

  // Validate that exactly one timestamp option is provided
  if (!argv.timestamp && !argv.currentTimestamp) {
    console.error(
      "Error: Must provide either --timestamp <UNIX_TIMESTAMP> or --current-timestamp",
    );
    process.exit(1);
  }
  if (argv.timestamp && argv.currentTimestamp) {
    console.error("Error: Cannot use both --timestamp and --current-timestamp");
    process.exit(1);
  }

  let snapshotTimestamp: number;

  // Get network-specific config
  const networkConfig = TBOS_SNAPSHOT_STAKING_CONFIG[argv.network];
  console.log(`Using network: ${argv.network}`);

  if (argv.currentTimestamp) {
    const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpcUrl);
    const currentBlock = await provider.getBlock("latest");
    const blockSafeThreshold = 2;
    const safeBlockNumber = currentBlock.number - blockSafeThreshold; // to avoid calculation error (not determined yet) for the most recent block
    const safeBlock = await provider.getBlock(safeBlockNumber);
    snapshotTimestamp = safeBlock.timestamp;
    console.log(
      `Using recent timestamp (block ${safeBlockNumber}): ${snapshotTimestamp} (${new Date(snapshotTimestamp * 1000).toISOString()})`,
    );
  } else {
    snapshotTimestamp = argv.timestamp!;
    console.log(
      `Using specified timestamp: ${snapshotTimestamp} (${new Date(snapshotTimestamp * 1000).toISOString()})`,
    );
  }

  await getStakingSnapshot({
    rpcUrl: networkConfig.rpcUrl,
    stakingAddress: networkConfig.stakingAddress,
    stakerAddresses: stakerAddresses,
    snapshotTimestamp,
    voluntaryOnly: argv.voluntaryOnly ?? true,
    averageBlockTime: networkConfig.averageBlockTime,
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
    throw new Error(`Error reading addresses config file: ${error}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
