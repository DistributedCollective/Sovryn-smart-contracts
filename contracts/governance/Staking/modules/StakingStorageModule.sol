pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../../proxy/modules/interfaces/IFunctionsList.sol";
import "./shared/StakingStorageShared.sol";

/**
 * @title Staking Storage Module
 * @notice Provides getters for public storage variables
 **/
contract StakingStorageModule is IFunctionsList, StakingStorageShared {
    function getStorageDefaultWeightScaling() external pure returns (uint256) {
        return uint256(DEFAULT_WEIGHT_SCALING);
    }

    /// @notice The maximum duration to stake tokens
    /// @return MAX_DURATION to stake tokens
    function getStorageMaxDurationToStakeTokens() external pure returns (uint256) {
        return MAX_DURATION;
    }

    /// @notice The maximum possible voting weight before adding +1 (actually 10, but need 9 for computation).
    function getStorageMaxVotingWeight() external pure returns (uint256) {
        return uint256(MAX_VOTING_WEIGHT);
    }

    /// @notice weight is multiplied with this factor (for allowing decimals, like 1.2x).
    /// @dev MAX_VOTING_WEIGHT * WEIGHT_FACTOR needs to be < 792, because there are 100,000,000 SOV with 18 decimals
    function getStorageWeightFactor() external pure returns (uint256) {
        return uint256(WEIGHT_FACTOR);
    }

    /// @notice Default weight scaling.
    function getStorageDefaulWeightScaling() external pure returns (uint256) {
        return uint256(DEFAULT_WEIGHT_SCALING);
    }

    function getStorageRangeForWeighScaling()
        external
        pure
        returns (uint256 minWeightScaling, uint256 maxWeightScaling)
    {
        return (uint256(MIN_WEIGHT_SCALING), uint256(MAX_WEIGHT_SCALING));
    }

    /// @notice The EIP-712 typehash for the contract's domain.
    function getStorageDomainTypehash() external pure returns (uint256) {
        return uint256(DOMAIN_TYPEHASH);
    }

    /// @notice The EIP-712 typehash for the delegation struct used by the contract.
    function getStorageDelegationTypehash() external pure returns (uint256) {
        return uint256(DELEGATION_TYPEHASH);
    }

    function getStorageName() external view returns (string memory) {
        return name;
    }

    /**
     * @notice Max iteration for direct withdrawal from staking to prevent out of gas issue.
     *
     * @return max iteration value.
     */
    function getMaxVestingWithdrawIterations() public view returns (uint256) {
        return maxVestingWithdrawIterations;
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](32);
        functionsList[0] = this.getStorageMaxDurationToStakeTokens.selector;
        functionsList[1] = this.getStorageMaxVotingWeight.selector;
        functionsList[2] = this.getStorageWeightFactor.selector;
        functionsList[3] = this.getStorageDefaulWeightScaling.selector;
        functionsList[4] = this.getStorageRangeForWeighScaling.selector;
        functionsList[5] = this.getStorageDomainTypehash.selector;
        functionsList[6] = this.getStorageDelegationTypehash.selector;
        functionsList[7] = this.getStorageName.selector;
        functionsList[8] = this.kickoffTS.selector;
        functionsList[9] = this.SOVToken.selector;
        functionsList[10] = this.delegates.selector;
        functionsList[11] = this.allUnlocked.selector;
        functionsList[12] = this.newStakingContract.selector;
        functionsList[13] = this.totalStakingCheckpoints.selector;
        functionsList[14] = this.numTotalStakingCheckpoints.selector;
        functionsList[15] = this.delegateStakingCheckpoints.selector;
        functionsList[16] = this.numDelegateStakingCheckpoints.selector;
        functionsList[17] = this.userStakingCheckpoints.selector;
        functionsList[18] = this.numUserStakingCheckpoints.selector;
        functionsList[19] = this.nonces.selector;
        functionsList[20] = this.feeSharing.selector;
        functionsList[21] = this.weightScaling.selector;
        functionsList[22] = this.vestingWhitelist.selector;
        functionsList[23] = this.admins.selector;
        functionsList[24] = this.vestingCodeHashes.selector;
        functionsList[25] = this.vestingCheckpoints.selector;
        functionsList[26] = this.numVestingCheckpoints.selector;
        functionsList[27] = this.vestingRegistryLogic.selector;
        functionsList[28] = this.pausers.selector;
        functionsList[29] = this.paused.selector;
        functionsList[30] = this.frozen.selector;
        functionsList[31] = this.getMaxVestingWithdrawIterations.selector;

        return functionsList;
    }
}
