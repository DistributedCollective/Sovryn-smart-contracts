pragma solidity 0.5.17;

/** Mock medianizer contract that will support for MoC medianizer interface to be used for testnet */
contract MockMoCMedianizer {
    uint256 public price;

    constructor(uint256 _price) public {
        price = _price;
    }

    /**
     * @dev set mock price
     * @param _price new price
     */
    function setPrice(uint256 _price) external {
        price = _price;
    }

    /**
     * @dev returning fixed price of rbtc (e.g: 100k)
     * @return value value price of rbtc
     * @return hasValue flag that is indicating the price is working or not
     */
    function peek() external view returns (bytes32 value, bool hasValue) {
        return (bytes32(price), true);
    }
}
