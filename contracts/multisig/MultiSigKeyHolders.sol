pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/Ownable.sol";

contract MultiSigKeyHolders is Ownable {

    string private constant ERROR_INVALID_ADDRESS = "Invalid address";
    string private constant ERROR_ADDRESS_ALREADY_ADDED = "Address already added";
    string private constant ERROR_ADDRESS_NOT_FOUND = "Address not found";

    mapping (address => bool) private isEthereumAddressAdded;
    address[] private ethereumAddresses;

    mapping (string => bool) private isBitcoinAddressAdded;
    string[] private bitcoinAddresses;

    function addEthereumAddress(address _address) public onlyOwner {
        require(_address != address(0), ERROR_INVALID_ADDRESS);
        require(!isEthereumAddressAdded[_address], ERROR_ADDRESS_ALREADY_ADDED);


    }

    function removeEthereumAddress(address _address) public onlyOwner {
        require(_address != address(0), ERROR_INVALID_ADDRESS);
        require(isEthereumAddressAdded[_address], ERROR_ADDRESS_NOT_FOUND);

    }

    function isEthereumAddressOwner(address _address) public view returns (bool) {
        return isEthereumAddressAdded[_address];
    }

    function getEthereumAddresses() public view returns (address[] memory) {
        return ethereumAddresses;
    }

    function addBitcoinAddress(string memory _address) public onlyOwner {
        require(bytes(_address).length != 0, ERROR_INVALID_ADDRESS);
        require(!isBitcoinAddressAdded[_address], ERROR_ADDRESS_ALREADY_ADDED);

    }

    function removeBitcoinAddress(string memory _address) public onlyOwner {
        require(bytes(_address).length != 0, ERROR_INVALID_ADDRESS);
        require(!isBitcoinAddressAdded[_address], ERROR_ADDRESS_NOT_FOUND);

    }

    function isBitcoinAddressOwner(string memory _address) public view returns (bool) {
        return isBitcoinAddressAdded[_address];
    }

    function getBitcoinAddresses() public view returns (string[] memory) {
        return bitcoinAddresses;
    }

}
