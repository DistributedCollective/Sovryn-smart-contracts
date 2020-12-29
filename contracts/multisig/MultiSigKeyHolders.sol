pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/Ownable.sol";

contract MultiSigKeyHolders is Ownable {


    function addEthereumAddress(address account) public onlyOwner {

    }

    function removeEthereumAddress(address account) public onlyOwner {

    }

    function isEthereumAddressAdded(address account) public returns (bool) {

    }

    function getEthereumAddresses() public returns (address[] memory) {

    }


//    function addBitcoinPublicKey(string memory account) public onlyOwner {
    function addBitcoinAddress(address account) public onlyOwner {

    }

    function removeBitcoinAddress(string memory account) public onlyOwner {

    }

    function isBitcoinAddressAdded(string memory account) public returns (bool) {

    }

    function getBitcoinAddresses() public returns (string[] memory) {

    }


}
