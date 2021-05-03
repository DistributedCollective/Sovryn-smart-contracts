pragma solidity ^0.5.17;

import "../openzeppelin/SafeMath.sol";
import "../interfaces/IERC20.sol";

/**
 *  @title A holding contract for Sovryn Ethereum Pool to accept SOV Token.
 *  @author Franklin Richards - powerhousefrank@protonmail.com
 *  @notice You can use this contract for deposit of SOV tokens for some time and withdraw later.
 */
contract Escrow {
	using SafeMath for uint256;

	/* Storage */

	/// @notice The total tokens deposited.
	/// @dev Used for calculating the reward % share of users related to total deposit.
	uint256 public totalDeposit;
	/// @notice The release timestamp for the tokens deposited.
	uint256 public releaseTime;
	/// @notice The amount of token we would be accepting as deposit at max.
	uint256 public depositLimit;

	/// @notice The SOV token contract.
	IERC20 public SOV;

	/// @notice The multisig contract which handles the fund.
	address public multisig;

	/// @notice The user balances.
	mapping(address => uint256) userBalances;

	/// @notice The current contract status.
	/// @notice Deployed - Deployed the contract.
	/// @notice Deposit - Time to deposit in the contract by the users.
	/// @notice Holding - Deposit is closed and now the holding period starts.
	/// @notice Withdraw - Time to withdraw in the contract by the users.
	/// @notice Expired - The contract is now closed completely.
	enum Status { Deployed, Deposit, Holding, Withdraw, Expired }
	Status public status;

	/* Events */

	/// @notice Emitted when the contract deposit starts.
	event EscrowActivated();

	/// @notice Emitted when the contract is put in holding state. No new token deposit accepted by User.
	event EscrowInHoldingState();

	/// @notice Emitted when the contract is put in withdraw state. Users can now withdraw tokens.
	event EscrowInWithdrawState();

	/// @notice Emitted when the contract is expired after withdraws are made/total token transfer.
	event EscrowFundExpired();

	/// @notice Emitted when a new multisig is added to the contract.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _newMultisig The address which is added as the new multisig.
	/// @dev Can only be initiated by the current multisig.
	event NewMultisig(address indexed _initiator, address indexed _newMultisig);

	/// @notice Emitted when the release timestamp is updated.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _releaseTimestamp The updated release timestamp for the withdraw.
	event TokenReleaseUpdated(address indexed _initiator, uint256 _releaseTimestamp);

	/// @notice Emitted when the deposit limit is updated.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _depositLimit The updated deposit limit.
	event TokenDepositLimitUpdated(address indexed _initiator, uint256 _depositLimit);

	/// @notice Emitted when a new token deposit is done by User.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _amount The amount of token deposited.
	event TokenDeposit(address indexed _initiator, uint256 _amount);

	/// @notice Emitted when we reach the token deposit limit.
	event DepositLimitReached();

	/// @notice Emitted when a token withdraw is done by Multisig.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _amount The amount of token withdrawed.
	event TokenWithdrawByMultisig(address indexed _initiator, uint256 _amount);

	/// @notice Emitted when a new token deposit is done by Multisig.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _amount The amount of token deposited.
	event TokenDepositByMultisig(address indexed _initiator, uint256 _amount);

	/// @notice Emitted when a token withdraw is done by User.
	/// @param _initiator The address which initiated this event to be emitted.
	/// @param _amount The amount of token withdrawed.
	event TokenWithdraw(address indexed _initiator, uint256 _amount);

	/* Modifiers */

	modifier onlyMultisig() {
		require(msg.sender == multisig, "Only Multisig can call this.");
		_;
	}

	modifier checkStatus(Status s) {
		require(status == s, "The contract is not in the right state.");
		_;
	}

	modifier checkRelease() {
		require(releaseTime != 0 && releaseTime <= block.timestamp, "The release time has not started yet.");
		_;
	}

	/* Functions */

	/**
	 * @notice Setup the required parameters.
	 * @param _SOV The SOV token address.
	 * @param _multisig The owner of the tokens & contract.
	 * @param _releaseTime The token release time, zero if undecided.
	 * @param _depositLimit The amount of tokens we will be accepting.
	 */
	constructor(
		address _SOV,
		address _multisig,
		uint256 _releaseTime,
		uint256 _depositLimit
	) public {
		require(_SOV != address(0), "Invalid SOV Address.");
		require(_multisig != address(0), "Invalid Multisig Address.");

		SOV = IERC20(_SOV);
		multisig = _multisig;

		emit NewMultisig(msg.sender, _multisig);

		releaseTime = _releaseTime;
		depositLimit = _depositLimit;
	}

	/**
	 * @notice This function is called once after deployment for starting the deposit action.
	 * @dev Without calling this function, the contract will not start accepting tokens.
	 */
	function init() public onlyMultisig checkStatus(Status.Deployed) {
		status = Status.Deposit;

		emit EscrowActivated();
	}

	/**
	 * @notice Update Multisig.
	 * @param _newMultisig The new owner of the tokens & contract.
	 */
	function updateMultisig(address _newMultisig) public onlyMultisig {
		require(_newMultisig != address(0), "New Multisig address invalid.");

		multisig = _newMultisig;

		emit NewMultisig(msg.sender, _newMultisig);
	}

	/**
	 * @notice Update Release Timestamp.
	 * @param _newReleaseTime The new release timestamp for token release.
	 * @dev Zero is also a valid timestamp, if the release time is not scheduled yet.
	 */
	function updateReleaseTimestamp(uint256 _newReleaseTime) public onlyMultisig {
		releaseTime = _newReleaseTime;

		emit TokenReleaseUpdated(msg.sender, _newReleaseTime);
	}

	/**
	 * @notice Update Deposit Limit.
	 * @param _newDepositLimit The new deposit limit.
	 * @dev IMPORTANT: Should not decrease than already deposited.
	 */
	function updateDepositLimit(uint256 _newDepositLimit) public onlyMultisig {
		require(_newDepositLimit >= totalDeposit, "Deposit already higher than the limit trying to be set.");
		depositLimit = _newDepositLimit;

		emit TokenDepositLimitUpdated(msg.sender, _newDepositLimit);
	}

	/**
	 * @notice Deposit tokens to this contract by User.
	 * @param _amount the amount of tokens deposited.
	 * @dev The contract has to be approved by the user inorder for this function to work.
	 * These tokens can be withdrawn/transferred during Holding State by the Multisig.
	 */
	function depositTokens(uint256 _amount) public checkStatus(Status.Deposit) {
		require(_amount > 0, "Amount needs to be bigger than zero.");
		uint256 amount = _amount;

		if (totalDeposit.add(_amount) >= depositLimit) {
			uint256 difference = totalDeposit.add(_amount).sub(depositLimit);
			amount = _amount.sub(difference);
			emit DepositLimitReached();
		}

		bool txStatus = SOV.transferFrom(msg.sender, address(this), amount);
		require(txStatus, "Token transfer was not successful.");

		userBalances[msg.sender] = userBalances[msg.sender].add(amount);
		totalDeposit = totalDeposit.add(amount);

		emit TokenDeposit(msg.sender, amount);
	}

	/**
	 * @notice Update contract state to Holding.
	 * @dev Once called, the contract no longer accepts any more deposits.
	 * The multisig can now withdraw tokens from the contract after the contract is in Holding State.
	 */
	function changeStateToHolding() public onlyMultisig checkStatus(Status.Deposit) {
		status = Status.Holding;

		emit EscrowInHoldingState();
	}

	/**
	 * @notice Withdraws all token from the contract by Multisig.
	 * @param _receiverAddress The address where the tokens has to be transferred. Zero address if the withdraw is to be done in Multisig.
	 * @dev Can only be called after the token state is changed to Holding.
	 */
	function withdrawTokensByMultisig(address _receiverAddress) public onlyMultisig checkStatus(Status.Holding) {
		address receiverAddress = msg.sender;
		if (_receiverAddress != address(0)) {
			receiverAddress = _receiverAddress;
		}

		uint256 value = SOV.balanceOf(address(this));
		/// Sending the amount to multisig.
		bool txStatus = SOV.transfer(receiverAddress, value);
		require(txStatus, "Token transfer was not successful. Check receiver address.");

		emit TokenWithdrawByMultisig(msg.sender, value);
	}

	/**
	 * @notice Deposit tokens to this contract by the Multisig.
	 * @param _amount the amount of tokens deposited.
	 * @dev The contract has to be approved by the multisig inorder for this function to work.
	 * Once the token deposit is higher than the total deposits done, the contract state is changed to Withdraw.
	 */
	function depositTokensByMultisig(uint256 _amount) public onlyMultisig checkStatus(Status.Holding) {
		require(_amount > 0, "Amount needs to be bigger than zero.");

		bool txStatus = SOV.transferFrom(msg.sender, address(this), _amount);
		require(txStatus, "Token transfer was not successful.");

		emit TokenDepositByMultisig(msg.sender, _amount);

		if (SOV.balanceOf(address(this)) >= totalDeposit) {
			status = Status.Withdraw;
			emit EscrowInWithdrawState();
		}
	}

	/**
	 * @notice Withdraws token from the contract by User.
	 * @dev Only works after the contract state is in Withdraw.
	 */
	function withdrawTokens() public checkRelease checkStatus(Status.Withdraw) {
		uint256 amount = userBalances[msg.sender];
		userBalances[msg.sender] = 0;
		bool txStatus = SOV.transfer(msg.sender, amount);
		require(txStatus, "Token transfer was not successful. Check receiver address.");

		emit TokenWithdraw(msg.sender, amount);
	}

	/* Getter Functions */

	/**
	 * @notice Function to read the current token balance of a particular user.
	 * @return _addr The user address whose balance has to be checked.
	 */
	function getUserBalance(address _addr) public view returns (uint256 balance) {
		return userBalances[_addr];
	}
}
