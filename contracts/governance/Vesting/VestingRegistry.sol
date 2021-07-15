pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/IStaking.sol";
import "../IFeeSharingProxy.sol";
import "./IVestingFactory.sol";
import "./IVesting.sol";
import "./ITeamVesting.sol";
import "../../openzeppelin/SafeMath.sol";

/**
 * @title Vesting Registry contract.
 *
 * @notice On January 25, 2020, Sovryn launched the Genesis Reservation system.
 * Sovryn community members who controlled a special NFT were granted access to
 * stake BTC or rBTC for cSOV tokens at a rate of 2500 satoshis per cSOV. Per
 * SIP-0003, up to 2,000,000 cSOV were made available in the Genesis event,
 * which will be redeemable on a 1:1 basis for cSOV, subject to approval by
 * existing SOV holders.
 *
 * On 15 Feb 2021 Sovryn is taking another step in its journey to decentralized
 * financial sovereignty with the vote on SIP 0005. This proposal will enable
 * participants of the Genesis Reservation system to redeem their reserved cSOV
 * tokens for SOV. They will also have the choice to redeem cSOV for rBTC if
 * they decide to exit the system.
 *
 * This contract deals with the vesting and redemption of cSOV tokens.
 * */
contract VestingRegistry is Ownable {
	using SafeMath for uint256;

	/* Storage */

	/// @notice Constant used for computing the vesting dates.
	uint256 public constant FOUR_WEEKS = 4 weeks;

	uint256 public constant CSOV_VESTING_CLIFF = FOUR_WEEKS;
	uint256 public constant CSOV_VESTING_DURATION = 10 * FOUR_WEEKS;

	IVestingFactory public vestingFactory;

	/// @notice The SOV token contract.
	address public SOV;

	/// @notice The cSOV token contracts.
	address[] public CSOVtokens;

	uint256 public priceSats;

	/// @notice The staking contract address.
	address public staking;

	/// @notice Fee sharing proxy.
	address public feeSharingProxy;

	/// @notice The vesting owner (e.g. governance timelock address).
	address public vestingOwner;

	/// @dev TODO: Add to the documentation: address can have only one vesting of each type.
	/// @dev user => vesting type => vesting contract.
	mapping(address => mapping(uint256 => address)) public vestingContracts;

	/**
	 * @dev Struct can be created to save storage slots, but it doesn't make
	 * sense. We don't have a lot of blacklisted accounts or account with
	 * locked amount.
	 * */

	/// @dev user => flag whether user has already exchange cSOV or got a reimbursement.
	mapping(address => bool) public processedList;

	/// @dev user => flag whether user shouldn't be able to exchange or reimburse.
	mapping(address => bool) public blacklist;

	/// @dev user => amount of tokens should not be processed.
	mapping(address => uint256) public lockedAmount;

	/// @dev user => flag whether user has admin role.
	mapping(address => bool) public admins;

	enum VestingType {
		TeamVesting, // MultisigVesting
		Vesting // TokenHolderVesting
	}

	/* Events */

	event CSOVReImburse(address from, uint256 CSOVamount, uint256 reImburseAmount);
	event CSOVTokensExchanged(address indexed caller, uint256 amount);
	event SOVTransferred(address indexed receiver, uint256 amount);
	event VestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
	event TeamVestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
	event TokensStaked(address indexed vesting, uint256 amount);
	event AdminAdded(address admin);
	event AdminRemoved(address admin);

	/* Functions */

	/**
	 * @notice Contract deployment settings.
	 * @param _vestingFactory The address of vesting factory contract.
	 * @param _SOV The SOV token address.
	 * @param _CSOVtokens The array of cSOV tokens.
	 * @param _priceSats The price of cSOV tokens in satoshis.
	 * @param _staking The address of staking contract.
	 * @param _feeSharingProxy The address of fee sharing proxy contract.
	 * @param _vestingOwner The address of an owner of vesting contract.
	 * @dev On Sovryn the vesting owner is Exchequer Multisig.
	 * According to SIP-0007 The Exchequer Multisig is designated to hold
	 * certain funds in the form of rBTC and SOV, in order to allow for
	 * flexible deployment of such funds on:
	 *  + facilitating rBTC redemptions for Genesis pre-sale participants.
	 *  + deploying of SOV for the purposes of exchange listings, market
	 *    making, and partnerships with third parties.
	 * */
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

	//---ACL------------------------------------------------------------------

	/**
	 * @dev Throws if called by any account other than the owner or admin.
	 * TODO: This ACL logic should be available on OpenZeppeling Ownable.sol
	 * or on our own overriding sovrynOwnable. This same logic is repeated
	 * on OriginInvestorsClaim.sol, TokenSender.sol and VestingRegistry2.sol
	 */
	modifier onlyAuthorized() {
		require(isOwner() || admins[msg.sender], "unauthorized");
		_;
	}

	/**
	 * @notice Add account to ACL.
	 * @param _admin The addresses of the account to grant permissions.
	 * */
	function addAdmin(address _admin) public onlyOwner {
		admins[_admin] = true;
		emit AdminAdded(_admin);
	}

	/**
	 * @notice Remove account from ACL.
	 * @param _admin The addresses of the account to revoke permissions.
	 * */
	function removeAdmin(address _admin) public onlyOwner {
		admins[_admin] = false;
		emit AdminRemoved(_admin);
	}

	//---PostCSOV--------------------------------------------------------------

	modifier isNotProcessed() {
		require(!processedList[msg.sender], "Address cannot be processed twice");
		_;
	}

	modifier isNotBlacklisted() {
		require(!blacklist[msg.sender], "Address blacklisted");
		_;
	}

	/**
	 * @notice cSOV payout to sender with rBTC currency.
	 * 1.- Check holder cSOV balance by adding up every cSOV token balance.
	 * 2.- ReImburse rBTC if funds available.
	 * 3.- And store holder address in processedList.
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

		/**
		 * @dev Found and fixed the SIP-0007 bug on VestingRegistry::reImburse formula.
		 * More details at Documenting Code issues at point 11 in
		 * https://docs.google.com/document/d/10idTD1K6JvoBmtPKGuJ2Ub_mMh6qTLLlTP693GQKMyU/
		 * Previous buggy code: uint256 reImburseAmount = (CSOVAmountWei.mul(priceSats)).div(10**10);
		 * */
		uint256 reImburseAmount = (CSOVAmountWei.mul(priceSats)).div(10**8);
		require(address(this).balance >= reImburseAmount, "Not enough funds to reimburse");
		msg.sender.transfer(reImburseAmount);

		emit CSOVReImburse(msg.sender, CSOVAmountWei, reImburseAmount);
	}

	/**
	 * @notice Get contract balance.
	 * @return The token balance of the contract.
	 * */
	function budget() external view returns (uint256) {
		uint256 SCBudget = address(this).balance;
		return SCBudget;
	}

	/**
	 * @notice Deposit function to receiving value (rBTC).
	 * */
	function deposit() public payable {}

	/**
	 * @notice Send all contract balance to an account.
	 * @param to The account address to send the balance to.
	 * */
	function withdrawAll(address payable to) public onlyOwner {
		to.transfer(address(this).balance);
	}

	//--------------------------------------------------------------------------------------------------------------------------------------

	/**
	 * @notice Sets vesting factory address. High level endpoint.
	 * @param _vestingFactory The address of vesting factory contract.
	 *
	 * @dev Splitting code on two functions: high level and low level
	 * is a pattern that makes easy to extend functionality in a readable way,
	 * without accidentally breaking the actual action being performed.
	 * For example, checks should be done on high level endpoint, while core
	 * functionality should be coded on the low level function.
	 * */
	function setVestingFactory(address _vestingFactory) public onlyOwner {
		_setVestingFactory(_vestingFactory);
	}

	/**
	 * @notice Sets vesting factory address. Low level core function.
	 * @param _vestingFactory The address of vesting factory contract.
	 * */
	function _setVestingFactory(address _vestingFactory) internal {
		require(_vestingFactory != address(0), "vestingFactory address invalid");
		vestingFactory = IVestingFactory(_vestingFactory);
	}

	/**
	 * @notice Sets cSOV tokens array. High level endpoint.
	 * @param _CSOVtokens The array of cSOV tokens.
	 * */
	function setCSOVtokens(address[] memory _CSOVtokens) public onlyOwner {
		_setCSOVtokens(_CSOVtokens);
	}

	/**
	 * @notice Sets cSOV tokens array by looping through input. Low level function.
	 * @param _CSOVtokens The array of cSOV tokens.
	 * */
	function _setCSOVtokens(address[] memory _CSOVtokens) internal {
		for (uint256 i = 0; i < _CSOVtokens.length; i++) {
			require(_CSOVtokens[i] != address(0), "CSOV address invalid");
		}
		CSOVtokens = _CSOVtokens;
	}

	/**
	 * @notice Set blacklist flag (true/false).
	 * @param _account The address to be blacklisted.
	 * @param _blacklisted The flag to add/remove to/from a blacklist.
	 * */
	function setBlacklistFlag(address _account, bool _blacklisted) public onlyOwner {
		require(_account != address(0), "account address invalid");

		blacklist[_account] = _blacklisted;
	}

	/**
	 * @notice Set amount to be subtracted from user token balance.
	 * @param _account The address with locked amount.
	 * @param _amount The amount to be locked.
	 * */
	function setLockedAmount(address _account, uint256 _amount) public onlyOwner {
		require(_account != address(0), "account address invalid");
		require(_amount != 0, "amount invalid");

		lockedAmount[_account] = _amount;
	}

	/**
	 * @notice Transfer SOV tokens to given address.
	 *
	 * @dev This is a wrapper for ERC-20 transfer function w/
	 * additional checks and triggering an event.
	 *
	 * @param _receiver The address of the SOV receiver.
	 * @param _amount The amount to be transferred.
	 * */
	function transferSOV(address _receiver, uint256 _amount) public onlyOwner {
		require(_receiver != address(0), "receiver address invalid");
		require(_amount != 0, "amount invalid");

		IERC20(SOV).transfer(_receiver, _amount);
		emit SOVTransferred(_receiver, _amount);
	}

	/**
	 * @notice Exchange cSOV to SOV with 1:1 rate
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

	/**
	 * @notice cSOV tokens are moved and staked on Vesting contract.
	 * @param _amount The amount of tokens to be vested.
	 * */
	function _createVestingForCSOV(uint256 _amount) internal {
		address vesting = _getOrCreateVesting(msg.sender, CSOV_VESTING_CLIFF, CSOV_VESTING_DURATION);

		IERC20(SOV).approve(vesting, _amount);
		IVesting(vesting).stakeTokens(_amount);

		emit CSOVTokensExchanged(msg.sender, _amount);
	}

	/**
	 * @notice Check a token address is among the cSOV token addresses.
	 * @param _CSOV The cSOV token address.
	 * */
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
	 * @notice Create Vesting contract.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _amount The amount to be staked.
	 * @param _cliff The time interval to the first withdraw in seconds.
	 * @param _duration The total duration in seconds.
	 * */
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
	 * @notice Create Team Vesting contract.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _amount The amount to be staked.
	 * @param _cliff The time interval to the first withdraw in seconds.
	 * @param _duration The total duration in seconds.
	 * */
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
	 * @notice Stake tokens according to the vesting schedule.
	 * @param _vesting The address of Vesting contract.
	 * @param _amount The amount of tokens to stake.
	 * */
	function stakeTokens(address _vesting, uint256 _amount) public onlyAuthorized {
		require(_vesting != address(0), "vesting address invalid");
		require(_amount > 0, "amount invalid");

		IERC20(SOV).approve(_vesting, _amount);
		IVesting(_vesting).stakeTokens(_amount);
		emit TokensStaked(_vesting, _amount);
	}

	/**
	 * @notice Query the vesting contract for an account.
	 * @param _tokenOwner The owner of the tokens.
	 * @return The vesting contract address for the given token owner.
	 * */
	function getVesting(address _tokenOwner) public view returns (address) {
		return vestingContracts[_tokenOwner][uint256(VestingType.Vesting)];
	}

	/**
	 * @notice Query the team vesting contract for an account.
	 * @param _tokenOwner The owner of the tokens.
	 * @return The team vesting contract address for the given token owner.
	 * */
	function getTeamVesting(address _tokenOwner) public view returns (address) {
		return vestingContracts[_tokenOwner][uint256(VestingType.TeamVesting)];
	}

	/**
	 * @notice If not exists, deploy a vesting contract through factory.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _cliff The time interval to the first withdraw in seconds.
	 * @param _duration The total duration in seconds.
	 * @return The vesting contract address for the given token owner
	 * whether it existed previously or not.
	 * */
	function _getOrCreateVesting(
		address _tokenOwner,
		uint256 _cliff,
		uint256 _duration
	) internal returns (address) {
		uint256 type_ = uint256(VestingType.Vesting);
		if (vestingContracts[_tokenOwner][type_] == address(0)) {
			/// @dev TODO: Owner of OwnerVesting contracts - the same address as tokenOwner.
			address vesting = vestingFactory.deployVesting(SOV, staking, _tokenOwner, _cliff, _duration, feeSharingProxy, _tokenOwner);
			vestingContracts[_tokenOwner][type_] = vesting;
		}
		return vestingContracts[_tokenOwner][type_];
	}

	/**
	 * @notice If not exists, deploy a team vesting contract through factory.
	 * @param _tokenOwner The owner of the tokens.
	 * @param _cliff The time interval to the first withdraw in seconds.
	 * @param _duration The total duration in seconds.
	 * @return The team vesting contract address for the given token owner
	 * whether it existed previously or not.
	 * */
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
