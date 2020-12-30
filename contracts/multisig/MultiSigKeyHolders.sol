pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/Ownable.sol";

contract MultiSigKeyHolders is Ownable {

    string private constant ERROR_INVALID_ADDRESS = "Invalid address";

    //flag and index for Ethereum address
    mapping (address => Data) private isEthereumAddressAdded;
    //list of Ethereum addresses
    address[] private ethereumAddresses;

    //flag and index for Bitcoin address
    mapping (string => Data) private isBitcoinAddressAdded;
    //list of Bitcoin addresses
    string[] private bitcoinAddresses;

    //helps removing items from array
    struct Data {
        bool added;
        uint248 index;
    }

    event EthereumAddressAdded(address indexed account);
    event EthereumAddressRemoved(address indexed account);
    event BitcoinAddressAdded(string account);
    event BitcoinAddressRemoved(string account);

    /**
     * @notice adds ethereum address to the key holders
     * @param _address the address to be added
     */
    function addEthereumAddress(address _address) public onlyOwner {
        _addEthereumAddress(_address);
    }

    /**
     * @notice adds ethereum addresses to the key holders
     * @param _address the addresses to be added
     */
    function addEthereumAddresses(address[] memory _address) public onlyOwner {
        for (uint i = 0; i < _address.length; i++) {
            _addEthereumAddress(_address[i]);
        }
    }

    function _addEthereumAddress(address _address) internal {
        require(_address != address(0), ERROR_INVALID_ADDRESS);

        if (! isEthereumAddressAdded[_address].added) {
            isEthereumAddressAdded[_address] = Data({
                added: true,
                index: uint248(ethereumAddresses.length)
            });
            ethereumAddresses.push(_address);
        }

        emit EthereumAddressAdded(_address);
    }

    /**
     * @notice removes ethereum address to the key holders
     * @param _address the address to be removed
     */
    function removeEthereumAddress(address _address) public onlyOwner {
        _removeEthereumAddress(_address);
    }

    /**
     * @notice removes ethereum addresses to the key holders
     * @param _address the addresses to be removed
     */
    function removeEthereumAddresses(address[] memory _address) public onlyOwner {
        for (uint i = 0; i < _address.length; i++) {
            _removeEthereumAddress(_address[i]);
        }
    }

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
     * @notice returns whether ethereum address is a key holder
     * @param _address the ethereum address to be checked
     */
    function isEthereumAddressOwner(address _address) public view returns (bool) {
        return isEthereumAddressAdded[_address].added;
    }

    /**
     * @notice returns array of ethereum key holders
     */
    function getEthereumAddresses() public view returns (address[] memory) {
        return ethereumAddresses;
    }

    /**
     * @notice adds bitcoin address to the key holders
     * @param _address the address to be added
     */
    function addBitcoinAddress(string memory _address) public onlyOwner {
        _addBitcoinAddress(_address);
    }

    /**
     * @notice adds bitcoin addresses to the key holders
     * @param _address the addresses to be added
     */
    function addBitcoinAddresses(string[] memory _address) public onlyOwner {
        for (uint i = 0; i < _address.length; i++) {
            _addBitcoinAddress(_address[i]);
        }
    }

    function _addBitcoinAddress(string memory _address) internal {
        require(bytes(_address).length != 0, ERROR_INVALID_ADDRESS);

        if (! isBitcoinAddressAdded[_address].added) {
            isBitcoinAddressAdded[_address] = Data({
                added: true,
                index: uint248(bitcoinAddresses.length)
            });
            bitcoinAddresses.push(_address);
        }

        emit BitcoinAddressAdded(_address);
    }

    /**
     * @notice removes bitcoin address to the key holders
     * @param _address the address to be removed
     */
    function removeBitcoinAddress(string memory _address) public onlyOwner {
        _removeBitcoinAddress(_address);
    }

    /**
     * @notice removes bitcoin addresses to the key holders
     * @param _address the addresses to be removed
     */
    function removeBitcoinAddresses(string[] memory _address) public onlyOwner {
        for (uint i = 0; i < _address.length; i++) {
            _removeBitcoinAddress(_address[i]);
        }
    }

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
     * @notice returns whether bitcoin address is a key holder
     * @param _address the bitcoin address to be checked
     */
    function isBitcoinAddressOwner(string memory _address) public view returns (bool) {
        return isBitcoinAddressAdded[_address].added;
    }

    /**
     * @notice returns array of bitcoin key holders
     */
    function getBitcoinAddresses() public view returns (string[] memory) {
        return bitcoinAddresses;
    }

    /**
     * @notice adds ethereum and bitcoin addresses to the key holders
     * @param _ethereumAddress the ethereum addresses to be added
     * @param _bitcoinAddress the bitcoin addresses to be added
     */
    function addEthereumAndBitcoinAddresses(
        address[] memory _ethereumAddress,
        string[] memory _bitcoinAddress
    )
        public
        onlyOwner
    {
        for (uint i = 0; i < _ethereumAddress.length; i++) {
            _addEthereumAddress(_ethereumAddress[i]);
        }
        for (uint i = 0; i < _bitcoinAddress.length; i++) {
            _addBitcoinAddress(_bitcoinAddress[i]);
        }
    }

    /**
     * @notice removes ethereum and bitcoin addresses to the key holders
     * @param _ethereumAddress the ethereum addresses to be removed
     * @param _bitcoinAddress the bitcoin addresses to be removed
     */
    function removeEthereumAndBitcoinAddresses(
        address[] memory _ethereumAddress,
        string[] memory _bitcoinAddress
    )
        public
        onlyOwner
    {
        for (uint i = 0; i < _ethereumAddress.length; i++) {
            _removeEthereumAddress(_ethereumAddress[i]);
        }
        for (uint i = 0; i < _bitcoinAddress.length; i++) {
            _removeBitcoinAddress(_bitcoinAddress[i]);
        }
    }

}
