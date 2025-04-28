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

async function getVoluntaryVotingPower(
  chainConfig: ChainConfig,
  stakerAddress: string,
): Promise<{ votingPower: string; isVesting: boolean }> {
  const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl);

  const stakingContract = new ethers.Contract(
    chainConfig.stakingAddress,
    STAKING_ABI,
    provider,
  );

  try {
    // Check if the address is a vesting contract
    const isVesting = await stakingContract.isVestingContract(stakerAddress);

    // If it's a vesting contract, return 0 voting power
    if (isVesting) {
      return {
        votingPower: "0",
        isVesting: true,
      };
    }

    // Get current voting power for voluntary staking
    const block = await provider.getBlock("latest");
    const ref_block = block.number - 1;
    const ref_block_ts = block.timestamp;

    //  the staker Voluntary Weighted Stake
    const stakerVWS = await stakingContract.getPriorWeightedStake(
      stakerAddress,
      ref_block,
      ref_block_ts,
    );

    return {
      votingPower: stakerVWS.toString(),
      isVesting: false,
    };
  } catch (error) {
    console.error(`Error getting voting power for ${stakerAddress}:`, error);
    throw error;
  }
}

async function getTotalVoluntaryVotingPower(
  addresses: StakingAddresses,
): Promise<{
  bob: { votingPower: string; isVesting: boolean };
  rsk: { votingPower: string; isVesting: boolean };
}> {
  try {
    // Get voting power from both chains in parallel
    const [bobVP, rskVP] = await Promise.all([
      getVoluntaryVotingPower(CHAIN_CONFIG.BOB, addresses.bob_staker),
      getVoluntaryVotingPower(CHAIN_CONFIG.RSK, addresses.rsk_staker),
    ]);

    return {
      bob: bobVP,
      rsk: rskVP,
    };
  } catch (error) {
    console.error("Error getting total voting power:", error);
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
    const votingPowers = await getTotalVoluntaryVotingPower(addresses);

    console.log("Voting Powers:");
    console.log("BOB Chain:", {
      address: addresses.bob_staker,
      ...votingPowers.bob,
      votingPower: ethers.utils.formatUnits(votingPowers.bob.votingPower, 18), // 18 decimals
    });
    console.log("RSK Chain:", {
      address: addresses.rsk_staker,
      ...votingPowers.rsk,
      votingPower: ethers.utils.formatUnits(votingPowers.rsk.votingPower, 18), // 18 decimals
    });
  } catch (error) {
    console.error("Error in main:", error);
  }
}

//sample run:
// ts-node scripts/staking/get_vp_voluntary_stake.ts 0x2bd2201bfe156a71eb0d02837172ffc237218505,0x91AB7f5Df554566a8cdD2CfC722D0AA031021684

main();
