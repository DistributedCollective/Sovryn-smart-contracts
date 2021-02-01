pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/IStaking.sol";
import "../IFeeSharingProxy.sol";
import "./IVestingFactory.sol";
import "./IVesting.sol";
import "./ITeamVesting.sol";
import "./IDevelopmentVesting.sol";

contract VestingRegistry is Ownable {
	///@notice constant used for computing the vesting dates
	uint256 public constant FOUR_WEEKS = 4 weeks;

	uint256 public constant CSOV_VESTING_CLIFF = FOUR_WEEKS;
	uint256 public constant CSOV_VESTING_DURATION = 10 * FOUR_WEEKS;

	uint256 public constant TEAM_VESTING_CLIFF = 6 * FOUR_WEEKS;
	uint256 public constant TEAM_VESTING_DURATION = 36 * FOUR_WEEKS;

	IVestingFactory public vestingFactory;

	///@notice the SOV token contract
	address public SOV;
	///@notice the CSOV token contracts
	address[] public CSOVtokens;

	///@notice the staking contract address
	address public staking;
	//@notice fee sharing proxy
	address public feeSharingProxy;
	//@notice the governance timelock address
	address public governanceTimelock;

	//TODO can user have more than one vesting contract of some type ?
	//user => vesting type => vesting contract
	mapping(address => mapping(uint256 => address)) public vestingContracts;

	enum VestingType {
		MultisigVesting, //TeamVesting
		TokenHolderVesting, //Vesting
		DevelopmentVesting, //Development fund
		AdoptionVesting //Adoption fund
		//TODO Ecosystem fund, Programmatic sale
	}

	event CSOVTokensExchanged(address indexed caller, uint256 amount);
	event SOVTransferred(address indexed receiver, uint256 amount);
	event VestingCreated(address indexed tokenOwner, uint256 cliff, uint256 duration, uint amount);
	event TeamVestingCreated(address indexed tokenOwner, uint256 cliff, uint256 duration, uint amount);
	event DevelopmentVestingCreated(address indexed tokenOwner, uint256 cliff, uint256 duration, uint256 frequency, uint amount);
	event AdoptionVestingCreated(address indexed tokenOwner, uint256 cliff, uint256 duration, uint256 frequency, uint amount);

	constructor(
		address _vestingFactory,
		address _SOV,
		address[] memory _CSOVtokens,
		address _staking,
		address _feeSharingProxy,
		address _governanceTimelock
	) public {
		require(_vestingFactory != address(0), "vestingFactory address invalid");
		require(_SOV != address(0), "SOV address invalid");
		for (uint256 i = 0; i < _CSOVtokens.length; i++) {
			require(_CSOVtokens[i] != address(0), "CSOV address invalid");
		}
		require(_staking != address(0), "staking address invalid");
		require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
		require(_governanceTimelock != address(0), "governanceTimelock address invalid");

		vestingFactory = IVestingFactory(_vestingFactory);
		SOV = _SOV;
		CSOVtokens = _CSOVtokens;
		staking = _staking;
		feeSharingProxy = _feeSharingProxy;
		governanceTimelock = _governanceTimelock;
	}

	function transferSOV(address _receiver, uint256 _amount) public onlyOwner {
		require(_receiver != address(0), "receiver address invalid");
		require(_amount != 0, "amount invalid");

		IERC20(SOV).transfer(_receiver, _amount);
		emit SOVTransferred(_receiver, _amount);
	}

	//TODO exchangeAllCSOV or exchangeCSOV ?
	//TODO transfer or mark as already converted if non-transferable
	//TODO do we need a blacklist?
	function exchangeAllCSOV() public {
		uint256 amount = 0;
		for (uint256 i = 0; i < CSOVtokens.length; i++) {
			address CSOV = CSOVtokens[i];
			uint256 balance = IERC20(CSOV).balanceOf(msg.sender);
			if (balance == 0) {
				continue;
			}
			bool success = IERC20(CSOV).transferFrom(msg.sender, address(this), balance);
			require(success, "transfer failed");
			amount += balance;
		}

		require(amount > 0, "amount invalid");
		_createVestingForCSOV(amount);
	}

	function exchangeCSOV(address _CSOV, uint256 _amount) public {
		_validateCSOV(_CSOV);
		require(_amount > 0, "amount invalid");

		bool success = IERC20(_CSOV).transferFrom(msg.sender, address(this), _amount);
		require(success, "transfer failed");

		_createVestingForCSOV(_amount);
	}

	function _createVestingForCSOV(uint256 _amount) internal {
		address vesting = _getOrCreateVesting(msg.sender, CSOV_VESTING_CLIFF, CSOV_VESTING_DURATION);

		IERC20(SOV).approve(vesting, _amount);
		IVesting(vesting).stakeTokens(_amount);

		emit CSOVTokensExchanged(msg.sender, _amount);
	}

	function _validateCSOV(address _CSOV) internal view {
		bool isValid = false;
		for (uint256 i = 0; i < CSOVtokens.length; i++) {
			if (_CSOV == CSOVtokens[i]) {
				isValid = true;
				break;
			}
		}
		require(isValid, "wrong CSOV address");
	}

	//TODO cliff - FOUR_WEEKS ?
	function createVesting(
		address _tokenOwner,
		uint256 _amount,
		uint256 _duration
	) public onlyOwner {
		uint256 cliff = FOUR_WEEKS;
		address vesting = _getOrCreateVesting(_tokenOwner, cliff, _duration);
		IERC20(SOV).approve(vesting, _amount);
		IVesting(vesting).stakeTokens(_amount);
		emit VestingCreated(_tokenOwner, cliff, _duration, _amount);
	}

	function createTeamVesting(address _tokenOwner, uint256 _amount) public onlyOwner {
		address vesting = _getOrCreateTeamVesting(_tokenOwner, TEAM_VESTING_CLIFF, TEAM_VESTING_DURATION);
		IERC20(SOV).approve(vesting, _amount);
		IVesting(vesting).stakeTokens(_amount);
		emit VestingCreated(_tokenOwner, TEAM_VESTING_CLIFF, TEAM_VESTING_DURATION, _amount);
	}

	function createDevelopmentVesting(
		address _tokenOwner,
		uint256 _amount,
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) public onlyOwner {
		address vesting = _getOrCreateDevelopmentVesting(_tokenOwner, _cliff, _duration, _frequency);
		IERC20(SOV).approve(vesting, _amount);
		IDevelopmentVesting(vesting).vestTokens(_amount);
		emit DevelopmentVestingCreated(_tokenOwner, _cliff, _duration, _frequency, _amount);
	}

	function createAdoptionVesting(
		address _tokenOwner,
		uint256 _amount,
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) public onlyOwner {
		address vesting = _getOrCreateAdoptionVesting(_tokenOwner, _cliff, _duration, _frequency);
		IERC20(SOV).approve(vesting, _amount);
		IDevelopmentVesting(vesting).vestTokens(_amount);
		emit AdoptionVestingCreated(_tokenOwner, _cliff, _duration, _frequency, _amount);
	}

	function getVesting(address _tokenOwner) public view returns (address) {
		return vestingContracts[_tokenOwner][uint256(VestingType.TokenHolderVesting)];
	}

	function getTeamVesting(address _tokenOwner) public view returns (address) {
		return vestingContracts[_tokenOwner][uint256(VestingType.MultisigVesting)];
	}

	function getDevelopmentVesting(address _tokenOwner) public view returns (address) {
		return vestingContracts[_tokenOwner][uint256(VestingType.DevelopmentVesting)];
	}

	function getAdoptionVesting(address _tokenOwner) public view returns (address) {
		return vestingContracts[_tokenOwner][uint256(VestingType.AdoptionVesting)];
	}

	function _getOrCreateVesting(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration
	) internal returns (address) {
		uint256 type_ = uint256(VestingType.TokenHolderVesting);
		if (vestingContracts[_tokenOwner][type_] == address(0)) {
			//TODO governanceTimelock ?
			address vesting = vestingFactory.deployVesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharingProxy, governanceTimelock);
			vestingContracts[_tokenOwner][type_] = vesting;
		}
		return vestingContracts[_tokenOwner][type_];
	}

	function _getOrCreateTeamVesting(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration
	) internal returns (address) {
		uint256 type_ = uint256(VestingType.MultisigVesting);
		if (vestingContracts[_tokenOwner][type_] == address(0)) {
			//TODO governanceTimelock ?
			address vesting = vestingFactory.deployTeamVesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharingProxy, governanceTimelock);
			vestingContracts[_tokenOwner][type_] = vesting;
		}
		return vestingContracts[_tokenOwner][type_];
	}

	function _getOrCreateDevelopmentVesting(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) internal returns (address) {
		uint256 type_ = uint256(VestingType.DevelopmentVesting);
		return _getOrCreateAdoptionOrDevelopmentVesting(type_, _tokenOwner, _cliff, _duration, _frequency);
	}

	function _getOrCreateAdoptionVesting(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) internal returns (address) {
		uint256 type_ = uint256(VestingType.AdoptionVesting);
		return _getOrCreateAdoptionOrDevelopmentVesting(type_, _tokenOwner, _cliff, _duration, _frequency);
	}

	function _getOrCreateAdoptionOrDevelopmentVesting(
		uint256 _type,
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration,
		uint256 _frequency
	) internal returns (address) {
		if (vestingContracts[_tokenOwner][_type] == address(0)) {
			//TODO governanceTimelock ?
			address vesting = vestingFactory.deployDevelopmentVesting(SOV, _tokenOwner, _cliff, _duration, _frequency, governanceTimelock);
			vestingContracts[_tokenOwner][_type] = vesting;
		}
		return vestingContracts[_tokenOwner][_type];
	}
}
