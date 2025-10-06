pragma solidity ^0.5.17;

/**
 * @title Simple Staking Mock for FeeSharingCollector tests
 * @notice This contract provides minimal mock functionality for staking contract
 * to be used with FeeSharingCollector in tests
 */
contract StakingMockForFeeSharingCollector {
    /**
     * @notice Mock implementation of getPriorWeightedStake
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @param date The date/timestamp of the unstaking time
     * @return Always returns 0 for testing purposes
     */
    function getPriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96) {
        return 0; // Return 0 for testing - no weighted stake
    }

    /**
     * @notice Mock implementation of getPriorVestingWeightedStake
     * @param blockNumber The block number
     * @param date The date/timestamp
     * @return Always returns 0 for testing purposes
     */
    function getPriorVestingWeightedStake(
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96) {
        return 0; // Return 0 for testing - no vesting weighted stake
    }

    /**
     * @notice Mock implementation of getPriorTotalVotingPower
     * @param blockNumber The block number
     * @param timestamp The timestamp
     * @return Always returns 1 for testing purposes (must be > 0)
     */
    function getPriorTotalVotingPower(
        uint32 blockNumber,
        uint256 timestamp
    ) external view returns (uint96) {
        return 1; // Return 1 for testing - minimal positive voting power to pass validation
    }
}
