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

    /// @notice Emitted when osSOV is withdrawn
    /// @param receiver The address which recieves the osSOV
    /// @param amount The amount withdrawn from the Smart Contract
    event RewardPaid(address indexed receiver, uint256 amount);

    /**
     * @notice Replacement of constructor by initialize function for Upgradable Contracts
     * This function will be called only once by the owner.
     * @param _osSOV osSOV token address
     * @param _staking StakingProxy address should be passed
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
    function claimReward(uint256 _startTime) external {
        require(
            stopBlock == 0 || stakerNextWithdrawTimestamp[msg.sender] < stopRewardsTimestamp,
            "Entire reward already paid"
        );
        (uint256 withdrawTimestamp, uint256 amount) = _getStakerCurrentReward(
            msg.sender,
            true,
            _startTime
        );
        require(withdrawTimestamp > 0 && amount > 0, "No valid reward");
        stakerNextWithdrawTimestamp[msg.sender] = withdrawTimestamp;
        _payReward(msg.sender, amount);
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
    function _computWeightedStakeForDate(
        address _staker,
        uint256 _block,
        uint256 _date
    ) internal view returns (uint256 weightedStake) {
        weightedStake = staking.getPriorWeightedStake(_staker, _block, _date);
        if (stopBlock > 0 && stopBlock < _block) {
            uint256 previousWeightedStake = staking.getPriorWeightedStake(
                _staker,
                stopBlock,
                _date
            );
            if (previousWeightedStake < weightedStake) {
                weightedStake = previousWeightedStake;
            }
        }
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
        emit RewardPaid(_staker, _amount);
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
     * @dev The getStakerCurrentReward() function internally calls this function to calculate reward amount
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
        uint256 startWithdrawTimestamp;
        uint256 endWithdrawTimestamp;

        startWithdrawTimestamp = stakerNextWithdrawTimestamp[_staker];
        if (stopBlock != 0 && startWithdrawTimestamp >= stopRewardsTimestamp) {
            return (startWithdrawTimestamp, 0);
        }

        uint256 currentBlockTsToLockDate = staking.timestampToLockDate(block.timestamp);

        if (startWithdrawTimestamp == 0) {
            startWithdrawTimestamp = rewardsProgramStartTime;
        }
        if (currentBlockTsToLockDate <= startWithdrawTimestamp) {
            return (startWithdrawTimestamp, 0);
        }
        if (startWithdrawTimestamp <= _startTime) {
            startWithdrawTimestamp = staking.timestampToLockDate(_startTime);
        }

        if (_considerMaxDuration) {
            endWithdrawTimestamp = startWithdrawTimestamp.add(maxDuration);
            endWithdrawTimestamp = endWithdrawTimestamp < block.timestamp
                ? staking.timestampToLockDate(endWithdrawTimestamp)
                : currentBlockTsToLockDate;
        } else {
            endWithdrawTimestamp = currentBlockTsToLockDate;
        }

        if (stopBlock != 0 && endWithdrawTimestamp > stopRewardsTimestamp) {
            // add 2 weeks because the right boundary is not included in processing cycle below
            endWithdrawTimestamp = stopRewardsTimestamp.add(TWO_WEEKS);
        }

        lastFinalisedBlock = _getCurrentBlockNumber() - 1;
        for (uint256 i = startWithdrawTimestamp; i < endWithdrawTimestamp; i += TWO_WEEKS) {
            uint256 referenceBlock = checkpointBlockNumber[i];
            if (referenceBlock == 0) {
                referenceBlock = lastFinalisedBlock.sub(
                    ((block.timestamp.sub(i)).div(averageBlockTime))
                );
            }
            if (referenceBlock < deploymentBlock) referenceBlock = deploymentBlock;
            weightedStake = weightedStake.add(
                _computWeightedStakeForDate(_staker, referenceBlock, i)
            );
        }
        nextWithdrawTimestamp = endWithdrawTimestamp;
        amount = weightedStake.mul(BASE_RATE).div(DIVISOR);
    }
}
