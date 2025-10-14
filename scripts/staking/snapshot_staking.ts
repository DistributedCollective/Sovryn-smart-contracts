// scripts/staking/snapshot_staking.ts
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
  blockNumber: number;
  voluntaryOnly: boolean;
}) {
  const {
    rpcUrl,
    stakingAddress,
    stakerAddresses,
    blockNumber,
    voluntaryOnly,
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

  const targetBlock = blockNumber;

  // Get timestamp from the block
  const block = await provider.getBlock(targetBlock);
  const targetTimestamp = block.timestamp;

  console.log(`Target block: ${targetBlock}`);
  console.log(
    `Block timestamp: ${targetTimestamp} (${new Date(targetTimestamp * 1000).toISOString()})`,
  );

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
  const jsonPath = path.join(
    resultsDir,
    `staking_snapshot_block_${targetBlock}_${timestamp}.json`,
  );
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  // Save as CSV
  const csvPath = path.join(
    resultsDir,
    `staking_snapshot_block_${targetBlock}_${timestamp}.csv`,
  );
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
    blockNumber?: number;
    currentBlockNumber?: boolean;
    voluntaryOnly?: boolean;
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
    targetBlockNumber = currentBlock.number - blockSafeThreshold; // to avoid calculation error (not determined yet) for the most recent block
    console.log(
      `Using current block number (with safety threshold): ${targetBlockNumber}`,
    );
  } else {
    targetBlockNumber = argv.blockNumber!;
    console.log(`Using specified block number: ${targetBlockNumber}`);
  }

  await getStakingSnapshot({
    rpcUrl: networkConfig.rpcUrl,
    stakingAddress: networkConfig.stakingAddress,
    stakerAddresses: stakerAddresses,
    blockNumber: targetBlockNumber,
    voluntaryOnly: argv.voluntaryOnly ?? true,
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
