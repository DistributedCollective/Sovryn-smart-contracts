pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./Checkpoints.sol";

contract WeightedStaking is Checkpoints{
    
    /************* TOTAL VOTING POWER COMPUTATION ************************/
    
     /**
     * @notice computes the total voting power at a given time
     * @param time the timestamp for which to calculate the total voting power
     * @return the total voting power at the given time
     * */
    function getPriorTotalVotingPower(uint32 blockNumber, uint time) view public returns(uint96 totalVotingPower){
        //start the computation with the exact or previous unlocking date (voting weight remians the same until the next break point)
        uint start =  timestampToLockDate(time);
        uint end = start + maxDuration;
        
        //max 76 iterations
        for(uint i = start; i < end; i += twoWeeks){
            totalVotingPower = add96(totalVotingPower, _totalPowerByDate(i, start, blockNumber), "overflow on total voting power computation");
        }
    }
    
     /**
     * @notice computes the voting power for a secific date
     * @param date the staking date to compute the power for
     * @param startDate the date for which we need to know the power of the stake
     * @param blockNumber the block number. needed for checkpointing.
     * */
    function _totalPowerByDate(uint date, uint startDate, uint blockNumber) internal view returns(uint96 power){
        uint96 weight = _computeWeightByDate(date, startDate);
        uint96 staked = getPriorTotalStakesForDate(date, blockNumber);
        power = mul96(staked, weight, "multiplication overflow for voting power");
    }
    
    
    /**
     * @notice Determine the prior number of stake for an unlocking date as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param date The date to check the stakes for
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorTotalStakesForDate(uint date, uint blockNumber) public view returns (uint96) {
        require(blockNumber < block.number, "Staking::getPriorVotes: not yet determined");

        uint32 nCheckpoints = numTotalStakingCheckpoints[date];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (totalStakingCheckpoints[date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return totalStakingCheckpoints[date][nCheckpoints - 1].stake;
        }

        // Next check implicit zero balance
        if (totalStakingCheckpoints[date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = totalStakingCheckpoints[date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return totalStakingCheckpoints[date][lower].stake;
    }
    
    
    
    
    /****************************** DELEGATED VOTING POWER COMPUTATION ************************/
    
    /**
     * @notice Determine the prior number of votes for a delegatee as of a block number.
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     *      Used for Voting, not for fee sharing.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the delegatee had as of the given block
     */
     function getPriorVotes(address account, uint blockNumber, uint date) public view returns (uint96 votes) {
        //if date is not an exact break point, start weight computation from the previous break point (alternative would be the next)
        uint start =  timestampToLockDate(date);
        uint end = start + maxDuration;
        
        //max 76 iterations
        for(uint i = start; i < end; i += twoWeeks){
            votes = add96(votes, _totalPowerByDateForDelegatee(account, i, start, blockNumber), "overflow on total voting power computation");
        }
     }
    
    /**
     * @notice computes the voting power for a secific date
     * @param date the staking date to compute the power for
     * @param startDate the date for which we need to know the power of the stake
     * @param blockNumber the block number. needed for checkpointing.
     * */
    function _totalPowerByDateForDelegatee(address account, uint date, uint startDate, uint blockNumber) internal view returns(uint96 power){
        uint96 weight = _computeWeightByDate(date, startDate);
        uint96 staked = getPriorStakeByDateForDelegatee(account, date, blockNumber);
        power = mul96(staked, weight, "multiplication overflow for voting power");
    }
    
    /**
     * @notice Determine the prior number of stake for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorStakeByDateForDelegatee(address account, uint date, uint blockNumber) public view returns (uint96) {
        require(blockNumber < block.number, "Staking::getPriorStakeByDateForDelegatee: not yet determined");

        uint32 nCheckpoints = numDelegateStakingCheckpoints[account][date];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (delegateStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return delegateStakingCheckpoints[account][date][nCheckpoints - 1].stake;
        }

        // Next check implicit zero balance
        if (delegateStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = delegateStakingCheckpoints[account][date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return delegateStakingCheckpoints[account][date][lower].stake;
    }
 
    
    /*************************** User Weighted Stake computation for fee sharing *******************************/
    
     /**
     * @notice Determine the prior weighted stake for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     *      Used for fee sharing, not voting.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The weighted stake the account had as of the given block
     */
     function getPriorWeightedStake(address account, uint blockNumber, uint date) public view returns (uint96) {
         //if date is not an exact break point, start weight computation from the previous break point (alternative would be the next)
         uint startDate =  timestampToLockDate(date);
         (uint96 staked, uint96 until) = getPriorUserStakeAndDate(account, blockNumber);
         uint96 weight = _computeWeightByDate(until, startDate);
         return mul96(staked, weight, "Staking::getPriorVotes: multiplication overflow for voting power");
     }
     
     /**
     * @notice Determine the prior number of stake for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorUserStakeAndDate(address account, uint blockNumber) public view returns (uint96, uint96) {
        require(blockNumber < block.number, "Staking::getPriorUserStakeAndDate: not yet determined");

        uint32 nCheckpoints = numUserCheckpoints[account];
        if (nCheckpoints == 0) {
            return (0, 0);
        }

        // First check most recent balance
        if (userCheckpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return (userCheckpoints[account][nCheckpoints - 1].stake, userCheckpoints[account][nCheckpoints - 1].lockedUntil);
        }

        // Next check implicit zero balance
        if (userCheckpoints[account][0].fromBlock > blockNumber) {
            return (0, 0);
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            UserCheckpoint memory cp = userCheckpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return (cp.stake, cp.lockedUntil);
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return (userCheckpoints[account][lower].stake, userCheckpoints[account][lower].lockedUntil);
    }
    
    
    /**************** SHARED FUNCTIONS *********************/
    
    /**
     * @notice compute the weight for a specific date
     * @param date the unlocking date
     * @param startDate we compute the weight for the tokens staked until 'date' on 'startDate'
     * */
    function _computeWeightByDate(uint date, uint startDate) internal view returns(uint96 weight){
        require(date >= startDate, "date needs to be bigger than startDate");
        uint remainingTime = (date - startDate);
        require(maxDuration > remainingTime, "remaining time can't be bigger than max duration");
        // x = max days - remaining days
        uint96 x = uint96(maxDuration - remainingTime)/(1 days);
        weight = mul96(maxVotingWeight, sub96(maxDurationPow2, x*x, "underflow on weight calculation"), "multiplication overflow on weight computation") / maxDurationPow2 ;
    }
    
    /**
     * @notice unstaking is posisble every 2 weeks only. this means, to calculate the key value for the staking
     * checkpoints, we need to map the intended timestamp to the closest available date
     * @param timestamp the unlocking timestamp
     * @return the actual unlocking date (might be up to 2 weeks shorter than intended)
     * */
    function timestampToLockDate(uint timestamp) public view returns(uint lockDate){
        require(timestamp >= kickoffTS, "Staking::timestampToLockDate: timestamp lies before contract creation");
        //if staking timestamp does not match any of the unstaking dates, set the lockDate to the closest one before the timestamp
        //e.g. passed timestamps lies 7 weeks after kickoff -> only stake for 6 weeks
        uint periodFromKickoff = (timestamp - kickoffTS) / twoWeeks;
        lockDate = periodFromKickoff * twoWeeks + kickoffTS;
    }
    
}