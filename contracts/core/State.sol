/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "./Objects.sol";
import "../mixins/EnumerableBytes32Set.sol";
import "../openzeppelin/ReentrancyGuard.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/SafeMath.sol";
import "../interfaces/IWrbtcERC20.sol";

contract State is Objects, ReentrancyGuard, Ownable {
	using SafeMath for uint256;
	using EnumerableBytes32Set for EnumerableBytes32Set.Bytes32Set;

	address public priceFeeds; // handles asset reference price lookups
	address public swapsImpl; // handles asset swaps using dex liquidity
	address public sovrynSwapContractRegistryAddress; // contract registry address of the sovryn swap network

	mapping(bytes4 => address) public logicTargets; // implementations of protocol functions

	mapping(bytes32 => Loan) public loans; // loanId => Loan
	mapping(bytes32 => LoanParams) public loanParams; // loanParamsId => LoanParams

	mapping(address => mapping(bytes32 => Order)) public lenderOrders; // lender => orderParamsId => Order
	mapping(address => mapping(bytes32 => Order)) public borrowerOrders; // borrower => orderParamsId => Order

	mapping(bytes32 => mapping(address => bool)) public delegatedManagers; // loanId => delegated => approved

	// Interest
	mapping(address => mapping(address => LenderInterest)) public lenderInterest; // lender => loanToken => LenderInterest object
	mapping(bytes32 => LoanInterest) public loanInterest; // loanId => LoanInterest object

	// Internals
	EnumerableBytes32Set.Bytes32Set internal logicTargetsSet; // implementations set
	EnumerableBytes32Set.Bytes32Set internal activeLoansSet; // active loans set

	mapping(address => EnumerableBytes32Set.Bytes32Set) internal lenderLoanSets; // lender loans set
	mapping(address => EnumerableBytes32Set.Bytes32Set) internal borrowerLoanSets; // borrow loans set
	mapping(address => EnumerableBytes32Set.Bytes32Set) internal userLoanParamSets; // user loan params set

	address public feesController; // address controlling fee withdrawals

	uint256 public lendingFeePercent = 10**19; // 10% fee                               // fee taken from lender interest payments
	mapping(address => uint256) public lendingFeeTokensHeld; // total interest fees received and not withdrawn per asset
	mapping(address => uint256) public lendingFeeTokensPaid; // total interest fees withdraw per asset (lifetime fees = lendingFeeTokensHeld + lendingFeeTokensPaid)

	uint256 public tradingFeePercent = 15 * 10**16; // 0.15% fee                        // fee paid for each trade
	mapping(address => uint256) public tradingFeeTokensHeld; // total trading fees received and not withdrawn per asset
	mapping(address => uint256) public tradingFeeTokensPaid; // total trading fees withdraw per asset (lifetime fees = tradingFeeTokensHeld + tradingFeeTokensPaid)

	uint256 public borrowingFeePercent = 9 * 10**16; // 0.09% fee                       // origination fee paid for each loan
	mapping(address => uint256) public borrowingFeeTokensHeld; // total borrowing fees received and not withdrawn per asset
	mapping(address => uint256) public borrowingFeeTokensPaid; // total borrowing fees withdraw per asset (lifetime fees = borrowingFeeTokensHeld + borrowingFeeTokensPaid)

	uint256 public protocolTokenHeld; // current protocol token deposit balance
	uint256 public protocolTokenPaid; // lifetime total payout of protocol token

	uint256 public affiliateFeePercent = 30 * 10**18; // 30% fee share                  // fee share for affiliate program

	uint256 public liquidationIncentivePercent = 5 * 10**18; // 5% collateral discount  // discount on collateral for liquidators

	mapping(address => address) public loanPoolToUnderlying; // loanPool => underlying
	mapping(address => address) public underlyingToLoanPool; // underlying => loanPool
	EnumerableBytes32Set.Bytes32Set internal loanPoolsSet; // loan pools set

	mapping(address => bool) public supportedTokens; // supported tokens for swaps

	uint256 public maxDisagreement = 5 * 10**18; // % disagreement between swap rate and reference rate

	uint256 public sourceBuffer = 10000; // used as buffer for swap source amount estimations

	uint256 public maxSwapSize = 50 ether; // maximum support swap size in BTC

	mapping(address => uint256) public borrowerNonce; // nonce per borrower. used for loan id creation.

	uint256 public rolloverBaseReward = 16800000000000; // Rollover transaction costs around 0.0000168 rBTC, it is denominated in wRBTC
	uint256 public rolloverFlexFeePercent = 0.1 ether; // 0.1%

	IWrbtcERC20 public wrbtcToken;
	address public protocolTokenAddress;

	uint256 public feeRebatePercent = 50 * 10**18; // 50% fee rebate                     // potocolToken reward to user, it is worth % of trading/borrowing fee

	address public admin;

	function _setTarget(bytes4 sig, address target) internal {
		logicTargets[sig] = target;

		if (target != address(0)) {
			logicTargetsSet.addBytes32(bytes32(sig));
		} else {
			logicTargetsSet.removeBytes32(bytes32(sig));
		}
	}
}
