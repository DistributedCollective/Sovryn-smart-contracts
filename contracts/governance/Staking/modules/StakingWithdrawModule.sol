pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../../proxy/modules/interfaces/IFunctionsList.sol";

import "../CheckpointsShared.sol";
import "../../../rsk/RSKAddrValidator.sol";
import "../../Vesting/ITeamVesting.sol";
import "../../Vesting/IVesting.sol";
import "../StakingShared.sol";

/**
 * @title Staking withdraw functionality module
 **/
contract StakingWithdrawModule is IFunctionsList, CheckpointsShared, StakingShared {
    using SafeMath for uint256;

    /**
     * @notice Withdraw the given amount of tokens if they are unlocked.
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
     * */
    function withdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external whenNotFrozen {
        _notSameBlockAsStakingCheckpoint(until);

        _withdraw(amount, until, receiver, false);
        // @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
        //		we need to check block.timestamp here
        _withdrawNext(until, receiver, false);
    }

    /**
     * @notice Withdraw the given amount of tokens.
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
     * @dev Can be invoked only by whitelisted contract passed to governanceWithdrawVesting
     * */
    function governanceWithdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) external whenNotFrozen {
        require(vestingWhitelist[msg.sender], "S07"); // unauthorized

        _notSameBlockAsStakingCheckpoint(until);

        _withdraw(amount, until, receiver, true);
        // @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
        //		we don't need to check block.timestamp here
        _withdrawNext(until, receiver, true);
    }

    /**
     * @notice Withdraw tokens for vesting contract.
     * @param vesting The address of Vesting contract.
     * @param receiver The receiver of the tokens. If not specified, send to the msg.sender
     * @dev Can be invoked only by whitelisted contract passed to governanceWithdrawVesting.
     * */
    function governanceWithdrawVesting(address vesting, address receiver)
        external
        onlyAuthorized
        whenNotFrozen
    {
        vestingWhitelist[vesting] = true;
        ITeamVesting(vesting).governanceWithdrawTokens(receiver);
        vestingWhitelist[vesting] = false;

        emit VestingTokensWithdrawn(vesting, receiver);
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
        _validateWithdrawParams(amount, until);

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
                require(address(feeSharing) != address(0), "S08"); // FeeSharing address wasn't set
                /// @dev Move punished amount to fee sharing.
                /// @dev Approve transfer here and let feeSharing do transfer and write checkpoint.
                SOVToken.approve(address(feeSharing), punishedAmount);
                feeSharing.transferTokens(address(SOVToken), punishedAmount);
            }
        }

        /// @dev transferFrom
        bool success = SOVToken.transfer(receiver, amount);
        require(success, "S09"); // Token transfer failed

        emit StakingWithdrawn(msg.sender, amount, until, receiver, isGovernance);
    }

    // @dev withdraws tokens for lock date 2 weeks later than given lock date
    function _withdrawNext(
        uint256 until,
        address receiver,
        bool isGovernance
    ) internal {
        if (_isVestingContract(msg.sender)) {
            uint256 nextLock = until.add(TWO_WEEKS);
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
     * @param until The date until which the tokens were staked.
     * */
    function getWithdrawAmounts(uint96 amount, uint256 until)
        external
        view
        returns (uint96, uint96)
    {
        _validateWithdrawParams(amount, until);
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
     * @param amount The number of tokens to withdraw.
     * @param until The date until which the tokens were staked.
     * */
    function _validateWithdrawParams(uint96 amount, uint256 until) internal view {
        require(amount > 0, "S10"); // Amount of tokens to withdraw must be > 0
        uint96 balance = _getPriorUserStakeByDate(msg.sender, until, block.number - 1);
        require(amount <= balance, "S11"); // Staking::withdraw: not enough balance
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

    function _getFunctionList() internal pure returns (bytes4[] memory) {
        bytes4[] memory functionList = new bytes4[](4);
        functionList[0] = this.withdraw.selector;
        functionList[1] = this.governanceWithdraw.selector;
        functionList[2] = this.governanceWithdrawVesting.selector;
        functionList[3] = this.getWithdrawAmounts.selector;
        functionList[4] = this.unlockAllTokens.selector;
        return functionList;
    }
}
