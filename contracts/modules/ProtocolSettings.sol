/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";
import "../events/ProtocolSettingsEvents.sol";
import "../openzeppelin/SafeERC20.sol";
import "../mixins/ProtocolTokenUser.sol";
import "../modules/interfaces/ProtocolSwapExternalInterface.sol";
import "../mixins/ModuleCommonFunctionalities.sol";
import "../swaps/ISwapsImpl.sol";
import "../governance/IFeeSharingProxy.sol";
import "../feeds/IPriceFeeds.sol";

/**
 * @title Protocol Settings contract.
 *
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains functions to customize protocol settings.
 * */
contract ProtocolSettings is State, ProtocolTokenUser, ProtocolSettingsEvents, ModuleCommonFunctionalities {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	/**
	 * @notice Empty public constructor.
	 * */
	constructor() public {}

	/**
	 * @notice Fallback function is to react to receiving value (rBTC).
	 * */
	function() external {
		revert("fallback not allowed");
	}

	/**
	 * @notice Set function selectors on target contract.
	 *
	 * @param target The address of the target contract.
	 * */
	function initialize(address target) external onlyOwner {
		address prevModuleContractAddress = logicTargets[this.setPriceFeedContract.selector];
		_setTarget(this.setPriceFeedContract.selector, target);
		_setTarget(this.setSwapsImplContract.selector, target);
		_setTarget(this.setLoanPool.selector, target);
		_setTarget(this.setSupportedTokens.selector, target);
		_setTarget(this.setLendingFeePercent.selector, target);
		_setTarget(this.setTradingFeePercent.selector, target);
		_setTarget(this.setBorrowingFeePercent.selector, target);
		_setTarget(this.setSwapExternalFeePercent.selector, target);
		_setTarget(this.setAffiliateFeePercent.selector, target);
		_setTarget(this.setAffiliateTradingTokenFeePercent.selector, target);
		_setTarget(this.setLiquidationIncentivePercent.selector, target);
		_setTarget(this.setMaxDisagreement.selector, target);
		_setTarget(this.setSourceBuffer.selector, target);
		_setTarget(this.setMaxSwapSize.selector, target);
		_setTarget(this.setFeesController.selector, target);
		_setTarget(this.withdrawFees.selector, target);
		_setTarget(this.withdrawLendingFees.selector, target);
		_setTarget(this.withdrawTradingFees.selector, target);
		_setTarget(this.withdrawBorrowingFees.selector, target);
		_setTarget(this.withdrawProtocolToken.selector, target);
		_setTarget(this.depositProtocolToken.selector, target);
		_setTarget(this.getLoanPoolsList.selector, target);
		_setTarget(this.isLoanPool.selector, target);
		_setTarget(this.setSovrynSwapContractRegistryAddress.selector, target);
		_setTarget(this.setWrbtcToken.selector, target);
		_setTarget(this.setProtocolTokenAddress.selector, target);
		_setTarget(this.setRolloverBaseReward.selector, target);
		_setTarget(this.setRebatePercent.selector, target);
		_setTarget(this.setSpecialRebates.selector, target);
		_setTarget(this.setSovrynProtocolAddress.selector, target);
		_setTarget(this.setSOVTokenAddress.selector, target);
		_setTarget(this.setLockedSOVAddress.selector, target);
		_setTarget(this.setMinReferralsToPayoutAffiliates.selector, target);
		_setTarget(this.getSpecialRebates.selector, target);
		_setTarget(this.getProtocolAddress.selector, target);
		_setTarget(this.getSovTokenAddress.selector, target);
		_setTarget(this.getLockedSOVAddress.selector, target);
		_setTarget(this.getFeeRebatePercent.selector, target);
		_setTarget(this.togglePaused.selector, target);
		_setTarget(this.isProtocolPaused.selector, target);
		_setTarget(this.getSwapExternalFeePercent.selector, target);
		_setTarget(this.setTradingRebateRewardsBasisPoint.selector, target);
		_setTarget(this.getTradingRebateRewardsBasisPoint.selector, target);
		emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "ProtocolSettings");
	}

	/**
	 * setting wrong address will break inter module functions calling
	 * should be set once
	 */
	function setSovrynProtocolAddress(address newProtocolAddress) external onlyOwner whenNotPaused {
		address oldProtocolAddress = protocolAddress;
		protocolAddress = newProtocolAddress;

		emit SetProtocolAddress(msg.sender, oldProtocolAddress, newProtocolAddress);
	}

	function setSOVTokenAddress(address newSovTokenAddress) external onlyOwner whenNotPaused {
		require(Address.isContract(newSovTokenAddress), "newSovTokenAddress not a contract");

		address oldTokenAddress = sovTokenAddress;
		sovTokenAddress = newSovTokenAddress;

		emit SetSOVTokenAddress(msg.sender, oldTokenAddress, newSovTokenAddress);
	}

	function setLockedSOVAddress(address newLockedSOVAddress) external onlyOwner whenNotPaused {
		require(Address.isContract(newLockedSOVAddress), "newLockSOVAddress not a contract");

		address oldLockedSOVAddress = lockedSOVAddress;
		lockedSOVAddress = newLockedSOVAddress;

		emit SetLockedSOVAddress(msg.sender, oldLockedSOVAddress, newLockedSOVAddress);
	}

	/**
	 * @notice Set the basis point of trading rebate rewards (SOV), max value is 9999 (99.99% liquid, 0.01% vested).
	 *
	 * @param newBasisPoint Basis point value.
	 */
	function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external onlyOwner whenNotPaused {
		require(newBasisPoint <= 9999, "value too high");

		uint256 oldBasisPoint = tradingRebateRewardsBasisPoint;
		tradingRebateRewardsBasisPoint = newBasisPoint;

		emit SetTradingRebateRewardsBasisPoint(msg.sender, oldBasisPoint, newBasisPoint);
	}

	/**
	 * @notice Update the minimum number of referrals to get affiliates rewards.
	 *
	 * @param newMinReferrals The new minimum number of referrals.
	 * */
	function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external onlyOwner whenNotPaused {
		uint256 oldMinReferrals = minReferralsToPayout;
		minReferralsToPayout = newMinReferrals;

		emit SetMinReferralsToPayoutAffiliates(msg.sender, oldMinReferrals, newMinReferrals);
	}

	/**
	 * @notice Set the address of the Price Feed instance.
	 *
	 * @param newContract The address of the Price Feed new instance.
	 * */
	function setPriceFeedContract(address newContract) external onlyOwner whenNotPaused {
		address oldContract = priceFeeds;
		priceFeeds = newContract;

		emit SetPriceFeedContract(msg.sender, oldContract, newContract);
	}

	/**
	 * @notice Set the address of the asset swapper instance.
	 *
	 * @param newContract The address of the asset swapper new instance.
	 * */
	function setSwapsImplContract(address newContract) external onlyOwner whenNotPaused {
		address oldContract = swapsImpl;
		swapsImpl = newContract;

		emit SetSwapsImplContract(msg.sender, oldContract, newContract);
	}

	/**
	 * @notice Set a list of loan pools and its tokens.
	 *
	 * @param pools The array of addresses of new loan pool instances.
	 * @param assets The array of addresses of the corresponding underlying tokens.
	 * */
	function setLoanPool(address[] calldata pools, address[] calldata assets) external onlyOwner whenNotPaused {
		require(pools.length == assets.length, "count mismatch");

		for (uint256 i = 0; i < pools.length; i++) {
			require(pools[i] != assets[i], "pool == asset");
			require(pools[i] != address(0), "pool == 0");
			require(assets[i] != address(0) || loanPoolToUnderlying[pools[i]] != address(0), "pool not exists");
			if (assets[i] == address(0)) {
				underlyingToLoanPool[loanPoolToUnderlying[pools[i]]] = address(0);
				loanPoolToUnderlying[pools[i]] = address(0);
				loanPoolsSet.removeAddress(pools[i]);
			} else {
				loanPoolToUnderlying[pools[i]] = assets[i];
				underlyingToLoanPool[assets[i]] = pools[i];
				loanPoolsSet.addAddress(pools[i]);
			}

			emit SetLoanPool(msg.sender, pools[i], assets[i]);
		}
	}

	/**
	 * @notice Set a list of supported tokens by populating the
	 *   storage supportedTokens mapping.
	 *
	 * @param addrs The array of addresses of the tokens.
	 * @param toggles The array of flags indicating whether
	 *   the corresponding token is supported or not.
	 * */
	function setSupportedTokens(address[] calldata addrs, bool[] calldata toggles) external onlyOwner whenNotPaused {
		require(addrs.length == toggles.length, "count mismatch");

		for (uint256 i = 0; i < addrs.length; i++) {
			supportedTokens[addrs[i]] = toggles[i];

			emit SetSupportedTokens(msg.sender, addrs[i], toggles[i]);
		}
	}

	/**
	 * @notice Set the value of lendingFeePercent storage variable.
	 *
	 * @param newValue The new value for lendingFeePercent.
	 * */
	function setLendingFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
		require(newValue <= 10**20, "value too high");
		uint256 oldValue = lendingFeePercent;
		lendingFeePercent = newValue;

		emit SetLendingFeePercent(msg.sender, oldValue, newValue);
	}

	/**
	 * @notice Set the value of tradingFeePercent storage variable.
	 *
	 * @param newValue The new value for tradingFeePercent.
	 * */
	function setTradingFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
		require(newValue <= 10**20, "value too high");
		uint256 oldValue = tradingFeePercent;
		tradingFeePercent = newValue;

		emit SetTradingFeePercent(msg.sender, oldValue, newValue);
	}

	/**
	 * @notice Set the value of borrowingFeePercent storage variable.
	 *
	 * @param newValue The new value for borrowingFeePercent.
	 * */
	function setBorrowingFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
		require(newValue <= 10**20, "value too high");
		uint256 oldValue = borrowingFeePercent;
		borrowingFeePercent = newValue;

		emit SetBorrowingFeePercent(msg.sender, oldValue, newValue);
	}

	/**
	 * @notice Set the value of swapExtrernalFeePercent storage variable
	 *
	 * @param newValue the new value for swapExternalFeePercent
	 */
	function setSwapExternalFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
		require(newValue <= 10**20, "value too high");
		uint256 oldValue = swapExtrernalFeePercent;
		swapExtrernalFeePercent = newValue;

		emit SetSwapExternalFeePercent(msg.sender, oldValue, newValue);
	}

	/**
	 * @notice Set the value of affiliateFeePercent storage variable.
	 *
	 * @param newValue The new value for affiliateFeePercent.
	 * */
	function setAffiliateFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
		require(newValue <= 10**20, "value too high");
		uint256 oldValue = affiliateFeePercent;
		affiliateFeePercent = newValue;

		emit SetAffiliateFeePercent(msg.sender, oldValue, newValue);
	}

	/**
	 * @notice Set the value of affiliateTradingTokenFeePercent storage variable.
	 *
	 * @param newValue The new value for affiliateTradingTokenFeePercent.
	 * */
	function setAffiliateTradingTokenFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
		require(newValue <= 10**20, "value too high");
		uint256 oldValue = affiliateTradingTokenFeePercent;
		affiliateTradingTokenFeePercent = newValue;

		emit SetAffiliateTradingTokenFeePercent(msg.sender, oldValue, newValue);
	}

	/**
	 * @notice Set the value of liquidationIncentivePercent storage variable.
	 *
	 * @param newValue The new value for liquidationIncentivePercent.
	 * */
	function setLiquidationIncentivePercent(uint256 newValue) external onlyOwner whenNotPaused {
		require(newValue <= 10**20, "value too high");
		uint256 oldValue = liquidationIncentivePercent;
		liquidationIncentivePercent = newValue;

		emit SetLiquidationIncentivePercent(msg.sender, oldValue, newValue);
	}

	/**
	 * @notice Set the value of the maximum swap spread.
	 *
	 * @param newValue The new value for maxDisagreement.
	 * */
	function setMaxDisagreement(uint256 newValue) external onlyOwner whenNotPaused {
		maxDisagreement = newValue;
	}

	/**
	 * @notice Set the value of the maximum source buffer.
	 *
	 * @dev To avoid rounding issues on the swap rate a small buffer is implemented.
	 *
	 * @param newValue The new value for the maximum source buffer.
	 * */
	function setSourceBuffer(uint256 newValue) external onlyOwner whenNotPaused {
		sourceBuffer = newValue;
	}

	/**
	 * @notice Set the value of the swap size limit.
	 *
	 * @param newValue The new value for the maximum swap size.
	 * */
	function setMaxSwapSize(uint256 newValue) external onlyOwner whenNotPaused {
		uint256 oldValue = maxSwapSize;
		maxSwapSize = newValue;

		emit SetMaxSwapSize(msg.sender, oldValue, newValue);
	}

	/**
	 * @notice Set the address of the feesController instance.
	 *
	 * @dev The fee sharing proxy must be the feesController of the
	 * protocol contract. This allows the fee sharing proxy
	 * to withdraw the fees.
	 *
	 * @param newController The new address of the feesController.
	 * */
	function setFeesController(address newController) external onlyOwner whenNotPaused {
		address oldController = feesController;
		feesController = newController;

		emit SetFeesController(msg.sender, oldController, newController);
	}

	/**
	 * @notice The feesController calls this function to withdraw fees
	 * from three sources: lending, trading and borrowing.
	 * The fees (except SOV) will be converted to wRBTC.
	 * For SOV, it will be deposited directly to feeSharingProxy from the protocol.
	 *
	 * @param tokens The array of address of the token instance.
	 * @param receiver The address of the withdrawal recipient.
	 *
	 * @return The withdrawn total amount in wRBTC
	 * */
	function withdrawFees(address[] calldata tokens, address receiver) external whenNotPaused returns (uint256 totalWRBTCWithdrawn) {
		require(msg.sender == feesController, "unauthorized");

		for (uint256 i = 0; i < tokens.length; i++) {
			uint256 lendingBalance = lendingFeeTokensHeld[tokens[i]];
			if (lendingBalance > 0) {
				lendingFeeTokensHeld[tokens[i]] = 0;
				lendingFeeTokensPaid[tokens[i]] = lendingFeeTokensPaid[tokens[i]].add(lendingBalance);
			}

			uint256 tradingBalance = tradingFeeTokensHeld[tokens[i]];
			if (tradingBalance > 0) {
				tradingFeeTokensHeld[tokens[i]] = 0;
				tradingFeeTokensPaid[tokens[i]] = tradingFeeTokensPaid[tokens[i]].add(tradingBalance);
			}

			uint256 borrowingBalance = borrowingFeeTokensHeld[tokens[i]];
			if (borrowingBalance > 0) {
				borrowingFeeTokensHeld[tokens[i]] = 0;
				borrowingFeeTokensPaid[tokens[i]] = borrowingFeeTokensPaid[tokens[i]].add(borrowingBalance);
			}

			uint256 tempAmount = lendingBalance.add(tradingBalance).add(borrowingBalance);

			if (tempAmount == 0) {
				continue;
			}

			uint256 amountConvertedToWRBTC;
			if (tokens[i] == address(sovTokenAddress)) {
				IERC20(tokens[i]).approve(feesController, tempAmount);
				IFeeSharingProxy(feesController).transferTokens(address(sovTokenAddress), uint96(tempAmount));
				amountConvertedToWRBTC = 0;
			} else {
				if (tokens[i] == address(wrbtcToken)) {
					amountConvertedToWRBTC = tempAmount;

					IERC20(address(wrbtcToken)).safeTransfer(receiver, amountConvertedToWRBTC);
				} else {
					IERC20(tokens[i]).approve(protocolAddress, tempAmount);

					(amountConvertedToWRBTC, ) = ProtocolSwapExternalInterface(protocolAddress).swapExternal(
						tokens[i], // source token address
						address(wrbtcToken), // dest token address
						feesController, // set protocol as receiver
						protocolAddress, // protocol as the sender
						tempAmount, // source token amount
						0, // reqDestToken
						0, // minReturn
						"" // loan data bytes
					);

					/// Will revert if disagreement found.
					IPriceFeeds(priceFeeds).checkPriceDisagreement(
						tokens[i],
						address(wrbtcToken),
						tempAmount,
						amountConvertedToWRBTC,
						maxDisagreement
					);
				}

				totalWRBTCWithdrawn = totalWRBTCWithdrawn.add(amountConvertedToWRBTC);
			}

			emit WithdrawFees(msg.sender, tokens[i], receiver, lendingBalance, tradingBalance, borrowingBalance, amountConvertedToWRBTC);
		}

		return totalWRBTCWithdrawn;
	}

	/**
	 * @notice The feesController calls this function to withdraw fees
	 * accrued from lending operations.
	 *
	 * @param token The address of the token instance.
	 * @param receiver The address of the withdrawal recipient.
	 * @param amount The amount of fees to get, ignored if greater than balance.
	 *
	 * @return Whether withdrawal was successful.
	 * */
	function withdrawLendingFees(
		address token,
		address receiver,
		uint256 amount
	) external whenNotPaused returns (bool) {
		require(msg.sender == feesController, "unauthorized");

		uint256 withdrawAmount = amount;

		uint256 balance = lendingFeeTokensHeld[token];
		if (withdrawAmount > balance) {
			withdrawAmount = balance;
		}
		if (withdrawAmount == 0) {
			return false;
		}

		lendingFeeTokensHeld[token] = balance.sub(withdrawAmount);
		lendingFeeTokensPaid[token] = lendingFeeTokensPaid[token].add(withdrawAmount);

		IERC20(token).safeTransfer(receiver, withdrawAmount);

		emit WithdrawLendingFees(msg.sender, token, receiver, withdrawAmount);

		return true;
	}

	/**
	 * @notice The feesController calls this function to withdraw fees
	 * accrued from trading operations.
	 *
	 * @param token The address of the token instance.
	 * @param receiver The address of the withdrawal recipient.
	 * @param amount The amount of fees to get, ignored if greater than balance.
	 *
	 * @return Whether withdrawal was successful.
	 * */
	function withdrawTradingFees(
		address token,
		address receiver,
		uint256 amount
	) external whenNotPaused returns (bool) {
		require(msg.sender == feesController, "unauthorized");

		uint256 withdrawAmount = amount;

		uint256 balance = tradingFeeTokensHeld[token];
		if (withdrawAmount > balance) {
			withdrawAmount = balance;
		}
		if (withdrawAmount == 0) {
			return false;
		}

		tradingFeeTokensHeld[token] = balance.sub(withdrawAmount);
		tradingFeeTokensPaid[token] = tradingFeeTokensPaid[token].add(withdrawAmount);

		IERC20(token).safeTransfer(receiver, withdrawAmount);

		emit WithdrawTradingFees(msg.sender, token, receiver, withdrawAmount);

		return true;
	}

	/**
	 * @notice The feesController calls this function to withdraw fees
	 * accrued from borrowing operations.
	 *
	 * @param token The address of the token instance.
	 * @param receiver The address of the withdrawal recipient.
	 * @param amount The amount of fees to get, ignored if greater than balance.
	 *
	 * @return Whether withdrawal was successful.
	 * */
	function withdrawBorrowingFees(
		address token,
		address receiver,
		uint256 amount
	) external whenNotPaused returns (bool) {
		require(msg.sender == feesController, "unauthorized");

		uint256 withdrawAmount = amount;

		uint256 balance = borrowingFeeTokensHeld[token];
		if (withdrawAmount > balance) {
			withdrawAmount = balance;
		}
		if (withdrawAmount == 0) {
			return false;
		}

		borrowingFeeTokensHeld[token] = balance.sub(withdrawAmount);
		borrowingFeeTokensPaid[token] = borrowingFeeTokensPaid[token].add(withdrawAmount);

		IERC20(token).safeTransfer(receiver, withdrawAmount);

		emit WithdrawBorrowingFees(msg.sender, token, receiver, withdrawAmount);

		return true;
	}

	/**
	 * @notice The owner calls this function to withdraw protocol tokens.
	 *
	 * @dev Wrapper for ProtocolTokenUser::_withdrawProtocolToken internal function.
	 *
	 * @param receiver The address of the withdrawal recipient.
	 * @param amount The amount of tokens to get.
	 *
	 * @return The protocol token address.
	 * @return Withdrawal success (true/false).
	 * */
	function withdrawProtocolToken(address receiver, uint256 amount) external onlyOwner whenNotPaused returns (address, bool) {
		return _withdrawProtocolToken(receiver, amount);
	}

	/**
	 * @notice The owner calls this function to deposit protocol tokens.
	 *
	 * @param amount The tokens of fees to send.
	 * */
	function depositProtocolToken(uint256 amount) external onlyOwner whenNotPaused {
		/// @dev Update local balance
		protocolTokenHeld = protocolTokenHeld.add(amount);

		/// @dev Send the tokens
		IERC20(protocolTokenAddress).safeTransferFrom(msg.sender, address(this), amount);
	}

	/**
	 * @notice Get a list of loan pools.
	 *
	 * @param start The offset.
	 * @param count The limit.
	 *
	 * @return The array of loan pools.
	 * */
	function getLoanPoolsList(uint256 start, uint256 count) external view returns (bytes32[] memory) {
		return loanPoolsSet.enumerate(start, count);
	}

	/**
	 * @notice Check whether a token is a pool token.
	 *
	 * @dev By querying its underlying token.
	 *
	 * @param loanPool The token address to check.
	 * */
	function isLoanPool(address loanPool) external view returns (bool) {
		return loanPoolToUnderlying[loanPool] != address(0);
	}

	/**
	 * @notice Set the contract registry address of the SovrynSwap network.
	 *
	 * @param registryAddress the address of the registry contract.
	 * */
	function setSovrynSwapContractRegistryAddress(address registryAddress) external onlyOwner whenNotPaused {
		require(Address.isContract(registryAddress), "registryAddress not a contract");

		address oldSovrynSwapContractRegistryAddress = sovrynSwapContractRegistryAddress;
		sovrynSwapContractRegistryAddress = registryAddress;

		emit SetSovrynSwapContractRegistryAddress(msg.sender, oldSovrynSwapContractRegistryAddress, sovrynSwapContractRegistryAddress);
	}

	/**
	 * @notice Set the wrBTC contract address.
	 *
	 * @param wrbtcTokenAddress The address of the wrBTC contract.
	 * */
	function setWrbtcToken(address wrbtcTokenAddress) external onlyOwner whenNotPaused {
		require(Address.isContract(wrbtcTokenAddress), "wrbtcTokenAddress not a contract");

		address oldwrbtcToken = address(wrbtcToken);
		wrbtcToken = IWrbtcERC20(wrbtcTokenAddress);

		emit SetWrbtcToken(msg.sender, oldwrbtcToken, wrbtcTokenAddress);
	}

	/**
	 * @notice Set the protocol token contract address.
	 *
	 * @param _protocolTokenAddress The address of the protocol token contract.
	 * */
	function setProtocolTokenAddress(address _protocolTokenAddress) external onlyOwner whenNotPaused {
		require(Address.isContract(_protocolTokenAddress), "_protocolTokenAddress not a contract");

		address oldProtocolTokenAddress = protocolTokenAddress;
		protocolTokenAddress = _protocolTokenAddress;

		emit SetProtocolTokenAddress(msg.sender, oldProtocolTokenAddress, _protocolTokenAddress);
	}

	/**
	 * @notice Set rollover base reward. It should be denominated in wrBTC.
	 *
	 * @param baseRewardValue The base reward.
	 * */
	function setRolloverBaseReward(uint256 baseRewardValue) external onlyOwner whenNotPaused {
		require(baseRewardValue > 0, "Base reward is zero");

		uint256 oldValue = rolloverBaseReward;
		rolloverBaseReward = baseRewardValue;

		emit SetRolloverBaseReward(msg.sender, oldValue, rolloverBaseReward);
	}

	/**
	 * @notice Set the fee rebate percent.
	 *
	 * @param rebatePercent The fee rebate percent.
	 * */
	function setRebatePercent(uint256 rebatePercent) external onlyOwner whenNotPaused {
		require(rebatePercent <= 10**20, "Fee rebate is too high");

		uint256 oldRebatePercent = feeRebatePercent;
		feeRebatePercent = rebatePercent;

		emit SetRebatePercent(msg.sender, oldRebatePercent, rebatePercent);
	}

	/**
	 * @notice Set the special fee rebate percent for specific pair
	 *
	 * @param specialRebatesPercent The new special fee rebate percent.
	 * */
	function setSpecialRebates(
		address sourceToken,
		address destToken,
		uint256 specialRebatesPercent
	) external onlyOwner whenNotPaused {
		// Set max special rebates to 1000%
		require(specialRebatesPercent <= 1000e18, "Special fee rebate is too high");

		uint256 oldSpecialRebatesPercent = specialRebates[sourceToken][destToken];
		specialRebates[sourceToken][destToken] = specialRebatesPercent;

		emit SetSpecialRebates(msg.sender, sourceToken, destToken, oldSpecialRebatesPercent, specialRebatesPercent);
	}

	/**
	 * @notice Get a rebate percent of specific pairs.
	 *
	 * @param sourceTokenAddress The source of pairs.
	 * @param destTokenAddress The dest of pairs.
	 *
	 * @return The percent rebates of the pairs.
	 * */
	function getSpecialRebates(address sourceTokenAddress, address destTokenAddress) external view returns (uint256 specialRebatesPercent) {
		return specialRebates[sourceTokenAddress][destTokenAddress];
	}

	function getProtocolAddress() external view returns (address) {
		return protocolAddress;
	}

	function getSovTokenAddress() external view returns (address) {
		return sovTokenAddress;
	}

	function getLockedSOVAddress() external view returns (address) {
		return lockedSOVAddress;
	}

	function getFeeRebatePercent() external view returns (uint256) {
		return feeRebatePercent;
	}

	function togglePaused(bool paused) external onlyOwner {
		require(paused != pause, "Can't toggle");
		pause = paused;
		emit TogglePaused(msg.sender, !paused, paused);
	}

	function isProtocolPaused() external view returns (bool) {
		return pause;
	}

	function getSwapExternalFeePercent() external view returns (uint256) {
		return swapExtrernalFeePercent;
	}

	/**
	 * @notice Get the basis point of trading rebate rewards.
	 *
	 * @return The basis point value.
	 */
	function getTradingRebateRewardsBasisPoint() external view returns (uint256) {
		return tradingRebateRewardsBasisPoint;
	}
}
