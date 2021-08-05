pragma solidity 0.5.17;

contract LoanTokenLogicStorage {
  /// DO NOT ADD VARIABLES HERE

  /// @dev Used by flashBorrow function.
	uint256 public constant VERSION = 6;
	/// @dev Used by flashBorrow function.
	address internal constant arbitraryCaller = 0x000F400e6818158D541C3EBE45FE3AA0d47372FF;
	bytes32 internal constant iToken_ProfitSoFar = 0x37aa2b7d583612f016e4a4de4292cb015139b3d7762663d06a53964912ea2fb6; // keccak256("iToken_ProfitSoFar")
}