pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../../openzeppelin/Ownable.sol";
import "../../../interfaces/IERC20.sol";
import "../../Staking/Staking.sol";
import "../../IFeeSharingProxy.sol";
import "../../ApprovalReceiver.sol";
import "./FourYearVestingStorage.sol";
import "../../../proxy/Proxy.sol";

/**
 * @title Four Year Vesting Contract.
 *
 * @notice A four year vesting contract.
 *
 * @dev Vesting contracts shouldn't be upgradable,
 * use Proxy instead of UpgradableProxy.
 * */
contract FourYearVesting is FourYearVestingStorage, Proxy {
	/**
	 * @notice Setup the vesting schedule.
	 * @param _logic The address of logic contract.
	 * @param _SOV The SOV token address.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _feeSharingProxy Fee sharing proxy address.
	 * */
	constructor(
		address _logic,
		address _SOV,
		address _stakingAddress,
		address _tokenOwner,
		address _feeSharingProxy
	) public {
		require(Address.isContract(_logic), "_logic not a contract");
		require(_SOV != address(0), "SOV address invalid");
		require(Address.isContract(_SOV), "_SOV not a contract");
		require(_stakingAddress != address(0), "staking address invalid");
		require(Address.isContract(_stakingAddress), "_stakingAddress not a contract");
		require(_tokenOwner != address(0), "token owner address invalid");
		require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
		require(Address.isContract(_feeSharingProxy), "_feeSharingProxy not a contract");

		_setImplementation(_logic);
		SOV = IERC20(_SOV);
		staking = Staking(_stakingAddress);
		tokenOwner = _tokenOwner;
		feeSharingProxy = IFeeSharingProxy(_feeSharingProxy);
		maxInterval = 18 * FOUR_WEEKS;
	}
}
