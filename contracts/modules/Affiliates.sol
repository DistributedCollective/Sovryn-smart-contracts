/**
 * Copyright 2017-2020, Sovryn, All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";
import "../mixins/EnumerableBytes32Set.sol";
import "../openzeppelin/SafeERC20.sol";
import "../events/AffiliatesEvents.sol";
import "../feeds/IPriceFeeds.sol";
import "../locked/ILockedSOV.sol";

/**
 * @title Affiliates contract.
 * @notice Track referrals and reward referrers (affiliates) with tokens.
 *   In-detail specifications are found at https://wiki.sovryn.app/en/community/Affiliates
 * @dev Module: Affiliates upgradable
 *   Storage: from State, functions called from Protocol by delegatecall
 */
contract Affiliates is State, AffiliatesEvents {
	using SafeERC20 for IERC20;

	/**
	 * @notice Void constructor.
	 */
	// solhint-disable-next-line no-empty-blocks
	constructor() public {}

	/**
	 * @notice Avoid calls to this contract except for those explicitly declared.
	 */
	function() external {
		revert("Affiliates - fallback not allowed");
	}

	/**
	 * @notice Set delegate callable functions by proxy contract.
	 * @dev This contract is designed as a module, this way logic can be
	 *   expanded and upgraded w/o losing storage that is kept in the protocol (State.sol)
	 *   initialize() is used to register in the proxy external (module) functions
	 *   to be called via the proxy.
	 * @param target The address of a new logic implementation.
	 */
	function initialize(address target) external onlyOwner {
		_setTarget(this.setAffiliatesReferrer.selector, target);
		_setTarget(this.getUserNotFirstTradeFlag.selector, target);
		_setTarget(this.getReferralsList.selector, target);
		_setTarget(this.setUserNotFirstTradeFlag.selector, target);
		_setTarget(this.payTradingFeeToAffiliatesReferrer.selector, target);
		_setTarget(this.getAffiliatesReferrerBalances.selector, target);
		_setTarget(this.getAffiliatesReferrerTokenBalance.selector, target);
		_setTarget(this.getAffiliatesReferrerTokensList.selector, target);
		_setTarget(this.withdrawAffiliatesReferrerTokenFees.selector, target);
		_setTarget(this.withdrawAllAffiliatesReferrerTokenFees.selector, target);
		_setTarget(this.getMinReferralsToPayout.selector, target);
		_setTarget(this.getAffiliatesUserReferrer.selector, target);
		_setTarget(this.getAffiliateRewardsHeld.selector, target);
		_setTarget(this.getAffiliateTradingTokenFeePercent.selector, target);
	}

	/**
	 * @notice Function modifier to avoid any other calls not coming from loan pools.
	 */
	modifier onlyCallableByLoanPools() {
		require(loanPoolToUnderlying[msg.sender] != address(0), "Affiliates: not authorized");
		_;
	}

	/**
	 * @notice Function modifier to avoid any other calls not coming from within protocol functions.
	 */
	modifier onlyCallableInternal() {
		require(msg.sender == protocolAddress, "Affiliates: not authorized");
		_;
	}

	/**
	 * @notice Data structure comprised of 3 flags to compute the result of setting a referrer.
	 */
	struct SetAffiliatesReferrerResult {
		bool success;
		bool alreadySet;
		bool userNotFirstTradeFlag;
	}

	/**
	 * @notice Loan pool calls this function to tell affiliates
	 *   a user coming from a referrer is trading and should be registered if not yet.
	 *   Taking into account some user status flags may lead to the user and referrer
	 *   become added or not to the affiliates record.
	 *
	 * @param user The address of the user that is trading on loan pools.
	 * @param referrer The address of the referrer the user is coming from.
	 */
	function setAffiliatesReferrer(address user, address referrer) external onlyCallableByLoanPools {
		SetAffiliatesReferrerResult memory result;

		result.userNotFirstTradeFlag = getUserNotFirstTradeFlag(user);
		result.alreadySet = affiliatesUserReferrer[user] != address(0);
		result.success = !(result.userNotFirstTradeFlag || result.alreadySet || user == referrer);
		if (result.success) {
			affiliatesUserReferrer[user] = referrer;
			referralsList[referrer].add(user);
			emit SetAffiliatesReferrer(user, referrer);
		} else {
			emit SetAffiliatesReferrerFail(user, referrer, result.alreadySet, result.userNotFirstTradeFlag);
		}
	}

	/**
	 * @notice Getter to query the referrals coming from a referrer.
	 * @param referrer The address of a given referrer.
	 * @return The referralsList mapping value by referrer.
	 */
	function getReferralsList(address referrer) external view returns (address[] memory refList) {
		refList = referralsList[referrer].enumerate();
		return refList;
	}

	/**
	 * @notice Getter to query the not-first-trade flag of a user.
	 * @param user The address of a given user.
	 * @return The userNotFirstTradeFlag mapping value by user.
	 */
	function getUserNotFirstTradeFlag(address user) public view returns (bool) {
		return userNotFirstTradeFlag[user];
	}

	/**
	 * @notice Setter to toggle on the not-first-trade flag of a user.
	 * @dev REFACTOR move setUserNotFirstTradeFlag to ProtocolSettings?
	 * @param user The address of a given user.
	 */
	function setUserNotFirstTradeFlag(address user) external onlyCallableByLoanPools {
		if (!userNotFirstTradeFlag[user]) {
			userNotFirstTradeFlag[user] = true;
			emit SetUserNotFirstTradeFlag(user);
		}
	}

	/**
	 * @notice Internal getter to query the fee share for affiliate program.
	 * @dev It returns a value defined at protocol storage (State.sol)
	 * @return The percentage of fee share w/ 18 decimals.
	 */
	function _getAffiliatesTradingFeePercentForSOV() internal view returns (uint256) {
		return affiliateFeePercent;
	}

	/**
	 * @notice Internal to calculate the affiliates trading token fee amount.
	 *   Affiliates program has 2 kind of rewards:
	 *     1. x% based on the fee of the token that is traded (in form of the token itself).
	 *     2. x% based on the fee of the token that is traded (in form of SOV).
	 *   This _getReferrerTradingFeeForToken calculates the first one
	 *   by applying a custom percentage multiplier.
	 * @param feeTokenAmount The trading token fee amount.
	 * @return The affiliates share of the trading token fee amount.
	 */
	function _getReferrerTradingFeeForToken(uint256 feeTokenAmount) internal view returns (uint256) {
		return feeTokenAmount.mul(getAffiliateTradingTokenFeePercent()).div(10**20);
	}

	/**
	 * @notice Getter to query the fee share of trading token fee for affiliate program.
	 * @dev It returns a value defined at protocol storage (State.sol)
	 * @return The percentage of fee share w/ 18 decimals.
	 */
	function getAffiliateTradingTokenFeePercent() public view returns (uint256) {
		return affiliateTradingTokenFeePercent;
	}

	/**
	 * @notice Getter to query referral threshold for paying out to the referrer.
	 * @dev It returns a value defined at protocol storage (State.sol)
	 * @return The minimum number of referrals set by Protocol.
	 */
	function getMinReferralsToPayout() public view returns (uint256) {
		return minReferralsToPayout;
	}

	/**
	 * @notice Get the sovToken reward of a trade.
	 * @dev The reward is worth x% of the trading fee.
	 * @param feeToken The address of the token in which the trading/borrowing fee was paid.
	 * @param feeAmount The height of the fee.
	 * @return The reward amount.
	 * */
	function _getSovBonusAmount(address feeToken, uint256 feeAmount) internal view returns (uint256) {
		uint256 rewardAmount;
		address _priceFeeds = priceFeeds;

		/// @dev Calculate the reward amount, querying the price feed.
		(bool success, bytes memory data) =
			_priceFeeds.staticcall(
				abi.encodeWithSelector(
					IPriceFeeds(_priceFeeds).queryReturn.selector,
					feeToken,
					sovTokenAddress, /// dest token = SOV
					feeAmount.mul(_getAffiliatesTradingFeePercentForSOV()).div(1e20)
				)
			);
		// solhint-disable-next-line no-inline-assembly
		assembly {
			if eq(success, 1) {
				rewardAmount := mload(add(data, 32))
			}
		}

		return rewardAmount;
	}

	/**
	 * @notice Protocol calls this function to pay the affiliates rewards to a user (referrer).
	 *
	 * @dev Affiliates program has 2 kind of rewards:
	 *     1. x% based on the fee of the token that is traded (in form of the token itself).
	 *     2. x% based on the fee of the token that is traded (in form of SOV).
	 *   Both are paid in this function.
	 *
	 * @dev Actually they are not paid, but just holded by protocol until user claims them by
	 *   actively calling withdrawAffiliatesReferrerTokenFees() function,
	 *   and/or when unvesting lockedSOV.
	 *
	 * @dev To be precise, what this function does is updating the registers of the rewards
	 *   for the referrer including the assignment of the SOV tokens as rewards to the
	 *   referrer's vesting contract.
	 *
	 * @param referrer The address of the referrer.
	 * @param trader The address of the trader.
	 * @param token The address of the token in which the trading/borrowing fee was paid.
	 * @param tradingFeeTokenBaseAmount Total trading fee amount, the base for calculating referrer's fees.
	 *
	 * @return referrerBonusSovAmount The amount of SOV tokens paid to the referrer (through a vesting contract, lockedSOV).
	 * @return referrerBonusTokenAmount The amount of trading tokens paid directly to the referrer.
	 */
	function payTradingFeeToAffiliatesReferrer(
		address referrer,
		address trader,
		address token,
		uint256 tradingFeeTokenBaseAmount
	) external onlyCallableInternal returns (uint256 referrerBonusSovAmount, uint256 referrerBonusTokenAmount) {
		bool isHeld = referralsList[referrer].length() < getMinReferralsToPayout();
		bool bonusPaymentIsSuccess = true;
		uint256 paidReferrerBonusSovAmount;

		/// Process token fee rewards first.
		referrerBonusTokenAmount = _getReferrerTradingFeeForToken(tradingFeeTokenBaseAmount);
		if (!affiliatesReferrerTokensList[referrer].contains(token)) affiliatesReferrerTokensList[referrer].add(token);
		affiliatesReferrerBalances[referrer][token] = affiliatesReferrerBalances[referrer][token].add(referrerBonusTokenAmount);

		/// Then process SOV rewards.
		referrerBonusSovAmount = _getSovBonusAmount(token, tradingFeeTokenBaseAmount);
		uint256 rewardsHeldByProtocol = affiliateRewardsHeld[referrer];

		if (isHeld) {
			/// If referrals less than minimum, temp the rewards SOV to the storage
			affiliateRewardsHeld[referrer] = rewardsHeldByProtocol.add(referrerBonusSovAmount);
		} else {
			/// If referrals >= minimum, directly send all of the remain rewards to locked sov
			/// Call depositSOV() in LockedSov contract
			/// Set the affiliaterewardsheld = 0
			affiliateRewardsHeld[referrer] = 0;
			paidReferrerBonusSovAmount = referrerBonusSovAmount.add(rewardsHeldByProtocol);
			IERC20(sovTokenAddress).approve(lockedSOVAddress, paidReferrerBonusSovAmount);

			(bool success, ) =
				lockedSOVAddress.call(abi.encodeWithSignature("depositSOV(address,uint256)", referrer, paidReferrerBonusSovAmount));

			if (!success) {
				bonusPaymentIsSuccess = false;
			}
		}

		if (bonusPaymentIsSuccess) {
			emit PayTradingFeeToAffiliate(
				referrer,
				trader, // trader
				token,
				isHeld,
				tradingFeeTokenBaseAmount,
				referrerBonusTokenAmount,
				referrerBonusSovAmount,
				paidReferrerBonusSovAmount
			);
		} else {
			emit PayTradingFeeToAffiliateFail(
				referrer,
				trader, // trader
				token,
				tradingFeeTokenBaseAmount,
				referrerBonusTokenAmount,
				referrerBonusSovAmount,
				paidReferrerBonusSovAmount
			);
		}

		return (referrerBonusSovAmount, referrerBonusTokenAmount);
	}

	/**
	 * @notice Referrer calls this function to receive its reward in a given token.
	 *   It will send the other (non-SOV) reward tokens from trading protocol fees,
	 *   to the referrer’s wallet.
	 * @dev Rewards are held by protocol in different tokens coming from trading fees.
	 *   Referrer has to claim them one by one for every token with accumulated balance.
	 * @param token The address of the token to withdraw.
	 * @param receiver The address of the withdrawal beneficiary.
	 * @param amount The amount of tokens to claim. If greater than balance, just sends balance.
	 */
	function withdrawAffiliatesReferrerTokenFees(
		address token,
		address receiver,
		uint256 amount
	) public {
		require(receiver != address(0), "Affiliates: cannot withdraw to zero address");
		address referrer = msg.sender;
		uint256 referrerTokenBalance = affiliatesReferrerBalances[referrer][token];
		uint256 withdrawAmount = referrerTokenBalance > amount ? amount : referrerTokenBalance;

		require(withdrawAmount > 0, "Affiliates: cannot withdraw zero amount");

		require(referralsList[referrer].length() >= getMinReferralsToPayout(), "Your referrals has not reached the minimum request");

		uint256 newReferrerTokenBalance = referrerTokenBalance.sub(withdrawAmount);

		if (newReferrerTokenBalance == 0) {
			_removeAffiliatesReferrerToken(referrer, token);
		} else {
			affiliatesReferrerBalances[referrer][token] = newReferrerTokenBalance;
		}

		IERC20(token).safeTransfer(receiver, withdrawAmount);

		emit WithdrawAffiliatesReferrerTokenFees(referrer, receiver, token, withdrawAmount);
	}

	/**
	 * @notice Withdraw to msg.sender all token fees for a referrer.
	 * @dev It's done by looping through its available tokens.
	 * @param receiver The address of the withdrawal beneficiary.
	 */
	function withdrawAllAffiliatesReferrerTokenFees(address receiver) external {
		require(receiver != address(0), "Affiliates: cannot withdraw to zero address");
		address referrer = msg.sender;

		require(referralsList[referrer].length() >= getMinReferralsToPayout(), "Your referrals has not reached the minimum request");

		(address[] memory tokenAddresses, uint256[] memory tokenBalances) = getAffiliatesReferrerBalances(referrer);
		for (uint256 i; i < tokenAddresses.length; i++) {
			withdrawAffiliatesReferrerTokenFees(tokenAddresses[i], receiver, tokenBalances[i]);
		}
	}

	/**
	 * @notice Internal function to delete a referrer's token balance.
	 * @param referrer The address of the referrer.
	 * @param token The address of the token specifying the balance to remove.
	 */
	function _removeAffiliatesReferrerToken(address referrer, address token) internal {
		delete affiliatesReferrerBalances[referrer][token];
		affiliatesReferrerTokensList[referrer].remove(token);
	}

	/**
	 * @notice Get all token balances of a referrer.
	 * @param referrer The address of the referrer.
	 * @return referrerTokensList The array of available tokens (keys).
	 * @return referrerTokensBalances The array of token balances (values).
	 */
	function getAffiliatesReferrerBalances(address referrer)
		public
		view
		returns (address[] memory referrerTokensList, uint256[] memory referrerTokensBalances)
	{
		referrerTokensList = getAffiliatesReferrerTokensList(referrer);
		referrerTokensBalances = new uint256[](referrerTokensList.length);
		for (uint256 i; i < referrerTokensList.length; i++) {
			referrerTokensBalances[i] = getAffiliatesReferrerTokenBalance(referrer, referrerTokensList[i]);
		}
		return (referrerTokensList, referrerTokensBalances);
	}

	/**
	 * @notice Get all available tokens at the affiliates program for a given referrer.
	 * @param referrer The address of a given referrer.
	 * @return tokensList The list of available tokens.
	 */
	function getAffiliatesReferrerTokensList(address referrer) public view returns (address[] memory tokensList) {
		tokensList = affiliatesReferrerTokensList[referrer].enumerate();
		return tokensList;
	}

	/**
	 * @notice Getter to query the affiliate balance for a given referrer and token.
	 * @param referrer The address of the referrer.
	 * @param token The address of the token to get balance for.
	 * @return The affiliatesReferrerBalances mapping value by referrer and token keys.
	 */
	function getAffiliatesReferrerTokenBalance(address referrer, address token) public view returns (uint256) {
		return affiliatesReferrerBalances[referrer][token];
	}

	/**
	 * @notice Getter to query the address of referrer for a given user.
	 * @param user The address of the user.
	 * @return The address on affiliatesUserReferrer mapping value by user key.
	 */
	function getAffiliatesUserReferrer(address user) public view returns (address) {
		return affiliatesUserReferrer[user];
	}

	/**
	 * @notice Getter to query the reward amount held for a given referrer.
	 * @param referrer The address of the referrer.
	 * @return The affiliateRewardsHeld mapping value by referrer key.
	 */
	function getAffiliateRewardsHeld(address referrer) public view returns (uint256) {
		return affiliateRewardsHeld[referrer];
	}
}
