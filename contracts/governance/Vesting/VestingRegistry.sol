pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/IStaking.sol";
import "../IFeeSharingProxy.sol";
import "./IVestingFactory.sol";
import "./IVesting.sol";
import "./ITeamVesting.sol";
import "../../openzeppelin/SafeMath.sol";

contract VestingRegistry is Ownable {
	using SafeMath for uint256;

	///@notice constant used for computing the vesting dates
	uint256 public constant FOUR_WEEKS = 4 weeks;

	uint256 public constant CSOV_VESTING_CLIFF = FOUR_WEEKS;
	uint256 public constant CSOV_VESTING_DURATION = 10 * FOUR_WEEKS;

	IVestingFactory public vestingFactory;

	///@notice the SOV token contract
	address public SOV;
	///@notice the CSOV token contracts
	address[] public CSOVtokens;

	uint256 public priceSats;

	///@notice the staking contract address
	address public staking;
	//@notice fee sharing proxy
	address public feeSharingProxy;
	//@notice the vesting owner (e.g. governance timelock address)
	address public vestingOwner;

	//TODO add to the documentation: address can have only one vesting of each type
	//user => vesting type => vesting contract
	mapping(address => mapping(uint256 => address)) public vestingContracts;

	//struct can be created to save storage slots, but it doesn't make sense
	//we don't have a lot of blacklisted accounts or account with locked amount
	//user => flag whether user has already exchange cSV or got a reimbursement
	mapping(address => bool) public processedList;
	//user => flag whether user shouldn't be able to exchange or reimburse
	mapping(address => bool) public blacklist;
	//user => amount of tokens should not be processed
	mapping(address => uint256) public lockedAmount;

	//user => flag whether user has admin role
	mapping(address => bool) public admins;

	enum VestingType {
		TeamVesting, //MultisigVesting
		Vesting //TokenHolderVesting
	}

	event CSOVReImburse(address from, uint256 CSOVamount, uint256 reImburseAmount);
	event CSOVTokensExchanged(address indexed caller, uint256 amount);
	event SOVTransferred(address indexed receiver, uint256 amount);
	event VestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
	event TeamVestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
	event TokensStaked(address indexed vesting, uint256 amount);
	event AdminAdded(address admin);
	event AdminRemoved(address admin);

	constructor(
		address _vestingFactory,
		address _SOV,
		address[] memory _CSOVtokens,
		uint256 _priceSats,
		address _staking,
		address _feeSharingProxy,
		address _vestingOwner
	) public {
		require(_SOV != address(0), "SOV address invalid");
		require(_staking != address(0), "staking address invalid");
		require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
		require(_vestingOwner != address(0), "vestingOwner address invalid");

		_setVestingFactory(_vestingFactory);
		_setCSOVtokens(_CSOVtokens);

		SOV = _SOV;
		priceSats = _priceSats;
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

	//---PostCSOV---------------------------------------------------------------------------------------------------------------------------

	modifier isNotProcessed() {
		require(!processedList[msg.sender], "Address cannot be processed twice");
		_;
	}

	modifier isNotBlacklisted() {
		require(!blacklist[msg.sender], "Address blacklisted");
		_;
	}

	/**
	 * @dev reImburse - check holder CSOV balance, ReImburse RBTC and store holder address in processedList
	 */
	function reImburse() public isNotProcessed isNotBlacklisted {
		uint256 CSOVAmountWei = 0;
		for (uint256 i = 0; i < CSOVtokens.length; i++) {
			address CSOV = CSOVtokens[i];
			uint256 balance = IERC20(CSOV).balanceOf(msg.sender);
			CSOVAmountWei = CSOVAmountWei.add(balance);
		}

		require(CSOVAmountWei > lockedAmount[msg.sender], "holder has no CSOV");
		CSOVAmountWei -= lockedAmount[msg.sender];
		processedList[msg.sender] = true;

		uint256 reImburseAmount = (CSOVAmountWei.mul(priceSats)).div(10**10);
		require(address(this).balance >= reImburseAmount, "Not enough funds to reimburse");
		msg.sender.transfer(reImburseAmount);

		emit CSOVReImburse(msg.sender, CSOVAmountWei, reImburseAmount);
	}

	function budget() external view returns (uint256) {
		uint256 SCBudget = address(this).balance;
		return SCBudget;
	}

	function deposit() public payable {}

	function withdrawAll(address payable to) public onlyOwner {
		to.transfer(address(this).balance);
	}

	//--------------------------------------------------------------------------------------------------------------------------------------

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
	 * @notice sets CSON tokens array
	 * @param _CSOVtokens the array of CSOV tokens
	 */
	function setCSOVtokens(address[] memory _CSOVtokens) public onlyOwner {
		_setCSOVtokens(_CSOVtokens);
	}

	function _setCSOVtokens(address[] memory _CSOVtokens) internal {
		for (uint256 i = 0; i < _CSOVtokens.length; i++) {
			require(_CSOVtokens[i] != address(0), "CSOV address invalid");
		}
		CSOVtokens = _CSOVtokens;
	}

	/**
	 * @notice sets blacklist flag
	 * @param _account the address to be blacklisted
	 * @param _blacklisted the flag to add/remove to/from a blacklist
	 */
	function setBlacklistFlag(address _account, bool _blacklisted) public onlyOwner {
		require(_account != address(0), "account address invalid");

		blacklist[_account] = _blacklisted;
	}

	/**
	 * @notice sets amount to be subtracted from user token balance
	 * @param _account the address with locked amount
	 * @param _amount the amount is locked
	 */
	function setLockedAmount(address _account, uint256 _amount) public onlyOwner {
		require(_account != address(0), "account address invalid");
		require(_amount != 0, "amount invalid");

		lockedAmount[_account] = _amount;
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
	 * @notice exchanges CSOV to SOV with 1:1 rate
	 */
	function exchangeAllCSOV() public isNotProcessed isNotBlacklisted {
		processedList[msg.sender] = true;

		uint256 amount = 0;
		for (uint256 i = 0; i < CSOVtokens.length; i++) {
			address CSOV = CSOVtokens[i];
			uint256 balance = IERC20(CSOV).balanceOf(msg.sender);
			amount += balance;
		}

		require(amount > lockedAmount[msg.sender], "amount invalid");
		amount -= lockedAmount[msg.sender];

		_createVestingForCSOV(amount);
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
