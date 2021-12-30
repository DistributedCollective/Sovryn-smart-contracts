pragma solidity >=0.5.0 <0.6.0;

interface IConverterAMM {
	function withdrawFees(address receiver) external returns (uint256);
}
