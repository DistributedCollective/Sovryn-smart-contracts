pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../CheckpointsShared.sol";
import "../StakingShared.sol";
import "../../../proxy/modules/interfaces/IFunctionsList.sol";

/**
 * @title Weighted Staking module contract.
 * @notice Implements getters for weighted staking functionality
 * */
contract WeightedStakingModule is IFunctionsList, StakingShared, CheckpointsShared {
    /*************************** User Weighted Stake computation for fee sharing *******************************/

    /**
     * @notice Determine the prior weighted stake for an account as of a block number.
     * Iterate through checkpoints adding up voting power.
     * @dev Block number must be a finalized block or else this function will
     * revert to prevent misinformation.
     *      Used for fee sharing, not voting.
     *
     * @param account The address of the account to check.
     * @param blockNumber The block number to get the vote balance at.
     * @param date The date/timestamp of the unstaking time.
     * @return The weighted stake the account had as of the given block.
     * */
    function getPriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) external view returns (uint96 priorWeightedStake) {
        return _getPriorWeightedStake(account, blockNumber, date);
    }

    function _getPriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) internal view returns (uint96 priorWeightedStake) {
        /// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
        uint256 start = _timestampToLockDate(date);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            uint96 weightedStake = weightedStakeByDate(account, i, start, blockNumber);
            if (weightedStake > 0) {
                priorWeightedStake = add96(priorWeightedStake, weightedStake, "WS12"); // overflow on total weight
            }
        }
    }

    /**
     * @notice Compute the voting power for a specific date.
     * Power = stake * weight
     * TODO: WeightedStaking::weightedStakeByDate should probably better
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
    ) public view returns (uint96 power) {
        uint96 staked = _getPriorUserStakeByDate(account, date, blockNumber);
        if (staked > 0) {
            uint96 weight = _computeWeightByDate(date, startDate);
            power = mul96(staked, weight, "WS13") / WEIGHT_FACTOR; // overflow
        } else {
            power = 0;
        }
    }

    /**
     * @notice Compute the weight for a specific date.
     * @param date The unlocking date.
     * @param startDate We compute the weight for the tokens staked until 'date' on 'startDate'.
     * @return The weighted stake the account had as of the given block.
     * */
    function computeWeightByDate(uint256 date, uint256 startDate)
        public
        pure
        returns (uint96 weight)
    {
        return _computeWeightByDate(date, startDate);
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](3);
        functionsList[0] = this.getPriorWeightedStake.selector;
        functionsList[1] = this.weightedStakeByDate.selector;
        functionsList[2] = this.computeWeightByDate.selector;
        return functionsList;
    }
}
