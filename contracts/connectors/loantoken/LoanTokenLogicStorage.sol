pragma solidity 0.5.17;

import "./AdvancedToken.sol";

contract LoanTokenLogicStorage is AdvancedToken {
	/// DO NOT ADD VARIABLES HERE

	/// @dev It is important to maintain the variables order so the delegate
	/// calls can access sovrynContractAddress

	/// ------------- MUST BE THE SAME AS IN LoanToken CONTRACT -------------------
	address public sovrynContractAddress;
	address public wrbtcTokenAddress;
	address public target_;
	address public admin;
	/// ------------- END MUST BE THE SAME AS IN LoanToken CONTRACT -------------------

	/// @dev Add new variables here on the bottom.
	address public earlyAccessToken; //not used anymore, but staying for upgradability
	address public pauser;
	/** The address of the liquidity mining contract */
	address public liquidityMiningAddress;

	/// @dev Used by flashBorrow function.
	uint256 public constant VERSION = 6;
	/// @dev Used by flashBorrow function.
	address internal constant arbitraryCaller = 0x000F400e6818158D541C3EBE45FE3AA0d47372FF;
	bytes32 internal constant iToken_ProfitSoFar = 0x37aa2b7d583612f016e4a4de4292cb015139b3d7762663d06a53964912ea2fb6; // keccak256("iToken_ProfitSoFar")
	uint256 public constant TINY_AMOUNT = 25e13;

	function stringToBytes32(string memory source) public pure returns (bytes32 result) {
		bytes memory tempEmptyStringTest = bytes(source);
		if (tempEmptyStringTest.length == 0) {
			return 0x0;
		}

		assembly {
			result := mload(add(source, 32))
		}
	}
}
