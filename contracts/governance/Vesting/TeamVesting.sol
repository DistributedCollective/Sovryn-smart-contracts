pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/Staking.sol";
import "../IFeeSharingProxy.sol";
import "./IVesting.sol";
import "../ApprovalReceiver.sol";
import "./VestingStorage.sol";
import "../../proxy/Proxy.sol";

/**
 * @title Team Vesting Contract.
 *
 * @notice A regular vesting contract, but the owner (governance) is able to
 * withdraw earlier without a slashing.
 *
 * @dev Vesting contracts shouldn't be upgradable,
 * use Proxy instead of UpgradableProxy.
 * */
contract TeamVesting is VestingStorage, Proxy {
    /**
     * @notice Setup the vesting schedule.
     * @param _logic The address of logic contract.
     * @param _SOV The SOV token address.
     * @param _tokenOwner The owner of the tokens.
     * @param _cliff The time interval to the first withdraw in seconds.
     * @param _duration The total duration in seconds.
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

        _setImplementation(_logic);
        SOV = IERC20(_SOV);
        staking = Staking(_stakingAddress);
        require(_duration <= staking.MAX_DURATION(), "duration may not exceed the max duration");
        tokenOwner = _tokenOwner;
        cliff = _cliff;
        duration = _duration;
        feeSharingProxy = IFeeSharingProxy(_feeSharingProxy);
    }
}
