pragma solidity ^0.5.17;

interface IStaking {
    function stakesBySchedule(
        uint amount,
        uint cliff,
        uint duration,
        uint intervalLength,
        address stakeFor,
        address delegatee
    )
    external;

    function stake(uint96 amount, uint until, address stakeFor, address delegatee) external;

    function getPriorTotalVotingPower(uint32 blockNumber, uint time) view external returns (uint96);

    function getPriorWeightedStake(address account, uint blockNumber, uint date) external view returns (uint96);

    function timestampToLockDate(uint timestamp) external view returns(uint lockDate);
}
