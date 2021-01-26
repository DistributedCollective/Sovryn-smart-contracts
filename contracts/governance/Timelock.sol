pragma solidity ^0.5.17;

import "../openzeppelin/SafeMath.sol";

interface ITimelock {
	function delay() external view returns (uint256);

	function GRACE_PERIOD() external view returns (uint256);

	function acceptAdmin() external;

	function queuedTransactions(bytes32 hash) external view returns (bool);

	function queueTransaction(
		address target,
		uint256 value,
		string calldata signature,
		bytes calldata data,
		uint256 eta
	) external returns (bytes32);

	function cancelTransaction(
		address target,
		uint256 value,
		string calldata signature,
		bytes calldata data,
		uint256 eta
	) external;

	function executeTransaction(
		address target,
		uint256 value,
		string calldata signature,
		bytes calldata data,
		uint256 eta
	) external payable returns (bytes memory);
}

contract Timelock is ITimelock {
	using SafeMath for uint256;

	uint256 public constant GRACE_PERIOD = 14 days;
	uint256 public constant MINIMUM_DELAY = 3 hours;
	uint256 public constant MAXIMUM_DELAY = 30 days;

	//4 bytes - 0x08c379a0 - method id
	//32 bytes - 2 parameters
	//32 bytes - bool, result
	//32 ... bytes - string, error message
	uint256 constant ERROR_MESSAGE_SHIFT = 68;

	address public admin;
	address public pendingAdmin;
	uint256 public delay;

	mapping(bytes32 => bool) public queuedTransactions;

	event NewAdmin(address indexed newAdmin);
	event NewPendingAdmin(address indexed newPendingAdmin);
	event NewDelay(uint256 indexed newDelay);
	event CancelTransaction(bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta);
	event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta);
	event QueueTransaction(bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta);

	constructor(address admin_, uint256 delay_) public {
		require(delay_ >= MINIMUM_DELAY, "Timelock::constructor: Delay must exceed minimum delay.");
		require(delay_ <= MAXIMUM_DELAY, "Timelock::setDelay: Delay must not exceed maximum delay.");

		admin = admin_;
		delay = delay_;
	}

	function() external payable {}

	function setDelay(uint256 delay_) public {
		require(msg.sender == address(this), "Timelock::setDelay: Call must come from Timelock.");
		require(delay_ >= MINIMUM_DELAY, "Timelock::setDelay: Delay must exceed minimum delay.");
		require(delay_ <= MAXIMUM_DELAY, "Timelock::setDelay: Delay must not exceed maximum delay.");
		delay = delay_;

		emit NewDelay(delay);
	}

	function acceptAdmin() public {
		require(msg.sender == pendingAdmin, "Timelock::acceptAdmin: Call must come from pendingAdmin.");
		admin = msg.sender;
		pendingAdmin = address(0);

		emit NewAdmin(admin);
	}

	function setPendingAdmin(address pendingAdmin_) public {
		require(msg.sender == address(this), "Timelock::setPendingAdmin: Call must come from Timelock.");
		pendingAdmin = pendingAdmin_;

		emit NewPendingAdmin(pendingAdmin);
	}

	function queueTransaction(
		address target,
		uint256 value,
		string memory signature,
		bytes memory data,
		uint256 eta
	) public returns (bytes32) {
		require(msg.sender == admin, "Timelock::queueTransaction: Call must come from admin.");
		require(eta >= getBlockTimestamp().add(delay), "Timelock::queueTransaction: Estimated execution block must satisfy delay.");

		bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
		queuedTransactions[txHash] = true;

		emit QueueTransaction(txHash, target, value, signature, data, eta);
		return txHash;
	}

	function cancelTransaction(
		address target,
		uint256 value,
		string memory signature,
		bytes memory data,
		uint256 eta
	) public {
		require(msg.sender == admin, "Timelock::cancelTransaction: Call must come from admin.");

		bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
		queuedTransactions[txHash] = false;

		emit CancelTransaction(txHash, target, value, signature, data, eta);
	}

	function executeTransaction(
		address target,
		uint256 value,
		string memory signature,
		bytes memory data,
		uint256 eta
	) public payable returns (bytes memory) {
		require(msg.sender == admin, "Timelock::executeTransaction: Call must come from admin.");

		bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
		require(queuedTransactions[txHash], "Timelock::executeTransaction: Transaction hasn't been queued.");
		require(getBlockTimestamp() >= eta, "Timelock::executeTransaction: Transaction hasn't surpassed time lock.");
		require(getBlockTimestamp() <= eta.add(GRACE_PERIOD), "Timelock::executeTransaction: Transaction is stale.");

		queuedTransactions[txHash] = false;

		bytes memory callData;

		if (bytes(signature).length == 0) {
			callData = data;
		} else {
			callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
		}

		// solium-disable-next-line security/no-call-value
		(bool success, bytes memory returnData) = target.call.value(value)(callData);
		if (!success) {
			if (returnData.length <= ERROR_MESSAGE_SHIFT) {
				revert("Timelock::executeTransaction: Transaction execution reverted.");
			} else {
				revert(_addErrorMessage("Timelock::executeTransaction: ", string(returnData)));
			}
		}

		emit ExecuteTransaction(txHash, target, value, signature, data, eta);

		return returnData;
	}

	function getBlockTimestamp() internal view returns (uint256) {
		// solium-disable-next-line security/no-block-members
		return block.timestamp;
	}

	function _addErrorMessage(string memory str1, string memory str2) internal pure returns (string memory) {
		bytes memory bytesStr1 = bytes(str1);
		bytes memory bytesStr2 = bytes(str2);
		string memory str12 = new string(bytesStr1.length + bytesStr2.length - ERROR_MESSAGE_SHIFT);
		bytes memory bytesStr12 = bytes(str12);
		uint256 j = 0;
		for (uint256 i = 0; i < bytesStr1.length; i++) {
			bytesStr12[j++] = bytesStr1[i];
		}
		for (uint256 i = ERROR_MESSAGE_SHIFT; i < bytesStr2.length; i++) {
			bytesStr12[j++] = bytesStr2[i];
		}
		return string(bytesStr12);
	}
}
