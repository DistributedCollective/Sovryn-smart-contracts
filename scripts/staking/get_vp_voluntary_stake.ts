import { ethers } from "ethers";

const STAKING_ABI = [
  "function getCurrentVotes(address account) external view returns (uint96)",
  "function getPriorVotes(address account, uint256 blockNumber, uint256 date) public view returns (uint96)",
  "function isVestingContract(address stakerAddress) external view returns (bool)",
  "function getPriorWeightedStake(address account, uint256 blockNumber, uint256 time) external view returns (uint96)",
];

interface ChainConfig {
  rpcUrl: string;
  stakingAddress: string;
}

interface StakingAddresses {
  bob_staker: string;
  rsk_staker: string;
}

const CHAIN_CONFIG: Record<string, ChainConfig> = {
  BOB: {
    rpcUrl: "https://rpc.gobob.xyz/",
    stakingAddress: "0xc17C6462cEAFE9A8819258c6bA168BEF5544Fc21", // BOB Staking proxy contract
  },
  RSK: {
    rpcUrl: "https://public-node.rsk.co/",
    stakingAddress: "0x5684a06CaB22Db16d901fEe2A5C081b4C91eA40e", // RSK Staking proxy contract
  },
};

async function getWeightedStakingAtBlock(
  chainConfig: ChainConfig,
  stakerAddress: string,
): Promise<{ weightedStake: string; isVesting: boolean }> {
  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl);

  const stakingContract = new ethers.Contract(
    chainConfig.stakingAddress,
    STAKING_ABI,
    provider,
  );

  try {
    // Check if the address is a vesting contract
    const isVesting = await stakingContract.isVestingContract(stakerAddress);

    // If it's a vesting contract, return 0 weighted voluntary stake
    if (isVesting) {
      return {
        weightedStake: "0",
        isVesting: true,
      };
    }

    // Get current weighted voluntary stake
    const block = await provider.getBlock("latest");
    const ref_block = block.number - 1;
    const ref_block_ts = block.timestamp;

    //  the staker Voluntary Weighted Stake
    const weightedStake = await stakingContract.getPriorWeightedStake(
      stakerAddress,
      ref_block,
      ref_block_ts,
    );

    return {
      weightedStake: weightedStake.toString(),
      isVesting: false,
    };
  } catch (error) {
    console.error(
      `Error getting weighted voluntary stake for ${stakerAddress}:`,
      error,
    );
    throw error;
  }
}

async function getStakerTotalWeightedStaking(
  addresses: StakingAddresses,
): Promise<{
  bob: { weightedStake: string; isVesting: boolean };
  rsk: { weightedStake: string; isVesting: boolean };
}> {
  try {
    // Get weighted voluntary stake from both chains in parallel
    const [bobVP, rskVP] = await Promise.all([
      getWeightedStakingAtBlock(CHAIN_CONFIG.BOB, addresses.bob_staker),
      getWeightedStakingAtBlock(CHAIN_CONFIG.RSK, addresses.rsk_staker),
    ]);

    return {
      bob: bobVP,
      rsk: rskVP,
    };
  } catch (error) {
    console.error("Error getting weighted voluntary stake:", error);
    throw error;
  }
}

async function main() {
  const addressesString = process.argv[2];
  if (!addressesString) {
    console.error("Please provide a comma-separated list of addresses");
    process.exit(1);
  }
  const splittedAddresses = addressesString.split(",");
  const addresses: StakingAddresses = {
    bob_staker: splittedAddresses[0],
    rsk_staker:
      splittedAddresses.length == 1
        ? splittedAddresses[0]
        : splittedAddresses[1],
  };

  try {
    const weightedStakes = await getStakerTotalWeightedStaking(addresses);

    console.log("Weighted Stakes:");
    console.log("BOB Chain:", {
      address: addresses.bob_staker,
      ...weightedStakes.bob,
      weightedStake: ethers.utils.formatUnits(
        weightedStakes.bob.weightedStake,
        18,
      ), // 18 decimals
    });
    console.log("RSK Chain:", {
      address: addresses.rsk_staker,
      ...weightedStakes.rsk,
      weightedStake: ethers.utils.formatUnits(
        weightedStakes.rsk.weightedStake,
        18,
      ), // 18 decimals
    });
  } catch (error) {
    console.error("Error in main:", error);
  }
}

//sample run:
// ts-node scripts/staking/get_vp_voluntary_stake.ts 0x2bd2201bfe156a71eb0d02837172ffc237218505,0x91AB7f5Df554566a8cdD2CfC722D0AA031021684

main();
