pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./shared/StakingShared.sol";
import "../../../proxy/modules/interfaces/IFunctionsList.sol";

/**
 * @title Staking Vesting Module contract
 * @notice Implements interaction with Vesting functionality: vesting registry, vesting staking
 * */
contract StakingVestingModule is IFunctionsList, StakingShared {
    event ContractCodeHashAdded(bytes32 hash);
    event ContractCodeHashRemoved(bytes32 hash);
    event VestingStakeSet(uint256 lockedTS, uint96 value);

    /**
     * @notice sets vesting registry
     * @param _vestingRegistryProxy the address of vesting registry proxy contract
     * @dev _vestingRegistryProxy can be set to 0 as this function can be reused by
     * various other functionalities without the necessity of linking it with Vesting Registry
     */
    function setVestingRegistry(address _vestingRegistryProxy) external onlyOwner whenNotFrozen {
        vestingRegistryLogic = IVestingRegistry(_vestingRegistryProxy);
    }

    /**
     * @notice Sets the users' vesting stakes for a giving lock dates and writes checkpoints.
     * @param lockedDates The arrays of lock dates.
     * @param values The array of values to add to the staked balance.
     * TODO: remove - it was designed as a disposable function to initialize vesting checkpoints
     */
    function setVestingStakes(uint256[] calldata lockedDates, uint96[] calldata values)
        external
        onlyAuthorized
        whenNotFrozen
    {
        require(lockedDates.length == values.length, "arrays mismatch"); // WS05

        uint256 length = lockedDates.length;
        for (uint256 i = 0; i < length; i++) {
            _setVestingStake(lockedDates[i], values[i]);
        }
    }

    /**
     * @notice Sets the users' vesting stake for a giving lock date and writes a checkpoint.
     * @param lockedTS The lock date.
     * @param value The value to be set.
     * TODO: remove - it was designed as a disposable function to initialize vesting checkpoints
     */
    function _setVestingStake(uint256 lockedTS, uint96 value) internal {
        require(
            lockedTS > kickoffTS,
            "Invalid lock dates: must greater than contract creation timestamp"
        );

        // locked date must be multiples of 14 days / TWO_WEEKS
        require(
            (lockedTS - kickoffTS) % TWO_WEEKS == 0,
            "Invalid lock dates: not multiples of 14 days"
        );

        // locked date must not exceed the MAX_DURATION
        require(
            lockedTS - block.timestamp <= MAX_DURATION,
            "Invalid lock dates: exceed max duration"
        );

        // the value must not exceed the total staked at the given locked date
        uint32 nStakeCheckpoints = numTotalStakingCheckpoints[lockedTS];
        uint96 totalStaked = totalStakingCheckpoints[lockedTS][nStakeCheckpoints - 1].stake;
        require(
            value <= totalStaked,
            "Invalid stake amount: greater than the total staked for given date"
        );

        uint32 nCheckpoints = numVestingCheckpoints[lockedTS];
        uint32 blockNumber;

        Checkpoint memory recentCP = vestingCheckpoints[lockedTS][nCheckpoints - 1];
        if (nCheckpoints == 0) blockNumber = uint32(block.number) - 1;
        else blockNumber = recentCP.fromBlock + 1;

        vestingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, value);
        numVestingCheckpoints[lockedTS] = nCheckpoints + 1;

        emit VestingStakeSet(lockedTS, value);
    }

    /**
     * @notice Determine the prior number of stake for an account until a
     * certain lock date as of a block number.
     * @dev Block number must be a finalized block or else this function
     * will revert to prevent misinformation.
     * @param account The address of the account to check.
     * @param date The lock date. Adjusted to the next valid lock date, if necessary.
     * @param blockNumber The block number to get the vote balance at.
     * @return The number of votes the account had as of the given block.
     * */
    function getPriorUserStakeByDate(
        address account,
        uint256 date,
        uint256 blockNumber
    ) external view returns (uint96) {
        uint96 priorStake = _getPriorUserStakeByDate(account, date, blockNumber);
        // @dev we need to modify function in order to workaround issue with Vesting.withdrawTokens:
        //		return 1 instead of 0 if message sender is a contract.
        if (priorStake == 0 && _isVestingContract(msg.sender)) {
            priorStake = 1;
        }
        return priorStake;
    }

    /*************************** Weighted Vesting Stake computation for fee sharing *******************************/

    /**
     * @notice Determine the prior weighted vested amount for an account as of a block number.
     * Iterate through checkpoints adding up voting power.
     * @dev Block number must be a finalized block or else this function will
     * revert to prevent misinformation.
     *      Used for fee sharing, not voting.
     * TODO: WeightedStaking::getPriorVestingWeightedStake is using the variable name "votes"
     * to add up token stake, and that could be misleading.
     *
     * @param blockNumber The block number to get the vote balance at.
     * @param date The staking date to compute the power for.
     * @return The weighted stake the account had as of the given block.
     * */
    function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)
        external
        view
        returns (uint96 votes)
    {
        /// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
        uint256 start = _timestampToLockDate(date);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            uint96 weightedStake = _weightedVestingStakeByDate(i, start, blockNumber);
            if (weightedStake > 0) {
                votes = add96(votes, weightedStake, "overflow on total weight"); // WS15
            }
        }
    }

    /**
     * @notice Compute the voting power for a specific date.
     * Power = stake * weight
     * @param date The staking date to compute the power for. Adjusted to the previous valid lock date, if necessary.
     * @param startDate The date for which we need to know the power of the stake. Adjusted to the previous valid lock date, if necessary.
     * @param blockNumber The block number, needed for checkpointing.
     * @return The stacking power.
     * */
    function weightedVestingStakeByDate(
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) external view returns (uint96 power) {
        date = _timestampToLockDate(date);
        startDate = _timestampToLockDate(startDate);
        power = _weightedVestingStakeByDate(date, startDate, blockNumber);
    }

    /**
     * @notice Compute the voting power for a specific date.
     * Power = stake * weight
     * @param date The staking date to compute the power for.
     * @param startDate The date for which we need to know the power of the stake.
     * @param blockNumber The block number, needed for checkpointing.
     * @return The stacking power.
     * */
    function _weightedVestingStakeByDate(
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) internal view returns (uint96 power) {
        uint96 staked = _getPriorVestingStakeByDate(date, blockNumber);
        if (staked > 0) {
            uint96 weight = _computeWeightByDate(date, startDate);
            power = mul96(staked, weight, "mul oveflow") / WEIGHT_FACTOR; // WS16
        } else {
            power = 0;
        }
    }

    /**
     * @notice Determine the prior number of vested stake for an account until a
     * certain lock date as of a block number.
     * @dev Block number must be a finalized block or else this function
     * will revert to prevent misinformation.
     * @param date The lock date. Adjusted to the next valid lock date, if necessary.
     * @param blockNumber The block number to get the vote balance at.
     * @return The number of votes the account had as of the given block.
     * */
    function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)
        external
        view
        returns (uint96)
    {
        date = _adjustDateForOrigin(date);
        return _getPriorVestingStakeByDate(date, blockNumber);
    }

    /**
     * @notice Determine the prior number of vested stake for an account until a
     * 		certain lock date as of a block number.
     * @dev All functions of Staking contract use this internal version,
     * 		we need to modify public function in order to workaround issue with Vesting.withdrawTokens:
     * return 1 instead of 0 if message sender is a contract.
     * @param date The lock date.
     * @param blockNumber The block number to get the vote balance at.
     * @return The number of votes the account had as of the given block.
     * */
    function _getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)
        internal
        view
        returns (uint96)
    {
        require(blockNumber < _getCurrentBlockNumber(), "not determined"); // WS17

        uint32 nCheckpoints = numVestingCheckpoints[date];
        if (nCheckpoints == 0) {
            return 0;
        }

        /// @dev First check most recent balance.
        if (vestingCheckpoints[date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return vestingCheckpoints[date][nCheckpoints - 1].stake;
        }

        /// @dev Next check implicit zero balance.
        if (vestingCheckpoints[date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
            Checkpoint memory cp = vestingCheckpoints[date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return vestingCheckpoints[date][lower].stake;
    }

    /**
     * @notice Add vesting contract's code hash to a map of code hashes.
     * @param vesting The address of Vesting contract.
     * @dev We need it to use isVestingContract() function instead of isContract()
     */
    function addContractCodeHash(address vesting) external onlyAuthorized whenNotFrozen {
        bytes32 codeHash = _getCodeHash(vesting);
        vestingCodeHashes[codeHash] = true;
        emit ContractCodeHashAdded(codeHash);
    }

    /**
     * @notice Remove vesting contract's code hash to a map of code hashes.
     * @param vesting The address of Vesting contract.
     * @dev We need it to use isVestingContract() function instead of isContract()
     */
    function removeContractCodeHash(address vesting) external onlyAuthorized whenNotFrozen {
        bytes32 codeHash = _getCodeHash(vesting);
        require(vestingCodeHashes[codeHash], "not a registered vesting code hash");
        vestingCodeHashes[codeHash] = false;
        emit ContractCodeHashRemoved(codeHash);
    }

    /**
     * @notice Return flag whether the given address is a registered vesting contract.
     * @param stakerAddress the address to check
     */
    function isVestingContract(address stakerAddress) external view returns (bool) {
        bool isVesting;
        bytes32 codeHash = _getCodeHash(stakerAddress);
        if (address(vestingRegistryLogic) != address(0)) {
            isVesting = vestingRegistryLogic.isVestingAddress(stakerAddress);
        }

        if (isVesting) return true;
        if (vestingCodeHashes[codeHash]) return true;
        return false;
    }

    /**
     * @notice Return hash of contract code
     */
    function _getCodeHash(address _contract) internal view returns (bytes32) {
        bytes32 codeHash;
        assembly {
            codeHash := extcodehash(_contract)
        }
        return codeHash;
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](9);
        functionsList[0] = this.setVestingRegistry.selector;
        functionsList[1] = this.setVestingStakes.selector;
        functionsList[2] = this.getPriorUserStakeByDate.selector;
        functionsList[3] = this.getPriorVestingWeightedStake.selector;
        functionsList[4] = this.getPriorVestingStakeByDate.selector;
        functionsList[5] = this.addContractCodeHash.selector;
        functionsList[6] = this.removeContractCodeHash.selector;
        functionsList[7] = this.isVestingContract.selector;
        functionsList[8] = this.weightedVestingStakeByDate.selector;
        return functionsList;
    }
}
