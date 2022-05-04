pragma solidity 0.5.17;

interface ILiquidityMiningV2 {
    function withdraw(
        address _poolToken,
        uint256 _amount,
        address _user
    ) external;

    function onTokensDeposited(address _user, uint256 _amount) external;

    function getUserPoolTokenBalance(address _poolToken, address _user)
        external
        view
        returns (uint256);

    function setPoolInfoRewardToken(
        address _poolToken,
        address _rewardToken,
        uint256 _lastRewardBlock,
        uint256 _accumulatedRewardPerShare
    ) external;

    function setRewardToken(
        address _rewardToken,
        uint256 _startBlock,
        uint256 _totalUsersBalance
    ) external;

    function setUserInfo(
        uint256 _poolId,
        address _user,
        address _rewardToken,
        uint256 _amount,
        uint256 _rewardDebt,
        uint256 _accumulatedReward
    ) external;

    function add(
        address _poolToken,
        address[] calldata _rewardTokens,
        uint96[] calldata _allocationPoints,
        bool _withUpdate
    ) external;

    function finishMigration() external;
}
