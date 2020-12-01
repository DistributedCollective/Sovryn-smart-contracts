pragma solidity ^0.5.17;

contract IFeeSharingProxy {
	function withdrawTokens(address _token, uint32 _maxCheckpoints, address _receiver) public;
}