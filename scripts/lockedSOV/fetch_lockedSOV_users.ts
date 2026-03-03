// scripts/lockedSOV/fetch_lockedSOV_users.ts
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";
dotenv.config();

const LOCKED_SOV_ABI = [
  "event Deposited(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount, uint256 _basisPoint)",
  "event VestingCreated(address indexed _initiator, address indexed _userAddress, address indexed _vesting)",
  "event Withdrawn(address indexed _initiator, address indexed _userAddress, uint256 _sovAmount)",
];

async function fetchLockedSOVUsers(
  lockedSOVAddress: string,
  rpcUrl: string,
  fromBlock: number,
  toBlock: number | "latest",
): Promise<Set<string>> {
  console.log("\nFetching LockedSOV user addresses from events...");
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const lockedSOV = new ethers.Contract(
    lockedSOVAddress,
    LOCKED_SOV_ABI,
    provider,
  );

  const userAddresses = new Set<string>();
  const batchSize = 10000;

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

      // Fetch Deposited events
      const depositedFilter = lockedSOV.filters.Deposited();
      const depositedEvents = await lockedSOV.queryFilter(
        depositedFilter,
        currentFromBlock,
        currentToBlock,
      );

      for (const event of depositedEvents) {
        if (event.args?._userAddress) {
          userAddresses.add(event.args._userAddress);
        }
      }

      // Fetch VestingCreated events
      const vestingCreatedFilter = lockedSOV.filters.VestingCreated();
      const vestingCreatedEvents = await lockedSOV.queryFilter(
        vestingCreatedFilter,
        currentFromBlock,
        currentToBlock,
      );

      for (const event of vestingCreatedEvents) {
        if (event.args?._userAddress) {
          userAddresses.add(event.args._userAddress);
        }
      }

      // Fetch Withdrawn events
      const withdrawnFilter = lockedSOV.filters.Withdrawn();
      const withdrawnEvents = await lockedSOV.queryFilter(
        withdrawnFilter,
        currentFromBlock,
        currentToBlock,
      );

      for (const event of withdrawnEvents) {
        if (event.args?._userAddress) {
          userAddresses.add(event.args._userAddress);
        }
      }

      console.log(
        `    Found ${depositedEvents.length} Deposited + ${vestingCreatedEvents.length} VestingCreated + ${withdrawnEvents.length} Withdrawn events, ${userAddresses.size} unique users so far`,
      );

      currentFromBlock = currentToBlock + 1;

      // Add delay to avoid rate limiting
      await sleep(200);
    } catch (error: any) {
      console.error(
        `ERROR: Failed to process blocks ${currentFromBlock}-${currentToBlock}:`,
        error.message,
      );
      currentFromBlock = currentToBlock + 1;
    }
  }

  return userAddresses;
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
    .option("locked-sov-address", {
      type: "string",
      description: "LockedSOV contract address",
      default: "0xB4e4517cA4Edf591Dcafb702999F04f02E57D978", // RSK mainnet
    })
    .option("rpc-url", {
      type: "string",
      description: "RPC URL",
      default: "https://mainnet-dev.sovryn.app/rpc",
    })
    .option("from-block", {
      type: "number",
      description: "Starting block for events scan",
      default: 3368550, // LockedSOV deployed at this block
    })
    .option("to-block", {
      type: "string",
      description: "Ending block for events scan (or 'latest')",
      default: "latest",
    })
    .parseSync();

  const userAddresses = await fetchLockedSOVUsers(
    argv.lockedSovAddress,
    argv.rpcUrl,
    argv.fromBlock,
    argv.toBlock === "latest" ? "latest" : parseInt(argv.toBlock),
  );

  // Save results
  const resultsDir = path.resolve(__dirname, "./config");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const addressesArray = Array.from(userAddresses).sort();

  const addressesPath = path.join(resultsDir, "lockedSOVUsers.json");
  fs.writeFileSync(
    addressesPath,
    JSON.stringify(
      {
        network: argv.network,
        fetchedAt: new Date().toISOString(),
        lockedSOVAddress: argv.lockedSovAddress,
        count: addressesArray.length,
        addresses: addressesArray,
      },
      null,
      2,
    ),
  );

  console.log("\n" + "=".repeat(60));
  console.log("LockedSOV Users Fetch Complete");
  console.log("=".repeat(60));
  console.log(`Total unique user addresses found: ${addressesArray.length}`);
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
