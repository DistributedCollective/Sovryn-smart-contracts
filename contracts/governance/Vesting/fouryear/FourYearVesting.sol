pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../../openzeppelin/Ownable.sol";
import "../../../interfaces/IERC20.sol";
import "../../Staking/Staking.sol";
import "../../IFeeSharingProxy.sol";
import "../../ApprovalReceiver.sol";
import "./FourYearVestingStorage.sol";
import "../../../proxy/UpgradableProxy.sol";

/**
 * @title Four Year Vesting Contract.
 *
 * @notice A four year vesting contract.
 *
 * @dev Vesting contract is upgradable,
 * Make sure the vesting owner is multisig otherwise it will be
 * catastrophic.
 * */
contract FourYearVesting is FourYearVestingStorage, UpgradableProxy {
	/**
	 * @notice Setup the vesting schedule.
	 * @param _logic The address of logic contract.
	 * @param _SOV The SOV token address.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _cliff The time interval to the first withdraw in seconds.
	 * @param _duration The total duration in seconds.
	 * @param _feeSharingProxy Fee sharing proxy address.
	 * */
	constructor(
		address _logic,
		address _SOV,
		address _stakingAddress,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		address _feeSharingProxy
	) public {
		require(_SOV != address(0), "SOV address invalid");
		require(_stakingAddress != address(0), "staking address invalid");
		require(_tokenOwner != address(0), "token owner address invalid");
		require(_duration >= _cliff, "duration must be bigger than or equal to the cliff");
		require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");

		setImplementation(_logic);
		SOV = IERC20(_SOV);
		staking = Staking(_stakingAddress);
		require(_duration <= staking.MAX_DURATION(), "duration may not exceed the max duration");
		tokenOwner = _tokenOwner;
		cliff = _cliff;
		duration = _duration;
		feeSharingProxy = IFeeSharingProxy(_feeSharingProxy);
		maxDuration = 18 * FOUR_WEEKS;
	}

	/**
	 * @dev We need to add this implementation to prevent proxy call
	 * FourYearVestingLogic.governanceWithdrawTokens.
	 * @param receiver The receiver of the token withdrawal.
	 * */
	function governanceWithdrawTokens(address receiver) public pure {
		revert("operation not supported");
	}

	/**
	 * @notice Set address of the implementation.
	 * @dev Overriding setImpl function of implementation. The logic can only be
	 * modified when both token owner and veting owner approve. Since
	 * setImplementation can only be called by vesting owner, we only need to check
	 * if the new logic is signed by the token owner.
	 * @param _implementation Address of the implementation.
	 * */
	function setImpl(address _implementation) public {
		require(signed[tokenOwner], "must be signed by token owner");
		setImplementation(_implementation);
		signed[tokenOwner] = false;
	}
}
