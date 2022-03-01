pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../../openzeppelin/Ownable.sol";
import "../../../interfaces/IERC20.sol";
import "../../Staking/Staking.sol";
import "../../IFeeSharingProxy.sol";
import "./IFourYearVesting.sol";
import "../../ApprovalReceiver.sol";
import "./FourYearVestingStorage.sol";
import "../../../openzeppelin/SafeMath.sol";

/**
 * @title Four Year Vesting Logic contract.
 * @notice Staking, delegating and withdrawal functionality.
 * @dev Deployed by FourYearVestingFactory contract.
 * */
contract FourYearVestingLogic is IFourYearVesting, FourYearVestingStorage, ApprovalReceiver {
	using SafeMath for uint256;

	/* Events */
	event TokensStaked(address indexed caller, uint256 amount);
	event VotesDelegated(address indexed caller, address delegatee);
	event TokensWithdrawn(address indexed caller, address receiver);
	event DividendsCollected(address indexed caller, address loanPoolToken, address receiver, uint32 maxCheckpoints);
	event MigratedToNewStakingContract(address indexed caller, address newStakingContract);

	/* Modifiers */
	/**
	 * @dev Throws if called by any account other than the token owner or the contract owner.
	 */
	modifier onlyOwners() {
		require(msg.sender == tokenOwner || isOwner(), "unauthorized");
		_;
	}

	/**
	 * @dev Throws if called by any account other than the token owner.
	 */
	modifier onlyTokenOwner() {
		require(msg.sender == tokenOwner, "unauthorized");
		_;
	}

	/* Functions */

	/**
	 * @notice Sets the max duration.
	 * @param _duration Max duration for which tokens scheduled shall be staked.
	 * */
	function setMaxDuration(uint256 _duration) public onlyOwner {
		maxDuration = _duration;
	}

	/**
	 * @notice Stakes tokens according to the vesting schedule.
	 * @param _amount The amount of tokens to stake.
	 * @param _restartStakeSchedule The time from which staking schedule restarts.
	 * The issue is that we can only stake tokens for a max duration. Thus, we need to restart
	 * from the lastSchedule.
	 * @return lastSchedule The max duration for which tokens were staked.
	 * @return remainingAmount The amount outstanding - to be staked.
	 * */
	function stakeTokens(uint256 _amount, uint256 _restartStakeSchedule) public returns (uint256 lastSchedule, uint256 remainingAmount) {
		(lastSchedule, remainingAmount) = _stakeTokens(msg.sender, _amount, _restartStakeSchedule);
	}

	/**
	 * @notice Stakes tokens according to the vesting schedule.
	 * @dev This function will be invoked from receiveApproval.
	 * @dev SOV.approveAndCall -> this.receiveApproval -> this.stakeTokensWithApproval
	 * @param _sender The sender of SOV.approveAndCall
	 * @param _amount The amount of tokens to stake.
	 * @param _restartStakeSchedule The time from which staking schedule restarts.
	 * The issue is that we can only stake tokens for a max duration. Thus, we need to restart
	 * from the lastSchedule.
	 * @return lastSchedule The max duration for which tokens were staked.
	 * @return remainingAmount The amount outstanding - to be staked.
	 * */
	function stakeTokensWithApproval(
		address _sender,
		uint256 _amount,
		uint256 _restartStakeSchedule
	) public onlyThisContract returns (uint256 lastSchedule, uint256 remainingAmount) {
		(lastSchedule, remainingAmount) = _stakeTokens(_sender, _amount, _restartStakeSchedule);
	}

	/**
	 * @notice Delegate votes from `msg.sender` which are locked until lockDate
	 * to `delegatee`.
	 * @param _delegatee The address to delegate votes to.
	 * */
	function delegate(address _delegatee) public onlyTokenOwner {
		require(_delegatee != address(0), "delegatee address invalid");
		uint256 stakingEndDate = endDate;
		/// @dev Withdraw for each unlocked position.
		/// @dev Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
		///		workaround found, but it doesn't work with TWO_WEEKS
		for (uint256 i = startDate.add(cliff); i <= stakingEndDate; i += FOUR_WEEKS) {
			staking.delegate(_delegatee, i);
		}
		emit VotesDelegated(msg.sender, _delegatee);
	}

	/**
	 * @notice Withdraws all tokens from the staking contract and
	 * forwards them to an address specified by the token owner.
	 * @param receiver The receiving address.
	 * @dev Can be called only by owner.
	 * */
	function governanceWithdrawTokens(address receiver) public {
		require(msg.sender == address(staking), "unauthorized");
		_withdrawTokens(receiver, true);
	}

	/**
	 * @notice Withdraws unlocked tokens from the staking contract and
	 * forwards them to an address specified by the token owner.
	 * @param receiver The receiving address.
	 * */
	function withdrawTokens(address receiver) public onlyTokenOwner {
		_withdrawTokens(receiver, false);
	}

	/**
	 * @notice Collect dividends from fee sharing proxy.
	 * @param _loanPoolToken The loan pool token address.
	 * @param _maxCheckpoints Maximum number of checkpoints to be processed.
	 * @param _receiver The receiver of tokens or msg.sender
	 * */
	function collectDividends(
		address _loanPoolToken,
		uint32 _maxCheckpoints,
		address _receiver
	) public onlyTokenOwner {
		require(_receiver != address(0), "receiver address invalid");

		/// @dev Invokes the fee sharing proxy.
		feeSharingProxy.withdraw(_loanPoolToken, _maxCheckpoints, _receiver);

		emit DividendsCollected(msg.sender, _loanPoolToken, _receiver, _maxCheckpoints);
	}

	/**
	 * @notice Sign transactions - only Token Owner.
	 * @dev The setImpl and changeTokenOwner functions can only be
	 * executed when both vesting owner and token owner have approved. This
	 * function ascertains the approval of token owner.
	 * */
	function signTransaction() public onlyTokenOwner {
		require(!signed[msg.sender], "already signed");
		signed[msg.sender] = true;
	}

	/**
	 * @notice Change token owner.
	 * @dev Changes token owner. Must be
	 * approved by both token owner and multisig(vesting owner).
	 * @param _newTokenOwner Address of new token owner.
	 * */
	function changeTokenOwner(address _newTokenOwner) public onlyOwner {
		require(_newTokenOwner != address(0), "invalid token owner address");
		require(signed[tokenOwner], "must be signed by token owner");
		tokenOwner = _newTokenOwner;
		signed[tokenOwner] = false;
	}

	/**
	 * @notice Set address of the implementation.
	 * @dev This function does nothing as it cannot access the setImplementation
	 * function of the UpgradableProxy. The actual function logic resides in the
	 * proxy contract.
	 * @param _implementation Address of the implementation.
	 * */
	function setImpl(address _implementation) public {
		// Look at FourYearVesting.sol
	}

	/**
	 * @notice Allows the owners to migrate the positions
	 * to a new staking contract.
	 * */
	function migrateToNewStakingContract() public onlyOwners {
		staking.migrateToNewStakingContract();
		staking = Staking(staking.newStakingContract());
		emit MigratedToNewStakingContract(msg.sender, address(staking));
	}

	/**
	 * @notice Extends first year stakes for four year vesting contracts.
	 * @dev Tokens are vested for 4 years. Since the max staking
	 * period is 3 years and the tokens are unlocked only after the first year is
	 * passed, hence, we extend the duration of staking for all unlocked tokens for the first
	 * year by 3 years.
	 * */
	function extendStaking() public {
		uint256 oneYear = startDate.add(52 weeks);
		uint256[] memory dates;
		uint96[] memory stakes;
		(dates, stakes) = staking.getStakes(address(this));

		for (uint256 i = 0; i < dates.length; i++) {
			if ((dates[i] < block.timestamp) && (dates[i] <= oneYear) && (stakes[i] > 0)) {
				staking.extendStakingDuration(dates[i], dates[i].add(156 weeks));
			}
		}
	}

	/**
	 * @notice Stakes tokens according to the vesting schedule. Low level function.
	 * @dev Once here the allowance of tokens is taken for granted.
	 * @param _sender The sender of tokens to stake.
	 * @param _amount The amount of tokens to stake.
	 * @param _restartStakeSchedule The time from which staking schedule restarts.
	 * The issue is that we can only stake tokens for a max duration. Thus, we need to restart
	 * from the lastSchedule.
	 * @return lastSchedule The max duration for which tokens were staked.
	 * @return remainingAmount The amount outstanding - to be staked.
	 * */
	function _stakeTokens(
		address _sender,
		uint256 _amount,
		uint256 _restartStakeSchedule
	) internal returns (uint256 lastSchedule, uint256 remainingAmount) {
		require((startDate == 0) || (startDate > 0 && remainingStakeAmount > 0), "create new vesting address");
		uint256 restartDate;
		uint256 relativeAmount;
		uint256 periods;
		if (startDate == 0 && _restartStakeSchedule == 0) {
			startDate = staking.timestampToLockDate(block.timestamp);
			durationLeft = duration;
			cliffAdded = cliff;
		}
		if (_restartStakeSchedule > 0 && _restartStakeSchedule == lastStakingSchedule && _amount == remainingStakeAmount) {
			restartDate = _restartStakeSchedule;
		} else {
			restartDate = startDate;
		}
		if (endDate == 0) {
			endDate = staking.timestampToLockDate(block.timestamp.add(duration));
		}
		uint256 addedMaxDuration = restartDate.add(maxDuration);
		if (addedMaxDuration < endDate) {
			// Runs for max duration
			lastStakingSchedule = addedMaxDuration;
			periods = (lastStakingSchedule.sub(restartDate)).div(cliff);
			uint256 actualSchedule = restartDate.add(periods.mul(cliff));
			lastStakingSchedule = actualSchedule <= lastStakingSchedule ? actualSchedule : lastStakingSchedule;
			relativeAmount = (_amount.mul(periods).mul(cliff)).div(durationLeft);
			durationLeft = durationLeft.sub(periods.mul(cliff));
			remainingStakeAmount = _amount.sub(relativeAmount);
		} else {
			// Normal run
			lastStakingSchedule = endDate;
			remainingStakeAmount = 0;
			durationLeft = 0;
			relativeAmount = _amount;
		}

		/// @dev Transfer the tokens to this contract.
		bool success = SOV.transferFrom(_sender, address(this), relativeAmount);
		require(success, "transfer failed");

		/// @dev Allow the staking contract to access them.
		SOV.approve(address(staking), relativeAmount);

		staking.stakesBySchedule(relativeAmount, cliffAdded, duration.sub(durationLeft), cliff, address(this), tokenOwner);
		if (durationLeft == 0) {
			cliffAdded = 0;
		} else {
			cliffAdded = cliffAdded.add(periods.mul(cliff));
		}

		emit TokensStaked(_sender, relativeAmount);
		return (lastStakingSchedule, remainingStakeAmount);
	}

	/**
	 * @notice Withdraws tokens from the staking contract and forwards them
	 * to an address specified by the token owner. Low level function.
	 * @dev Once here the caller permission is taken for granted.
	 * @param receiver The receiving address.
	 * @param isGovernance Whether all tokens (true)
	 * or just unlocked tokens (false).
	 * */
	function _withdrawTokens(address receiver, bool isGovernance) internal {
		require(receiver != address(0), "receiver address invalid");

		uint96 stake;

		/// @dev Usually we just need to iterate over the possible dates until now.
		uint256 end;

		/// @dev In the unlikely case that all tokens have been unlocked early,
		///   allow to withdraw all of them.
		if (staking.allUnlocked() || isGovernance) {
			end = endDate;
		} else {
			end = block.timestamp;
			// For four year vesting withdrawal of stakes for the first year is not allowed. These
			// stakes are extended for three years.
			require(end > startDate.add(52 weeks), "cannot withdraw in the first year");
		}

		/// @dev Withdraw for each unlocked position.
		/// @dev Don't change FOUR_WEEKS to TWO_WEEKS, a lot of vestings already deployed with FOUR_WEEKS
		///		workaround found, but it doesn't work with TWO_WEEKS
		for (uint256 i = startDate.add(cliff); i <= end; i += FOUR_WEEKS) {
			/// @dev Read amount to withdraw.
			stake = staking.getPriorUserStakeByDate(address(this), i, block.number.sub(1));

			/// @dev Withdraw if > 0
			if (stake > 0) {
				if (isGovernance) {
					staking.governanceWithdraw(stake, i, receiver);
				} else {
					staking.withdraw(stake, i, receiver);
				}
			}
		}

		emit TokensWithdrawn(msg.sender, receiver);
	}

	/**
	 * @notice Overrides default ApprovalReceiver._getToken function to
	 * register SOV token on this contract.
	 * @return The address of SOV token.
	 * */
	function _getToken() internal view returns (address) {
		return address(SOV);
	}

	/**
	 * @notice Overrides default ApprovalReceiver._getSelectors function to
	 * register stakeTokensWithApproval selector on this contract.
	 * @return The array of registered selectors on this contract.
	 * */
	function _getSelectors() internal view returns (bytes4[] memory) {
		bytes4[] memory selectors = new bytes4[](1);
		selectors[0] = this.stakeTokensWithApproval.selector;
		return selectors;
	}
}
