pragma solidity ^0.5.17;

import "./StakingRewardsStorage.sol";
import "../../openzeppelin/SafeMath.sol";
import "../../openzeppelin/Address.sol";

/**
 * @title Staking Rewards Contract.
 * @notice This is a trial incentive program.
 * In this, the SOV emitted and becoming liquid from the Adoption Fund could be utilized
 * to offset the higher APY's offered for Liquidity Mining events.
 * Vesting contract stakes are excluded from these rewards.
 * Only wallets which have staked previously liquid SOV are eligible for these rewards.
 * Tokenholders who stake their SOV receive staking rewards, a pro-rata share
 * of the revenue that the platform generates from various transaction fees
 * plus revenues from stakers who have a portion of their SOV slashed for
 * early unstaking.
 * */
contract StakingRewards is StakingRewardsStorage {
    using SafeMath for uint256;

    /// @notice Emitted when SOV is withdrawn
    /// @param receiver The address which recieves the SOV
    /// @param amount The amount withdrawn from the Smart Contract
    event RewardWithdrawn(address indexed receiver, uint256 amount);

    /**
     * @notice Replacement of constructor by initialize function for Upgradable Contracts
     * This function will be called only once by the owner.
     * @param _SOV SOV token address
     * @param _staking StakingProxy address should be passed
     * */
    function initialize(address _SOV, IStaking _staking) external onlyOwner {
        require(_SOV != address(0), "Invalid SOV Address.");
        require(Address.isContract(_SOV), "_SOV not a contract");
        SOV = IERC20(_SOV);
        staking = _staking;
        startTime = staking.timestampToLockDate(block.timestamp);
        setMaxDuration(15 * TWO_WEEKS);
        deploymentBlock = _getCurrentBlockNumber();
    }

    /**
     * @notice Stops the current rewards program.
     * @dev All stakes existing on the contract at the point in time of
     * cancellation continue accruing rewards until the end of the staking
     * period being rewarded
     * */
    function stop() external onlyOwner {
        require(stopBlock == 0, "Already stopped");
        stopBlock = _getCurrentBlockNumber();
    }

    /**
     * @notice Collect rewards
     * @dev User calls this function to collect SOV staking rewards as per the SIP-0024 program.
     * The weighted stake is calculated using getPriorWeightedStake. Block number sent to the functon
     * must be a finalised block, hence we deduct 1 from the current block. User is only allowed to withdraw
     * after intervals of 14 days.
     * @param restartTime The time from which the staking rewards calculation shall restart.
     * The issue is that we can only run for a max duration and if someone stakes for the
     * first time after the max duration is over, the reward will always return 0. Thus, we need to restart
     * from the duration that elapsed without generating rewards.
     * */
    function collectReward(uint256 restartTime) external {
        (uint256 withdrawalTime, uint256 amount) = getStakerCurrentReward(true, restartTime);
        require(withdrawalTime > 0 && amount > 0, "no valid reward");
        withdrawals[msg.sender] = withdrawalTime;
        _payReward(msg.sender, amount);
    }

    /**
     * @notice Withdraws all token from the contract by Multisig.
     * @param _receiverAddress The address where the tokens has to be transferred.
     */
    function withdrawTokensByOwner(address _receiverAddress) external onlyOwner {
        uint256 value = SOV.balanceOf(address(this));
        _transferSOV(_receiverAddress, value);
    }

    /**
     * @notice Changes average block time - based on blockchain
     * @dev If average block time significantly changes, we can update it here and use for block number calculation
     */
    function setAverageBlockTime(uint256 _averageBlockTime) external onlyOwner {
        averageBlockTime = _averageBlockTime;
    }

    /**
     * @notice This function computes the last staking checkpoint and calculates the corresponding
     * block number using the average block time which is then added to the mapping `checkpointBlockDetails`.
     */
    function setBlock() external {
        uint256 lastCheckpointTime = staking.timestampToLockDate(block.timestamp);
        _setBlock(lastCheckpointTime);
    }

    /**
     * @notice This function computes the block number using the average block time for a given historical
     * checkpoint which is added to the mapping `checkpointBlockDetails`.
     * @param _time Exact staking checkpoint time
     */
    function setHistoricalBlock(uint256 _time) external {
        _setBlock(_time);
    }

    /**
     * @notice Sets the max duration
     * @dev Rewards can be collected for a maximum duration at a time. This
     * is to avoid Block Gas Limit failures. Setting it zero would mean that it will loop
     * through the entire duration since the start of rewards program.
     * It should ideally be set to a value, for which the rewards can be easily processed.
     * @param _duration Max duration for which rewards can be collected at a go (in seconds)
     * */
    function setMaxDuration(uint256 _duration) public onlyOwner {
        maxDuration = _duration;
    }

    /**
     * @notice Internal function to calculate weighted stake
     * @dev If the rewards program is stopped, the user will still continue to
     * earn till the end of staking period based on the stop block.
     * @param _staker Staker address
     * @param _block Last finalised block
     * @param _date The date to compute prior weighted stakes
     * @return The weighted stake
     * */
    function _computeRewardForDate(
        address _staker,
        uint256 _block,
        uint256 _date
    ) internal view returns (uint256 weightedStake) {
        weightedStake = staking.getPriorWeightedStake(_staker, _block, _date);
        if (stopBlock > 0) {
            uint256 previousWeightedStake =
                staking.getPriorWeightedStake(_staker, stopBlock, _date);
            if (previousWeightedStake < weightedStake) {
                weightedStake = previousWeightedStake;
            }
        }
    }

    /**
     * @notice Internal function to pay rewards
     * @dev Base rate is annual, but we pay interest for 14 days,
     * which is 1/26 of one staking year (1092 days)
     * @param _staker User address
     * @param amount the reward amount
     * */
    function _payReward(address _staker, uint256 amount) internal {
        require(SOV.balanceOf(address(this)) >= amount, "not enough funds to reward user");
        claimedBalances[_staker] = claimedBalances[_staker].add(amount);
        _transferSOV(_staker, amount);
    }

    /**
     * @notice transfers SOV tokens to given address
     * @param _receiver the address of the SOV receiver
     * @param _amount the amount to be transferred
     */
    function _transferSOV(address _receiver, uint256 _amount) internal {
        require(_amount != 0, "amount invalid");
        require(SOV.transfer(_receiver, _amount), "transfer failed");
        emit RewardWithdrawn(_receiver, _amount);
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
     * @notice Internal function to calculate and set block
     * */
    function _setBlock(uint256 _checkpointTime) internal {
        uint256 currentTS = block.timestamp;
        uint256 lastFinalisedBlock = _getCurrentBlockNumber() - 1;
        require(checkpointBlockDetails[_checkpointTime] == 0, "block number already set");
        uint256 checkpointBlock =
            lastFinalisedBlock.sub(((currentTS.sub(_checkpointTime)).div(averageBlockTime)));
        checkpointBlockDetails[_checkpointTime] = checkpointBlock;
    }

    /**
     * @notice Get staker's current accumulated reward
     * @dev The collectReward() function internally calls this function to calculate reward amount
     * @param considerMaxDuration True: Runs for the maximum duration - used in tx not to run out of gas
     * False - to query total rewards
     * @param restartTime The time from which the staking rewards calculation shall restart.
     * @return The timestamp of last withdrawal
     * @return The accumulated reward
     */
    function getStakerCurrentReward(bool considerMaxDuration, uint256 restartTime)
        public
        view
        returns (uint256 lastWithdrawalInterval, uint256 amount)
    {
        uint256 weightedStake;
        uint256 lastFinalisedBlock = _getCurrentBlockNumber() - 1;
        uint256 currentTS = block.timestamp;
        uint256 duration;
        address staker = msg.sender;
        uint256 lastWithdrawal = withdrawals[staker];

        uint256 lastStakingInterval = staking.timestampToLockDate(currentTS);
        lastWithdrawalInterval = lastWithdrawal > 0 ? lastWithdrawal : startTime;
        if (lastStakingInterval <= lastWithdrawalInterval) return (0, 0);
        /* Normally the restart time is 0. If this function returns a valid lastWithdrawalInterval
		and zero amount - that means there were no valid rewards for that period. So the new period must start
		from the end of the last interval or till the time no rewards are accumulated i.e. restartTime */
        if (restartTime >= lastWithdrawalInterval) {
            uint256 latestRestartTime = staking.timestampToLockDate(restartTime);
            lastWithdrawalInterval = latestRestartTime;
        }

        if (considerMaxDuration) {
            uint256 addedMaxDuration = lastWithdrawalInterval.add(maxDuration);
            duration = addedMaxDuration < currentTS
                ? staking.timestampToLockDate(addedMaxDuration)
                : lastStakingInterval;
        } else {
            duration = lastStakingInterval;
        }

        for (uint256 i = lastWithdrawalInterval; i < duration; i += TWO_WEEKS) {
            uint256 referenceBlock = checkpointBlockDetails[i];
            if (referenceBlock == 0) {
                referenceBlock = lastFinalisedBlock.sub(
                    ((currentTS.sub(i)).div(averageBlockTime))
                );
            }
            if (referenceBlock < deploymentBlock) referenceBlock = deploymentBlock;
            weightedStake = weightedStake.add(_computeRewardForDate(staker, referenceBlock, i));
        }

        lastWithdrawalInterval = duration;
        amount = weightedStake.mul(BASE_RATE).div(DIVISOR);
    }
}
