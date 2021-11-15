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

	/// @notice flag whether MarginTradeOrder was already executed
	mapping(bytes32 => bool) public executedOrders;

	/// @notice MarginTradeOrder
	struct MarginTradeOrder {
		bytes32 loanId; /// 0 if new loan
		uint256 leverageAmount; /// Expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5).
		uint256 loanTokenSent;
		uint256 collateralTokenSent;
		address collateralTokenAddress;
		address trader;
		uint256 minReturn; // minimum position size in the collateral tokens
		bytes loanDataBytes; /// Arbitrary order data.
		uint256 createdTimestamp;
	}

	/// @notice The EIP-712 typehash for the contract's domain.
	bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

	/// @notice The EIP-712 typehash for the MarginTradeOrder struct used by the contract.
	bytes32 public constant MARGIN_TRADE_ORDER_TYPEHASH =
		keccak256(
			"MarginTradeOrder(bytes32 loanId,uint256 leverageAmount,uint256 loanTokenSent,uint256 collateralTokenSent,address collateralTokenAddress,address trader,uint256 minReturn,bytes32 loanDataBytes,uint256 createdTimestamp)"
		);

	/// @notice The name of this contract.
	string public constant NAME = "Loan Token";

	//MarginTradeOrder ====================================================================================================================

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
