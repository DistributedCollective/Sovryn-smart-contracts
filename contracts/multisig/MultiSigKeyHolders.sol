pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/Ownable.sol";

/**
 * @title Multi Signature Key Holders contract.
 *
 * This contract contains the implementation of functions to add and remove
 * key holders w/ rBTC and BTC addresses.
 * */
contract MultiSigKeyHolders is Ownable {
	/* Storage */

	uint256 public constant MAX_OWNER_COUNT = 50;

	string private constant ERROR_INVALID_ADDRESS = "Invalid address";
	string private constant ERROR_INVALID_REQUIRED = "Invalid required";

	/// Flag and index for Ethereum address.
	mapping(address => Data) private isEthereumAddressAdded;

	/// List of Ethereum addresses.
	address[] private ethereumAddresses;

	/// Required number of signatures for the Ethereum multisig.
	uint256 public ethereumRequired = 2;

	/// Flag and index for Bitcoin address.
	mapping(string => Data) private isBitcoinAddressAdded;

	/// List of Bitcoin addresses.
	string[] private bitcoinAddresses;

	/// Required number of signatures for the Bitcoin multisig.
	uint256 public bitcoinRequired = 2;

	/// Helps removing items from array.
	struct Data {
		bool added;
		uint248 index;
	}

	/* Events */

	event EthereumAddressAdded(address indexed account);
	event EthereumAddressRemoved(address indexed account);
	event EthereumRequirementChanged(uint256 required);
	event BitcoinAddressAdded(string account);
	event BitcoinAddressRemoved(string account);
	event BitcoinRequirementChanged(uint256 required);

	/* Modifiers */

	modifier validRequirement(uint256 ownerCount, uint256 _required) {
		require(ownerCount <= MAX_OWNER_COUNT && _required <= ownerCount && _required != 0 && ownerCount != 0, ERROR_INVALID_REQUIRED);
		_;
	}

	/* Functions */

	/**
	 * @notice Add rBTC address to the key holders.
	 * @param _address The address to be added.
	 * */
	function addEthereumAddress(address _address) public onlyOwner {
		_addEthereumAddress(_address);
	}

	/**
	 * @notice Add rBTC addresses to the key holders.
	 * @param _address The addresses to be added.
	 * */
	function addEthereumAddresses(address[] memory _address) public onlyOwner {
		for (uint256 i = 0; i < _address.length; i++) {
			_addEthereumAddress(_address[i]);
		}
	}

	/**
	 * @notice Internal function to add rBTC address to the key holders.
	 * @param _address The address to be added.
	 * */
	function _addEthereumAddress(address _address) internal {
		require(_address != address(0), ERROR_INVALID_ADDRESS);

		if (!isEthereumAddressAdded[_address].added) {
			isEthereumAddressAdded[_address] = Data({ added: true, index: uint248(ethereumAddresses.length) });
			ethereumAddresses.push(_address);
		}

		emit EthereumAddressAdded(_address);
	}

	/**
	 * @notice Remove rBTC address to the key holders.
	 * @param _address The address to be removed.
	 * */
	function removeEthereumAddress(address _address) public onlyOwner {
		_removeEthereumAddress(_address);
	}

	/**
	 * @notice Remove rBTC addresses to the key holders.
	 * @param _address The addresses to be removed.
	 * */
	function removeEthereumAddresses(address[] memory _address) public onlyOwner {
		for (uint256 i = 0; i < _address.length; i++) {
			_removeEthereumAddress(_address[i]);
		}
	}

	/**
	 * @notice Internal function to remove rBTC address to the key holders.
	 * @param _address The address to be removed.
	 * */
	function _removeEthereumAddress(address _address) internal {
		require(_address != address(0), ERROR_INVALID_ADDRESS);

		if (isEthereumAddressAdded[_address].added) {
			uint248 index = isEthereumAddressAdded[_address].index;
			if (index != ethereumAddresses.length - 1) {
				ethereumAddresses[index] = ethereumAddresses[ethereumAddresses.length - 1];
				isEthereumAddressAdded[ethereumAddresses[index]].index = index;
			}
			ethereumAddresses.length--;
			delete isEthereumAddressAdded[_address];
		}

		emit EthereumAddressRemoved(_address);
	}

	/**
	 * @notice Get whether rBTC address is a key holder.
	 * @param _address The rBTC address to be checked.
	 * */
	function isEthereumAddressOwner(address _address) public view returns (bool) {
		return isEthereumAddressAdded[_address].added;
	}

	/**
	 * @notice Get array of rBTC key holders.
	 * */
	function getEthereumAddresses() public view returns (address[] memory) {
		return ethereumAddresses;
	}

	/**
	 * @notice Set flag ethereumRequired to true/false.
	 * @param _required The new value of the ethereumRequired flag.
	 * */
	function changeEthereumRequirement(uint256 _required) public onlyOwner validRequirement(ethereumAddresses.length, _required) {
		ethereumRequired = _required;
		emit EthereumRequirementChanged(_required);
	}

	/**
	 * @notice Add bitcoin address to the key holders.
	 * @param _address The address to be added.
	 * */
	function addBitcoinAddress(string memory _address) public onlyOwner {
		_addBitcoinAddress(_address);
	}

	/**
	 * @notice Add bitcoin addresses to the key holders.
	 * @param _address The addresses to be added.
	 * */
	function addBitcoinAddresses(string[] memory _address) public onlyOwner {
		for (uint256 i = 0; i < _address.length; i++) {
			_addBitcoinAddress(_address[i]);
		}
	}

	/**
	 * @notice Internal function to add bitcoin address to the key holders.
	 * @param _address The address to be added.
	 * */
	function _addBitcoinAddress(string memory _address) internal {
		require(bytes(_address).length != 0, ERROR_INVALID_ADDRESS);

		if (!isBitcoinAddressAdded[_address].added) {
			isBitcoinAddressAdded[_address] = Data({ added: true, index: uint248(bitcoinAddresses.length) });
			bitcoinAddresses.push(_address);
		}

		emit BitcoinAddressAdded(_address);
	}

	/**
	 * @notice Remove bitcoin address to the key holders.
	 * @param _address The address to be removed.
	 * */
	function removeBitcoinAddress(string memory _address) public onlyOwner {
		_removeBitcoinAddress(_address);
	}

	/**
	 * @notice Remove bitcoin addresses to the key holders.
	 * @param _address The addresses to be removed.
	 * */
	function removeBitcoinAddresses(string[] memory _address) public onlyOwner {
		for (uint256 i = 0; i < _address.length; i++) {
			_removeBitcoinAddress(_address[i]);
		}
	}

	/**
	 * @notice Internal function to remove bitcoin address to the key holders.
	 * @param _address The address to be removed.
	 * */
	function _removeBitcoinAddress(string memory _address) internal {
		require(bytes(_address).length != 0, ERROR_INVALID_ADDRESS);

		if (isBitcoinAddressAdded[_address].added) {
			uint248 index = isBitcoinAddressAdded[_address].index;
			if (index != bitcoinAddresses.length - 1) {
				bitcoinAddresses[index] = bitcoinAddresses[bitcoinAddresses.length - 1];
				isBitcoinAddressAdded[bitcoinAddresses[index]].index = index;
			}
			bitcoinAddresses.length--;
			delete isBitcoinAddressAdded[_address];
		}

		emit BitcoinAddressRemoved(_address);
	}

	/**
	 * @notice Get whether bitcoin address is a key holder.
	 * @param _address The bitcoin address to be checked.
	 * */
	function isBitcoinAddressOwner(string memory _address) public view returns (bool) {
		return isBitcoinAddressAdded[_address].added;
	}

	/**
	 * @notice Get array of bitcoin key holders.
	 * */
	function getBitcoinAddresses() public view returns (string[] memory) {
		return bitcoinAddresses;
	}

	/**
	 * @notice Set flag bitcoinRequired to true/false.
	 * @param _required The new value of the bitcoinRequired flag.
	 * */
	function changeBitcoinRequirement(uint256 _required) public onlyOwner validRequirement(bitcoinAddresses.length, _required) {
		bitcoinRequired = _required;
		emit BitcoinRequirementChanged(_required);
	}

	/**
	 * @notice Add rBTC and bitcoin addresses to the key holders.
	 * @param _ethereumAddress the rBTC addresses to be added.
	 * @param _bitcoinAddress the bitcoin addresses to be added.
	 * */
	function addEthereumAndBitcoinAddresses(address[] memory _ethereumAddress, string[] memory _bitcoinAddress) public onlyOwner {
		for (uint256 i = 0; i < _ethereumAddress.length; i++) {
			_addEthereumAddress(_ethereumAddress[i]);
		}
		for (uint256 i = 0; i < _bitcoinAddress.length; i++) {
			_addBitcoinAddress(_bitcoinAddress[i]);
		}
	}

	/**
	 * @notice Remove rBTC and bitcoin addresses to the key holders.
	 * @param _ethereumAddress The rBTC addresses to be removed.
	 * @param _bitcoinAddress The bitcoin addresses to be removed.
	 * */
	function removeEthereumAndBitcoinAddresses(address[] memory _ethereumAddress, string[] memory _bitcoinAddress) public onlyOwner {
		for (uint256 i = 0; i < _ethereumAddress.length; i++) {
			_removeEthereumAddress(_ethereumAddress[i]);
		}
		for (uint256 i = 0; i < _bitcoinAddress.length; i++) {
			_removeBitcoinAddress(_bitcoinAddress[i]);
		}
	}
}
