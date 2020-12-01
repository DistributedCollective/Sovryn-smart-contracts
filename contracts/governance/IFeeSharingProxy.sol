pragma solidity ^0.5.17;

contract IFeeSharingProxy {
	//@todo add a receiver to the withdraw function of the fee sharing proxy
	function withdrawFees(address _token) public;
}