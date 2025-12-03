pragma solidity >=0.5.0 <0.6.0;

import "./PriceFeeds.sol";
import "./IV1PoolOracle.sol";
import "../openzeppelin/Ownable.sol";
import "../openzeppelin/Address.sol";
import "../openzeppelin/SafeMath.sol";
import "./IPriceFeeds.sol";

/**
 * @notice The BOS-specific Price Feed V1 Pool Oracle contract.
 *         Clone of PriceFeedV1PoolOracle with a distinct contract name for BOS deployment.
 */
contract PriceFeedV1PoolOracleBOS is IPriceFeedsExt, Ownable {
    using SafeMath for uint256;

    address public v1PoolOracleAddress;
    address public wRBTCAddress;
    address public docAddress;
    address public baseCurrency;

    event SetV1PoolOracleAddress(address indexed v1PoolOracleAddress, address changerAddress);
    event SetWRBTCAddress(address indexed wRBTCAddress, address changerAddress);
    event SetDOCAddress(address indexed docAddress, address changerAddress);
    event SetBaseCurrency(address indexed baseCurrency, address changerAddress);

    constructor(
        address _v1PoolOracleAddress,
        address _wRBTCAddress,
        address _docAddress,
        address _baseCurrency
    ) public {
        setRBTCAddress(_wRBTCAddress);
        setDOCAddress(_docAddress);
        setV1PoolOracleAddress(_v1PoolOracleAddress);
        setBaseCurrency(_baseCurrency);
    }

    function latestAnswer() external view returns (uint256) {
        IV1PoolOracle _v1PoolOracle = IV1PoolOracle(v1PoolOracleAddress);

        uint256 _price = _v1PoolOracle.latestPrice(baseCurrency);
        uint256 priceInUSD = _convertAnswerToUsd(_price);
        require(priceInUSD != 0, "price error");

        return priceInUSD;
    }

    function _convertAnswerToUsd(uint256 _valueInBTC) private view returns (uint256) {
        address _priceFeeds = msg.sender;

        uint256 precision = IPriceFeeds(_priceFeeds).queryPrecision(wRBTCAddress, docAddress);
        uint256 valueInUSD = IPriceFeeds(_priceFeeds).queryReturn(
            wRBTCAddress,
            docAddress,
            _valueInBTC
        );

        return valueInUSD.mul(precision).div(1e18);
    }

    function setV1PoolOracleAddress(address _v1PoolOracleAddress) public onlyOwner {
        require(Address.isContract(_v1PoolOracleAddress), "_v1PoolOracleAddress not a contract");
        IV1PoolOracle _v1PoolOracle = IV1PoolOracle(_v1PoolOracleAddress);
        address liquidityPool = _v1PoolOracle.liquidityPool();
        require(
            ILiquidityPoolV1Converter(liquidityPool).reserveTokens(0) == wRBTCAddress ||
                ILiquidityPoolV1Converter(liquidityPool).reserveTokens(1) == wRBTCAddress,
            "one of the two reserves needs to be wrbtc"
        );
        v1PoolOracleAddress = _v1PoolOracleAddress;
        emit SetV1PoolOracleAddress(v1PoolOracleAddress, msg.sender);
    }

    function setRBTCAddress(address _wRBTCAddress) public onlyOwner {
        require(_wRBTCAddress != address(0), "wRBTC address cannot be zero address");
        wRBTCAddress = _wRBTCAddress;
        emit SetWRBTCAddress(wRBTCAddress, msg.sender);
    }

    function setDOCAddress(address _docAddress) public onlyOwner {
        require(_docAddress != address(0), "DOC address cannot be zero address");
        docAddress = _docAddress;
        emit SetDOCAddress(_docAddress, msg.sender);
    }

    function setBaseCurrency(address _baseCurrency) public onlyOwner {
        require(_baseCurrency != address(0), "Base currency address cannot be zero address");
        baseCurrency = _baseCurrency;
        emit SetBaseCurrency(_baseCurrency, msg.sender);
    }
}
