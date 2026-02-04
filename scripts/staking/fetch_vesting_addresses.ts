// scripts/staking/fetch_vesting_addresses.ts
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";
dotenv.config();

const VESTING_REGISTRY_ABI = [
  "event VestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount, uint256 vestingCreationType)",
  "event TeamVestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount, uint256 vestingCreationType)",
  "function isVestingAddress(address _vestingAddress) external view returns (bool)",
];

interface VestingInfo {
  address: string;
  tokenOwner: string;
  vestingType: "Vesting" | "TeamVesting";
  vestingCreationType: number;
  cliff: string;
  duration: string;
  amount: string;
}

/**
 * Fetch all vesting addresses by scanning VestingCreated and TeamVestingCreated events
 */
async function fetchVestingAddressesFromEvents(
  vestingRegistryAddress: string,
  rpcUrl: string,
  fromBlock: number,
  toBlock: number | "latest",
): Promise<VestingInfo[]> {
  console.log("\nFetching vesting addresses from VestingRegistry events...");
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const vestingRegistry = new ethers.Contract(
    vestingRegistryAddress,
    VESTING_REGISTRY_ABI,
    provider,
  );

  const vestingInfos: VestingInfo[] = [];
  const batchSize = 10000; // Process in batches to avoid rate limits

  let currentFromBlock = fromBlock;
  const finalToBlock =
    toBlock === "latest" ? await provider.getBlockNumber() : toBlock;

  console.log(`Scanning from block ${fromBlock} to ${finalToBlock}...`);

  while (currentFromBlock <= finalToBlock) {
    const currentToBlock = Math.min(
      currentFromBlock + batchSize - 1,
      finalToBlock,
    );

    try {
      console.log(
        `  Processing blocks ${currentFromBlock} to ${currentToBlock}...`,
      );

      // Fetch VestingCreated events
      const vestingCreatedFilter = vestingRegistry.filters.VestingCreated();
      const vestingCreatedEvents = await vestingRegistry.queryFilter(
        vestingCreatedFilter,
        currentFromBlock,
        currentToBlock,
      );

      for (const event of vestingCreatedEvents) {
        vestingInfos.push({
          address: event.args?.vesting,
          tokenOwner: event.args?.tokenOwner,
          vestingType: "Vesting",
          vestingCreationType: event.args?.vestingCreationType.toNumber(),
          cliff: event.args?.cliff.toString(),
          duration: event.args?.duration.toString(),
          amount: event.args?.amount.toString(),
        });
      }

      // Fetch TeamVestingCreated events
      const teamVestingCreatedFilter =
        vestingRegistry.filters.TeamVestingCreated();
      const teamVestingCreatedEvents = await vestingRegistry.queryFilter(
        teamVestingCreatedFilter,
        currentFromBlock,
        currentToBlock,
      );

      for (const event of teamVestingCreatedEvents) {
        vestingInfos.push({
          address: event.args?.vesting,
          tokenOwner: event.args?.tokenOwner,
          vestingType: "TeamVesting",
          vestingCreationType: event.args?.vestingCreationType.toNumber(),
          cliff: event.args?.cliff.toString(),
          duration: event.args?.duration.toString(),
          amount: event.args?.amount.toString(),
        });
      }

      console.log(
        `    Found ${vestingCreatedEvents.length} VestingCreated + ${teamVestingCreatedEvents.length} TeamVestingCreated events, ${vestingInfos.length} total vestings`,
      );

      currentFromBlock = currentToBlock + 1;

      // Add delay to avoid rate limiting
      await sleep(200);
    } catch (error: any) {
      console.error(
        `ERROR: Failed to process blocks ${currentFromBlock}-${currentToBlock}:`,
        error.message,
      );
      // Continue with next batch
      currentFromBlock = currentToBlock + 1;
    }
  }

  return vestingInfos;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option("network", {
      type: "string",
      description: "Network to use",
      choices: ["rsk-mainnet", "rsk-testnet"],
      demandOption: true,
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
    .option("from-block", {
      type: "number",
      description: "Starting block for events scan",
      default: 3769649, // Registry deployed at this block
    })
    .option("to-block", {
      type: "string",
      description: "Ending block for events scan (or 'latest')",
      default: "latest",
    })
    .parseSync();

  // Fetch vesting addresses from VestingRegistry events
  const vestingInfos = await fetchVestingAddressesFromEvents(
    argv.vestingRegistryAddress,
    argv.rpcUrl,
    argv.fromBlock,
    argv.toBlock === "latest" ? "latest" : parseInt(argv.toBlock),
  );

  const allVestingAddresses = new Set<string>();
  vestingInfos.forEach((v) => allVestingAddresses.add(v.address));

  // Save results
  const resultsDir = path.resolve(__dirname, "./config");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const addressesArray = Array.from(allVestingAddresses).sort();

  // Save simple addresses list
  const addressesPath = path.join(resultsDir, "vestingAddresses.json");
  fs.writeFileSync(
    addressesPath,
    JSON.stringify(
      {
        network: argv.network,
        fetchedAt: new Date().toISOString(),
        count: addressesArray.length,
        addresses: addressesArray,
      },
      null,
      2,
    ),
  );

  // Save detailed info
  const detailedPath = path.join(resultsDir, "vestingAddresses_detailed.json");
  fs.writeFileSync(
    detailedPath,
    JSON.stringify(
      {
        network: argv.network,
        fetchedAt: new Date().toISOString(),
        count: vestingInfos.length,
        vestings: vestingInfos,
      },
      null,
      2,
    ),
  );
  console.log(`\nDetailed info saved to: ${detailedPath}`);

  console.log("\n" + "=".repeat(60));
  console.log("Vesting Addresses Fetch Complete");
  console.log("=".repeat(60));
  console.log(`Total unique vesting addresses found: ${addressesArray.length}`);
  console.log(`Saved to: ${addressesPath}`);
  console.log("=".repeat(60));

  console.log("\nSample addresses:");
  addressesArray.slice(0, 5).forEach((addr) => console.log(`  ${addr}`));
  if (addressesArray.length > 5) {
    console.log(`  ... and ${addressesArray.length - 5} more`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
