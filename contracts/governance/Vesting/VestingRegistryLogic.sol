pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../interfaces/IERC20.sol";
import "../Staking/IStaking.sol";
import "../IFeeSharingProxy.sol";
import "./IVesting.sol";
import "./ITeamVesting.sol";
import "./VestingRegistryStorage.sol";
import "../../openzeppelin/Initializable.sol";
import "../../utils/AdminRole.sol";

contract VestingRegistryLogic is VestingRegistryStorage, Initializable, AdminRole {
	event SOVTransferred(address indexed receiver, uint256 amount);
	event VestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
	event TeamVestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
	event TokensStaked(address indexed vesting, uint256 amount);

	/**
	 * @notice Replace constructor with initialize function for Upgradable Contracts
	 * This function will be called only once by the owner
	 * */
	function initialize(
		address _vestingFactory,
		address _SOV,
		address _staking,
		address _feeSharingProxy,
		address _vestingOwner,
		address _lockedSOV,
		address _vestingRegistry,
		address _vestingRegistry2,
		address _vestingRegistry3
	) public onlyOwner initializer {
		require(_SOV != address(0), "SOV address invalid");
		require(_staking != address(0), "staking address invalid");
		require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
		require(_vestingOwner != address(0), "vestingOwner address invalid");
		require(_lockedSOV != address(0), "LockedSOV address invalid");
		require(_vestingRegistry != address(0), "Vesting registry address invalid");
		require(_vestingRegistry2 != address(0), "Vesting registry 2 address invalid");
		require(_vestingRegistry3 != address(0), "Vesting registry 3 address invalid");

		_setVestingFactory(_vestingFactory);
		SOV = _SOV;
		staking = _staking;
		feeSharingProxy = _feeSharingProxy;
		vestingOwner = _vestingOwner;
		lockedSOV = LockedSOV(_lockedSOV);
		vestingRegistry = VestingRegistry(_vestingRegistry);
		vestingRegistry2 = VestingRegistry2(_vestingRegistry2);
		vestingRegistry3 = VestingRegistry3(_vestingRegistry3);
	}

	/**
	 * @notice sets vesting factory address
	 * @param _vestingFactory the address of vesting factory contract
	 */
	function setVestingFactory(address _vestingFactory) public onlyOwner {
		_setVestingFactory(_vestingFactory);
	}

	/**
	 * @notice Internal function that sets vesting factory address
	 * @param _vestingFactory the address of vesting factory contract
	 */
	function _setVestingFactory(address _vestingFactory) internal {
		require(_vestingFactory != address(0), "vestingFactory address invalid");
		vestingFactory = IVestingFactory(_vestingFactory);
	}

	/**
	 * @notice transfers SOV tokens to given address
	 * @param _receiver the address of the SOV receiver
	 * @param _amount the amount to be transferred
	 */
	function transferSOV(address _receiver, uint256 _amount) public onlyOwner {
		require(_receiver != address(0), "receiver address invalid");
		require(_amount != 0, "amount invalid");

		IERC20(SOV).transfer(_receiver, _amount);
		emit SOVTransferred(_receiver, _amount);
	}

	/**
	 * @notice adds vestings that were deployed in previous vesting registries
	 * @dev migration of data from previous vesting registy contracts
	 */
	function addDeployedVestings(address[] memory _tokenOwners) public onlyAuthorized {
		for (uint256 i = 0; i < _tokenOwners.length; i++) {
			require(_tokenOwners[i] != address(0), "token owner cannot be 0 address");
			_getDeployedVestings(_tokenOwners[i]);
			_getDeployedTeamVestings(_tokenOwners[i]);
		}
	}

	/**
	 * @notice creates Vesting contract
	 * @param _tokenOwner the owner of the tokens
	 * @param _amount the amount to be staked
	 * @param _cliff the cliff in seconds
	 * @param _duration the total duration in seconds
	 */
	function createVesting(
		address _tokenOwner,
		uint256 _amount,
		uint256 _cliff,
		uint256 _duration
	) public onlyAuthorized {
		address vesting = _getOrCreateVesting(_tokenOwner, _amount, _cliff, _duration, uint256(VestingType.Vesting));
		emit VestingCreated(_tokenOwner, vesting, _cliff, _duration, _amount);
	}

	/**
	 * @notice creates Team Vesting contract
	 * @param _tokenOwner the owner of the tokens
	 * @param _amount the amount to be staked
	 * @param _cliff the cliff in seconds
	 * @param _duration the total duration in seconds
	 */
	function createTeamVesting(
		address _tokenOwner,
		uint256 _amount,
		uint256 _cliff,
		uint256 _duration
	) public onlyAuthorized {
		address vesting = _getOrCreateVesting(_tokenOwner, _amount, _cliff, _duration, uint256(VestingType.TeamVesting));
		emit TeamVestingCreated(_tokenOwner, vesting, _cliff, _duration, _amount);
	}

	/**
	 * @notice stakes tokens according to the vesting schedule
	 * @param _vesting the address of Vesting contract
	 * @param _amount the amount of tokens to stake
	 */
	function stakeTokens(address _vesting, uint256 _amount) public onlyAuthorized {
		require(_vesting != address(0), "vesting address invalid");
		require(_amount > 0, "amount invalid");

		IERC20(SOV).approve(_vesting, _amount);
		IVesting(_vesting).stakeTokens(_amount);
		emit TokensStaked(_vesting, _amount);
	}

	/**
	 * @notice returns vesting contract address for the given token owner
	 * @param _tokenOwner the owner of the tokens
	 * @dev Calls a public getVestingAddr function with cliff and duration. This is to accomodate the existing logic for LockedSOV
	 * @dev We need to use LockedSOV.changeRegistryCliffAndDuration function very judiciously
	 */
	function getVesting(address _tokenOwner) public view returns (address) {
		return getVestingAddr(_tokenOwner, lockedSOV.cliff(), lockedSOV.duration());
	}

	/**
	 * @notice public function that returns vesting contract address for the given token owner, cliff, duration
	 * @dev Important: Please use this instead of getVesting function
	 */
	function getVestingAddr(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration
	) public view returns (address) {
		uint256 type_ = uint256(VestingType.Vesting);
		uint256 uid = uint256(keccak256(abi.encodePacked(_tokenOwner, type_, _cliff, _duration)));
		return vestingContracts[_tokenOwner][uid];
	}

	/**
	 * @notice returns team vesting contract address for the given token owner, cliff, duration
	 */
	function getTeamVesting(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration
	) public view returns (address) {
		uint256 type_ = uint256(VestingType.TeamVesting);
		uint256 uid = uint256(keccak256(abi.encodePacked(_tokenOwner, type_, _cliff, _duration)));
		return vestingContracts[_tokenOwner][uid];
	}

	/**
	 * @notice Internal function to deploy Vesting/Team Vesting contract
	 * @param _tokenOwner the owner of the tokens
	 * @param _amount the amount to be staked
	 * @param _cliff the cliff in seconds
	 * @param _duration the total duration in seconds
	 * @param _type the type of vesting
	 */
	function _getOrCreateVesting(
		address _tokenOwner,
		uint256 _amount,
		uint256 _cliff,
		uint256 _duration,
		uint256 _type
	) internal returns (address) {
		address vesting;
		uint256 uid = uint256(keccak256(abi.encodePacked(_tokenOwner, _type, _cliff, _duration)));
		if (vestingContracts[_tokenOwner][uid] == address(0)) {
			if (_type == 1) {
				vesting = vestingFactory.deployVesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharingProxy, _tokenOwner);
			} else {
				vesting = vestingFactory.deployTeamVesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharingProxy, vestingOwner);
			}
			vestingContracts[_tokenOwner][uid] = vesting;
			vestings[uid] = Vesting(_type, vesting);
			vestingsOf[_tokenOwner].push(uid);
		}
		return vestingContracts[_tokenOwner][uid];
	}

	/**
	 * @notice returns the addresses of Vesting contracts from all three previous versions of Vesting Registry
	 */
	function _getDeployedVestings(address _tokenOwner) internal {
		if (vestingRegistry.getVesting(_tokenOwner) != address(0)) {
			vestingAddresses.push(vestingRegistry.getVesting(_tokenOwner));
		}
		if (vestingRegistry2.getVesting(_tokenOwner) != address(0)) {
			vestingAddresses.push(vestingRegistry2.getVesting(_tokenOwner));
		}
		if (vestingRegistry3.getVesting(_tokenOwner) != address(0)) {
			vestingAddresses.push(vestingRegistry3.getVesting(_tokenOwner));
		}
		uint256 vestingType = 1;
		for (uint256 i = 0; i < vestingAddresses.length; i++) {
			VestingLogic vesting = VestingLogic(vestingAddresses[i]);
			uint256 uid = uint256(keccak256(abi.encodePacked(_tokenOwner, vestingType, vesting.cliff(), vesting.duration())));
			vestingContracts[_tokenOwner][uid] = vestingAddresses[i];
			vestings[uid] = Vesting(vestingType, vestingAddresses[i]);
			vestingsOf[_tokenOwner].push(uid);
		}
		delete vestingAddresses;
	}

	/**
	 * @notice returns the addresses of TeamVesting contracts from all three previous versions of Vesting Registry
	 */
	function _getDeployedTeamVestings(address _tokenOwner) internal {
		if (vestingRegistry.getTeamVesting(_tokenOwner) != address(0)) {
			vestingAddresses.push(vestingRegistry.getTeamVesting(_tokenOwner));
		}
		if (vestingRegistry2.getTeamVesting(_tokenOwner) != address(0)) {
			vestingAddresses.push(vestingRegistry2.getTeamVesting(_tokenOwner));
		}
		if (vestingRegistry3.getTeamVesting(_tokenOwner) != address(0)) {
			vestingAddresses.push(vestingRegistry3.getTeamVesting(_tokenOwner));
		}
		uint256 vestingType = 0;
		for (uint256 i = 0; i < vestingAddresses.length; i++) {
			VestingLogic vesting = VestingLogic(vestingAddresses[i]);
			uint256 uid = uint256(keccak256(abi.encodePacked(_tokenOwner, vestingType, vesting.cliff(), vesting.duration())));
			vestingContracts[_tokenOwner][uid] = vestingAddresses[i];
			vestings[uid] = Vesting(vestingType, vestingAddresses[i]);
			vestingsOf[_tokenOwner].push(uid);
		}
		delete vestingAddresses;
	}

	/**
	 * @notice returns all vesting details for the given token owner
	 */
	function getVestingsOf(address _tokenOwner) external view returns (Vesting[] memory) {
		uint256[] storage vestingIds = vestingsOf[_tokenOwner];
		Vesting[] memory _vestings = new Vesting[](vestingIds.length);
		uint256 j;
		for (uint256 i = 0; i < vestingIds.length; i++) {
			Vesting storage _vesting = vestings[vestingIds[i]];
			_vestings[j] = Vesting(_vesting.vestingType, _vesting.vestingAddress);
			j += 1;
		}
		return _vestings;
	}

	/**
	 * @notice returns cliff and duration for Vesting & TeamVesting contracts
	 */
	function getVestingDetails(address _vestingAddress) external view returns (uint256 cliff, uint256 duration) {
		VestingLogic vesting = VestingLogic(_vestingAddress);
		return (vesting.cliff(), vesting.duration());
	}
}
