pragma solidity >=0.5.0 <0.6.0;

import "./PriceFeeds.sol";
import "./IV1PoolOracle.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/Address.sol";
import "../openzeppelin/SafeMath.sol";
import "./IPriceFeeds.sol";

/**
 * @notice The Price Feed V1 Pool Oracle contract.
 *
 * This contract implements V1 Pool Oracle query functionality,
 * getting the price and the last timestamp from an external oracle contract.
 * */
contract PriceFeedV1PoolOracle is IPriceFeedsExt, Ownable {
	using SafeMath for uint256;
	/* Storage */

	address public v1PoolOracleAddress;
	address public wRBTCAddress;
	address public docAddress;

	/* Events */
	event SetV1PoolOracleAddress(address indexed v1PoolOracleAddress, address changerAddress);
	event SetWRBTCAddress(address indexed wRBTCAddress, address changerAddress);
	event SetDOCAddress(address indexed docAddress, address changerAddress);

	/* Functions */

	/**
	 * @notice Initialize a new V1 Pool Oracle.
	 *
	 * @param _v1PoolOracleAddress The V1 Pool Oracle address.
	 * @param _wRBTCAddress The wrbtc token address.
	 * @param _docAddress The doc token address.
	 * */
	constructor(
		address _v1PoolOracleAddress,
		address _wRBTCAddress,
		address _docAddress
	) public {
		setV1PoolOracleAddress(_v1PoolOracleAddress);
		setRBTCAddress(_wRBTCAddress);
		setDOCAddress(_docAddress);
	}

	/**
	 * @notice Get the oracle price.
	 * @return The price from Oracle.
	 * */
	function latestAnswer() external view returns (uint256) {
		IV1PoolOracle _v1PoolOracle = IV1PoolOracle(v1PoolOracleAddress);
		// Need to check, if the requested asset is BTC
		address liquidityPool = _v1PoolOracle.liquidityPool();
		require(
			ILiquidityPoolV1Converter(liquidityPool).reserveTokens(0) != wRBTCAddress ||
				ILiquidityPoolV1Converter(liquidityPool).reserveTokens(1) != wRBTCAddress,
			"wrBTC price feed cannot use the oracle v1 pool"
		);

		uint256 _price = _v1PoolOracle.latestAnswer();

		// Need to convert to USD, since the V1 pool return value is based on BTC
		uint256 priceInUSD = _convertAnswerToUsd(_price);
		require(priceInUSD != 0, "price error");

		return priceInUSD;
	}

	function _convertAnswerToUsd(uint256 _valueInBTC) private view returns (uint256) {
		address _priceFeeds = msg.sender;

		uint256 precision = IPriceFeeds(_priceFeeds).queryPrecision(wRBTCAddress, docAddress);
		uint256 valueInUSD = IPriceFeeds(_priceFeeds).queryReturn(wRBTCAddress, docAddress, _valueInBTC);

		/// Need to multiply by query precision (doc's precision) and divide by 1*10^8 (Because the based price in v1 pool is in rBTC(8 decimals))
		return valueInUSD.mul(precision).div(1e8);
	}

	/**
	 * @notice Set the V1 Pool Oracle address.
	 *
	 * @param _v1PoolOracleAddress The V1 Pool Oracle address.
	 */
	function setV1PoolOracleAddress(address _v1PoolOracleAddress) public onlyOwner {
		require(Address.isContract(_v1PoolOracleAddress), "_v1PoolOracleAddress not a contract");
		v1PoolOracleAddress = _v1PoolOracleAddress;
		emit SetV1PoolOracleAddress(v1PoolOracleAddress, msg.sender);
	}

	/**
	 * @notice Set the rBtc address. V1 pool based price is BTC, so need to convert the value from v1 pool to USD. That's why we need to get the price of the rBtc
	 *
	 * @param _wRBTCAddress The rBTC address
	 */
	function setRBTCAddress(address _wRBTCAddress) public onlyOwner {
		require(_wRBTCAddress != address(0), "wRBTC address cannot be zero address");
		wRBTCAddress = _wRBTCAddress;
		emit SetWRBTCAddress(wRBTCAddress, msg.sender);
	}

	/**
	 * @notice Set the rBtc address. V1 pool based price is BTC, so need to convert the value from v1 pool to USD. That's why we need to get the price of the rBtc
	 *
	 * @param _docAddress The rBTC address
	 */
	function setDOCAddress(address _docAddress) public onlyOwner {
		require(_docAddress != address(0), "DOC address cannot be zero address");
		docAddress = _docAddress;
		emit SetDOCAddress(_docAddress, msg.sender);
	}
}
