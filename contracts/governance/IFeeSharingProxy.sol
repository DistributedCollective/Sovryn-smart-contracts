pragma solidity ^0.5.17;

contract IFeeSharingProxy {
	function withdrawToken(address _token, uint32 _maxCheckpoints, address _receiver) public;
}