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
import "../escrow/ILockedSOV.sol";

contract Affiliates is State, AffiliatesEvents {
	/*
    Module: Affiliates upgradable
    Storage: from State, functions called from Protocol by delegatecall
    */

	using SafeERC20 for IERC20;

	constructor() public {}

	function() external {
		revert("Affiliates - fallback not allowed");
	}

	function initialize(address target) external onlyOwner {
		_setTarget(this.setAffiliatesReferrer.selector, target);
		_setTarget(this.getUserNotFirstTradeFlag.selector, target);
		_setTarget(this.setUserNotFirstTradeFlag.selector, target);
		_setTarget(this.payTradingFeeToAffiliatesReferrer.selector, target);
	}

	modifier onlyCallableByLoanPools() {
		require(loanPoolToUnderlying[msg.sender] != address(0), "Affiliates: not authorized");
		_;
	}

	// only allowed to be called from within protocol functions
	modifier onlyCallableInternal() {
		require(msg.sender == protocolAddress, "Affiliates: not authorized");
		_;
	}

	struct SetAffiliatesReferrerResult {
		bool success;
		bool alreadySet;
		bool userNotFirstTradeFlag;
	}

	function setAffiliatesReferrer(address user, address referrer) external onlyCallableByLoanPools {
		SetAffiliatesReferrerResult memory result;

		result.userNotFirstTradeFlag = getUserNotFirstTradeFlag(user);
		result.alreadySet = affiliatesUserReferrer[user] != address(0) ? true : false;
		result.success = !(result.userNotFirstTradeFlag || result.alreadySet || user == referrer);
		if (result.success) {
			affiliatesUserReferrer[user] = referrer;
			if (!referralsList[referrer].contains(user)) referralsList[referrer].add(user);
			emit SetAffiliatesReferrer(user, referrer);
		} else {
			emit SetAffiliatesReferrerFail(user, referrer, result.alreadySet, result.userNotFirstTradeFlag);
		}
	}

	function getUserNotFirstTradeFlag(address user) public view returns (bool) {
		return userNotFirstTradeFlag[user];
	}

	//REFACTOR move setUserNotFirstTradeFlag to ProtocolSettings?
	function setUserNotFirstTradeFlag(address user) external onlyCallableByLoanPools {
		if (!userNotFirstTradeFlag[user]) {
			userNotFirstTradeFlag[user] = true;
			emit SetUserNotFirstTradeFlag(user);
		}
	}

	//AUDIT Do we need to allow an owner to nullify a referrer for some reason?
	/*
    function affiliatesRemoveUserReferrer(address user, address referrer) external onlyOwner {
        if(referrer != address(0) && getUserNotFirstTradeFlag[user]) {
            delete affiliatesUserReferrer[user];
            //TODO: event with the reason for removing referrer
        }
    }
    */

	function _getAffiliatesTradingFeePercent() internal view returns (uint256) {
		return affiliateFeePercent;
	}

	function _getMinReferralsToPayout() internal view returns (uint256) {
		return minReferralsToPayout;
	}

	/**
	 * @dev get the sovToken reward of a trade. The reward is worth x% of the trading fee.
	 * @param feeToken the address of the token in which the trading/borrowig fee was paid
	 * @param feeAmount the height of the fee
	 * */
	function _getSovBonusAmount(address feeToken, uint256 feeAmount) internal view returns (uint256) {
		uint256 rewardAmount;
		address _priceFeeds = priceFeeds;

		//calculate the reward amount, querying the price feed
		(bool success, bytes memory data) =
			_priceFeeds.staticcall(
				abi.encodeWithSelector(
					IPriceFeeds(_priceFeeds).queryReturn.selector,
					feeToken,
					sovTokenAddress, // dest token = SOV
					feeAmount.mul(_getAffiliatesTradingFeePercent()).div(10**20)
				)
			);
		assembly {
			if eq(success, 1) {
				rewardAmount := mload(add(data, 32))
			}
		}

		return rewardAmount;
	}

	/**
	 * @param tradingFeeTokenBaseAmount total trading fee amount, the base for calculating referrer's fees
	 */
	function payTradingFeeToAffiliatesReferrer(
		address referrer,
		address token,
		uint256 tradingFeeTokenBaseAmount
	) external onlyCallableInternal returns (uint256 referrerBonusSovAmount) {
		bool isHeld = referralsList[referrer].length() >= _getMinReferralsToPayout() ? false : true;
		bool bonusPaymentIsSuccess = true;
		uint256 paidReferrerBonusSovAmount;

		if (tradingFeeTokenBaseAmount > 0) {
			referrerBonusSovAmount = _getSovBonusAmount(token, tradingFeeTokenBaseAmount);
			uint256 rewardsHeldByProtocol = affiliateRewardsHeld[referrer];

			if (isHeld) {
				// If referrals less than minimum, temp the rewards sov to the storage
				affiliateRewardsHeld[referrer] = rewardsHeldByProtocol.add(referrerBonusSovAmount);
			} else {
				// If referrals >= minimum, directly send all of the remain rewards to locked sov
				// Call depositSOV() in LockedSov contract
				// Set the affiliaterewardsheld = 0
				affiliateRewardsHeld[referrer] = 0;
				paidReferrerBonusSovAmount = referrerBonusSovAmount.add(rewardsHeldByProtocol);
				IERC20(sovTokenAddress).approve(lockedSOVAddress, paidReferrerBonusSovAmount);

				(bool success, ) =
					lockedSOVAddress.call(abi.encodeWithSignature("depositSOV(address,uint256)", referrer, paidReferrerBonusSovAmount));

				if (!success) {
					bonusPaymentIsSuccess = false;
				}
			}
		}

		if (bonusPaymentIsSuccess) {
			emit PayTradingFeeToAffiliate(
				referrer,
				token,
				isHeld,
				tradingFeeTokenBaseAmount,
				referrerBonusSovAmount,
				paidReferrerBonusSovAmount
			);
		} else {
			emit PayTradingFeeToAffiliateFail(
				referrer,
				token,
				tradingFeeTokenBaseAmount,
				referrerBonusSovAmount,
				paidReferrerBonusSovAmount
			);
		}

		return referrerBonusSovAmount;
	}
}
