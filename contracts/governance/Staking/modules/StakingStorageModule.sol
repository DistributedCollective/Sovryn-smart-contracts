pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../StakingStorageShared.sol";

/**
 * @title Staking Storage Module - access to public storage variables
 **/
contract StakingSorageModule is StakingStorageShared {
    function getStorageDefaultWeightScaling() external pure returns (uint256) {
        return uint256(DEFAULT_WEIGHT_SCALING);
    }

    /// @notice The maximum duration to stake tokens
    function getStorageMaxDurationToStakeTokens() external pure returns (uint256) {
        return uint256(MAX_DURATION);
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

    function _getFunctionList() internal pure returns (bytes4[] memory) {
        bytes4[] memory functionList = new bytes4[](30);
        functionList[0] = this.getStorageMaxDurationToStakeTokens.selector;
        functionList[1] = this.getStorageMaxVotingWeight.selector;
        functionList[2] = this.getStorageWeightFactor.selector;
        functionList[3] = this.getStorageDefaulWeightScaling.selector;
        functionList[4] = this.getStorageRangeForWeighScaling.selector;
        functionList[5] = this.getStorageDomainTypehash.selector;
        functionList[6] = this.getStorageDelegationTypehash.selector;
        functionList[7] = this.getStorageName.selector;
        functionList[8] = this.kickoffTS.selector;
        functionList[9] = this.SOVToken.selector;
        functionList[10] = this.delegates.selector;
        functionList[11] = this.allUnlocked.selector;
        functionList[12] = this.newStakingContract.selector;
        functionList[13] = this.totalStakingCheckpoints.selector;
        functionList[14] = this.numTotalStakingCheckpoints.selector;
        functionList[15] = this.delegateStakingCheckpoints.selector;
        functionList[16] = this.numDelegateStakingCheckpoints.selector;
        functionList[17] = this.userStakingCheckpoints.selector;
        functionList[18] = this.numUserStakingCheckpoints.selector;
        functionList[19] = this.nonces.selector;
        functionList[20] = this.feeSharing.selector;
        functionList[21] = this.weightScaling.selector;
        functionList[22] = this.vestingWhitelist.selector;
        functionList[23] = this.admins.selector;
        functionList[24] = this.vestingCodeHashes.selector;
        functionList[25] = this.vestingCheckpoints.selector;
        functionList[26] = this.numVestingCheckpoints.selector;
        functionList[27] = this.vestingRegistryLogic.selector;
        functionList[28] = this.pausers.selector;
        functionList[29] = this.paused.selector;
        functionList[30] = this.frozen.selector;

        return functionList;
    }
}
