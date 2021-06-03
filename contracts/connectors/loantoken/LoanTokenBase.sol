/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../../openzeppelin/SafeMath.sol";
import "../../openzeppelin/SignedSafeMath.sol";
import "../../openzeppelin/ReentrancyGuard.sol";
import "../../openzeppelin/Ownable.sol";
import "../../openzeppelin/Address.sol";
import "../../interfaces/IWrbtcERC20.sol";
import "./Pausable.sol";

/**
 * @title Loan Token Base contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * Specific loan related storage for iTokens.
 *
 * An loan token or iToken is a representation of a user funds in the pool and the
 * interest they've earned. The redemption value of iTokens continually increase
 * from the accretion of interest paid into the lending pool by borrowers. The user
 * can sell iTokens to exit its position. The user might potentially use them as
 * collateral wherever applicable.
 *
 * There are three main tokens in the bZx system, iTokens, pTokens, and BZRX tokens.
 * The bZx system of lending and borrowing depends on iTokens and pTokens, and when
 * users lend or borrow money on bZx, their crypto assets go into or come out of
 * global liquidity pools, which are pools of funds shared between many different
 * exchanges. When lenders supply funds into the global liquidity pools, they
 * automatically receive iTokens; When users borrow money to open margin trading
 * positions, they automatically receive pTokens. The system is also designed to
 * use the BZRX tokens, which are only used to pay fees on the network currently.
 * */
contract LoanTokenBase is ReentrancyGuard, Ownable, Pausable {
	uint256 internal constant WEI_PRECISION = 10**18;
	uint256 internal constant WEI_PERCENT_PRECISION = 10**20;

	int256 internal constant sWEI_PRECISION = 10**18;

	/// @notice Standard ERC-20 properties
	string public name;
	string public symbol;
	uint8 public decimals;

	/// @notice The address of the loan token (asset to lend) instance.
	address public loanTokenAddress;

	uint256 public baseRate;
	uint256 public rateMultiplier;
	uint256 public lowUtilBaseRate;
	uint256 public lowUtilRateMultiplier;

	uint256 public targetLevel;
	uint256 public kinkLevel;
	uint256 public maxScaleRate;

	uint256 internal _flTotalAssetSupply;
	uint256 public checkpointSupply;
	uint256 public initialPrice;

	/// uint88 for tight packing -> 8 + 88 + 160 = 256
	uint88 internal lastSettleTime_;

	/// Mapping of keccak256(collateralToken, isTorqueLoan) to loanParamsId.
	mapping(uint256 => bytes32) public loanParamsIds;

	/// Price of token at last user checkpoint.
	mapping(address => uint256) internal checkpointPrices_;

	// the maximum trading/borrowing/lending limit per token address
	mapping(address => uint256) public transactionLimit; 
	// 0 -> no limit

}
