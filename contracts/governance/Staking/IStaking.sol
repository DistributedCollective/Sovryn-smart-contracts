pragma solidity ^0.5.17;

/**
 * @title Interface for contract governance/Staking/Staking.sol
 * @dev Interfaces are used to cast a contract address into a callable instance.
 */
interface IStaking {
    function stakesBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) external;

    function stake(
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external;

    function getPriorVotes(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96);

    function getPriorTotalVotingPower(uint32 blockNumber, uint256 time)
        external
        view
        returns (uint96);

    function getPriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96);

    function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)
        external
        view
        returns (uint96);

    function timestampToLockDate(uint256 timestamp) external view returns (uint256 lockDate);

    function isVestingContract(address stakerAddress) external view returns (bool);
}
