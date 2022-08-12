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

    function allUnlocked() external view returns (bool);

    function newStakingContract() external view returns (address);

    function getPriorUserStakeByDate(
        address account,
        uint256 date,
        uint256 blockNumber
    ) external view returns (uint96);

    function governanceWithdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external;

    function withdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external;

    function migrateToNewStakingContract() external;

    function delegate(address delegatee, uint256 lockDate) external;

    function MAX_DURATION() external view returns (uint256);
}
