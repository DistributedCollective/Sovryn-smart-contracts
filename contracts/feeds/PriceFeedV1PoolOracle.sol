pragma solidity >=0.5.0 <0.6.0;

import "./PriceFeeds.sol";
import "./IV1PoolOracle.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/Address.sol";
import "./IPriceFeeds.sol";

/**
 * @notice The Price Feed V1 Pool Oracle contract.
 *
 * This contract implements V1 Pool Oracle query functionality,
 * getting the price and the last timestamp from an external oracle contract.
 * */
contract PriceFeedV1PoolOracle is IPriceFeedsExt, Ownable {
	/* Storage */

	address public v1PoolOracleAddress;
	address public rBTCAddress;
	address public docAddress;

	/* Events */
	event SetV1PoolOracleAddress(address indexed v1PoolOracleAddress, address changerAddress);
	event SetRBTCAddress(address indexed rBTCAddress, address changerAddress);
	event SetDOCAddress(address indexed docAddress, address changerAddress);

	/* Functions */

	/**
	 * @notice Initialize a new V1 Pool Oracle.
	 *
	 * @param _v1PoolOracleAddress The V1 Pool Oracle address.
	 * */
	constructor(address _v1PoolOracleAddress, address _rBTCAddress, address _docAddress) public {
		setV1PoolOracleAddress(_v1PoolOracleAddress);
		setRBTCAddress(_rBTCAddress);
		setDOCAddress(_docAddress);
	}

	/**
	 * @notice Get the oracle price.
	 * @return The price from Oracle.
	 * */
	function latestAnswer() external view returns (uint256) {
		require(rBTCAddress != address(0), "rBTC address has not been set");
		require(docAddress != address(0), "DOC address has not been set");
		IV1PoolOracle _v1PoolOracle = IV1PoolOracle(v1PoolOracleAddress);
		(uint256 _price) = _v1PoolOracle.latestAnswer();

		// Need to convert to USD, since the V1 pool return value is based on BTC
		uint256 priceInUSD = _convertAnswerToUsd(_price);
		require(priceInUSD != 0, "price error");


		return priceInUSD;
	}

	function _convertAnswerToUsd(uint256 _valueInBTC) private view returns (uint256){
		uint256 valueInUSD;
		address _priceFeeds = msg.sender;

		(bool success, bytes memory data) =
			_priceFeeds.staticcall(
				abi.encodeWithSelector(
					IPriceFeeds(_priceFeeds).queryReturn.selector,
					rBTCAddress,
					docAddress,
					_valueInBTC
				)
			);
		assembly {
			if eq(success, 1) {
				valueInUSD := mload(add(data, 32))
			}
		}

		return valueInUSD;
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
	 * @param _rBTCAddress The rBTC address
	 */
	function setRBTCAddress(address _rBTCAddress) public onlyOwner {
		require(_rBTCAddress != address(0), "rBTC address cannot be zero address");
		rBTCAddress = _rBTCAddress;
		emit SetRBTCAddress(rBTCAddress, msg.sender);
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
