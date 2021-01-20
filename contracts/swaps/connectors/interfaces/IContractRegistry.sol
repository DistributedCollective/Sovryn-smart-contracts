pragma solidity 0.5.17;

contract IContractRegistry {
	function addressOf(bytes32 contractName) public view returns (address);
}
