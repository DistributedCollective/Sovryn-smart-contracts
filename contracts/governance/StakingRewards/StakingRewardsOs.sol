pragma solidity ^0.5.17;

import { StakingRewardsOsStorage, IStaking, IERC20Mintable } from "./StakingRewardsOsStorage.sol";
import { SafeMath } from "../../openzeppelin/SafeMath.sol";
import { Address } from "../../openzeppelin/Address.sol";
import { Initializable } from "../../openzeppelin/Initializable.sol";

/**
 * @title Staking Rewards Contract.
 * @notice This is a trial incentive program.
 * In this, the osSOV minted to voluntary stakers and is locked until transferred to BitcoinOS
 * */
contract StakingRewardsOs is StakingRewardsOsStorage, Initializable {
    using SafeMath for uint256;

    /// @notice fromTimestamp - left boundary of the rewards interval
    /// @notice toTimestamp - right boundary of the rewards interval
    struct RewardsInterval {
        uint256 fromTimestamp;
        uint256 toTimestamp;
    }

    /// @notice Emitted when osSOV is withdrawn
    /// @param receiver The address which recieves the osSOV
    /// @param amount The amount withdrawn from the Smart Contract
    event RewardWithdrawn(address indexed receiver, uint256 amount);

    /**
     * @notice Replacement of constructor by initialize function for Upgradable Contracts
     * This function will be called only once by the owner.
     * @param _osSOV osSOV token address
     * @param _staking StakingProxy address should be passed
     * @param _averageBlockTime average block time used for calculating rewards
     * */
    function initialize(
        address _osSOV,
        IStaking _staking,
        uint256 _averageBlockTime
    ) external onlyOwner initializer {
        require(_osSOV != address(0), "Invalid OsSOV Address");
        require(Address.isContract(_osSOV), "OsSOV is not a contract");
        osSOV = IERC20Mintable(_osSOV);
        staking = _staking;
        rewardsProgramStartTime = staking.timestampToLockDate(block.timestamp);
        maxDuration = 15 * TWO_WEEKS;
        deploymentBlock = _getCurrentBlockNumber();
        averageBlockTime = _averageBlockTime;
    }

    /**
     * @notice Stops the current rewards program.
     * @dev Users will only get rewards up to the stop block
     * */
    function stop() external onlyOwner {
        require(stopBlock == 0, "Already stopped");
        stopBlock = _getCurrentBlockNumber();
        stopRewardsTimestamp = staking.timestampToLockDate(block.timestamp);
    }

    /**
     * @notice Collect rewards
     * @dev User calls this function to collect osSOV staking rewards accrued by this contract
     * The weighted stake is calculated using getPriorWeightedStake. Block number sent to the functon
     * must be a finalised block, hence we deduct 1 from the current block. User is only allowed to withdraw
     * after intervals of 14 days.
     * @param _startTime The time from which to start the staking rewards calculation
     * The issue is that we can only run for a max duration and if someone stakes for the
     * first time after the max duration is over, the reward will always return 0. Thus, we need to restart
     * from the duration that elapsed without generating rewards.
     * */
    function collectReward(uint256 _startTime) external {
        require(
            stopBlock == 0 || stakerNextWithdrawTimestamp[msg.sender] < stopRewardsTimestamp,
            "Entire reward already paid"
        );
        (uint256 nextWithdrawTimestamp, uint256 amount) = _getStakerCurrentReward(
            msg.sender,
            true,
            _startTime
        );
        require(nextWithdrawTimestamp > 0 && amount > 0, "No valid reward");
        stakerNextWithdrawTimestamp[msg.sender] = nextWithdrawTimestamp;
        _payReward(msg.sender, amount);
    }

    /**
     * @notice Changes average block time - based on blockchain
     * @dev If average block time significantly changes, we can update it here and use for block number calculation
     * @param _averageBlockTime - average block time used for calculating checkpoint blocks
     */
    function setAverageBlockTime(uint256 _averageBlockTime) external onlyOwner {
        averageBlockTime = _averageBlockTime;
    }

    /**
     * @notice This function computes the last staking checkpoint and calculates the corresponding
     * block number using the average block time which is then added to the mapping `checkpointBlockNumber`.
     */
    function setBlock() external {
        uint256 lastCheckpointTime = staking.timestampToLockDate(block.timestamp);
        _setBlock(lastCheckpointTime);
    }

    /**
     * @notice This function computes the block number using the average block time for a given historical
     * checkpoint which is added to the mapping `checkpointBlockNumber`.
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
     * @dev Users will receive rewards uo till the stop block
     * @param _staker Staker address
     * @param _block Last finalised block
     * @param _date The date to compute prior weighted stakes
     * @return The weighted stake
     * */
    function _computeWeightedStakeForDate(
        address _staker,
        uint256 _block,
        uint256 _date
    ) internal view returns (uint256 weightedStake) {
        return staking.getPriorWeightedStake(_staker, _block, _date);
    }

    /**
     * @notice Internal function to pay rewards
     * @dev Base rate is annual, but we pay interest for 14 days,
     * which is 1/26 of one staking year (1092 days)
     * @param _staker Staker address
     * @param _amount the reward amount
     * */
    function _payReward(address _staker, uint256 _amount) internal {
        require(_amount != 0, "amount invalid");
        claimedBalances[_staker] = claimedBalances[_staker].add(_amount);
        osSOV.mint(_staker, _amount);
        emit RewardWithdrawn(_staker, _amount);
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
        uint256 lastFinalisedBlock = _getCurrentBlockNumber() - 1;
        require(checkpointBlockNumber[_checkpointTime] == 0, "block number already set");
        uint256 checkpointBlock = lastFinalisedBlock.sub(
            ((block.timestamp.sub(_checkpointTime)).div(averageBlockTime))
        );
        checkpointBlockNumber[_checkpointTime] = checkpointBlock;
    }

    /**
     * @notice Get staker's current accumulated reward
     * @dev getStakerCurrentReward function internally calls this function to calculate reward amount of msg.sender
     * @param _considerMaxDuration True: Runs for the maximum duration - used in tx not to run out of gas
     * False - to query total rewards
     * @param _startTime The time from which the staking rewards calculation shall restart.
     * @return The timestamp of last withdrawal
     * @return The accumulated reward
     */
    function getStakerCurrentReward(
        bool _considerMaxDuration,
        uint256 _startTime
    ) external view returns (uint256 nextWithdrawTimestamp, uint256 amount) {
        return _getStakerCurrentReward(msg.sender, _considerMaxDuration, _startTime);
    }

    /**
     * @notice Get any staker's current accumulated reward
     * @dev getArbitraryStakerCurrentReward function internally calls this function to calculate reward amount
     * @param _considerMaxDuration True: Runs for the maximum duration - used in tx not to run out of gas
     * False - to query total rewards
     * @param _startTime The time from which the staking rewards calculation shall restart.
     * @param _staker The staker address to calculate rewards for
     * @return The timestamp of last withdrawal
     * @return The accumulated reward
     */
    function getArbitraryStakerCurrentReward(
        bool _considerMaxDuration,
        uint256 _startTime,
        address _staker
    ) external view returns (uint256 nextWithdrawTimestamp, uint256 amount) {
        return _getStakerCurrentReward(_staker, _considerMaxDuration, _startTime);
    }

    /**
     * @notice Internal function to calculate staker's current reward
     * @dev Normally the start time is 0. If this function returns a valid withdraw timestamp
     * and zero amount - that means there were no valid rewards for that period. So the new period must start
     * from the end of the last interval or till the time no rewards are accumulated i.e. _startTime
     */
    function _getStakerCurrentReward(
        address _staker,
        bool _considerMaxDuration,
        uint256 _startTime
    ) internal view returns (uint256 nextWithdrawTimestamp, uint256 amount) {
        uint256 weightedStake;
        uint256 lastFinalisedBlock;
        RewardsInterval memory rewardsInterval;
        uint256 currentBlockTsToLockDate;
        uint256 startWithdrawTimestamp = stakerNextWithdrawTimestamp[_staker];

        // it is important to have this check in the beginning
        if (stopBlock != 0 && startWithdrawTimestamp > stopRewardsTimestamp) {
            return (startWithdrawTimestamp, 0);
        }

        // interval left boundary
        if (_startTime < rewardsProgramStartTime) {
            rewardsInterval.fromTimestamp = startWithdrawTimestamp > 0
                ? startWithdrawTimestamp
                : rewardsProgramStartTime;
        } else if (_startTime > startWithdrawTimestamp) {
            rewardsInterval.fromTimestamp = staking.timestampToLockDate(_startTime);
        } else {
            rewardsInterval.fromTimestamp = startWithdrawTimestamp;
        }

        // interval right boundary
        currentBlockTsToLockDate = staking.timestampToLockDate(block.timestamp);
        if (_considerMaxDuration) {
            uint256 endWithdrawTimestamp = staking.timestampToLockDate(
                rewardsInterval.fromTimestamp.add(maxDuration)
            );
            rewardsInterval.toTimestamp = endWithdrawTimestamp > currentBlockTsToLockDate
                ? currentBlockTsToLockDate
                : endWithdrawTimestamp;
        } else {
            rewardsInterval.toTimestamp = currentBlockTsToLockDate;
        }

        if (stopRewardsTimestamp > 0 && rewardsInterval.toTimestamp > stopRewardsTimestamp) {
            rewardsInterval.toTimestamp = stopRewardsTimestamp.add(TWO_WEEKS);
        }

        if (rewardsInterval.fromTimestamp > rewardsInterval.toTimestamp) {
            return (rewardsInterval.fromTimestamp, 0);
        }

        lastFinalisedBlock = _getCurrentBlockNumber() - 1;

        for (
            uint256 i = rewardsInterval.fromTimestamp;
            i < rewardsInterval.toTimestamp;
            i += TWO_WEEKS
        ) {
            uint256 referenceBlock = checkpointBlockNumber[i];
            if (referenceBlock == 0) {
                referenceBlock = lastFinalisedBlock.sub(
                    ((block.timestamp.sub(i)).div(averageBlockTime))
                );
            }
            if (referenceBlock < deploymentBlock) {
                referenceBlock = deploymentBlock;
            }
            weightedStake = weightedStake.add(
                _computeWeightedStakeForDate(_staker, referenceBlock, i)
            );
        }
        nextWithdrawTimestamp = rewardsInterval.toTimestamp;
        amount = weightedStake.mul(BASE_RATE).div(DIVISOR);
    }
}
