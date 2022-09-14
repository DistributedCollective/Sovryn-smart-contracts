pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./StakingStorageShared.sol";
import "../../SafeMath96.sol";
import "../../../../openzeppelin/SafeMath.sol";
import "../../../../openzeppelin/Ownable.sol";

/**
 * @title Staking modules shared functionality
 */
contract StakingShared is StakingStorageShared, SafeMath96 {
    using SafeMath for uint256;

    uint256 internal constant FOUR_WEEKS = 4 weeks;

    /**
     * @dev Throws if paused.
     */
    modifier whenNotPaused() {
        require(!paused, "paused"); // SS03
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner or admin.
     */
    modifier onlyAuthorized() {
        require(isOwner() || admins[msg.sender], "unauthorized"); // SS01
        _;
    }

    /**
	 * @dev Throws if called by any account other than the owner or admin or pauser.
	 
	modifier onlyAuthorizedOrPauser() {
		require(isOwner() || admins[msg.sender] || pausers[msg.sender], "unauthorized"); // WS02
		_;
	}
	*/

    /**
     * @dev Throws if called by any account other than the owner or pauser.
     */
    modifier onlyPauserOrOwner() {
        require(isOwner() || pausers[msg.sender], "unauthorized"); // SS02
        _;
    }

    /**
     * @dev Throws if called by any account other than pauser.
     * @notice Uncomment when needed
     */
    /*
	modifier onlyPauser() {
		require(pausers[msg.sender], "Not pauser");
		_;
	}
	*/

    /**
     * @dev Throws if frozen.
     */
    modifier whenNotFrozen() {
        require(!frozen, "paused"); // SS04
        _;
    }

    constructor() internal {
        // abstract
    }

    function _notSameBlockAsStakingCheckpoint(uint256 lockDate) internal view {
        uint32 nCheckpoints = numUserStakingCheckpoints[msg.sender][lockDate];
        bool notSameBlock =
            userStakingCheckpoints[msg.sender][lockDate][nCheckpoints - 1].fromBlock !=
                block.number;
        require(notSameBlock, "cannot be mined in the same block as last stake"); // S20
    }

    /**
     * @notice Unstaking is possible every 2 weeks only. This means, to
     * calculate the key value for the staking checkpoints, we need to
     * map the intended timestamp to the closest available date.
     * @param timestamp The unlocking timestamp.
     * @return The actual unlocking date (might be up to 2 weeks shorter than intended).
     * */
    function _timestampToLockDate(uint256 timestamp) internal view returns (uint256 lockDate) {
        require(timestamp >= kickoffTS, "timestamp < contract creation"); // WS23
        /**
         * @dev If staking timestamp does not match any of the unstaking dates
         * , set the lockDate to the closest one before the timestamp.
         * E.g. Passed timestamps lies 7 weeks after kickoff -> only stake for 6 weeks.
         * */
        uint256 periodFromKickoff = (timestamp - kickoffTS) / TWO_WEEKS;
        lockDate = periodFromKickoff * TWO_WEEKS + kickoffTS;
    }

    /**
     * @notice Determine the current Block Number
     * @dev This is segregated from the _getPriorUserStakeByDate function to better test
     * advancing blocks functionality using Mock Contracts
     * */
    function _getCurrentBlockNumber() internal view returns (uint256) {
        return block.number;
    }

    /**
     * @notice Determine the prior number of stake for an account until a
     * 		certain lock date as of a block number.
     * @dev All functions of Staking contract use this internal version,
     * 		we need to modify public function in order to workaround issue with Vesting.withdrawTokens:
     * return 1 instead of 0 if message sender is a contract.
     * @param account The address of the account to check.
     * @param date The lock date.
     * @param blockNumber The block number to get the vote balance at.
     * @return The number of votes the account had as of the given block.
     * */
    function _getPriorUserStakeByDate(
        address account,
        uint256 date,
        uint256 blockNumber
    ) internal view returns (uint96) {
        require(blockNumber < _getCurrentBlockNumber(), "not determined"); // WS14

        date = _adjustDateForOrigin(date);
        uint32 nCheckpoints = numUserStakingCheckpoints[account][date];
        if (nCheckpoints == 0) {
            return 0;
        }

        /// @dev First check most recent balance.
        if (userStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return userStakingCheckpoints[account][date][nCheckpoints - 1].stake;
        }

        /// @dev Next check implicit zero balance.
        if (userStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
            Checkpoint memory cp = userStakingCheckpoints[account][date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return userStakingCheckpoints[account][date][lower].stake;
    }

    /**
     * @dev origin vesting contracts have different dates
     * we need to add 2 weeks to get end of period (by default, it's start)
     * @param date The staking date to compute the power for.
     * @return unlocking date.
     */
    function _adjustDateForOrigin(uint256 date) internal view returns (uint256) {
        uint256 adjustedDate = _timestampToLockDate(date);
        //origin vesting contracts have different dates
        //we need to add 2 weeks to get end of period (by default, it's start)
        if (adjustedDate != date) {
            date = adjustedDate + TWO_WEEKS;
        }
        return date;
    }

    /**
     * @notice Compute the weight for a specific date.
     * @param date The unlocking date.
     * @param startDate We compute the weight for the tokens staked until 'date' on 'startDate'.
     * @return The weighted stake the account had as of the given block.
     * */
    function _computeWeightByDate(uint256 date, uint256 startDate)
        internal
        pure
        returns (uint96 weight)
    {
        require(date >= startDate, "date < startDate"); // WS18
        uint256 remainingTime = (date - startDate);
        require(MAX_DURATION >= remainingTime, "remaining time < max duration"); // WS19
        /// @dev x = max days - remaining days
        uint96 x = uint96(MAX_DURATION - remainingTime) / (1 days);
        /// @dev w = (m^2 - x^2)/m^2 +1 (multiplied by the weight factor)
        weight = add96(
            WEIGHT_FACTOR,
            mul96(
                MAX_VOTING_WEIGHT * WEIGHT_FACTOR,
                sub96(
                    MAX_DURATION_POW_2,
                    x * x,
                    "WS20" /* weight underflow */
                ),
                "WS21" /* weight mul overflow */
            ) / MAX_DURATION_POW_2,
            "WS22" /* overflow on weight */
        );
    }

    /**
     * @notice Return flag whether the given address is a registered vesting contract.
     * @param stakerAddress the address to check
     */
    function _isVestingContract(address stakerAddress) internal view returns (bool) {
        bool isVesting;
        bytes32 codeHash;

        assembly {
            codeHash := extcodehash(stakerAddress)
        }
        if (address(vestingRegistryLogic) != address(0)) {
            isVesting = vestingRegistryLogic.isVestingAddress(stakerAddress);
        }

        if (isVesting) return true;
        if (vestingCodeHashes[codeHash]) return true;
        return false;
    }
}
