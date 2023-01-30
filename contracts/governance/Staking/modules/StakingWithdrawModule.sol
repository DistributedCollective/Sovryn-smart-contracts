pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../../proxy/modules/interfaces/IFunctionsList.sol";

import "./shared/CheckpointsShared.sol";
import "../../../rsk/RSKAddrValidator.sol";
import "../../Vesting/ITeamVesting.sol";
import "../../Vesting/IVesting.sol";
import "./shared/StakingShared.sol";

/**
 * @title Staking withdrawal functionality module
 **/
contract StakingWithdrawModule is IFunctionsList, StakingShared, CheckpointsShared {
    using SafeMath for uint256;

    event MaxVestingWithdrawIterationsUpdated(uint256 oldMaxIterations, uint256 newMaxIterations);

    /// @dev Struct for direct withdraw function -- to avoid stack too deep issue
    struct VestingConfig {
        address vestingAddress;
        uint256 startDate;
        uint256 endDate;
        uint256 cliff;
        uint256 duration;
        address tokenOwner;
    }

    /// @notice An event emitted when staked tokens get withdrawn.
    event StakingWithdrawn(
        address indexed staker,
        uint256 amount,
        uint256 until,
        address indexed receiver,
        bool isGovernance
    );

    /// @notice An event emitted when vesting tokens get withdrawn.
    event VestingTokensWithdrawn(address vesting, address receiver);

    /// @notice An event emitted when the owner unlocks all tokens.
    event TokensUnlocked(uint256 amount);

    /**
     * @notice Withdraw the given amount of tokens if they are unlocked.
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
     * @dev If until is not a valid lock date, the next lock date after until is used.
     * */
    function withdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external whenNotFrozen {
        _notSameBlockAsStakingCheckpoint(until, msg.sender);

        _withdraw(amount, until, receiver, false);
        // @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
        //		we need to check block.timestamp here
        _withdrawNext(until, receiver, false);
    }

    /**
     * @notice Governance withdraw vesting directly through staking contract.
     * This direct withdraw vesting solves the out of gas issue when there are too many iterations when withdrawing.
     * This function only allows cancelling vesting contract of the TeamVesting type.
     *
     * @param vesting The vesting address.
     * @param receiver The receiving address.
     * @param startFrom The start value for the iterations.
     */
    function cancelTeamVesting(
        address vesting,
        address receiver,
        uint256 startFrom
    ) external onlyAuthorized whenNotFrozen {
        /// require the caller only for team vesting contract.
        require(vestingRegistryLogic.isTeamVesting(vesting), "Only team vesting allowed");

        _cancelTeamVesting(vesting, receiver, startFrom);
    }

    /**
     * @notice Withdraws tokens from the staking contract and forwards them
     * to an address specified by the token owner. Low level function.
     * @dev Once here the caller permission is taken for granted.
     * @param _vesting The vesting address.
     * @param _receiver The receiving address.
     * @param _startFrom The start value for the iterations.
     * or just unlocked tokens (false).
     * */
    function _cancelTeamVesting(
        address _vesting,
        address _receiver,
        uint256 _startFrom
    ) private {
        require(_receiver != address(0), "receiver address invalid");

        ITeamVesting teamVesting = ITeamVesting(_vesting);

        VestingConfig memory vestingConfig =
            VestingConfig(
                _vesting,
                teamVesting.startDate(),
                teamVesting.endDate(),
                teamVesting.cliff(),
                teamVesting.duration(),
                teamVesting.tokenOwner()
            );

        /// @dev In the unlikely case that all tokens have been unlocked early,
        /// allow to withdraw all of them, as long as the itrations less than maxVestingWithdrawIterations.
        uint256 end = vestingConfig.endDate;

        uint256 defaultStart = vestingConfig.startDate + vestingConfig.cliff;

        _startFrom = _startFrom >= defaultStart ? _startFrom : defaultStart;

        /// @dev max iterations need to be decreased by 1, otherwise the iteration will always be surplus by 1
        uint256 totalIterationValue =
            (_startFrom + (TWO_WEEKS * (maxVestingWithdrawIterations - 1)));
        uint256 adjustedEnd = end < totalIterationValue ? end : totalIterationValue;

        /// @dev Withdraw for each unlocked position.
        for (uint256 i = _startFrom; i <= adjustedEnd; i += TWO_WEEKS) {
            /// @dev Read amount to withdraw.
            uint96 tempStake = _getPriorUserStakeByDate(_vesting, i, block.number - 1);

            if (tempStake > 0) {
                /// @dev do governance direct withdraw for team vesting
                _withdrawFromTeamVesting(tempStake, i, _receiver, vestingConfig);
            }
        }

        if (adjustedEnd < end) {
            emit TeamVestingPartiallyCancelled(msg.sender, _receiver, adjustedEnd);
        } else {
            emit TeamVestingCancelled(msg.sender, _receiver);
        }
    }

    /**
     * @notice Send user' staked tokens to a receiver taking into account punishments.
     * Sovryn encourages long-term commitment and thinking. When/if you unstake before
     * the end of the staking period, a percentage of the original staking amount will
     * be slashed. This amount is also added to the reward pool and is distributed
     * between all other stakers.
     *
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
     * @param isGovernance Whether all tokens (true)
     * or just unlocked tokens (false).
     * */
    function _withdraw(
        uint96 amount,
        uint256 until,
        address receiver,
        bool isGovernance
    ) internal {
        // @dev it's very unlikely some one will have 1/10**18 SOV staked in Vesting contract
        //		this check is a part of workaround for Vesting.withdrawTokens issue
        if (amount == 1 && _isVestingContract(msg.sender)) {
            return;
        }
        until = _adjustDateForOrigin(until);
        _validateWithdrawParams(msg.sender, amount, until);

        /// @dev Determine the receiver.
        if (receiver == address(0)) receiver = msg.sender;

        /// @dev Update the checkpoints.
        _decreaseDailyStake(until, amount);
        _decreaseUserStake(msg.sender, until, amount);
        if (_isVestingContract(msg.sender)) _decreaseVestingStake(until, amount);
        _decreaseDelegateStake(delegates[msg.sender][until], until, amount);

        /// @dev Early unstaking should be punished.
        if (block.timestamp < until && !allUnlocked && !isGovernance) {
            uint96 punishedAmount = _getPunishedAmount(amount, until);
            amount -= punishedAmount;

            /// @dev punishedAmount can be 0 if block.timestamp are very close to 'until'
            if (punishedAmount > 0) {
                require(address(feeSharing) != address(0), "FeeSharing address wasn't set"); // S08
                /// @dev Move punished amount to fee sharing.
                /// @dev Approve transfer here and let feeSharing do transfer and write checkpoint.
                SOVToken.approve(address(feeSharing), punishedAmount);
                feeSharing.transferTokens(address(SOVToken), punishedAmount);
            }
        }

        /// @dev transferFrom
        bool success = SOVToken.transfer(receiver, amount);
        require(success, "Token transfer failed"); // S09

        emit StakingWithdrawn(msg.sender, amount, until, receiver, isGovernance);
    }

    /**
     * @notice Send user' staked tokens to a receiver.
     * This function is dedicated only for direct withdrawal from staking contract.
     * Currently only being used by cancelTeamVesting()
     *
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * @param receiver The receiver of the tokens. If not specified, send to the msg.sender.
     * @param vestingConfig The vesting config.
     * @dev VestingConfig struct intended to avoid stack too deep issue, and it contains this properties:
        address vestingAddress; // vesting contract address
        uint256 startDate; //start date of vesting
        uint256 endDate; // end date of vesting
        uint256 cliff; // after this time period the tokens begin to unlock
        uint256 duration; // after this period all the tokens will be unlocked
        address tokenOwner; // owner of the vested tokens
     * */
    function _withdrawFromTeamVesting(
        uint96 amount,
        uint256 until,
        address receiver,
        VestingConfig memory vestingConfig
    ) internal {
        address vesting = vestingConfig.vestingAddress;

        until = _adjustDateForOrigin(until);
        _validateWithdrawParams(vesting, amount, until);

        /// @dev Determine the receiver.
        if (receiver == address(0)) receiver = msg.sender;

        /// @dev Update the checkpoints.
        _decreaseDailyStake(until, amount);
        _decreaseUserStake(vesting, until, amount);

        _decreaseVestingStake(until, amount);
        _decreaseDelegateStake(delegates[vesting][until], until, amount);

        /// @dev transferFrom
        bool success = SOVToken.transfer(receiver, amount);
        require(success, "Token transfer failed"); // S09

        emit StakingWithdrawn(vesting, amount, until, receiver, true);
    }

    // @dev withdraws tokens for lock date 2 weeks later than given lock date
    function _withdrawNext(
        uint256 until,
        address receiver,
        bool isGovernance
    ) internal {
        if (_isVestingContract(msg.sender)) {
            // adjust nextLock to the next valid lock date to make sure we don't accidentally
            // withdraw stakes that are in the future and would get slashed (if until is not
            // a valid lock date)
            uint256 nextLock = _adjustDateForOrigin(until.add(TWO_WEEKS));
            if (isGovernance || block.timestamp >= nextLock) {
                uint96 stakes = _getPriorUserStakeByDate(msg.sender, nextLock, block.number - 1);
                if (stakes > 0) {
                    _withdraw(stakes, nextLock, receiver, isGovernance);
                }
            }
        }
    }

    /**
     * @notice Get available and punished amount for withdrawing.
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked. Adjusted to the next valid lock date, if necessary.
     * */
    function getWithdrawAmounts(uint96 amount, uint256 until)
        external
        view
        returns (uint96, uint96)
    {
        until = _adjustDateForOrigin(until);
        _validateWithdrawParams(msg.sender, amount, until);
        uint96 punishedAmount = _getPunishedAmount(amount, until);
        return (amount - punishedAmount, punishedAmount);
    }

    /**
     * @notice Get punished amount for withdrawing.
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * */
    function _getPunishedAmount(uint96 amount, uint256 until) internal view returns (uint96) {
        uint256 date = _timestampToLockDate(block.timestamp);
        uint96 weight = _computeWeightByDate(until, date); /// @dev (10 - 1) * WEIGHT_FACTOR
        weight = weight * weightScaling;
        return (amount * weight) / WEIGHT_FACTOR / 100;
    }

    /**
     * @notice Validate withdraw parameters.
     * @param account Address to be validated.
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * */
    function _validateWithdrawParams(
        address account,
        uint96 amount,
        uint256 until
    ) internal view {
        require(amount > 0, "Amount of tokens to withdraw must be > 0"); // S10
        uint96 balance = _getPriorUserStakeByDate(account, until, block.number - 1);
        require(amount <= balance, "Staking::withdraw: not enough balance"); // S11
    }

    /**
     * @notice Allow the owner to unlock all tokens in case the staking contract
     * is going to be replaced
     * Note: Not reversible on purpose. once unlocked, everything is unlocked.
     * The owner should not be able to just quickly unlock to withdraw his own
     * tokens and lock again.
     * @dev Last resort.
     * */
    function unlockAllTokens() external onlyOwner whenNotFrozen {
        allUnlocked = true;
        emit TokensUnlocked(SOVToken.balanceOf(address(this)));
    }

    /**
     * @dev set max withdraw iterations.
     *
     * @param newMaxIterations new max iterations value.
     */
    function setMaxVestingWithdrawIterations(uint256 newMaxIterations)
        external
        onlyAuthorized
        whenNotFrozen
    {
        require(newMaxIterations > 0, "Invalid max iterations");
        emit MaxVestingWithdrawIterationsUpdated(maxVestingWithdrawIterations, newMaxIterations);
        maxVestingWithdrawIterations = newMaxIterations;
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](5);
        functionsList[0] = this.withdraw.selector;
        functionsList[1] = this.cancelTeamVesting.selector;
        functionsList[2] = this.getWithdrawAmounts.selector;
        functionsList[3] = this.unlockAllTokens.selector;
        functionsList[4] = this.setMaxVestingWithdrawIterations.selector;
        return functionsList;
    }
}
