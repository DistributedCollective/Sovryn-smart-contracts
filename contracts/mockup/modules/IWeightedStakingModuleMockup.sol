pragma solidity ^0.5.17;

import "../../governance/Staking/modules/WeightedStakingModule.sol";

contract IWeightedStakingModuleMockup {
    function MOCK_priorWeightedStake(uint96 _priorWeightedStake) external;

    function MOCK_priorWeightedStakeAtBlock(uint96 _priorWeightedStake, uint256 _block) external;

    function getPriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96);

    function calculatePriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external;

    /**
     * @dev We need this function to simulate zero delegate checkpoint value.
     */
    function setDelegateStake(
        address delegatee,
        uint256 lockedTS,
        uint96 value
    ) external;

    /**
     * @notice Compute the voting power for a specific date.
     * Power = stake * weight
     * be internal instead of a public function.
     * @param account The user address.
     * @param date The staking date to compute the power for.
     * @param startDate The date for which we need to know the power of the stake.
     * @param blockNumber The block number, needed for checkpointing.
     * @return The stacking power.
     * */
    function weightedStakeByDate(
        address account,
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) external view returns (uint96 power);

    /**
     * @notice Compute the weight for a specific date.
     * @param date The unlocking date.
     * @param startDate We compute the weight for the tokens staked until 'date' on 'startDate'.
     * @return The weighted stake the account had as of the given block.
     * */
    function computeWeightByDate(uint256 date, uint256 startDate)
        external
        pure
        returns (uint96 weight);

    /**
     * @notice Receives approval from SOV token.
     * @param _data The data will be used for low level call.
     */
    function receiveApproval(
        address _sender,
        uint256 _amount,
        address _token,
        bytes calldata _data
    ) external;
}
