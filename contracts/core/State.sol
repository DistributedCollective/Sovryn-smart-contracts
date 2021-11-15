/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "./Objects.sol";
import "../mixins/EnumerableAddressSet.sol";
import "../mixins/EnumerableBytes32Set.sol";
import "../openzeppelin/ReentrancyGuard.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/SafeMath.sol";
import "../interfaces/IWrbtcERC20.sol";

/**
 * @title State contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the storage values of the Protocol.
 * */
contract State is Objects, ReentrancyGuard, Ownable {
	using SafeMath for uint256;
	using EnumerableAddressSet for EnumerableAddressSet.AddressSet; // enumerable map of addresses
	using EnumerableBytes32Set for EnumerableBytes32Set.Bytes32Set; // enumerable map of bytes32 or addresses

	/// Handles asset reference price lookups.
	address public priceFeeds;

	/// Handles asset swaps using dex liquidity.
	address public swapsImpl;

	/// Contract registry address of the Sovryn swap network.
	address public sovrynSwapContractRegistryAddress;

	/// Implementations of protocol functions.
	mapping(bytes4 => address) public logicTargets;

	/// Loans: loanId => Loan
	mapping(bytes32 => Loan) public loans;

	/// Loan parameters: loanParamsId => LoanParams
	mapping(bytes32 => LoanParams) public loanParams;

	/// lender => orderParamsId => Order
	mapping(address => mapping(bytes32 => Order)) public lenderOrders;

	/// borrower => orderParamsId => Order
	mapping(address => mapping(bytes32 => Order)) public borrowerOrders;

	/// loanId => delegated => approved
	mapping(bytes32 => mapping(address => bool)) public delegatedManagers;

	/**
	 *** Interest ***
	 **/

	/// lender => loanToken => LenderInterest object
	mapping(address => mapping(address => LenderInterest)) public lenderInterest;

	/// loanId => LoanInterest object
	mapping(bytes32 => LoanInterest) public loanInterest;

	/**
	 *** Internals ***
	 **/

	/// Implementations set.
	EnumerableBytes32Set.Bytes32Set internal logicTargetsSet;

	/// Active loans set.
	EnumerableBytes32Set.Bytes32Set internal activeLoansSet;

	/// Lender loans set.
	mapping(address => EnumerableBytes32Set.Bytes32Set) internal lenderLoanSets;

	/// Borrow loans set.
	mapping(address => EnumerableBytes32Set.Bytes32Set) internal borrowerLoanSets;

	/// User loan params set.
	mapping(address => EnumerableBytes32Set.Bytes32Set) internal userLoanParamSets;

	/// Address controlling fee withdrawals.
	address public feesController;

	/// 10% fee /// Fee taken from lender interest payments.
	uint256 public lendingFeePercent = 10**19;

	/// Total interest fees received and not withdrawn per asset.
	mapping(address => uint256) public lendingFeeTokensHeld;

	/// Total interest fees withdraw per asset.
	/// lifetime fees = lendingFeeTokensHeld + lendingFeeTokensPaid
	mapping(address => uint256) public lendingFeeTokensPaid;

	/// 0.15% fee /// Fee paid for each trade.
	uint256 public tradingFeePercent = 15 * 10**16;

	/// Total trading fees received and not withdrawn per asset.
	mapping(address => uint256) public tradingFeeTokensHeld;

	/// Total trading fees withdraw per asset
	/// lifetime fees = tradingFeeTokensHeld + tradingFeeTokensPaid
	mapping(address => uint256) public tradingFeeTokensPaid;

	/// 0.09% fee /// Origination fee paid for each loan.
	uint256 public borrowingFeePercent = 9 * 10**16;

	/// Total borrowing fees received and not withdrawn per asset.
	mapping(address => uint256) public borrowingFeeTokensHeld;

	/// Total borrowing fees withdraw per asset.
	/// lifetime fees = borrowingFeeTokensHeld + borrowingFeeTokensPaid
	mapping(address => uint256) public borrowingFeeTokensPaid;

	/// Current protocol token deposit balance.
	uint256 public protocolTokenHeld;

	/// Lifetime total payout of protocol token.
	uint256 public protocolTokenPaid;

	/// 5% fee share in form of SOV /// Fee share for affiliate program.
	uint256 public affiliateFeePercent = 5 * 10**18;

	/// 5% collateral discount /// Discount on collateral for liquidators.
	uint256 public liquidationIncentivePercent = 5 * 10**18;

	/// loanPool => underlying
	mapping(address => address) public loanPoolToUnderlying;

	/// underlying => loanPool
	mapping(address => address) public underlyingToLoanPool;

	/// Loan pools set.
	EnumerableBytes32Set.Bytes32Set internal loanPoolsSet;

	/// Supported tokens for swaps.
	mapping(address => bool) public supportedTokens;

	/// % disagreement between swap rate and reference rate.
	uint256 public maxDisagreement = 5 * 10**18;

	/// Used as buffer for swap source amount estimations.
	uint256 public sourceBuffer = 10000;

	/// Maximum support swap size in rBTC
	uint256 public maxSwapSize = 50 ether;

	/// Nonce per borrower. Used for loan id creation.
	mapping(address => uint256) public borrowerNonce;

	/// Rollover transaction costs around 0.0000168 rBTC, it is denominated in wrBTC.
	uint256 public rolloverBaseReward = 16800000000000;
	uint256 public rolloverFlexFeePercent = 0.1 ether; /// 0.1%

	IWrbtcERC20 public wrbtcToken;
	address public protocolTokenAddress;

	/// 50% fee rebate
	/// potocolToken reward to user, it is worth % of trading/borrowing fee.
	uint256 public feeRebatePercent = 50 * 10**18;

	address public admin;

	/// For modules interaction.
	address public protocolAddress;

	/**
	 *** Affiliates ***
	 **/

	/// The flag is set on the user's first trade.
	mapping(address => bool) public userNotFirstTradeFlag;

	/// User => referrer (affiliate).
	mapping(address => address) public affiliatesUserReferrer;

	/// List of referral addresses affiliated to the referrer.
	mapping(address => EnumerableAddressSet.AddressSet) internal referralsList;

	/// @dev Referral threshold for paying out to the referrer.
	///   The referrer reward is being accumulated and locked until the threshold is passed.
	uint256 public minReferralsToPayout = 3;

	/// @dev Total affiliate SOV rewards that held in the protocol
	///   (Because the minimum referrals is less than the rule)
	mapping(address => uint256) public affiliateRewardsHeld;

	/// @dev For affiliates SOV Bonus proccess.
	address public sovTokenAddress;
	address public lockedSOVAddress;

	/// @dev 20% fee share of trading token fee.
	///   Fee share of trading token fee for affiliate program.
	uint256 public affiliateTradingTokenFeePercent = 20 * 10**18;

	/// @dev Addresses of tokens in which commissions were paid to referrers.
	mapping(address => EnumerableAddressSet.AddressSet) internal affiliatesReferrerTokensList;

	/// @dev [referrerAddress][tokenAddress] is a referrer's token balance of accrued fees.
	mapping(address => mapping(address => uint256)) public affiliatesReferrerBalances;

	mapping(address => mapping(address => uint256)) public specialRebates; // Special rate rebates for spesific pair -- if not set, then use the default one
	bool public pause; //Flag to pause all protocol modules

	/// ClosePosition
	struct ClosePosition {
		bytes32 loanId;
		address receiver;
		uint256 swapAmount; // denominated in collateralToken
		bool returnTokenIsCollateral; // true: withdraws collateralToken, false: withdraws loanToken
		bytes loanDataBytes; // for future use /*loanDataBytes*/
		uint256 createdTimestamp;
	}

	/// @notice The EIP-712 typehash for the contract's domain.
	bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

	/// @notice The EIP-712 typehash for the MarginTradeOrder struct used by the contract.
	bytes32 public constant CLOSE_WITH_SWAP_TYPEHASH =
		keccak256(
			"CloseWithSwap(bytes32 loanId,address receiver,uint256 swapAmount,bool returnTokenIsCollateral,bytes32 loanDataBytes,uint256 createdTimestamp)"
		);

	/// @notice The name of this contract.
	string public constant NAME = "Loan Closing";

	/// @notice flag whether MarginTradeOrder was already executed
	mapping(bytes32 => bool) public executedOrders;

	/**
	 * @notice Add signature and target to storage.
	 * @dev Protocol is a proxy and requires a way to add every
	 *   module function dynamically during deployment.
	 * */
	function _setTarget(bytes4 sig, address target) internal {
		logicTargets[sig] = target;

		if (target != address(0)) {
			logicTargetsSet.addBytes32(bytes32(sig));
		} else {
			logicTargetsSet.removeBytes32(bytes32(sig));
		}
	}
}
