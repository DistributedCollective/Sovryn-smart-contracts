/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../PriceFeeds.sol";

/**
 * @title Price Feeds Local contract.
 *
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized
 * margin trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract contains the logic of setting and getting rates between two tokens.
 * */
contract PriceFeedsLocal is PriceFeeds {
	mapping(address => mapping(address => uint256)) public rates;

	/// uint256 public slippageMultiplier = 100 ether;

	/**
	 * @notice Deploy local price feed contract.
	 *
	 * @param _wrbtcTokenAddress The address of the wrBTC instance.
	 * @param _protocolTokenAddress The address of the protocol token instance.
	 * */
	constructor(address _wrbtcTokenAddress, address _protocolTokenAddress)
		public
		PriceFeeds(_wrbtcTokenAddress, _protocolTokenAddress, _wrbtcTokenAddress)
	{}

	/**
	 * @notice Calculate the price ratio between two tokens.
	 *
	 * @param sourceToken The address of the source tokens.
	 * @param destToken The address of the destiny tokens.
	 *
	 * @return rate The price ratio source/dest.
	 * @return precision The ratio precision.
	 * */
	function _queryRate(address sourceToken, address destToken) internal view returns (uint256 rate, uint256 precision) {
		require(!globalPricingPaused, "pricing is paused");

		if (sourceToken == destToken) {
			rate = 10**18;
			precision = 10**18;
		} else {
			if (sourceToken == protocolTokenAddress) {
				/// Hack for testnet; only returns price in rBTC.
				rate = protocolTokenEthPrice;
			} else if (destToken == protocolTokenAddress) {
				/// Hack for testnet; only returns price in rBTC.
				rate = SafeMath.div(10**36, protocolTokenEthPrice);
			} else {
				if (rates[sourceToken][destToken] != 0) {
					rate = rates[sourceToken][destToken];
				} else {
					uint256 sourceToEther = rates[sourceToken][address(wrbtcToken)] != 0 ? rates[sourceToken][address(wrbtcToken)] : 10**18;
					uint256 etherToDest = rates[address(wrbtcToken)][destToken] != 0 ? rates[address(wrbtcToken)][destToken] : 10**18;

					rate = sourceToEther.mul(etherToDest).div(10**18);
				}
			}
			precision = _getDecimalPrecision(sourceToken, destToken);
		}
	}

	/**
	 * @notice Owner set price ratio between two tokens.
	 *
	 * @param sourceToken The address of the source tokens.
	 * @param destToken The address of the destiny tokens.
	 * @param rate The price ratio source/dest.
	 * */
	function setRates(
		address sourceToken,
		address destToken,
		uint256 rate
	) public onlyOwner {
		if (sourceToken != destToken) {
			rates[sourceToken][destToken] = rate;
			rates[destToken][sourceToken] = SafeMath.div(10**36, rate);
		}
	}

	/*function setSlippageMultiplier(
        uint256 _slippageMultiplier)
        public
        onlyOwner
    {
        require (slippageMultiplier != _slippageMultiplier && _slippageMultiplier <= 100 ether);
        slippageMultiplier = _slippageMultiplier;
    }*/
}
