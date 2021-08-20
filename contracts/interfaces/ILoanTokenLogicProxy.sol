pragma solidity 0.5.17;

interface ILoanTokenLogicProxy {
	function initializeLoanTokenProxy(address _beaconAddress) external;

	function beaconAddress() external view returns (address);

	function setBeaconAddress(address _newBeaconAddress) external;
}
