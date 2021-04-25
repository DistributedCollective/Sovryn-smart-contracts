pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../feeds/PriceFeeds.sol";

contract PriceFeedsMock is PriceFeeds {
	uint256 rate;
	uint256 precision;

	function setRateAndPrecision(uint256 _rate, uint256 _precision) public {
		rate = _rate;
		precision = _precision;
	}

	constructor(
		address _wrbtcTokenAddress,
		address _protocolTokenAddress,
		address _baseTokenAddress,
		uint256 _rate,
		uint256 _precision
	) public PriceFeeds(_wrbtcTokenAddress, _protocolTokenAddress, _baseTokenAddress) {
		//mock rate and precision
		setRateAndPrecision(_rate, _precision);
	}

	function _queryRate(address, address) internal view returns (uint256, uint256) {
		return (rate, precision);
	}
}
