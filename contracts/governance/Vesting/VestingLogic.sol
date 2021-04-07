pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/Staking.sol";
import "../IFeeSharingProxy.sol";
import "./IVesting.sol";
import "../ApprovalReceiver.sol";
import "./VestingStorage.sol";

contract VestingLogic is IVesting, VestingStorage, ApprovalReceiver {
	event TokensStaked(address indexed caller, uint256 amount);
	event VotesDelegated(address indexed caller, address delegatee);
	event TokensWithdrawn(address indexed caller, address receiver);
	event DividendsCollected(address indexed caller, address loanPoolToken, address receiver, uint32 maxCheckpoints);
	event MigratedToNewStakingContract(address indexed caller, address newStakingContract);

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

	/**
	 * @notice stakes tokens according to the vesting schedule
	 * @param _amount the amount of tokens to stake
	 * */
	function stakeTokens(uint256 _amount) public {
		_stakeTokens(msg.sender, _amount);
	}

	/**
	 * @notice stakes tokens according to the vesting schedule
	 * @dev this function will be invoked from receiveApproval
	 * @dev SOV.approveAndCall -> this.receiveApproval -> this.stakeTokensWithApproval
	 * @param _sender the sender of SOV.approveAndCall
	 * @param _amount the amount of tokens to stake
	 * */
	function stakeTokensWithApproval(address _sender, uint256 _amount) public onlyThisContract {
		_stakeTokens(_sender, _amount);
	}

	function _stakeTokens(address _sender, uint256 _amount) internal {
		//maybe better to allow staking unil the cliff was reached
		if (startDate == 0) {
			startDate = staking.timestampToLockDate(block.timestamp);
		}
		endDate = staking.timestampToLockDate(block.timestamp + duration);
		//transfer the tokens to this contract
		bool success = SOV.transferFrom(_sender, address(this), _amount);
		require(success);
		//allow the staking contract to access them
		SOV.approve(address(staking), _amount);

		staking.stakesBySchedule(_amount, cliff, duration, FOUR_WEEKS, address(this), tokenOwner);

		emit TokensStaked(_sender, _amount);
	}

	/**
	 * @notice Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`
	 * @param _delegatee The address to delegate votes to
	 */
	function delegate(address _delegatee) public onlyTokenOwner {
		require(_delegatee != address(0), "delegatee address invalid");

		//withdraw for each unlocked position
		for (uint256 i = startDate + cliff; i <= endDate; i += FOUR_WEEKS) {
			staking.delegate(_delegatee, i);
		}
		emit VotesDelegated(msg.sender, _delegatee);
	}

	/**
	 * @notice withdraws all tokens from the staking contract and forwards them to an address specified by the token owner
	 * @param receiver the receiving address
	 * @dev can be called only by owner
	 * */
	function governanceWithdrawTokens(address receiver) public {
		require(msg.sender == address(staking), "unauthorized");

		_withdrawTokens(receiver, true);
	}

	/**
	 * @notice withdraws unlocked tokens from the staking contract and forwards them to an address specified by the token owner
	 * @param receiver the receiving address
	 **/
	function withdrawTokens(address receiver) public onlyOwners {
		_withdrawTokens(receiver, false);
	}

	function _withdrawTokens(address receiver, bool isGovernance) internal {
		require(receiver != address(0), "receiver address invalid");

		uint96 stake;
		//usually we just need to iterate over the possible dates until now
		uint256 end;
		//in the unlikely case that all tokens have been unlocked early, allow to withdraw all of them.
		if (staking.allUnlocked() || isGovernance) {
			end = endDate;
		} else {
			end = block.timestamp;
		}
		//withdraw for each unlocked position
		for (uint256 i = startDate + cliff; i <= end; i += FOUR_WEEKS) {
			//read amount to withdraw
			stake = staking.getPriorUserStakeByDate(address(this), i, block.number - 1);
			//withdraw if > 0
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
	 * @dev collect dividends from fee sharing proxy
	 */
	function collectDividends(
		address _loanPoolToken,
		uint32 _maxCheckpoints,
		address _receiver
	) public onlyOwners {
		require(_receiver != address(0), "receiver address invalid");
		//invokes the fee sharing proxy
		feeSharingProxy.withdraw(_loanPoolToken, _maxCheckpoints, _receiver);
		emit DividendsCollected(msg.sender, _loanPoolToken, _receiver, _maxCheckpoints);
	}

	/**
	 * @notice allows the owners to migrate the positions to a new staking contract
	 * */
	function migrateToNewStakingContract() public onlyOwners {
		staking.migrateToNewStakingContract();
		staking = Staking(staking.newStakingContract());
		emit MigratedToNewStakingContract(msg.sender, address(staking));
	}

	function _getToken() internal view returns (address) {
		return address(SOV);
	}

	function _getSelectors() internal view returns (bytes4[] memory) {
		bytes4[] memory selectors = new bytes4[](1);
		selectors[0] = this.stakeTokensWithApproval.selector;
		return selectors;
	}
}
