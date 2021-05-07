pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/IStaking.sol";
import "../IFeeSharingProxy.sol";
import "./IVestingFactory.sol";
import "./IVesting.sol";
import "./ITeamVesting.sol";
import "../../openzeppelin/SafeMath.sol";

contract VestingRegistry3 is Ownable {
	using SafeMath for uint256;

	IVestingFactory public vestingFactory;

	///@notice the SOV token contract
	address public SOV;

	///@notice the staking contract address
	address public staking;
	//@notice fee sharing proxy
	address public feeSharingProxy;
	//@notice the vesting owner (e.g. governance timelock address)
	address public vestingOwner;

	//TODO add to the documentation: address can have only one vesting of each type
	//user => vesting type => vesting contract
	mapping(address => mapping(uint256 => address)) public vestingContracts;

	//user => flag whether user has admin role
	mapping(address => bool) public admins;

	enum VestingType {
		TeamVesting, //MultisigVesting
		Vesting //TokenHolderVesting
	}

	event SOVTransferred(address indexed receiver, uint256 amount);
	event VestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
	event TeamVestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
	event TokensStaked(address indexed vesting, uint256 amount);
	event AdminAdded(address admin);
	event AdminRemoved(address admin);

	constructor(
		address _vestingFactory,
		address _SOV,
		address _staking,
		address _feeSharingProxy,
		address _vestingOwner
	) public {
		require(_SOV != address(0), "SOV address invalid");
		require(_staking != address(0), "staking address invalid");
		require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
		require(_vestingOwner != address(0), "vestingOwner address invalid");

		_setVestingFactory(_vestingFactory);

		SOV = _SOV;
		staking = _staking;
		feeSharingProxy = _feeSharingProxy;
		vestingOwner = _vestingOwner;
	}

	/**
	 * @dev Throws if called by any account other than the owner or admin.
	 */
	modifier onlyAuthorized() {
		require(isOwner() || admins[msg.sender], "unauthorized");
		_;
	}

	function addAdmin(address _admin) public onlyOwner {
		admins[_admin] = true;
		emit AdminAdded(_admin);
	}

	function removeAdmin(address _admin) public onlyOwner {
		admins[_admin] = false;
		emit AdminRemoved(_admin);
	}

	/**
	 * @notice sets vesting factory address
	 * @param _vestingFactory the address of vesting factory contract
	 */
	function setVestingFactory(address _vestingFactory) public onlyOwner {
		_setVestingFactory(_vestingFactory);
	}

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
		address vesting = _getOrCreateVesting(_tokenOwner, _cliff, _duration);
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
		address vesting = _getOrCreateTeamVesting(_tokenOwner, _cliff, _duration);
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
	 */
	function getVesting(address _tokenOwner) public view returns (address) {
		return vestingContracts[_tokenOwner][uint256(VestingType.Vesting)];
	}

	/**
	 * @notice returns team vesting contract address for the given token owner
	 * @param _tokenOwner the owner of the tokens
	 */
	function getTeamVesting(address _tokenOwner) public view returns (address) {
		return vestingContracts[_tokenOwner][uint256(VestingType.TeamVesting)];
	}

	function _getOrCreateVesting(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration
	) internal returns (address) {
		uint256 type_ = uint256(VestingType.Vesting);
		if (vestingContracts[_tokenOwner][type_] == address(0)) {
			//TODO Owner of OwnerVesting contracts - the same address as tokenOwner
			address vesting = vestingFactory.deployVesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharingProxy, _tokenOwner);
			vestingContracts[_tokenOwner][type_] = vesting;
		}
		return vestingContracts[_tokenOwner][type_];
	}

	function _getOrCreateTeamVesting(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration
	) internal returns (address) {
		uint256 type_ = uint256(VestingType.TeamVesting);
		if (vestingContracts[_tokenOwner][type_] == address(0)) {
			address vesting = vestingFactory.deployTeamVesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharingProxy, vestingOwner);
			vestingContracts[_tokenOwner][type_] = vesting;
		}
		return vestingContracts[_tokenOwner][type_];
	}
}
